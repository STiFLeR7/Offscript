/**
 * Stage 3 — Generate: the house AUTHOR CONTRACT.
 *
 * The seam (authoring-seam.ts) was handing the dispatched author only
 * archetype/intent/tone/tokenRoles while instructing it to be "grounded in the
 * Example Brand house preview components and brand style" — and supplying NONE of
 * them. The collateral governance (PURPOSE + PHILOSOPHY, with the rulebooks and
 * component catalogue on disk) was loaded by buildContext and then dropped. This
 * module stops dropping it.
 *
 * `buildAuthorContract(context)` synthesizes ONE per-run shared contract from the
 * already-loaded governance + the brief. It is written once to
 * <dispatchDir>/_AUTHOR_CONTRACT.md (by createSubagentAuthor) and every per-section
 * request.md points at it — so the heavy governance is paid once, and each request
 * stays curated (a pointer + the section specifics + one archetype exemplar).
 *
 * ANTI-FRAMEWORK GUARDRAIL: this is declarative CURATION of governance the engine
 * already loads + references to on-disk gold standards — not a DSL, not a template
 * engine, not a per-bundle component library. It distils the load-bearing authoring
 * rules and routes the author to the collateral rulebooks (collateral-core /
 * README-DATA-VIZ) / component-governance / exemplars for the full text. The rules below are the DELTA that the gold standard has and the
 * thin scripted/first-pass output lacks (density, idiom range, brand furniture,
 * voice) — i.e. the quality lever, not generic prose.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { designProcessesDir, projectReferencesDir, resolveBrandContract, type Track } from '../paths.js';
import { hasProjectBrandIdentity } from './context.js';
import { loadImageryManifest } from './imagery-manifest.js';
import type { DesignContext } from './types.js';
import type { ContentShape } from './content-signal.js';

// `Archetype | string` mirrors PlanItem.archetype without importing the enum.
type Archetype = string;

/** Where the curated per-archetype exemplar fragments live, per track. */
function fragmentsDir(track: Track): string {
  return join(designProcessesDir(track), 'exemplars', 'fragments');
}

/**
 * Collateral archetype → fragment filename. Collateral archetypes are
 * CoverPage / ContentPage / StatsPage / ClosingPage; anything unrecognized
 * falls back to the content fragment (the safe default for a prose page).
 */
function collateralFragmentFile(archetype: string): string {
  switch (archetype) {
    case 'CoverPage':
      return 'cover.html';
    case 'StatsPage':
      return 'stats.html';
    case 'ClosingPage':
      return 'closing.html';
    case 'ContentPage':
    default:
      return 'content.html';
  }
}

/**
 * Website archetype → fragment filename (the 18 SECTION_INTELLIGENCE archetypes,
 * collapsed onto the curated fragment set). Returns `null` for an archetype with
 * no curated exemplar yet — selectExemplar then yields '' so the seam degrades
 * cleanly while the website fragments are curated incrementally (Phase-2 Unit B).
 */
function websiteFragmentFile(archetype: string): string | null {
  switch (archetype) {
    case 'hero':
    case 'sub-hero':
      return 'hero.html';
    case 'logo-bar':
      return 'logo-bar.html';
    case 'feature-grid':
    case 'feature-spotlight':
      return 'features.html';
    case 'process':
      return 'process.html';
    case 'metrics':
      return 'metrics.html';
    case 'testimonial':
    case 'testimonial-wall':
      return 'testimonial.html';
    case 'case-study':
      return 'case.html';
    case 'pricing':
      return 'pricing.html';
    case 'plan-comparison':
      return 'comparison.html';
    case 'faq':
      return 'faq.html';
    case 'cta-banner':
      return 'cta.html';
    case 'footer':
      return 'footer.html';
    case 'editorial':
      return 'editorial.html';
    case 'founder':
      return 'team.html';
    case 'integrations':
      return 'integrations.html';
    case 'resources':
      return 'resources.html';
    case 'contact':
      return 'contact.html';
    default:
      return null;
  }
}

/**
 * Return the curated exemplar fragment for an archetype ("match this rhythm and
 * density — do NOT clone"). Track-aware: website resolves the website archetype
 * vocabulary + fragments dir; collateral (the default) resolves the collateral
 * set — so the website path NEVER reaches a collateral fragment (track isolation).
 * Returns '' when no fragment is mapped or the file is absent, so the seam
 * degrades gracefully rather than throwing mid-run.
 */
export function selectExemplar(archetype: Archetype | string, track: Track = 'collateral'): string {
  const file =
    track === 'website'
      ? websiteFragmentFile(String(archetype))
      : collateralFragmentFile(String(archetype));
  if (!file) return '';
  const path = join(fragmentsDir(track), file);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8').trim();
}

/**
 * For a rich-family composition (RELATIONSHIP DIAGRAM / SPATIAL SYSTEM), the
 * relative path of the gold exemplar the in-session author should STUDY (never
 * clone). Deterministic pick by signal (diagram → comparison/process family else
 * the hub-spoke default; spatial → the layer-stack). Existence-checked; returns
 * '' for a non-rich composition, the website track (isolation), or an absent file
 * (graceful degrade — the author falls back to the composition prose). The path is
 * relative to the track's `exemplars/` dir, matching how the seam points at refs.
 */
export function richExemplarPointer(
  composition: string,
  signal: readonly ContentShape[],
  track: Track = 'collateral',
): string {
  if (track !== 'collateral') return '';
  let rel = '';
  if (/RELATIONSHIP DIAGRAM/.test(composition)) {
    rel = signal.includes('comparison')
      ? 'diagrams/comparison.html'
      : signal.includes('process')
        ? 'diagrams/process.html'
        : 'diagrams/hub-spoke.html';
  } else if (/SPATIAL SYSTEM/.test(composition)) {
    rel = 'spatial/layer-stack.html';
  }
  if (!rel) return '';
  const abs = join(designProcessesDir(track), 'exemplars', rel);
  return existsSync(abs) ? rel : '';
}

/**
 * Option 1 — content-routed study pointer (NOT flagship-gated).
 *
 * The flagship-only `richExemplarPointer` left the diagram/spatial corpus invisible
 * to every non-flagship rich-content page (the APA runtime showed 17 diagrams + 11
 * spatial exemplars never surfaced). This resolves the SINGLE best-matched governed
 * exemplar for ANY collateral section whose content-signal warrants a rich visual,
 * keyed on the content shape (not the composition string) so it fires whenever the
 * brief substance is relational/spatial — surfacing a precise pointer instead of a
 * directory. Still pure routing: it returns an on-disk path to STUDY, never inlines
 * the fragment. Existence-checked; '' for website (isolation), generic shapes, or an
 * absent file (graceful degrade). The path is relative to the track's `exemplars/`.
 *
 * W54 — Data Visualization parity: a stats-only signal now routes to the governed
 * data-viz exemplar corpus (`exemplars/data-visualization/`) at the LOWEST priority
 * (below spatial and diagram/process/comparison — unchanged), matching the same
 * spatial > diagram > chart precedence PresentationIntent.classify() already holds.
 * The default pick (`benchmark-bars.html`) is the FIRST entry in README-DATA-VIZ §8's
 * own "prefer the simplest" chart-selection hierarchy (bar chart) — not an invented
 * heuristic; the content signal doesn't discriminate further (bar/line/donut/table),
 * exactly like the existing 'diagram'-only case already defaults to the generic
 * hub-spoke exemplar without discriminating further.
 */
export function routedStudyPointer(signal: readonly ContentShape[], track: Track = 'collateral'): string {
  if (track !== 'collateral') return '';
  const has = (s: ContentShape): boolean => signal.includes(s);
  let rel = '';
  // Spatial wins over diagram (a system illustration is the stronger, rarer cue);
  // chart is the lowest priority, matching classify()'s spatial > diagram > chart order.
  if (has('spatial')) rel = 'spatial/layer-stack.html';
  else if (has('process')) rel = 'diagrams/process.html';
  else if (has('comparison')) rel = 'diagrams/comparison.html';
  else if (has('diagram')) rel = 'diagrams/hub-spoke.html';
  else if (has('stats')) rel = 'data-visualization/benchmark-bars.html';
  if (!rel) return '';
  const abs = join(designProcessesDir(track), 'exemplars', rel);
  return existsSync(abs) ? rel : '';
}

