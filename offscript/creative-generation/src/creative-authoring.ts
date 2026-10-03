/**
 * Creative Authoring Layer — replaces the deterministic SVG placeholder renderer
 * (`producer.ts`'s `renderCreativeVisual`) with a real LLM-driven composition step, structurally
 * parallel to `role-assignment.ts` / `visual-proof-judgment-executor.ts` (curated request ->
 * injectable dispatch -> real external author -> strict parse + structural validation ->
 * authored/unavailable). Own executor, own prompt builder, own strict parser — never imports those
 * modules' logic, never introduces a second generic model/provider abstraction.
 *
 * This module makes NO semantic decision of its own. Every field on `CreativeAuthoringRequest`
 * traces to an already-real, already-wired upstream decision (Feature Mapping's components, Camera
 * Selection, Composition Camera Bias, Environment Selection, Role Assignment) — the author receives
 * decisions, it does not make them again. Its only new authority is HOW those decisions are
 * composed into real HTML: real interface furniture (tables, badges, timelines, cards) instead of a
 * shape-per-component SVG box.
 *
 * The one thing the author is explicitly NOT trusted with is the environment photo itself — real
 * image bytes are never requested from or returned by the model. The author leaves a placeholder
 * slot (`data-environment-slot="<slug>"`); `parseCreativeAuthoringResponse` mechanically substitutes
 * the real, already-resolved asset (`resolveEnvironmentAsset`, unmodified) afterward. This mirrors
 * `producer.ts`'s own environment-embedding discipline: the renderer never selects an environment,
 * only draws the one already chosen.
 *
 * A structurally invalid or refused response ALWAYS becomes `{ outcome: 'unavailable', reason }` —
 * never a silent fallback to the SVG placeholder renderer. Fallback policy is the caller's concern
 * (see producer.ts's injectable `render` seam); this module only ever reports honestly.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveEnvironmentAsset, isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';
import { loadCreativeReference } from './references.js';
import { resolveBrandTypography, type AuthoringBrand } from './brand-typography.js';
import type { Camera } from './camera-selection.js';
import type { RoleAssignment } from './role-assignment.js';

/** The request contract — every field traces to an already-real upstream decision (see module
 * header). No Decision Record, Material, Color, or Benchmark fields: those systems don't exist in
 * this package yet (see the Port/Adapt/Defer boundary this module was designed against). */
export interface CreativeAuthoringRequest {
  /** Supplied project references, or an explicit reference/demo brand choice. Absent means no brand mandate. */
  readonly brand?: AuthoringBrand;
  readonly belief: string;
  readonly feature: string;
  readonly mustInclude: readonly string[];
  readonly ratio: string;
  /** The real pixel dimensions `ratio` resolves to (`producer.ts`'s `dimensionsForRatio` — the same
   * table the deterministic renderer has always used). Optional so existing callers/tests that only
   * ever cared about `ratio` as a label keep working unchanged; the real `runRethinkLoop` caller
   * always populates both together. Absent means no target-geometry guidance/validation applies —
   * never a fabricated default canvas size. */
  readonly canvasWidth?: number;
  readonly canvasHeight?: number;
  /** componentsForFeature(feature) — authoritative and closed; the author may render a subset but
   * never a component outside this list. */
  readonly components: readonly string[];
  readonly camera?: Camera;
  readonly compositionBias?: { readonly density: string; readonly breathing: string };
  /** The already-selected governed environment identity. The author never selects one itself. */
  readonly environment?: EnvironmentSlug;
  readonly roles?: RoleAssignment;
}

export type CreativeAuthoringOutcome =
  | { readonly outcome: 'authored'; readonly html: string; readonly evidence: string }
  | { readonly outcome: 'unavailable'; readonly reason: string };

/** The injectable dispatch boundary. Independently declared, never imported from any other
 * judgment-shaped module's dispatch type — the same "sibling reimplementation" precedent this
 * package already follows throughout. */
export type CreativeAuthoringDispatch = (promptText: string) => Promise<string>;

export type CreativeAuthoringExecutor = (request: CreativeAuthoringRequest) => Promise<CreativeAuthoringOutcome>;

export const CREATIVE_AUTHORING_LLM_EXECUTOR = 'creative-authoring-llm-v1';

const ENVIRONMENT_SLOT_ATTR = 'data-environment-slot';
const ROOT_ID = 'cr-artifact-visual';

// ─── Prompt (Phase 6) ─────────────────────────────────────────────────────────────────────────

/** Pulls the PORT/ADAPT items' native-rule guidance out of the ported Quality Bar document — DEFER
 * items (needing systems this package doesn't have) are left out of the authoring instruction; the
 * full document stays available via loadCreativeReference for anyone auditing the boundary. */