/**
 * Option 2 — the routed intelligence CLASS for a section (what the application rail checks).
 * Derived from the same content-signal that drives `routedStudyPointer`, so the stamp and
 * the pointer can never disagree. Returns the class family name (not a specific component):
 *   'spatial' → a layered/iso system illustration · 'diagram' → a relational/flow visual ·
 *   'chart' → a data visualization / metric visualization (README-DATA-VIZ).
 * '' when no rich-visual class is routed (the rail then makes no demand on the section).
 *
 * W54 — Data Visualization parity: adds the 'chart' branch (stats signal) at the same
 * priority 'chart' already holds in PresentationIntent.classify() (presentation-intent.ts)
 * — spatial, then diagram/process/comparison, then chart — so this function and
 * PresentationIntent's own classification can never disagree.
 */
export function routedClassFor(signal: readonly ContentShape[]): '' | 'diagram' | 'spatial' | 'chart' {
  if (signal.includes('spatial')) return 'spatial';
  if (signal.includes('process') || signal.includes('comparison') || signal.includes('diagram'))
    return 'diagram';
  if (signal.includes('stats')) return 'chart';
  return '';
}

// ── Per-page composition assignment (anti-monotony) ─────────────────────────────
// 14 independent cold authors given one exemplar all default to the SAME layout
// (headline + 3 list-rows + band) → the deck reads as one template repeated. The fix:
// assign each page a DISTINCT lead composition, rotated by its index among same-archetype
// items, so consecutive pages differ. The author MUST build around the assigned layout.

/**
 * WS5 — spatial-hero cover variant. Selected by plan.ts (not the rotation) when the
 * whole deck reads system/architecture-heavy, replacing the standard editorial COVER.
 * Same dark-bleed framing rules as COVER (the engine wraps it bleed+dark), but the hero
 * is an authored isometric/layered system illustration — the visual anchor.
 */
export const SPATIAL_HERO_COVER =
  'SPATIAL HERO COVER — dark navy editorial cover whose HERO is an authored isometric/layered system illustration (`.cr-graphic`, inline SVG) sitting behind or beside the headline. The engine wraps the cover in a full-bleed dark page (`cr-page--bleed cr-page--dark`), so the navy already reaches the edge — do NOT use position:absolute/inset:0 and do NOT set your own page-filling background. Author a `min-height:100%;box-sizing:border-box` root with your OWN inner padding (~14–16mm): eyebrow → oversized `.cr-display-xl` headline → sub-line, with the system illustration as the anchoring visual (layer-stack / operating-model / ecosystem). Labels legible, accent/tonal fills, never navy data marks. White text (`--fg-inverse`). The illustration must stay within the page box (a4-bounds still FAILS on overflow).';

/** ContentPage lead-composition rotation — each is a distinct house layout. */
const CONTENT_COMPOSITIONS: string[] = [
  'NUMBERED EDITORIAL LIST — a `.cr-list-row` set of 3–4 hairline-ruled rows (number | label | body). Lead with the list; one supporting band after it.',
  'ICON-FEATURE GRID — 3 features, each a `.cr-icon-chip tone-periwinkle` (inline-SVG glyph) + title + one line, as a row stack OR a `.cr-grid .cr-cols-3` peer set. NOT numbered rows.',
  'TWO-COLUMN COMPARISON — one `.cr-data-group` with an internal 2-column contrast (this vs that / before vs after), a few paired rows. NOT a list.',
  'STAT-CARD GRID — a `.cr-grid .cr-cols-2` 2×2 of `.cr-stat-card tone-periwinkle` (dark numeral + label + sub), one card per point. Numerals dark, ≤4 glyphs.',
  'CHECKLIST — a `.cr-checklist` of 4–6 proof points (`.cr-check`, currentColor marker), optionally `--cols-2`. A scannable qualification/proof list, not numbered rows.',
  'STATEMENT-LED — an oversized `.cr-display` statement (one big idea, airy) + a short supporting paragraph or a single `.cr-band`. Lead with scale and whitespace; minimal components.',
  'INLINE-SVG DIAGRAM — a small hand-authored diagram or flow (`.cr-graphic`, ≤40mm tall: a 2–3 node flow, a cycle, or a labelled relationship) + a one-line caption + a short framing intro.',
  'PULL-QUOTE — a `.cr-quote` (navy `.cr-band--dark` band, the sanctioned pull-statement) as the hero, + a short lead-in or attribution. NOT a callout box.',
  // 8 — rich relationship/architecture diagram (flagship-eligible; full inline-SVG, NOT the ≤40mm inline one)
  'RELATIONSHIP DIAGRAM — a substantial hand-authored inline-SVG diagram (`.cr-graphic`) that shows the actual relationship in the prose: a hub-and-spoke, an architecture/box-and-edge map, a comparison, or a maturity ladder. The diagram is the page HERO, not a ≤40mm aside. Study the matching gold exemplar pointed to in your request; author your OWN labelled version, on-palette, accent edges, dark legible labels. One framing line above it.',
  // 9 — spatial / system illustration (flagship-eligible)
  'SPATIAL SYSTEM — a layered/isometric system illustration (`.cr-graphic`): a layer-stack, an operating-model frame, or an ecosystem of interacting parts, authored as inline SVG. The illustration carries the page. Study the matching spatial exemplar pointed to in your request; author your OWN, never clone. Dark legible labels, accent/tonal fills, never navy data marks.',
];

/** StatsPage lead-composition rotation — distinct stat/chart treatments. */
const STATS_COMPOSITIONS: string[] = [
  'STAT LEDGER — a `.cr-stat-ledger` (3–4 rows, label beside numeral, hairline-ruled) as the lead, optionally a one-line takeaway band.',
  'METRICS WALL — a `.cr-stat-wall` (3-up numeral-over-caption, hairline-ruled) + ONE doc-scoped chart (`.viz-*`, ≤40mm) below it.',
  'STAT-CARD GRID — a `.cr-grid .cr-cols-2` 2×2 of `.cr-stat-card` (dark numerals) as the lead, + a short framing intro.',
  'BENCHMARK CHART — a doc-scoped subject-vs-baseline `.viz-*` bar comparison as the hero (accent bars, dark numerals) + a supporting ledger or one metric.',
];

/** Content shapes each CONTENT_COMPOSITIONS[i] serves (index-aligned with the array). */
// NOTE: 'generic' is the deriver's no-cue catch-all (content-signal returns ['generic']
// when nothing matched), so it is deliberately NOT a candidacy tag — a generic signal
// matches no composition and degrades to the FULL-set fallback below.
const CONTENT_COMPOSITION_SHAPES: ContentShape[][] = [
  ['list'],                            // 0 NUMBERED EDITORIAL LIST
  ['list'],                            // 1 ICON-FEATURE GRID
  ['comparison'],                      // 2 TWO-COLUMN COMPARISON
  ['stats'],                           // 3 STAT-CARD GRID
  ['checklist'],                       // 4 CHECKLIST
  ['statement'],                       // 5 STATEMENT-LED
  ['diagram', 'process'],              // 6 INLINE-SVG DIAGRAM
  ['quote'],                           // 7 PULL-QUOTE
  ['diagram'],                         // 8 RELATIONSHIP DIAGRAM (rich, flagship-eligible)
  ['spatial'],                         // 9 SPATIAL SYSTEM (rich, flagship-eligible)
];

/** Content shapes each STATS_COMPOSITIONS[i] serves (index-aligned). */
const STATS_COMPOSITION_SHAPES: ContentShape[][] = [
  ['stats'],               // 0 STAT LEDGER
  ['stats'],               // 1 METRICS WALL
  ['stats'],               // 2 STAT-CARD GRID
  ['comparison', 'stats'], // 3 BENCHMARK CHART
];

// Fail-fast guard: the *_COMPOSITION_SHAPES arrays are index-aligned with their
// composition arrays, but TS can't enforce equal length. A future edit to one array
// without the other would make compositionCandidatesFor() dereference shapes[i] ===
// undefined → a runtime crash. Assert at module load so any test trips it immediately.
if (
  CONTENT_COMPOSITION_SHAPES.length !== CONTENT_COMPOSITIONS.length ||
  STATS_COMPOSITION_SHAPES.length !== STATS_COMPOSITIONS.length
) {
  throw new Error(
    'author-contract: composition↔shape arrays are desynced — keep *_COMPOSITION_SHAPES ' +
      'index-aligned and equal-length with CONTENT_COMPOSITIONS / STATS_COMPOSITIONS.',
  );
}

/**
 * Candidate compositions for an archetype that serve ANY of the given content shapes,
 * in their canonical array order. Empty signal / no match → the FULL set for the
 * archetype (so the selector always has ≥1 candidate; index degrades to a tie-break).
 * Cover/Closing are singletons (their fixed treatments) → a 1-element set.
 */
export function compositionCandidatesFor(
  archetype: Archetype | string,
  signal: readonly ContentShape[],
): string[] {
  if (archetype === 'CoverPage') return [assignComposition('CoverPage', 0)];
  if (archetype === 'ClosingPage') return [assignComposition('ClosingPage', 0)];
  const arr = archetype === 'StatsPage' ? STATS_COMPOSITIONS : CONTENT_COMPOSITIONS;
  const shapes =
    archetype === 'StatsPage' ? STATS_COMPOSITION_SHAPES : CONTENT_COMPOSITION_SHAPES;
  const want = new Set(signal);
  const matched = arr.filter((_, i) => shapes[i].some((s) => want.has(s)));
  return matched.length > 0 ? matched : [...arr];
}

/**
 * Assign a distinct lead composition for a page, by archetype + its 0-based index
 * among same-archetype items. Cover/Closing are singletons with fixed treatments.
 * Deterministic (index-based) so runs are reproducible.
 */
export function assignComposition(
  archetype: Archetype | string,
  indexAmongArchetype: number,
  track: Track = 'collateral',
): string {
  // Website archetypes (hero ≠ pricing ≠ faq ≠ footer) are already heterogeneous,
  // so the "every page looks identical" failure the rotation fixes does not arise.
  // No assigned composition for website — the contract + the archetype itself carry
  // the layout intent. (Collateral's near-identical A4 pages are why it rotates.)
  if (track === 'website') return '';
  switch (archetype) {
    case 'CoverPage':
      return 'COVER — dark navy editorial. The engine wraps the cover in a full-bleed dark page (`cr-page--bleed cr-page--dark`), so the navy already reaches the page edge AND the engine paints the governed cover photo + navy scrim behind your content — do NOT use position:absolute/inset:0 and do NOT set your own page-filling background (the engine owns it; you author the content layer on top, in white). Author a `min-height:100%;box-sizing:border-box` root with your OWN inner padding (~14–16mm) to hold the content margin: eyebrow → oversized `.cr-display-xl` headline → sub-line → optionally ONE 3-up stat strip on the floor. White text (`--fg-inverse`), big type, room to breathe.';
    case 'ClosingPage':
      return 'CLOSE — a `.cr-band cr-band--dark` CTA card (within the margins, NO bleed): lede headline + body + electric `.cr-btn` + a `.cr-checklist` of ≤4 points. Flows after a short intro, not anchored into a void.';
    case 'StatsPage':
      return STATS_COMPOSITIONS[indexAmongArchetype % STATS_COMPOSITIONS.length];
    case 'ContentPage':
    default:
      return CONTENT_COMPOSITIONS[indexAmongArchetype % CONTENT_COMPOSITIONS.length];
  }
}

/**
 * Build the once-per-run shared author contract for a track.
 *
 * Track-dispatch: collateral → the A4-collateral contract; website → the
 * Example Brand-website contract (distilled from the design-team charter); deck /
 * anything else → '' (no contract; the scripted author ignores it and the
 * subagent seam writes no _AUTHOR_CONTRACT.md). Each contract is the DELTA the
 * gold standard has that thin first-pass output lacks (voice, charter, component
 * vocabulary, hard rails) — declarative curation of already-loaded governance,
 * not a DSL or a template engine (anti-framework guardrail).
 */
export function buildAuthorContract(context: DesignContext): string {
  if (hasProjectBrandIdentity(context) && context.track !== 'deck') return buildProjectAuthorContract(context);
  if (context.track === 'collateral') return buildCollateralAuthorContract(context);
  if (context.track === 'website') return buildWebsiteAuthorContract(context);
  return '';
}

/** Supplied project references govern identity; bundled examples only teach composition. */
function buildProjectAuthorContract(context: DesignContext): string {
  const { brief, track } = context;
  const productName = resolveProductName(context);
  const refs = projectReferencesDir(context.client);
  const cssPath = join(resolveBrandContract(context.client, track), 'colors_and_type.css').replaceAll('\\', '/');
  const css = readFileSync(cssPath, 'utf8');
  const cssSource = context.brandSource === 'client' ? 'Supplied CSS' : 'Fallback token CSS';
  const voiceReference = context.brandKit?.voiceReference;
  const voicePath = voiceReference ? resolve(refs, voiceReference) : join(refs, 'voice.md');
  const voice = voiceReference || existsSync(voicePath) ? readFileSync(voicePath, 'utf8').trim() : '';
  const kit = context.brandKit;
  const imageryPath = kit?.imageryManifest ? resolve(refs, kit.imageryManifest) : undefined;
  const imagery = imageryPath && existsSync(imageryPath) ? readFileSync(imageryPath, 'utf8').trim() : '';
  const assets = kit
    ? `- Kit subject: ${kit.subject}
- Mark on light surfaces: ${kit.logo.lightSurfaceMark}
- Mark on dark surfaces: ${kit.logo.darkSurfaceMark}
${kit.imageryManifest ? `- Imagery manifest: ${kit.imageryManifest} — follow its role, mode and scrim declarations.\n${imagery}\n` : '- No imagery manifest was supplied. Do not borrow sample imagery.\n'}${kit.iconography ? `- Icon convention: ${kit.iconography.convention} — use the project convention.\n` : '- No icon convention was declared; follow the brief.\n'}`
    : 'No project kit was supplied. Use the project text label and do not borrow sample marks or imagery.';
  const logoConvention = track === 'collateral'
    ? 'For an engine-embedded header mark, emit `<span class="cr-logo-mark cr-logo-mark--white"></span>` on dark surfaces or `<span class="cr-logo-mark cr-logo-mark--color"></span>` on light surfaces. The engine embeds the supplied SVG variants once. If the marks are unavailable, the engine fills these spans with the project text label. Do not draw or invent a replacement mark.'
    : 'Use supplied marks with ordinary `<img>` references appropriate to the surface; the engine inlines the files.';
  const medium = track === 'collateral' ? 'A4 collateral' : 'website';
  const geometry = track === 'collateral'
    ? 'Output the INNER content of one A4 page. The engine wraps it in `.cr-page` with 16mm padding and owns the running footer. The engine injects this footer; Do NOT author a `.cr-page-foot`. Keep content within the page box; use `box-sizing:border-box` on full-height blocks. Overflow, overlap and page wrapping must pass the render checks. Keep a consistent frame and reading order across pages, with composition and spacing suited to the content.'
    : 'Output one section fragment with the assigned anchor id as its single root. The engine joins sections into the page. Use responsive layout and document-scoped styles; preserve readable hierarchy, navigation, and meaningful interactions at narrow viewports.';
  return `# Offscript author contract — ${productName} ${medium} (READ THIS FIRST)

## Project identity and voice
The project identity, brand kit, voice guidance and brief govern this deliverable's identity.
Use their palette, typography, punctuation, headline casing, iconography and visual treatments.
Bundled reference examples are optional studies of structure and hierarchy; adapt them to this project.
When a study example differs from the supplied project guidance, follow the project guidance.
- Product: ${brief.oneLiner}
- Audience: ${brief.audience || '(follow the brief)'}
- Tone: ${brief.tone || '(follow the supplied voice guidance and audience)'}
- Must include: ${brief.mustInclude?.join('; ') || '(follow the brief)'}
${context.parentUrl ? `- Parent brand: ${context.parentUrl} — preserve its declared conventions.\n` : ''}
## ${cssSource} — ${cssPath}
Use the resolved tokens and component classes wherever they serve the content.
${context.brandSource === 'default' ? 'These are fallback layout and colour tokens; they do not make the sample brand the project identity.' : 'The project supplied this token CSS.'}
Colour and type choices must be traceable to this CSS; keep document-specific layout styles scoped.
\`\`\`css
${css}
\`\`\`

## Supplied voice${voice ? ` — ${voiceReference ?? 'voice.md'}` : ''}
${voice || 'No separate voice document was supplied. Follow the brief tone and the product audience.'}

## Project assets and iconography
All asset paths and imagery manifest pointers are relative to projects/${context.client}/references/.
${assets}
${logoConvention}
Use normal relative image references and CSS url() paths; the engine inlines project assets in both website and collateral output. Never substitute bundled sample assets for a missing project asset.

## Geometry and output
${geometry}
Output only the requested fragment, without a document shell. Keep assets self-contained.
Study any assigned composition for its communication purpose, then realize it in the project's identity.

## Communication, accessibility and factual copy
- One communication objective and a clear primary focal point per section. Keep the content complete, readable and purposeful.
- Preserve semantic landmarks, heading hierarchy, language metadata, descriptive alternatives and accessible controls.
- Maintain readable contrast for text, labels and data on every surface. Honour reduced-motion preferences; static content stays visible without JavaScript.
- Never fabricate data, metrics, testimonials, logos or quotes. Use supplied source material and label illustrative values.
- Render validation must verify bounds, overlap and visibility; a static score does not certify geometry.
`;
}