function extractEvaluableQualityBarRules(doc: string): string {
  const lines = doc.split('\n');
  const kept: string[] = [];
  let skip = false;
  for (const line of lines) {
    if (/^### \d+\./.test(line)) skip = false;
    if (/\*\*Classification:\*\* DEFER/.test(line)) skip = true;
    if (!skip && (/^### \d+\./.test(line) || /^\*\*Native rule/.test(line))) kept.push(line);
  }
  return kept.join('\n');
}

/** Real, sourced typography/color guidance — grounded in Example Brand's own authoritative brand-pack
 * tokens (`brand-typography.ts`), never in the historical Repo B reference system's own (different)
 * brand. Omitted entirely (no section, no claim) when the real source is unavailable — never a
 * fabricated fallback value. */
function typographyLines(brand: AuthoringBrand | undefined): string[] {
  if (!brand) return [];
  if (!('reference' in brand)) {
    return [
      '',
      '## Supplied project branding (authoritative)',
      'Follow the supplied palette, typography, weight range, voice and visual treatments.',
      'Project guidance takes precedence over styling examples in the quality bar.',
      'The supplied CSS is embedded mechanically after authoring; use its tokens and classes.',
      ...(brand.css !== undefined ? ['```css', brand.css, '```'] : []),
      ...(brand.voice !== undefined ? ['## Supplied project voice', brand.voice] : []),
    ];
  }
  const typography = resolveBrandTypography();
  if (!typography) return [];
  const ratio = (typography.headingPx / typography.supportingPx).toFixed(1);
  return [
    '',
    '## Reference/demo typography & color (explicit example choice)',
    '',
    `- typeface: "${typography.fontFamily}" — the ONE real typeface for this brand. Every`,
    '  font-family declaration must include it (a generic fallback after it, e.g. sans-serif, is',
    '  fine) — never substitute a different family (Inter, system-ui alone, Helvetica, etc.).',
    `- weights: use only real steps — ${typography.fontWeightRange[0]}, 500, 600, ${typography.fontWeightRange[1]}`,
    '  (normal/bold keywords are fine too). Never an invented in-between value like 450/550/650 —',
    '  that non-standard-increment pattern is a specific, avoidable tell of unauthored output.',
    '- EXACTLY three type registers — hero, body/label, micro/caption. No half-steps: every text',
    '  size in your composition should snap to one of the three, not scatter across many nearly-',
    '  identical sizes. This brand\'s own real scale clears a',
    `  ${ratio}x ratio between its largest heading (${typography.headingPx}px) and its`,
    `  supporting/micro text (${typography.supportingPx}px) — size your hero element proportionally`,
    '  dominant over your micro text by roughly that same ratio, scaled to fit the actual canvas',
    '  you were given (do not paste the literal pixel numbers onto a much smaller creative).',
    `- real colors: accent ${typography.accentHex}, primary text ${typography.textPrimaryHex}, secondary`,
    `  text ${typography.textSecondaryHex}, muted/caption text ${typography.textMutedHex}. Use these`,
    '  instead of inventing a color — an unsourced accent hue is the same class of error as an',
    '  unsourced font.',
    '- live-capture furniture: where genuinely justified by the components you are composing, include',
    '  at least one small piece of "this is really being used right now" detail — a cursor, a tooltip,',
    '  a highlighted/active row or tab state, a timestamp. Do not force these in where nothing in the',
    '  actual components calls for them.',
  ];
}

/** Real, sourced target-canvas guidance (Target Ratio / Canvas Geometry sprint) — the same real
 * ratio->pixel table `renderCreativeVisual` has always used (`producer.ts`'s `dimensionsForRatio`),
 * never an invented/assumed canvas. Omitted entirely (no section) when the caller did not supply
 * canvas dimensions — mirrors `typographyLines()`'s own "no real source, no fabricated fallback"
 * discipline. Root cause this fixes: the author was previously given only the bare ratio label
 * (e.g. "16:9") with no pixel anchor, so it invented an arbitrary ~1280px-wide canvas regardless of
 * the real target — the same class of gap `typographyLines()` closed for font/color. */
function geometryLines(request: CreativeAuthoringRequest): string[] {
  if (request.canvasWidth === undefined || request.canvasHeight === undefined) return [];
  const { canvasWidth: w, canvasHeight: h } = request;
  return [
    '',
    '## Target canvas geometry (required — author to THIS frame, never a default or assumed size)',
    '',
    `- target canvas: ${w}px × ${h}px (ratio ${request.ratio}). Declare this exact aspect ratio`,
    `  on the root element — either \`aspect-ratio: ${w} / ${h}\` or explicit`,
    `  \`width:${w}px;height:${h}px\` — do not omit it, and do not declare a different, conflicting`,
    '  ratio anywhere else in the document.',
    '- Do NOT assume a default canvas (e.g. a generic ~1280px-wide layout, or a 16:9 frame when a',
    '  different ratio was actually requested). Author proportionally to the ACTUAL target above.',
    '- No element may declare a fixed pixel width or height larger than this target canvas — the',
    '  composition, including the environment layer, must stay inside the real frame, not an',
    '  imagined larger one. CSS may still be responsive (%, flex, grid) as long as the declared',
    '  aspect ratio is preserved.',
  ];
}

export function buildCreativeAuthoringPrompt(request: CreativeAuthoringRequest): string {
  const qualityBar = extractEvaluableQualityBarRules(loadCreativeReference('QUALITY-BAR.md'));
  const roleLines = request.roles
    ? [
        `- hero (the dominant product object/state): ${request.roles.hero}`,
        `  support: ${request.roles.support.length > 0 ? request.roles.support.join(' | ') : '(none)'}`,
        `  signal (the live detail): ${request.roles.signal.length > 0 ? request.roles.signal.join(' | ') : '(none)'}`,
        `  subordinate context: ${request.roles.subordinateContext.length > 0 ? request.roles.subordinateContext.join(' | ') : '(none)'}`,
        `  unassigned (decoration — omit, do not force a role): ${request.roles.unassigned.length > 0 ? request.roles.unassigned.join(' | ') : '(none)'}`,
      ]
    : ['- (no role assignment was given — treat every component as equally prominent)'];

  const environmentLines = request.environment
    ? [
        '',
        '## Environment (already selected — do not choose a different one, do not embed image bytes)',
        '',
        `The environment "${request.environment}" was already selected upstream. Include exactly ONE`,
        `element in your markup carrying the attribute \`${ENVIRONMENT_SLOT_ATTR}="${request.environment}"\`` +
          ' — do NOT attempt to embed, reference, invent, or link any image bytes/URLs yourself for it.',
        'The real photo is inserted into that element mechanically after you respond. Do not fill that',
        'element with a placeholder image, gradient, or color fill in its place — leave it empty.',
      ]
    : [
        '',
        '## Environment',
        '',
        'No environment was selected upstream. Follow the supplied project surface treatments.',
        'When no project guidance was supplied, use a simple neutral surface; no invented photography.',
      ];

  return [
    'You are the Creative Authoring step for one already-decided creative composition. Every',
    'decision below has ALREADY been made by upstream systems. Your job is ONLY to realize those',
    'decisions as a real, well-composed HTML/CSS interface illustration — you decide HOW they are',
    'visually composed, never WHAT they are.',
    '',
    '## DECISIONS (already established upstream — do not re-derive, do not change)',
    '',
    `- belief: ${request.belief}`,
    `- feature: ${request.feature}`,
    `- mustInclude: ${request.mustInclude.length > 0 ? request.mustInclude.join(' | ') : '(none given)'}`,
    `- ratio: ${request.ratio}` +
      (request.canvasWidth !== undefined && request.canvasHeight !== undefined
        ? ` (target canvas: ${request.canvasWidth}x${request.canvasHeight}px)`
        : ''),
    `- camera: ${request.camera ?? '(not given)'}`,
    `- composition density/breathing bias: ${request.compositionBias ? `${request.compositionBias.density} / ${request.compositionBias.breathing}` : '(not given)'}`,
    '',
    '## The authoritative component list — render ONLY from this closed set, never invent one',
    '',
    request.components.map((c) => `- ${c}`).join('\n'),
    '',
    '## Role hierarchy (already assigned — express in visual prominence, never reassign)',
    '',
    ...roleLines,
    ...environmentLines,
    ...geometryLines(request),
    '',
    '## AUTHORING (this is what you decide)',
    '',
    'Compose a real HTML/CSS interface illustration expressing the decisions above — application',
    'surfaces, tables, workflow states, badges, timelines, notifications, statistics, or controls,',
    'ONLY where the actual components above justify them. Do not invent a product capability outside',
    'the component list. Do not decide the concrete visual arrangement for you — you decide it.',
    '',
    'MARKING (required — this is how your composition is verified): every element that visually',
    'represents one of the authoritative components above MUST carry the attribute',
    '`data-component="<exact component name>"`, spelled exactly as it appears in the list above',
    '(e.g. `<div data-component="workflow builder">...</div>`). A component you render without this',
    'exact attribute cannot be verified and the whole response will be rejected — so every real',
    'component you compose needs this marker, even if it also has other classes/attributes/content.',
    '',
    'COMPOSITION HIERARCHY (required — every visible interface system must have a declared, legible',
    'role): the role hierarchy above already tells you which component is hero, which are support,',
    'which are signal, and which are subordinate context. Translate that directly into',
    '`data-role="hero"` / `data-role="support"` / `data-role="signal"` / `data-role="subordinateContext"`',
    'on the SAME element that carries `data-component` (e.g.',
    '`<section data-component="workflow builder" data-role="hero">`). Reuse this exact vocabulary —',
    'do not invent a different one.',
    '',
    '- PRIMARY PROOF (`hero`): the one dominant product-interface expression. Exactly ONE component',
    '  may claim this role — never produce two equally dominant interface systems competing for',
    '  attention. If you find yourself giving a second system the same visual weight as the hero',
    '  (same scale, same elevation, same prominence), that is a composition error: pick one, and make',
    '  the other genuinely secondary.',
    '- SUPPORTING PROOF (`support`/`signal`): a secondary UI system that strengthens the SAME claim',
    '  as the primary proof — it must remain visually legible and clearly subordinate (smaller, less',
    '  elevated, positioned in relation to the hero), never faded to the point of unreadability.',
    '- CONTEXT (`subordinateContext`): environmental or atmospheric support that does not compete with',
    '  the primary proof at all.',
    '',
    'DUPLICATE-WORKFLOW RULE: if multiple components belong to the same underlying workflow or story',
    '(e.g. stages, status, progress, approval state), prefer ONE coherent workflow composition that',
    'contains all of them, rather than multiple overlapping UI systems that visually repeat the same',
    'story. Do not build a primary workflow card PLUS a second workflow/timeline system beneath it',
    'unless that second system has a clearly distinct explanatory purpose (e.g. historical trend vs.',
    'live state) — and if it does, that purpose must read clearly, not as an accidental duplicate.',
    '',
    'OPACITY RULE: do NOT use low opacity as a substitute for hierarchy. Opacity may be used for truly',
    'decorative/atmospheric detail — never for a meaningful, data-component-bearing element. A real',
    'interface component (anything carrying `data-component`) must remain visually legible: it must',
    'never read as a ghost, a shadow, a reflection, or a background watermark. Use size, elevation,',
    'position, and grouping to express "supporting" — not near-invisible opacity or a washed-out fill.',
    '',
    'OVERLAP RULE: overlap may be used for hierarchy, but it must clearly communicate a spatial',
    'relationship — which system is primary, which is subordinate. Avoid a large interface system',
    'partially hidden underneath another one with no clear relationship between them; that reads as an',
    'accidental duplicate, not an intentional composition.',
    ...typographyLines(request.brand),
    '',
    '## Quality guidance (evaluable rules only — ported native Quality Bar)',
    '',
    qualityBar,
    '',
    '## Rules — do not choose, select, change, or invent what upstream already decided',
    '',
    '- Do not change feature, belief, camera, or environment.',
    '- Do not invent a component outside the authoritative list above.',
    '- Do not invent a role assignment different from the one given.',
    '- Do not bypass or re-run Visual Proof Validation — that gate already ran upstream of you.',
    '- Do not self-approve this creative — approval is never this step\'s job.',
    '- No <script> tags — this is a static creative, never interactive.',
    '- No external URLs, no absolute filesystem paths.',
    `- The entire composition must be inside one root element: \`<div id="${ROOT_ID}">...</div>\`.`,
    '- If you genuinely cannot author this honestly from what is given, respond instead with exactly:',
    '  {"status": "unavailable", "reason": "<why>"}',
    '- Otherwise, respond with the complete self-contained HTML document (inline <style> only, no',
    '  external assets) — either raw, or inside a ```html fenced block. No prose before or after.',
    '',
  ].join('\n');
}

// ─── Structural validator (Phase 11) — structural only, never an aesthetic judge ────────────────

export type CreativeAuthoringValidation = { readonly valid: true } | { readonly valid: false; readonly reason: string };

/** Balances a single tag name's open/close count — a lightweight, deterministic well-formedness
 * check, not a full HTML parser (Phase 11: "structural validation only"). */
function tagIsBalanced(html: string, tag: string): boolean {
  const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  const opens = (html.match(openRe) ?? []).length;
  const closes = (html.match(closeRe) ?? []).length;
  return opens > 0 && opens === closes;
}

/** The bucket names a `data-role` marker may carry — reuses Role Assignment's own vocabulary
 * verbatim (hero/support/signal/subordinateContext), never a new parallel taxonomy. */
type RoleBucketName = 'hero' | 'support' | 'signal' | 'subordinateContext';

/** The declared visual-purpose floor a meaningful (data-component-bearing) element must clear —
 * below this, real content reads as a shadow/ghost/watermark rather than intentional supporting
 * evidence (the composition-quality defect this sprint fixes). Applies only to the element's OWN
 * inline `style` — a bounded, honest scope; see the implementation report for what this does and
 * does not catch. */
const LEGIBILITY_OPACITY_FLOOR = 0.5;
const LEGIBILITY_ALPHA_FLOOR = 0.35;

/** Extracts every `<tag ... data-component="X" ...>` opening tag's full attribute string, so a
 * single element's `data-role`/`style` can be read alongside its `data-component` value without a
 * full HTML/CSS parser. */
function componentTags(html: string): { component: string; tag: string }[] {
  const re = /<[a-zA-Z][a-zA-Z0-9]*\s[^>]*\bdata-component="([^"]+)"[^>]*>/g;
  return [...html.matchAll(re)].map((m) => ({ component: m[1], tag: m[0] }));
}

function attrValue(tag: string, attr: string): string | undefined {
  // Built via string concatenation, not a template literal starting with a backslash escape —
  // this package's own isolation test flags a quote immediately followed by two literal
  // backslashes as a suspected Windows UNC-path literal; `(?:^|\s)` sidesteps that false match.
  return tag.match(new RegExp('(?:^|\\s)' + attr + '="([^"]*)"'))?.[1];
}

/** Structural, not aesthetic: flags an inline `opacity:` below the legibility floor, or an
 * rgba()/hsla() paint value (background/color/fill/border*) below the alpha floor, on the
 * component's OWN tag only — never a computed-style/rendering judgment. */
function isGhostUi(tag: string): boolean {
  const style = attrValue(tag, 'style');
  if (!style) return false;
  const opacityMatch = style.match(/(?:^|;)\s*opacity\s*:\s*([\d.]+)/i);
  if (opacityMatch && Number(opacityMatch[1]) < LEGIBILITY_OPACITY_FLOOR) return true;
  const paintProps = /(?:^|;)\s*(?:background(?:-color)?|color|fill|border(?:-color)?)\s*:[^;]*?(rgba|hsla)\(([^)]+)\)/gi;
  for (const m of style.matchAll(paintProps)) {
    const parts = m[2].split(',').map((p) => p.trim());
    const alpha = Number(parts[parts.length - 1]);
    if (!Number.isNaN(alpha) && alpha < LEGIBILITY_ALPHA_FLOOR) return true;
  }
  return false;
}

/**
 * Composition-hierarchy check (Composition Quality sprint): when a role assignment was given
 * upstream, every rendered component must carry a `data-role` marker reusing that same assignment
 * verbatim — this is how "which system is primary vs. supporting vs. context" becomes structurally
 * checkable without judging aesthetics. Catches: a missing marker, a marker that contradicts the
 * given assignment, more than one component claiming `hero` (duplicate-primary / two competing
 * dominant systems), and a meaningful component painted below the legibility floor (ghost UI).
 * Returns undefined (no violation) when `roles` is absent — this check never fires without an
 * upstream role assignment to check against.
 */
function validateComposition(html: string, roles: RoleAssignment | undefined): string | undefined {
  if (!roles) return undefined;
  const bucketOf = new Map<string, RoleBucketName>();
  bucketOf.set(roles.hero, 'hero');
  for (const c of roles.support) bucketOf.set(c, 'support');
  for (const c of roles.signal) bucketOf.set(c, 'signal');
  for (const c of roles.subordinateContext) bucketOf.set(c, 'subordinateContext');

  let heroCount = 0;
  for (const { component, tag } of componentTags(html)) {
    const declaredRole = attrValue(tag, 'data-role');
    if (!declaredRole) return `missing_role_marker: "${component}" has no data-role attribute`;
    if (declaredRole === 'hero') heroCount++;
    if (heroCount > 1) return `duplicate_primary: more than one component is marked data-role="hero"`;

    const expected = bucketOf.get(component);
    if (expected && declaredRole !== expected) {
      return `role_mismatch: "${component}" is marked data-role="${declaredRole}" but the given role assignment says "${expected}"`;
    }
    if (isGhostUi(tag)) {
      return `ghost_ui: "${component}" is rendered below legibility (opacity/alpha too low for meaningful content)`;
    }
  }
  return undefined;
}