/**
 * The A4-collateral author contract. Interpolates the brief context (oneLiner /
 * tone / audience / parent) and distils the load-bearing collateral authoring
 * rules from the loaded governance, pointing the author at the full on-disk
 * governance + exemplars for everything not inlined here.
 */
function buildCollateralAuthorContract(context: DesignContext): string {
  const { brief } = context;
  const productName = resolveProductName(context);
  const audience = brief.audience?.trim() || 'senior stakeholders / executives';
  const mustInclude =
    brief.mustInclude && brief.mustInclude.length > 0
      ? brief.mustInclude.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
      : '  _(none declared — follow the brief one-liner)_';
  const parentLine = context.parentUrl
    ? `\n- **Parent brand (Rule 0):** \`${context.parentUrl}\` — inherit its palette, type, and conventions; deviations only with cause.`
    : '';

  return `# Offscript author contract — ${productName} A4 collateral (READ THIS FIRST)

Reference example: this default presentation uses the bundled Example Brand design references.
Supplied project references select the project's own author contract instead.

You are authoring **ONE page** of a multi-page A4 collateral deliverable for **${productName}**.
Output ONE self-contained HTML fragment to your assigned \`<id>.response.html\`. The engine
wraps it in \`<section class="cr-page">\` (A4, 16mm padding, square corners, \`overflow:hidden\`)
and embeds the house \`colors_and_type.css\` + fonts. You write the INNER content only.

## The flow you sit in — Creative Director → Philosophy → you (READ BOTH FIRST)
This contract is the THIRD stage of \`CREATIVE DIRECTOR → PHILOSOPHY → Offscript\`. Before authoring, read:
1. \`resources/design_processes/CREATIVE_DIRECTOR.md\` — the intent persona (What / Why / How,
   taste-not-correctness). It frames WHY this deliverable exists, who it is for, and the register to hold.
2. \`resources/design_processes/collateral/PHILOSOPHY.md\` — the medium logic for a **print-true,
   self-contained page** (content determines form; communication over decoration; a family, never a template).
The persona shapes *feel*, the philosophy shapes *structure*, the rails below enforce *correctness*. On
any conflict, the rails and brand pack win — follow them and flag the tension, never hardcode around it.

## This deliverable
- **Product (one-liner):** ${brief.oneLiner}
- **Audience:** ${audience}
- **Tone:** ${brief.tone}${parentLine}
- **Must-include (the narrative spine):**
${mustInclude}

## Voice — ${productName}'s, drawn from the brief (full conventions: resources/design_principles/voice.md)
The deliverable's voice is: **${brief.tone || '(no tone declared — infer a precise, on-brand voice from the one-liner and audience)'}**.
Write every headline and body block in that voice for **${productName}**. The points below are
house *conventions* (how a governed collateral page reads), not copy to reuse — never lift
another product's words or examples.
- **Diagnostic, not aspirational** — name the reader's real pain/cost/outcome, then the solution.
- **Second-person** about the reader's pain/cost/outcome ("**You** are paying skilled staff to do
  work that costs pennies"); **first-person plural** for ${productName} ("**We** …") — never
  first-person singular, never "users."
- **Quantify** almost every body block (dollars, hours, %, ×) with numbers from THIS product's own
  substance (never invent one). Open a page on a *named tax* on the reader, then the solution.
- **Title Case** headlines and section titles; CAPS only for the eyebrow micro-label.
- No hype, no exclamation points, no emoji.

## Density — COMPLETE, never sparse (the #1 fix)
Each page must read **complete and purposeful — neither crowded nor sparse.** A page is NOT
a single thin component floating in whitespace. Build it: a **display-scale headline**
(\`.cr-display-lg\` / \`.cr-display\`) + a **real intro paragraph** + a **lead component** +
**supporting band/strip** — filled top→bottom with a margin-rhythm cadence (~11–18mm between
blocks, see the exemplar). Use the page; do not leave the bottom third empty. (If content
truly runs short, enlarge the headline and give the lead component room — never pad with air.)

## Per-archetype density + fit budget (HARD — hits "not sparse" AND "not overflow" at once)
Calibrated so one A4 page (~178×265mm usable, ~1002px tall) reads complete without clipping.
The overflow trap is **too many stacked blocks with too much air between them** — not just
word count. **Vertical budget:** a page holds **header + headline-block + ONE lead component +
AT MOST one supporting band + foot — that is all.** Do NOT add a second content block beyond
the one band. **Inter-block gaps: 10–12mm** between major blocks (reserve 14–18mm only for an
airy 2–3-block page); do not stack 15mm gaps on a 4+ block page — that alone overflows.
- **CoverPage:** headline ≤ 10 words; sub-line 25–40 words; optionally ONE 3-up stat strip
  (captions ≤ 6 words, numerals ≤ 4 glyphs). One idea, large type, room around it.
- **ContentPage:** headline ≤ 12 words; intro 25–40 words (2–3 lines); ONE lead component of
  **exactly 3 items** (a \`.cr-list-row\` set or feature rows), each label ≤ 6 words + body
  **≤ 18 words (ONE line, never two)**; then at most ONE supporting band ≤ 18 words. **3 rows,
  not 4** — a 4th row plus a band plus a foot overflows 265mm.
- **StatsPage:** headline ≤ 10 words; intro 25–35 words; ONE stat treatment of **3–4 rows**
  (ledger/wall/cards), numerals ≤ 4 glyphs, labels ≤ 8 words; optionally ONE doc-scoped chart
  (≤ 40mm tall). One stat block plus one chart is the ceiling — never two charts, never a
  ledger AND a wall AND a chart.
- **ClosingPage:** headline ≤ 14 words; intro 25–40 words; ONE CTA band with a button + a
  \`.cr-checklist\` of **≤ 4 items, each ≤ 9 words**.
- **Flagship visual page (ONLY when your request says \`Flagship: yes\`):** this is the one
  page allowed to make a rich diagram/illustration the dominant element. Relax the ≤40mm
  inline-diagram cap — the \`.cr-graphic\` may occupy up to **~150mm tall** as the page hero,
  with a short headline + ONE framing line above it and **NO supporting band** (the visual IS
  the content). It still must not exceed the ~265mm usable box — **a4-bounds still FAILS on
  overflow**, so size the visual to fit. No other page gets this; a non-flagship diagram page
  keeps the ≤40mm inline treatment.
- **Whole-page ceiling:** total visible body copy stays roughly **90–130 words**. Under 70
  reads sparse (enlarge the headline / give the component room); **over ~140 risks the
  a4-bounds clip.** If it won't fit, CUT a row or CUT words — never shrink below the 16px floor,
  never drop \`box-sizing:border-box\` from a full-height block.
- **Size caps so "fill" never overflows (you cannot render — respect these):** "fill the page"
  means a large HEADLINE and consistent gaps, NOT oversized components. A **2×2 stat-card grid**
  must stay ≤ ~105mm total — do NOT set card \`min-height\` above ~42mm (4 cards × ~42mm + gap
  overflows fast). A **statement** display caps at ~44px. A **diagram/SVG** ≤ 40mm tall. Inter-block
  gaps stay ~12–14mm (not 18mm) once a page has 4+ blocks. When unsure, size DOWN — overflow is a
  hard fail, a little extra bottom margin is not. A page is "full enough" at ~85% height; do not
  chase 100% with bigger components.

## Compose differently every page (anti-clone) — USE YOUR ASSIGNED COMPOSITION
Same family, different composition each time. The #1 failure on a multi-page deck is **every
page looking identical** — the same headline + 3 list-rows + a tinted band, over and over. To
prevent that, your section brief below carries an **Assigned composition** — the lead layout
for THIS page (e.g. a 2-column comparison, a stat-card grid, a checklist, an inline-SVG diagram,
a pull-quote, a feature grid). **You MUST build the page around that assigned layout — do NOT
default to a numbered list.** The reference exemplar shows house QUALITY and rhythm, not the
layout to copy; follow your assigned composition, not the exemplar's structure. Also vary
headline scale/placement and tonal rhythm. Gold standards to study (read, do NOT clone):
\`resources/design_principles/exemplars/ai-strategy-integration-field-guide-v2.html\` (long-form), \`resources/design_principles/exemplars/dr-scribe-product-sheet.html\`.

## The page FRAME is the constant — vary the COMPOSITION, never the frame
Every page shares ONE frame so the document reads as a family: a \`.cr-page-header\` at the very
top (${productName} wordmark left + \`.cr-eyebrow\` section label right), and a thin running footer
**the engine injects identically on every page** at the very bottom. Between them, the body
**flows straight down from the header** with ONE consistent gap rhythm. **The composition between
the header and the (engine-owned) foot is what varies page to page — the frame never does.**

### Vertical fill — NO mid-page voids, NO bottom dead-zones (this is the #1 visual fix)
- **Only the engine's running footer may pin to the bottom.** NEVER put \`margin-top:auto\`,
  \`.cr-anchor-bottom\`, or \`justify-content:space-between\` on a CONTENT block or band — that
  shoves it to the page bottom and leaves an ugly hole in the middle. Content flows top-down.
  (You do not write the foot at all — see Brand furniture below.)
- **Fill the page top-to-bottom.** The body should occupy roughly the full column. Achieve fill
  through **scale and distributed spacing** — a large display headline, generous but CONSISTENT
  inter-block gaps (one value, ~12–16mm, repeated), and a lead component sized to carry the page
  — NOT by cramming more words and NOT by concentrating slack into one gap. Any leftover space
  is a single modest margin above the pinned foot (a clean top-loaded editorial page), never a
  gap between two content blocks.
- If a page feels empty: enlarge the headline, give the lead component more room, or add ONE
  more peer item — do not anchor a band to the floor to "balance" it.

## Brand furniture
- **Header (top):** \`.cr-page-header\` — the ${productName} **logo** (top-left) + section eyebrow
  (top-right). On every page. The logo is the REAL SVG lockup, never a text wordmark: emit
  \`<span class="cr-logo-mark cr-logo-mark--white" role="img" aria-label="${productName}"></span>\`
  on a navy/dark page (the cover) and \`cr-logo-mark--color\` on a white page. The engine embeds
  both lockups; you only reference the class.
- **Foot (bottom):** the running footer is **house furniture the engine injects** — identical on
  every page. Do NOT author a \`.cr-page-foot\`; if you emit one it is stripped and replaced. (The
  engine pins it to the bottom margin line.)
- **Icons:** monoline inline-SVG (\`stroke:currentColor;fill:none;stroke-width:1.75\`) seated in
  a circular \`.cr-icon-chip tone-periwinkle\` — never a bare icon beside copy.

## Component cheat-sheet (house classes — do NOT invent; full anatomy in resources/design_processes/collateral/component-governance/components.md; layout governance in rulebooks/collateral-core.md)
- **Numbered editorial list:** \`.cr-list-row\` (\`.cr-list-num\`/\`.cr-list-label\`/\`.cr-list-body\`).
- **Stat ledger:** \`.cr-stat-ledger\` → \`.cr-stat-line\` (label beside numeral, hairline-ruled).
- **Stat wall:** \`.cr-stat-wall\` → \`.cr-stat-row.cr-cols-2/3\` → \`.cr-stat\` (numeral over caption).
- **Stat cards:** \`.cr-grid.cr-cols-2/3\` of \`.cr-stat-card tone-periwinkle\` (value/label/sub).
- **Tonal band:** \`.cr-band\` (+ \`tone-*\`) / \`.cr-band--dark\` (navy) / \`--bleed\` (full width).
- **Quote:** \`.cr-quote\` (navy band — the sanctioned alternative to the BANNED callout box).
- **CTA:** \`.cr-cta-strip\` (simple) or a \`.cr-band--dark\` banner with a \`.cr-checklist\`.
- **Tones:** \`tone-periwinkle|sky|sage|lilac|blush|coral\` set surface + accent on any component.

## Data-viz idioms — USE THEM where data supports it (full rulebook: resources/design_processes/collateral/rulebooks/README-DATA-VIZ.md)
A numbers-heavy page should not be all text. When you have a comparison or a small dataset,
reach for a **doc-scoped \`.viz-*\` chart** in a local \`<style>\` block (charts are
per-document — NEVER add \`.viz-*\` to the shared CSS). Idioms (specimens in
\`resources/design_processes/collateral/exemplars/data-visualization/\`): **benchmark bars** (subject-vs-baseline —
the default), ring, rank, cluster, trend, donut, delta, pair, table. Rules that bind:
- **Never fabricate data.** Visualize only numbers from the brief. Mark illustrative values.
- **Data marks are accent/tonal/gradient — NEVER navy/dark.** Numerals, titles, and hairline
  axes stay dark/legible. Bars start at zero; tiny values get a min size; nice-number scales.
- A single number is a **metric visualization** (a big numeral), not a chart.

## Rich visuals — STUDY the governed exemplar corpus (do NOT clone; rebuild in the brand)
When a page's substance is **relational** (a flow, a hub-and-spoke, an architecture, a
comparison, a maturity ladder) or **spatial** (a layer-stack, an operating-model, an
ecosystem, an isometric system), the page should carry that visual — text-only is a missed
page. The house ships a realized corpus to learn from on disk; **study the structure /
composition / hierarchy, then author your OWN on-palette version with the brief's content**:
- **Diagrams (relational/flow):** \`resources/design_processes/collateral/exemplars/diagrams/\`
  (architecture, comparison, ecosystem, flywheel, framework, hub-spoke, journey, matrix,
  maturity-model, operating-model, process, quadrant, roadmap, timeline, venn). Rulebook:
  \`rulebooks/README-DIAGRAMS.md\`.
- **Spatial systems (layered/iso illustrations):** \`resources/design_processes/collateral/exemplars/spatial/\`
  (layer-stack, operating-model, ecosystem-system, modular-system, iso-illustrations).
  Rulebook: \`rulebooks/README-SPATIAL.md\` / \`SPATIAL-BRIEF.md\`.
When your request names a **specific routed exemplar**, that is the closest match to THIS
page's content — open it first. Realize the visual as inline SVG in a \`.cr-graphic\` (labels
legible, accent/tonal fills, never navy data marks); it must fit the page box (a4-bounds).

## Hard rails (validated — honour ALL of them)
> Enforcement reality: **geometric/render findings (a4-bounds, text-overlap, page-wrap) ESCALATE and
> FREEZE the section** (they break the deliverable). The **brand findings below are flagged as
> warnings** the actuator clears — but treat every one as binding: a warning you ignore is a defect that
> shipped. Author as if each fails the section.
- **Colours: \`var(--token)\` only.** NEVER a hex literal in any \`style=\`. (SVG \`fill="var(--token)"\` ok.)
- **Metrics are DARK** primary text on light tonal surfaces (white on navy via dark scoping).
  An accent colour NEVER touches a number.
- **No em-dash \`—\` and no ampersand \`&\`** in visible copy. Use \`.\`, \`,\`, \`:\`, \`(\`, or \`·\`.
  The arrow \`→\` (U+2192) is allowed (CTAs).
- **No emoji. No drop shadow / filter / mix-blend. No callout boxes** (a tinted box with a
  coloured left border is BANNED — use a \`.cr-band\`, a tonal card, or a \`.cr-divider\`).
- **One component per row.** Distinct components stack vertically; never two side by side.
  Internal columns within ONE component, and a homogeneous peer set (a stat strip, a feature
  grid), are fine.
- **Body text ≥ 16px** — the **brand body floor** (author to this). The 12px \`.cr-eyebrow\` micro-cap is
  the only smaller size; the a4-bounds rail's absolute hard-fail floor sits lower (~14px), but never
  author below the 16px brand floor.
- **A4 fit (hard):** usable box is 210×297mm minus 16mm padding = ~178×265mm (~1002px tall).
  Nothing may exceed it — overflow is clipped and FAILS the a4-bounds rail. A full-height block
  (\`height:100%\`) MUST also set \`box-sizing:border-box\`. When in doubt, fewer words, larger type.
  - **Horizontal overflow traps (these flag a4-bounds even when content looks fine):**
    (1) NO \`cr-band--bleed\` / negative horizontal margins — a full-bleed band reaches the page
    edge, ~16mm past the content margin, and the rail clips it; keep every band WITHIN the 16mm
    margins (plain \`.cr-band\` / \`.cr-band--dark\`). (2) NO fixed-mm grid tracks like
    \`grid-template-columns: 1fr 40mm\` — \`1fr\` is \`minmax(auto,1fr)\`, so a non-wrapping right
    column plus the gap overruns 178mm. Use flex with \`min-width:0\` on the growing side and a
    \`flex-shrink:0\` metric, or \`%\`-based bar widths — never a fixed-mm track that can overrun.
- **Photography is cover-only.** Interior pages carry NO photos — interest comes from
  composition, scale, whitespace, and tonal surfaces.

## Output contract
- Output ONLY the fragment: a single root \`<div id="THE-PAGE-ID" ...>...</div>\` whose \`id\`
  equals your page id. No \`<!doctype>\`, \`<html>\`, \`<head>\`, and no \`<section class="cr-page">\`
  wrapper (the engine adds it). A doc-scoped \`<style>\` block for \`.viz-*\` chart helpers IS
  allowed (and expected for charts).
`;
}

/**
 * The display brand / product name for the deliverable: the brief's explicit
 * `brand` field, else the titleized client id (`acme-corp` → `Acme-corp`). Drives
 * the client-neutral website contract header + voice — so the creative steering
 * names the actual product, never a hardcoded Example Brand.
 */
function resolveProductName(context: DesignContext): string {
  const brand = context.brief.brand?.trim();
  if (brand) return brand;
  const declaredSubject = context.brandKit?.subject?.trim() || context.brandContract?.subject?.trim();
  if (declaredSubject) return declaredSubject;
  const client = context.client?.trim();
  if (!client) return 'The Product';
  return client.charAt(0).toUpperCase() + client.slice(1);
}

/**
 * The website author contract — distilled from the design-team charter
 * (Website-offscript-v1 README "Content fundamentals" + "Design charter" +
 * "Visual foundations") and the website token sheet
 * (resources/design_processes/website/colors_and_type.css). It is the website
 * sibling of the collateral contract: the DELTA the gold-standard pages have that
 * the thin first-pass output lacks (voice, charter, the .cr-* component vocabulary,
 * the hard rails). Every rule traces to the design-team governance — distilled, not
 * invented. The website palette diverges from collateral on shared `.cr-*` names
 * (e.g. `--cr-ink` black vs navy, "never indigo" vs periwinkle); this contract names
 * the WEBSITE vocabulary so the in-session author never falls back to collateral's.
 */