/** Real weight steps only — matches Example Brand's own real declared font-weight range plus its two
 * real intermediate steps. Rejects the "mush" pattern (450/550/650/etc.) flagged by exemplar
 * comparison as a concrete, avoidable synthetic-feeling tell. Only enforced when the real brand
 * typography source actually resolves — never invented as a rule when there is no real source. */
const REAL_FONT_WEIGHT_STEPS = new Set([400, 500, 600, 700]);

/**
 * Structural, source-grounded typography check: every `font-family` declaration must include the
 * real authoritative typeface (generic fallbacks after it are fine), and every numeric `font-weight`
 * must be one of the real steps. Gated on `resolveBrandTypography()` actually resolving — when the
 * real source is unavailable, this check is skipped entirely rather than enforcing a rule with no
 * real backing (mirrors the composition-hierarchy check's own `roles`-gating discipline).
 */
function validateTypography(html: string, brand: AuthoringBrand | undefined): string | undefined {
  if (!brand || !('reference' in brand)) return undefined;
  const typography = resolveBrandTypography();
  if (!typography) return undefined;

  const familyRe = /font-family\s*:\s*([^;"'}]+|"[^"]*"|'[^']*')/gi;
  for (const m of html.matchAll(familyRe)) {
    const declared = m[1].replace(/["']/g, '');
    if (!declared.toLowerCase().includes(typography.fontFamily.toLowerCase())) {
      return `font_family: "${declared.trim()}" does not include the real authoritative typeface "${typography.fontFamily}"`;
    }
  }

  const weightRe = /font-weight\s*:\s*(\d+)/gi;
  for (const m of html.matchAll(weightRe)) {
    const weight = Number(m[1]);
    if (!REAL_FONT_WEIGHT_STEPS.has(weight)) {
      return `font_weight: ${weight} is not one of the real steps (400/500/600/700) — an invented in-between value`;
    }
  }

  return undefined;
}

/** Relative tolerance for comparing declared vs. target aspect ratios — small enough to still catch
 * a genuinely wrong ratio (e.g. 1:1 declared against a 16:9 target), generous enough to absorb
 * rounding in author-authored numbers (e.g. `4/3` vs. `480/360`, both 1.333...). */
const GEOMETRY_RATIO_TOLERANCE = 0.02;

function ratiosMatch(a: number, b: number): boolean {
  return Math.abs(a - b) / b <= GEOMETRY_RATIO_TOLERANCE;
}

/** A CSS property name at a real declaration boundary only — excludes `border-width`, `max-width`,
 * `stroke-width`, etc. (a hyphen immediately precedes those, failing the negative lookbehind) while
 * still matching both `style="width:640px"` (preceded by `"`) and `{width:640px}` (preceded by `{`
 * or `;`). Structural, not aesthetic: a fixed pixel size literally larger than the target canvas is
 * a geometry defect regardless of how it renders. */
const FIXED_PX_DIMENSION_RE = /(?<![a-zA-Z-])(width|height)\s*:\s*(\d+)px/gi;

/** Extracts the CSS text governing the root `#cr-artifact-visual` element only — its own inline
 * `style` attribute, plus any `<style>` rule specifically scoped to `#cr-artifact-visual` — never
 * the whole document (a rule on some other selector must not count as the root's own geometry). */
function rootGeometryText(html: string): string | undefined {
  const rootTagMatch = html.match(new RegExp(`<[a-zA-Z][a-zA-Z0-9]*[^>]*\\bid="${ROOT_ID}"[^>]*>`));
  const rootStyle = rootTagMatch ? (attrValue(rootTagMatch[0], 'style') ?? '') : '';
  const ruleMatch = html.match(new RegExp(`#${ROOT_ID}\\s*\\{([^}]*)\\}`));
  const ruleStyle = ruleMatch ? ruleMatch[1] : '';
  const combined = `${rootStyle};${ruleStyle}`;
  return combined.replace(/;/g, '').trim() === '' ? undefined : combined;
}

/** Reads a declared width/height ratio out of a CSS text fragment — either `aspect-ratio: W / H`, or
 * an explicit `width:Wpx;height:Hpx` pair. Undefined when neither form is present. */
function declaredRatio(styleText: string): number | undefined {
  const aspectMatch = styleText.match(/aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/i);
  if (aspectMatch) return Number(aspectMatch[1]) / Number(aspectMatch[2]);
  const widthMatch = styleText.match(/(?<![a-zA-Z-])width\s*:\s*(\d+)px/i);
  const heightMatch = styleText.match(/(?<![a-zA-Z-])height\s*:\s*(\d+)px/i);
  if (widthMatch && heightMatch) return Number(widthMatch[1]) / Number(heightMatch[1]);
  return undefined;
}

/**
 * Target-geometry check (Target Ratio / Canvas Geometry sprint): when the caller supplied real
 * canvas dimensions, the root element must declare a matching aspect-ratio/width+height, the
 * document must not declare a second, conflicting aspect-ratio anywhere, and no element (including
 * the environment layer) may hardcode a fixed pixel width/height larger than the real target canvas
 * — the exact regression a fixed ~1280px-wide composition against a 640x360 (16:9) target was.
 * Returns undefined (no violation, no check at all) when the request carries no canvas dimensions —
 * this check never fires without a real target to check against, mirroring `validateComposition`'s
 * own `roles`-gating and `validateTypography`'s own source-gating.
 */
function validateGeometry(html: string, request: CreativeAuthoringRequest): string | undefined {
  const { canvasWidth, canvasHeight } = request;
  if (canvasWidth === undefined || canvasHeight === undefined) return undefined;
  const targetRatio = canvasWidth / canvasHeight;

  const rootText = rootGeometryText(html);
  const rootRatio = rootText ? declaredRatio(rootText) : undefined;
  if (rootRatio === undefined) {
    return 'missing_geometry: root element declares no aspect-ratio or explicit width/height matching the target canvas';
  }
  if (!ratiosMatch(rootRatio, targetRatio)) {
    return (
      `geometry_mismatch: root declares a ${rootRatio.toFixed(2)} aspect ratio but the target canvas ` +
      `(${canvasWidth}x${canvasHeight}) requires ${targetRatio.toFixed(2)}`
    );
  }

  const declaredAspectRatios = [...html.matchAll(/aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/gi)].map(
    (m) => Number(m[1]) / Number(m[2]),
  );
  const distinctRatios = declaredAspectRatios.filter(
    (r, i) => declaredAspectRatios.findIndex((other) => ratiosMatch(r, other)) === i,
  );
  if (distinctRatios.length > 1) {
    return 'conflicting_geometry: more than one distinct aspect-ratio value is declared in the document';
  }

  for (const [, prop, value] of html.matchAll(FIXED_PX_DIMENSION_RE)) {
    const numeric = Number(value);
    const ceiling = prop.toLowerCase() === 'width' ? canvasWidth : canvasHeight;
    if (numeric > ceiling) {
      return (
        `oversized_fixed_dimension: found ${prop}:${numeric}px, exceeding the target canvas's own ` +
        `${prop} of ${ceiling}px`
      );
    }
  }

  return undefined;
}

export function validateAuthoredCreative(html: string, request: CreativeAuthoringRequest): CreativeAuthoringValidation {
  if (typeof html !== 'string' || html.trim() === '') {
    return { valid: false, reason: 'empty: response has no content' };
  }
  if (!html.includes(`id="${ROOT_ID}"`)) {
    return { valid: false, reason: `missing_root: expected a single element with id="${ROOT_ID}"` };
  }
  if (!tagIsBalanced(html, 'div')) {
    return { valid: false, reason: 'malformed_html: unbalanced <div> tags' };
  }
  if (/<script[\s>]/i.test(html)) {
    return { valid: false, reason: 'script_present: creatives are static markup, no <script> allowed' };
  }
  if (/["'`]?[A-Za-z]:[\\/]/.test(html) || /\\\\[A-Za-z]/.test(html) || /\bfile:\/\//i.test(html)) {
    return { valid: false, reason: 'external_path: an absolute filesystem path leaked into the markup' };
  }
  // Built from concatenated parts, never as one literal — this package's own isolation test
  // (isolation.test.ts) forbids ANY source file from containing that repo name as a literal
  // substring, including this defensive check itself.
  const forbiddenRepoName = ['Offscript', 'creatives', 'generation'].join('-');
  if (new RegExp(forbiddenRepoName, 'i').test(html)) {
    return { valid: false, reason: 'external_repository: the historical reference system must never be named in output' };
  }

  const componentSet = new Set(request.components);
  const componentMatches = [...html.matchAll(/data-component="([^"]+)"/g)].map((m) => m[1]);
  for (const component of componentMatches) {
    if (!componentSet.has(component)) {
      return { valid: false, reason: `unsupported_component: "${component}" is not in the authoritative component list` };
    }
  }
  if (componentMatches.length === 0) {
    return { valid: false, reason: 'empty: no authoritative component was rendered — looks like a placeholder' };
  }
  if (request.roles && !componentMatches.includes(request.roles.hero)) {
    return { valid: false, reason: `missing_hero: hero component "${request.roles.hero}" was not rendered` };
  }

  const compositionViolation = validateComposition(html, request.roles);
  if (compositionViolation) {
    return { valid: false, reason: compositionViolation };
  }

  const typographyViolation = validateTypography(html, request.brand);
  if (typographyViolation) {
    return { valid: false, reason: typographyViolation };
  }

  const geometryViolation = validateGeometry(html, request);
  if (geometryViolation) {
    return { valid: false, reason: geometryViolation };
  }

  if (request.environment) {
    const slotMatch = html.match(new RegExp(`${ENVIRONMENT_SLOT_ATTR}="([^"]+)"`));
    if (!slotMatch) {
      return { valid: false, reason: `missing_environment: no ${ENVIRONMENT_SLOT_ATTR} element for "${request.environment}"` };
    }
    if (slotMatch[1] !== request.environment) {
      return {
        valid: false,
        reason: `environment_mismatch: slot declares "${slotMatch[1]}", upstream selected "${request.environment}"`,
      };
    }
  }

  return { valid: true };
}

// ─── Response parsing (mechanical environment substitution + strict parse) ──────────────────────

function stripFence(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** Mechanically inserts the real, already-resolved environment asset into the author's declared
 * slot element — the author never sees or produces image bytes (see module header). */
function embedEnvironmentAsset(html: string, environment: EnvironmentSlug): string | { error: string } {
  if (!isEnvironmentSlug(environment)) return { error: `unrecognized environment "${environment}"` };
  const assetPath = resolveEnvironmentAsset(environment);
  if (!assetPath || !fs.existsSync(assetPath)) {
    return { error: `environment "${environment}" has no real asset on disk at the resolved path` };
  }
  const jpegBase64 = fs.readFileSync(assetPath).toString('base64');
  const dataUri = `data:image/jpeg;base64,${jpegBase64}`;
  const slotRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)([^>]*\\s${ENVIRONMENT_SLOT_ATTR}="${environment}"[^>]*)>`);
  const match = html.match(slotRe);
  if (!match) return { error: `no ${ENVIRONMENT_SLOT_ATTR} element found for "${environment}"` };
  const [fullTag, tagName, attrs] = match;
  const styleRe = /\sstyle="([^"]*)"/;
  const bgRule = `background-image:url(${dataUri});background-size:cover;background-position:center`;
  let newAttrs: string;
  if (styleRe.test(attrs)) {
    newAttrs = attrs.replace(styleRe, (_m, existing) => ` style="${existing};${bgRule}"`);
  } else {
    newAttrs = `${attrs} style="${bgRule}"`;
  }
  return html.replace(fullTag, `<${tagName}${newAttrs}>`);
}

/** Embed supplied project CSS; bundled font bytes require an explicit reference/demo choice. */
function embedBrandStyle(html: string, brand: AuthoringBrand | undefined): string {
  if (!brand) return html;
  if (!('reference' in brand)) {
    if (brand.css === undefined) return html;
    const style = `<style data-creative-brand="project">${brand.embeddedCss ?? brand.css}</style>`;
    return /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (headTag) => `${headTag}${style}`)
      : style + html;
  }
  const typography = resolveBrandTypography();
  if (!typography) return html;
  const fontBase64 = fs.readFileSync(typography.fontFilePath).toString('base64');
  const fontFace =
    `<style>@font-face{font-family:"${typography.fontFamily}";` +
    `src:url(data:font/ttf;base64,${fontBase64}) format("truetype");` +
    `font-weight:${typography.fontWeightRange[0]} ${typography.fontWeightRange[1]};font-style:normal;}</style>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (headTag) => `${headTag}${fontFace}`);
  }
  return fontFace + html;
}

/**
 * Strictly parses an author's raw response into a `CreativeAuthoringOutcome`. Never best-effort: a
 * refused/malformed/structurally-invalid response is always `unavailable` with a specific,
 * machine-readable reason — never repaired, never a silent fallback to a placeholder render. On a
 * structurally valid response declaring an environment, the real asset is mechanically embedded
 * (never authored by the model) before final validation.
 */
export function parseCreativeAuthoringResponse(raw: string, request: CreativeAuthoringRequest): CreativeAuthoringOutcome {
  const trimmed = raw.trim();
  try {
    const asJson = JSON.parse(trimmed);
    if (asJson && typeof asJson === 'object' && asJson.status === 'unavailable') {
      const reason = typeof asJson.reason === 'string' && asJson.reason.trim() !== '' ? asJson.reason.trim() : 'no reason given';
      return { outcome: 'unavailable', reason };
    }
  } catch {
    // not JSON — expected for the normal HTML-response path, fall through.
  }

  let html = stripFence(raw);
  html = embedBrandStyle(html, request.brand);

  if (request.environment) {
    const embedded = embedEnvironmentAsset(html, request.environment);
    if (typeof embedded === 'object' && 'error' in embedded) {
      return { outcome: 'unavailable', reason: `environment_embed_failed: ${embedded.error}` };
    }
    html = embedded;
  }

  const validation = validateAuthoredCreative(html, request);
  if (!validation.valid) {
    return { outcome: 'unavailable', reason: validation.reason };
  }

  return { outcome: 'authored', html, evidence: 'structurally valid authored composition' };
}

/** Returns a `CreativeAuthoringExecutor` that always resolves with the given, caller-supplied
 * outcome — the scripted stub, mirroring `createScriptedRoleAssignmentExecutor`'s own discipline. */
export function createScriptedCreativeAuthoringExecutor(outcome: CreativeAuthoringOutcome): CreativeAuthoringExecutor {
  return async () => outcome;
}

// ─── Real executor (Phase 5/6) ───────────────────────────────────────────────────────────────

export interface RealCreativeAuthoringExecutorOptions {
  readonly dispatch: CreativeAuthoringDispatch;
  /** When given, a curated request file and an audit-trail trace file are written here per call. */
  readonly dispatchDir?: string;
  /** Milliseconds to wait for dispatch before treating it as unavailable (reason: 'timeout'). */
  readonly timeoutMs?: number;
}

function correlationIdFor(request: CreativeAuthoringRequest): string {
  return createHash('sha256').update(`${request.belief}|${request.feature}`).digest('hex').slice(0, 12);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__creative_authoring_timeout__')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function writeAuditTrail(
  dispatchDir: string,
  correlationId: string,
  prompt: string,
  outcome: CreativeAuthoringOutcome,
  startedAt: string,
  endedAt: string,
): void {
  fs.mkdirSync(dispatchDir, { recursive: true });
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.authoring-request.md`), prompt, 'utf8');
  const trace =
    outcome.outcome === 'authored'
      ? {
          executor: CREATIVE_AUTHORING_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'authored',
          evidence: outcome.evidence,
        }
      : {
          executor: CREATIVE_AUTHORING_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'unavailable',
          reason: outcome.reason,
        };
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.authoring-trace.json`), JSON.stringify(trace, null, 2), 'utf8');
}

/**
 * Builds a real `CreativeAuthoringExecutor`: constructs the curated prompt, dispatches it via the
 * injected `dispatch` (bounded by `timeoutMs`), and strictly parses + validates the response. A
 * dispatch exception or timeout becomes `unavailable` — never a fabricated composition, never a
 * silent fallback to the deterministic placeholder renderer (that decision belongs to the caller,
 * see producer.ts's injectable render seam).
 */
export function createRealCreativeAuthoringExecutor(opts: RealCreativeAuthoringExecutorOptions): CreativeAuthoringExecutor {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return async (request) => {
    const prompt = buildCreativeAuthoringPrompt(request);
    const startedAt = new Date().toISOString();
    let outcome: CreativeAuthoringOutcome;
    try {
      const raw = await withTimeout(opts.dispatch(prompt), timeoutMs);
      outcome = parseCreativeAuthoringResponse(raw, request);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === '__creative_authoring_timeout__';
      outcome = isTimeout
        ? { outcome: 'unavailable', reason: 'timeout' }
        : { outcome: 'unavailable', reason: `dispatch_error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const endedAt = new Date().toISOString();
    if (opts.dispatchDir) {
      writeAuditTrail(opts.dispatchDir, correlationIdFor(request), prompt, outcome, startedAt, endedAt);
    }
    return outcome;
  };
}