/**
 * Primary font family from a `--cr-font-*` token value (e.g. `"Urbanist", system-ui,
 * sans-serif` → `Urbanist`). Falls back to the literal first segment, then to `fallback`,
 * so the contract stays correct even on a re-theme — the sheet is the single source of truth.
 */
function primaryFamily(tokenValue: string | undefined, fallback: string): string {
  const v = tokenValue ?? '';
  const fam = (v.match(/"([^"]+)"/)?.[1] ?? v.split(',')[0] ?? '').trim();
  return fam || fallback;
}

function buildWebsiteAuthorContract(context: DesignContext): string {
  const { brief } = context;
  const productName = resolveProductName(context);
  // Typeface names are DERIVED from the sheet tokens (never hardcoded) so the contract
  // and the embedded colors_and_type.css can never desync on a re-theme.
  const displayFont = primaryFamily(context.tokens?.customProps?.get('--cr-font-display'), 'the display face');
  const bodyFont = primaryFamily(context.tokens?.customProps?.get('--cr-font-body'), 'the body face');
  const editorialFont = primaryFamily(context.tokens?.customProps?.get('--cr-font-editorial'), displayFont);
  // Layout geometry is DERIVED from the sheet tokens too (page/gutter/content wells) — same
  // single-source-of-truth rule as the typeface, so a re-theme can't desync these numbers.
  const tok = (name: string, fallback: string): string =>
    (context.tokens?.customProps?.get(name) ?? fallback).trim();
  const pageMax = tok('--cr-page-max', '1440px');
  const gutter = tok('--cr-page-gutter', '100px');
  const contentMax = tok('--cr-content-max', '1440px');
  const contentNarrow = tok('--cr-content-narrow', '1080px');
  const audience = brief.audience?.trim() || '(audience not declared — infer from the one-liner)';
  const mustInclude =
    brief.mustInclude && brief.mustInclude.length > 0
      ? brief.mustInclude.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
      : '  _(none declared — follow the brief one-liner)_';
  const parentLine = context.parentUrl
    ? `\n- **Parent brand (Rule 0):** \`${context.parentUrl}\` — inherit its palette, type, and conventions; deviations only with cause.`
    : '';
  // The legal set of governance images the author may request — read from imagery.md (no brand
  // literals in code). try/catch so a mid-edit manifest never breaks contract assembly (advisory text).
  let imageryList = '';
  try {
    const allowed = loadImageryManifest('website').filter((r) => r.mode === 'author');
    imageryList = allowed.map((r) => `  - \`${r.file}\` — ${r.notes || r.role}`).join('\n');
  } catch {
    imageryList = '  _(imagery.md not loaded — request inline SVG/CSS only)_';
  }

  return `# Offscript author contract — ${productName} website (READ THIS FIRST)

Reference example: this default presentation uses the bundled Example Brand design references.
Supplied project references select the project's own author contract instead.

You are authoring **ONE section** of a multi-section ${productName} marketing website page.
Output ONE self-contained HTML fragment to your assigned \`<id>.response.html\`. The engine
joins the section fragments inside \`<div id="root">\` and embeds the house website
\`colors_and_type.css\` + fonts (${displayFont} + ${bodyFont}). You write the section's INNER content only —
your section owns its full-width band including its own vertical padding.

## The flow you sit in — Creative Director → Philosophy → you (READ BOTH FIRST)
This contract is the THIRD stage of \`CREATIVE DIRECTOR → PHILOSOPHY → Offscript\`. Before authoring, read:
1. \`resources/design_processes/CREATIVE_DIRECTOR.md\` — the intent persona (What / Why / How,
   taste-not-correctness). It frames WHY this deliverable exists, who it is for, and the register to hold.
2. \`resources/design_processes/website/PHILOSOPHY.md\` — the medium logic for a **fluid, scrolling
   page** (section = unit, page = narrative; guide-don't-force; surfaces-not-lines; reward the scroll).
The persona shapes *feel*, the philosophy shapes *structure*, the rails below enforce *correctness*. On
any conflict, the rails and brand pack win — follow them and flag the tension, never hardcode around it.

## Full governance on disk — STUDY, never clone (read before authoring)
The nested governance is NOT inlined here — open it on disk under \`resources/design_processes/website/\`:
- **Rulebooks:** \`rulebooks/{design-charter,visual-language,creatives}.md\` — the laws of the medium by role.
- **Composition reasoning (the WHY beneath the catalog — study before composing):**
  \`component-governance/COMPOSITION-REASONING.md\` — what information must exist, the order it is met, how
  space carries it within a section, and which mechanism makes it consumable. It EXTENDS the catalog below,
  never replaces it; the component library is FIXED — derive the need, then map it to the best-fitting
  existing section (a need no existing section serves is an escalation, never a licence to invent one).
- **Component governance:** \`component-governance/components.md\` (the role families) + \`COMPOSITION.md\`
  (the by-\`serves\` index of all 79 realized sections — find the layout that fits the job) + \`COMPOSE.md\`
  (the grammar for assembling a new section from donor blocks).
- **Study exemplars (do NOT clone — archive-relative, won't render standalone):** the 79 realized sections in
  \`exemplars/sections/\`, 2 full pages in \`exemplars/pages/\`, 6 inspiration images in \`exemplars/inspiration/\`.
  They teach rhythm, density, and the \`.cr-*\` vocabulary — study them for principles, never paste them.
- **Voice:** \`voice.md\`. **Imagery by intent:** \`ASSETS.md\` (of the blur pool, only \`blur-7\` is brand-legal).

## This deliverable
- **Product (one-liner):** ${brief.oneLiner}
- **Audience:** ${audience}
- **Tone:** ${brief.tone}${parentLine}
- **Must-include (the narrative spine):**
${mustInclude}

## Voice — ${productName}'s, drawn from the brief (write in THIS voice, do not borrow another product's)
The deliverable's voice is: **${brief.tone || '(no tone declared — infer a precise, on-brand voice from the one-liner and audience)'}**.
Write every headline and line in that voice for **${productName}**. The points below are house
*conventions* (how a Example Brand-governed page reads), not copy to reuse — never lift another
product's words or examples.
- **Headlines: Title Case**, one focal idea each, with a strong rhythm break or period. ≤ ~10 words.
- **Body** is plainspoken **sentence case** — short declarative bursts over hedging prose.
- **Person:** speak to **you** (the reader's org), from **we** (${productName}). Never first-person
  singular, never "users."
- **Numbers as proof** — anchor claims to a real %, multiple, or count drawn from THIS product's
  own substance (never invent a metric). Stat cards ARE the argument, not decoration.
- **CTAs** are imperative, second-person, on one line, ending in a \` →\` arrow, followed by a small
  grey reassurance line.
- **Comparison framing:** the status-quo column gets neutral cool-grey type; the ${productName}
  column gets a coloured accent. Let contrast do the work — never insult the alternatives.
- **Avoid:** emoji, exclamation points; "powerful / robust / leverage / synergy / revolutionary";
  "we believe / our mission is" filler; jargon ladders. The argument is concrete outcomes.

## Design charter — every decision supports communication (clarity FIRST, impress second)
Priority order: clarity → scannability → readability → hierarchy → credibility → fast comprehension.
When a trade-off arises, prioritise understanding over visual complexity.
- **One communication objective per section.** If two messages compete equally, split or subordinate one.
- **One primary focal point per viewport** — a reader must be able to name the most important thing
  within 3 seconds. If not, strengthen hierarchy through scale, position, spacing, contrast.
- **Progressive disclosure** — the section feels **complete without being crowded or sparse.** Every
  component justifies its presence by advancing the narrative; never add a card/widget to fill space
  (avoid the "dashboard effect" where many elements carry equal weight).
- Visual interest comes from **scale, composition, typography, spacing, contrast, hierarchy** — NOT
  decorative effects, illustrations, or embellishment.

## Hard constraints (validated — a violation fails the section)
- **Colours: \`var(--token)\` only** — NEVER a hex literal in any \`style=\`. (SVG colour via
  \`style="fill:var(--token)"\`, not \`fill="#…"\` — \`var()\` does not resolve in an SVG presentation
  attribute.) The token set is the WEBSITE sheet
  \`resources/design_processes/website/colors_and_type.css\` (NOT the collateral
  \`design_principles/\` sheet) — read it for the exact vocabulary. \`var(--cr-brand)\` is the
  action blue; white is \`var(--cr-bg)\`; translucent veils use \`rgba(…)\` (not a hex literal, allowed).
- **Restrained depth — separation is border-first.** Build separation primarily from **borders**
  (\`1px solid var(--cr-line)\` on light, \`var(--cr-line-dark)\` on dark), spacing, contrast, and scale.
  The ONLY sanctioned elevation is the soft-shadow tokens (\`var(--cr-shadow-sm)\` / \`var(--cr-shadow-lg)\`)
  and glass (\`.cr-glass\` / \`.cr-glass-light\`, \`var(--cr-glass-*)\`), used **sparingly** on genuinely
  floating panels or panels over imagery. **Never an ad-hoc raw \`box-shadow: 0 …\` / \`filter: blur()\`
  / glow** — only the tokens. No emphasis-by-shadow on flat content (cards at rest, text).
- **Hover only signals a REAL interaction** — buttons, links, nav, controls. Static cards and
  informational content NEVER react to hover.
- **No negative margins and no layout hacks.** Resolve composition through spacing, grid, alignment,
  and component structure (offset headline lines with \`text-align\` / grid placement — never \`margin:-…\`).
- **Icons are Lucide only** — single-weight line glyphs, \`currentColor\`, ~1.8px stroke, rounded caps;
  emit them as **inline \`<svg>\`** (the single-file output carries no CDN). No other icon set, no emoji,
  no illustration standing in for an icon.
- **\`var(--cr-brand)\` is the brand AND the action colour** — the thing the eye lands on to
  click (primary CTAs, focus rings, link accents, the single coloured word in a tagline). Do not flood
  large background surfaces with it.
- **NEVER indigo.** \`var(--cr-wordmark-indigo)\` is the colour wordmark ONLY — never a UI surface,
  accent, headline, or icon. (The website palette diverges here from collateral, which uses periwinkle —
  do not mix the two brand vocabularies.)

## The three canonical surfaces (pick one per section — never gradient-blend within a band)
1. **Light** — \`var(--cr-bg)\` (default; headings sit here). Vary lightly among the EXISTING
   neutrals (\`--cr-bg-warm\`, \`--cr-bg-warm-2\`, \`--cr-bg-grey-50\`/\`-100\`) **only when the
   shift strengthens hierarchy or grouping** — never a fixed white-grey-white cadence, never decoration,
   no new surface tokens.
2. **Cool off-white band** — \`var(--cr-bg-warm)\` (proof-of-work / statistic sections).
3. **Ink / Night** — \`var(--cr-ink)\`, or a top-down gradient (hero \`var(--cr-ink-night)\` →
   \`var(--cr-ink-violet)\`; closing CTA \`var(--cr-ink-blue-deep)\` family). A deliberate device — flip
   text with \`.cr-on-dark\`.
- **Sections are divided by surface, not rules/lines.** Each band carries its own padding.

## Type ramp + headline hierarchy (reuse the ramp — invent NO new sizes / weights / fonts / classes)
- **Display (${displayFont}, \`var(--cr-font-display)\`):** largest → smallest — \`.cr-h-hero\` · \`.cr-h-section\`
  · \`.cr-h-sub\` · \`.cr-h-group\` · \`.cr-h-card\` · eyebrow \`.cr-h-eyebrow\` (caps). Big stat \`.cr-num-display\`.
  **Apply the classes; never write raw \`font-size\`/\`font-weight\`** — the exact px + weight live in the embedded sheet.
- **Editorial (${editorialFont}, the heaviest display cut, \`var(--cr-font-editorial)\`):** an oversized
  magazine-cover moment — used sparingly.
- **Body (${bodyFont}):** \`.cr-p-lede\` (lede) · \`.cr-p\` (default) · \`.cr-p-card\` (in cards) · \`.cr-caption\`
  (small) · \`.cr-quote\` (pull-quotes). **No italics, no serifs.**
- **Headline hierarchy toolkit (use ONLY when it sharpens the message; ONE focal point per headline):**
  two-tone split (focal line \`var(--cr-fg)\`, supporting line \`var(--cr-fg-3)\` on light / \`var(--cr-fg-muted)\`
  on dark); ONE accent word in \`var(--cr-brand)\` (never indigo); weight emphasis (display line vs editorial
  statement); scale pairing (eyebrow → title; big stat → caption); deliberate line breaks + per-line
  \`text-align\` (setup line left+muted, focal line right+ink). Keep headlines **Title Case**. No text-shadow on type.

## Layout (page geometry)
- Page **${pageMax}** wide, **${gutter}** gutter → **${contentMax}** content well (\`--cr-page-max\` / \`--cr-page-gutter\` /
  \`--cr-content-max\`); a narrower **${contentNarrow}** reading well (\`--cr-content-narrow\`) is the documented exception
  for FAQ / editorial. Your section sets its OWN padding via the \`--cr-space-*\` scale (generous for hero/proof, tighter for closers).
- **8-pt grid**; common gaps 12 / 16 / 24 / 40 / 60 / 80 / 120px (\`--cr-space-*\`, large steps up to \`--cr-space-50\`). Card stacks = 3-up rows,
  gap 60. Section heights are **substantial** (heroes 800+, proof ~870, closing CTA ~525) — fill them with
  scale + spacing, never by cramming words.
- **Responsive:** add \`@media\` breakpoints in a doc-scoped \`<style>\` (links / columns collapse ≤ ~860px).

## Component cheat-sheet (house classes — do NOT invent; full vocabulary in the website \`colors_and_type.css\`)
- **Headings / body:** the \`.cr-h-*\` + \`.cr-p*\` ramp above; \`.cr-quote\` for pull-quotes; \`.cr-on-dark\`
  flips text white on ink surfaces.
- **Buttons:** primary = pill, \`var(--cr-brand)\` bg, white ${bodyFont} Medium, pill padding, \` →\` appended
  in the SAME span (not a separate icon). \`.cr-btn-secondary\` = light pill, line border, ink text;
  \`.cr-btn-ghost\` = transparent + line; \`.cr-btn-tertiary\` = bare text button. Hover nudges the arrow 4px right (no colour change); press 96% scale.
- **Cards:** 16px radius (\`--cr-radius-lg\`), white bg, **\`1px solid var(--cr-line)\` hairline** — border-first
  (sanctioned \`var(--cr-shadow-*)\` / \`.cr-glass\` only when a panel genuinely floats). Stat tile: \`var(--cr-bg-warm-2)\`
  tonal fill, 24px padding, number top-left at \`.cr-num-display\`, label bottom-left.
- **FAQ row:** 12px radius, \`var(--cr-brand-100)\` pale-blue, single-line question. Q&A answer panel:
  12px radius, \`var(--cr-ink-deep)\`, 60px padding, white text.
- **Stat / proof:** big numbers in \`.cr-num-display\` (optionally accented \`var(--cr-brand)\` / \`var(--cr-teal)\`);
  agent-status dots use the greens (\`var(--cr-success)\` = "running"). Comparison table = status-quo grey vs CR accent.
- **Restrained depth (v2):** default separation is still border-first (hairline / surface / scale), but ONE soft
  shadow (\`var(--cr-shadow-sm)\` / \`var(--cr-shadow-lg)\`) and **glass** (\`.cr-glass\` / \`.cr-glass-light\`,
  \`var(--cr-glass-*)\`) are sanctioned, used sparingly on floating / over-imagery panels. Never a raw/ad-hoc
  \`box-shadow: 0 …\` — only the tokens.

## Structural chrome — composed INTO sections, never their own section
The page has exactly one **nav** and uses **dividers** as surface transitions; neither is a planned
section, so you will never get a request.md for one — compose them into the section you ARE authoring:
- **Nav** belongs at the top of the **hero** section (logo left · canonical links · a "Let's talk" pill
  right), **re-toned to the hero surface** (light hero → colour logo + dark links + ink pill; dark hero →
  white logo + white links + white pill). If you are authoring the hero, include the nav inside it; never a
  dark nav over a light hero, never a standalone nav band.
- **Dividers** are **surface transitions, not lines** — adjacent sections change surface (light → warm cream
  → ink) and that shift IS the divider. A textural motif (the design library's halftone / dither / horizon
  edge, authored as inline SVG/CSS at a band's top or bottom edge) is the only sanctioned "divider"; never a
  bare \`<hr>\` or a full-width hairline rule between two sections.

## Imagery & creatives (allowed on website; collateral interiors stay photo-free — only the cover carries a photo, painted by the engine)
- A **creative** is a self-contained section visual communicating ONE thing: a light-theme UI in a curated
  environment, ~**80% neutral / ≤20% accent**, one focal point, often **cropped** so the UI bleeds off-frame.
  Aspect 1:1 / 16:9 / 3:4 / 4:3.
- Background: EITHER an atmospheric image OR a brand-gradient panel (navy → ink-violet → ink-night, **never
  indigo**) + a grain overlay. Pick ONE mode and keep it consistent across a section.
- **Self-contained today:** prefer **inline SVG / CSS** for logos/icons/motifs (e.g. the white "orbit"
  ring at ~40% opacity). For a figure or contrast band you **MAY request a governance-listed image** (the
  night hero, a texture, a value-band backdrop) by emitting a normal relative ref — e.g.
  \`<img src="backgrounds/hero-bg-night.jpg">\` or \`background-image:url('textures/texture-grain.png')\` —
  resolved against the website imagery catalog (\`imagery.md\`) and inlined to a data-URI by the engine. Only
  request files listed in \`imagery.md\`; an unlisted ref will not resolve and is dropped. The allowed set:
${imageryList}
  No fabricated screenshots, metrics, logos, or quotes — generate believable contextual UI; an archetype is
  a layout hint.

## Motion — the behaviour library is AUTO-EMBEDDED; you emit the DATA HOOKS, not the script
- The house behaviour library (reveal · count-up · bar/fill grow · active-nav · nav-toggle) is embedded ONCE
  by the engine and its CSS hooks ship in the foundation sheet. **Do NOT hand-write a \`<script>\` for these —
  just add the markup hooks below.** (A bespoke \`<script>\` for something genuinely outside this set is still
  allowed, but never re-implement the library — it self-guards against a double-embed.)
  - **Reveal:** add \`data-reveal\` to a section/block; stagger siblings with inline \`style="--d:.08s"\`. The
    library adds \`.js\` to \`<html>\` and toggles \`.is-visible\` in view. Reveals are **transform-only** — the
    resting \`opacity\` STAYS 1, never 0 (an \`opacity:0\` rest blanks below-the-fold content in print/static —
    the "looks blank" failure). Animate \`transform\`, not \`opacity\`.
  - **Count-up:** a \`.cr-num-display\`/number element gets \`class="cr-count" data-target="90"\` (+ optional
    \`data-decimals\` / \`data-prefix\` / \`data-suffix\`). Keep the final value as the element's text so it reads
    correctly with JS off.
  - **Bar / fill grow:** a bar uses \`.cr-grow-h\` + \`style="--h:88%"\` (vertical) or \`.cr-grow-w\` + \`--w\`
    (horizontal); it grows from 0 once its \`[data-reveal]\` ancestor enters view, resting at the full value.
  - **Active-nav:** a sticky index item carries \`data-nav-go="fw-1"\`; the matching scroll target carries
    \`id="fw-1" data-go="fw-1"\`. The library toggles \`.is-active\` on the index item whose target is in view
    (this is the left index tracking the right-side scroll — author both ends or you get no tracking).
  - **Nav drawer:** the toggle button is \`data-nav-toggle\`; the mobile panel is \`data-nav-drawer hidden\`.
- No spring/bounce (the brand reads institutional); hero figures don't move; nothing parallax. Hover = the
  4px arrow nudge (no colour change); press = 96% scale snap (150ms). Because resting opacity is 1, the page
  is fully legible with JS off, on a still snapshot, and in print (the library + a \`prefers-reduced-motion\`
  no-op in the sheet handle the rest).

## Data-viz (where the data supports it — numbers as proof)
- Use the on-palette categorical ramp \`var(--cr-data-1…6)\` (blue / green / violet / amber / teal / pink).
  A single big number is a \`.cr-num-display\` metric, not a chart. Never indigo; data marks are accent,
  numerals + labels stay legible ink. Animate counters with \`.cr-count\`+\`data-target\` and bars with
  \`.cr-grow-h\`/\`.cr-grow-w\` (above) — the embedded library drives both; never add a charting script.

## Output contract
- Output ONLY the section fragment: a single root element carrying your anchor id
  (\`<section id="THE-ID" …>\` or the semantic landmark). No \`<!doctype>\`, \`<html>\`, \`<head>\`, and no
  \`<div id="root">\` wrapper (the engine adds it).
- Every colour is a \`var(--token)\`. Inline SVG for icons / motifs. A doc-scoped \`<style>\` block for this
  section's layout / breakpoints / motion IS allowed. Self-contained — no CDN, no external refs, no framework.
`;
}
