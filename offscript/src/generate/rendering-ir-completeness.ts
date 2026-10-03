/**
 * D1-S3 — Rendering IR Completeness Analyzer (VERIFICATION ONLY; no rendering, no Generation change).
 *
 * Measures what the CURRENT HTML renderers actually consume — `assembleWebsiteBySelection`
 * (scripts/generate.ts:483-536, website) and `authorDocument` (src/generate/author.ts:277-506,
 * collateral) — against what the D1-S2 Rendering IR (`rendering-ir.ts`) represents. This module
 * is a pure, read-only COMPARISON: it never renders HTML, never inspects a fragment/CSS/React,
 * and is not consumed by Generation (δ=0, same landing shape as `rendering-ir.ts` itself).
 *
 * Two orthogonal axes, per the sprint's brief:
 *   - STATIC classification — every renderer-input concern is assigned exactly one `category`
 *     (represented | missing-semantic | presentational | framework-specific) and exactly one
 *     `owner` (IR | Runtime | Framework | Theme), each carrying a `path:line` citation. This is
 *     fixed, grounded knowledge (RENDERER_INPUT_REGISTRY below) — not derived from any one plan.
 *   - DYNAMIC measurement — `analyzeRenderingIRCompleteness(plan, rir, brief)` runs every
 *     registry entry's `measure()` against a SPECIFIC (plan, rir, brief) triple to report whether
 *     that concern's data is actually `present`, `absent`, or `not-applicable` for THIS
 *     deliverable — "measured, not claimed" (the repo's operator invariant; cf.
 *     `validateRenderingIR`).
 *
 * See docs/offscript/D1-S3-RIR-COMPLETENESS.md for the full grounding + findings this
 * registry was built from.
 */
import type { AuthoringPlan, PlanItem } from './types.js';
import type { Brief } from './brief.js';
import type { RenderingIR, RenderingSection } from './rendering-ir.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

export type InputOwner = 'IR' | 'Runtime' | 'Framework' | 'Theme';
export type InputCategory = 'represented' | 'missing-semantic' | 'presentational' | 'framework-specific';
export type PresenceState = 'present' | 'absent' | 'not-applicable';

export interface RendererInputSpec {
  readonly id: string;
  readonly description: string;
  readonly citation: string;
  readonly owner: InputOwner;
  readonly category: InputCategory;
  /** Optional caveat surfaced verbatim in findings (e.g. a mapping divergence, not an absence). */
  readonly note?: string;
  readonly measure: (plan: AuthoringPlan, rir: RenderingIR, brief?: Brief) => PresenceState;
}

export interface CompletenessFinding {
  readonly id: string;
  readonly description: string;
  readonly citation: string;
  readonly owner: InputOwner;
  readonly category: InputCategory;
  readonly presence: PresenceState;
  readonly note?: string;
}

export interface CompletenessCoverage {
  readonly applicable: number;
  readonly present: number;
  readonly absent: number;
  /** present / (present + absent) * 100; 0 when nothing is applicable. */
  readonly representedPct: number;
}

export interface RenderingIRCompletenessReport {
  readonly track: AuthoringPlan['track'];
  readonly findings: readonly CompletenessFinding[];
  readonly coverage: CompletenessCoverage;
  readonly byOwner: Readonly<Record<InputOwner, number>>;
  readonly byCategory: Readonly<Record<InputCategory, number>>;
  readonly digest: string;
}

// ── measurement helpers ─────────────────────────────────────────────────────────

function allSections(rir: RenderingIR): readonly RenderingSection[] {
  return rir.document.pages.flatMap((p) => p.sections);
}

/** A genuine (measured) scan for a JSON key name anywhere in the serialized IR — never a claim. */
function rirHasKey(rir: RenderingIR, key: string): boolean {
  return new RegExp(`"${key}"\\s*:`).test(JSON.stringify(rir));
}

function planHasItem(plan: AuthoringPlan, pred: (item: PlanItem) => boolean): boolean {
  return plan.items.some(pred);
}

const present = (): PresenceState => 'present';
const absent = (): PresenceState => 'absent';
const notApplicable = (): PresenceState => 'not-applicable';

/** applicable(plan) decides present/absent; when inapplicable, reports not-applicable instead. */
function gated(
  applicable: (plan: AuthoringPlan, brief?: Brief) => boolean,
  found: (plan: AuthoringPlan, rir: RenderingIR, brief?: Brief) => boolean,
): (plan: AuthoringPlan, rir: RenderingIR, brief?: Brief) => PresenceState {
  return (plan, rir, brief) => {
    if (!applicable(plan, brief)) return 'not-applicable';
    return found(plan, rir, brief) ? 'present' : 'absent';
  };
}

/** A concern this repo has no per-plan applicability signal for, but that a real run always exercises. */
const alwaysApplicable = (): boolean => true;
const websiteOnly = (plan: AuthoringPlan): boolean => plan.track === 'website';
const collateralOnly = (plan: AuthoringPlan): boolean => plan.track === 'collateral';

// ── the registry (grounded, static — see D1-S3-RIR-COMPLETENESS.md) ─────────────

export const RENDERER_INPUT_REGISTRY: readonly RendererInputSpec[] = [
  // ── IR-mapped semantic fields (represented) ──────────────────────────────────
  {
    id: 'section-role',
    description: 'PlanItem.archetype → RenderingSection.role',
    citation: 'types.ts:128; rendering-ir.ts:203',
    owner: 'IR',
    category: 'represented',
    measure: gated(alwaysApplicable, (_p, rir) => allSections(rir).length > 0 && allSections(rir).every((s) => !!s.role)),
  },
  {
    id: 'section-id',
    description: 'PlanItem.governanceReferenceId ?? anchor.id → RenderingSection.id',
    citation: 'types.ts:127,199; rendering-ir.ts:159-161',
    owner: 'IR',
    category: 'represented',
    measure: gated(alwaysApplicable, (_p, rir) => allSections(rir).every((s) => !!s.id)),
  },
  {
    id: 'section-intent',
    description: 'PlanItem.intent → RenderingSection.intent',
    citation: 'types.ts:130; rendering-ir.ts:205',
    owner: 'IR',
    category: 'represented',
    measure: gated(alwaysApplicable, (_p, rir) => allSections(rir).every((s) => !!s.intent)),
  },
  {
    id: 'section-landmark',
    description: 'anchor.landmark → RenderingSection.landmark (a11y semantics)',
    citation: 'sections.ts:11-12; rendering-ir.ts:206',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.anchor.landmark),
      (_p, rir) => allSections(rir).some((s) => !!s.landmark),
    ),
  },
  {
    id: 'section-content-blob',
    description: 'PlanItem.content → a single RenderingSlot{kind:"prose"}',
    citation: 'types.ts:131; rendering-ir.ts:192-194',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.content?.trim()),
      (_p, rir) => allSections(rir).some((s) => s.slots.length > 0),
    ),
  },
  {
    id: 'composition-variant-surface',
    description: 'PlanItem.componentVariant/surfaceRole → RenderingSection.composition{variant,surface}',
    citation: 'types.ts:164,169; rendering-ir.ts:164-169',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.componentVariant || !!i.surfaceRole),
      (_p, rir) => allSections(rir).some((s) => !!s.composition),
    ),
  },
  {
    id: 'presentation-medium-commitment',
    description: 'PlanItem.presentationIntent → RenderingSection.presentation{medium,commitment}',
    citation: 'presentation-intent.ts:64-75; rendering-ir.ts:225-229; types.ts:220 (collateral-only, always absent on website)',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.presentationIntent),
      (_p, rir) => allSections(rir).some((s) => !!s.presentation),
    ),
  },
  {
    id: 'reasoning-why',
    description: 'PlanItem.reasoning (SectionReasoning) → RenderingSection.reasoning',
    citation: 'types.ts:94-107,201-206; rendering-ir.ts:177-189',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.reasoning),
      (_p, rir) => allSections(rir).some((s) => !!s.reasoning),
    ),
  },
  {
    id: 'token-roles',
    description: 'PlanItem.tokenRoles → RenderingDocument.tokens (union, deduped, sorted)',
    citation: 'types.ts:129; rendering-ir.ts:235-239',
    owner: 'IR',
    category: 'represented',
    measure: gated(
      (plan) => planHasItem(plan, (i) => i.tokenRoles.length > 0),
      (_p, rir) => rir.document.tokens.length > 0,
    ),
  },
  {
    id: 'metadata-title-description',
    description: 'brief.brand/oneLiner → RenderingDocument.metadata{title,description,siteName}',
    citation: 'brief.ts:31,47; rendering-ir.ts:225-233',
    owner: 'IR',
    category: 'represented',
    note:
      'Mapping divergence (not an absence): the REAL renderers resolve the page title from brief.oneLiner ' +
      'FIRST (site-metadata.ts:75 resolveMetadata — `meta.title ?? brief.oneLiner ?? brief.brand`; ' +
      'author.ts:485 assembleDocument({title: context.brief.oneLiner}); website-shell.ts titles the ' +
      'shell with `context.brief.oneLiner`, generate.ts:531,533), while the RIR builder sets ' +
      '`document.metadata.title = brief.brand` (rendering-ir.ts:226) — oneLiner only becomes ' +
      '`description`. A consumer trusting RIR.metadata.title as "the page title" gets the wrong string ' +
      'whenever brand !== oneLiner.',
    measure: gated(
      () => true,
      (_p, rir) => !!(rir.document.metadata.title || rir.document.metadata.description),
    ),
  },

  // ── semantic concerns the architecture reserves but the builder cannot populate (Phase 0 gaps) ──
  {
    id: 'section-content-fine-grained',
    description: 'Heading/subhead/body/action/media slot decomposition (architecture reserves RenderingSlotKind beyond "prose")',
    citation: 'RENDERING_IR_ARCHITECTURE.md:229-241 (RIRSlot.kind); rendering-ir.ts:54 (RenderingSlotKind = "prose" only); reconstruct-band.ts:131 (the decomposition lives inside the HTML fragment, which the builder must not inspect)',
    owner: 'IR',
    category: 'missing-semantic',
    measure: gated(alwaysApplicable, (_p, rir) => allSections(rir).some((s) => s.slots.some((sl) => sl.kind !== 'prose'))),
  },
  {
    id: 'composition-layout-taxonomy',
    description: 'A normalized layout enum (stack/split/grid/trio) — the architecture proposed RIRSection.composition.layout; the builder keeps only the opaque variant slug',
    citation: 'RENDERING_IR_ARCHITECTURE.md:216 (RIRSection.composition.layout); rendering-ir.ts:73-76 (RenderingComposition has variant+surface, no layout field); D1-S2-RIR-BUILDER.md §3c.4 "(decision)"',
    owner: 'IR',
    category: 'missing-semantic',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.componentVariant || !!i.surfaceRole),
      (_p, rir) => rirHasKey(rir, 'layout'),
    ),
  },
  {
    id: 'action-intent',
    description: 'CTA label/intent/target (RIRSlot.action) — a semantic action, never wired onto PlanItem',
    citation: 'RENDERING_IR_ARCHITECTURE.md:235-239 (RIRSlot.action); D1-S2-RIR-BUILDER.md §3c.2 "Not present as data on PlanItem"',
    owner: 'IR',
    category: 'missing-semantic',
    measure: gated(alwaysApplicable, (_p, rir) => rirHasKey(rir, 'action')),
  },
  {
    id: 'interactivity-intent',
    description: 'Declared interactivity (accordion/tabs/carousel/reveal/count-up) — RIRSlot.interactivity',
    citation: 'RENDERING_IR_ARCHITECTURE.md:240,422-424 (RIRSlot.interactivity); rendering-ir.ts (RenderingSlot has no interactivity field)',
    owner: 'IR',
    category: 'missing-semantic',
    measure: gated(alwaysApplicable, (_p, rir) => rirHasKey(rir, 'interactivity')),
  },
  {
    id: 'responsive-intent',
    description: 'Reflow/emphasis intent (RIRResponsiveIntent{emphasis,reflow}) — reserved, never populated',
    citation: 'RENDERING_IR_ARCHITECTURE.md:161,243-246 (RIRResponsiveIntent); D1-S2-RIR-BUILDER.md §3c.3 "Not present as structured data on PlanItem"',
    owner: 'IR',
    category: 'missing-semantic',
    measure: gated(alwaysApplicable, (_p, rir) => rirHasKey(rir, 'responsive')),
  },
  {
    id: 'metadata-tone',
    description: 'brief.tone (the communication voice) — RenderingMetadata.tone (D1-S4)',
    citation: 'authoring-seam.ts:48-49 (AuthoringRequest.tone); brief.ts (Brief.tone); rendering-ir.ts (RenderingMetadata.tone, D1-S4)',
    owner: 'IR',
    category: 'represented',
    note: 'Closed by D1-S4-RIR-SEMANTIC-EXPANSION.md — real data was already flowing (brief.tone), only the mapping was missing.',
    measure: gated(() => true, (_p, rir) => rirHasKey(rir, 'tone')),
  },
  {
    id: 'metadata-seo-social',
    description: 'canonicalUrl/robots/themeColor/ogType/twitterCard/twitterSite/favicon/appleTouchIcon/manifest/organization — the project-owned SEO/social identity, threaded into RenderingMetadata via buildRenderingIR\'s optional 3rd `siteMetadata` parameter (D1-S4)',
    citation: 'site-metadata.ts:22-44 (SiteMetadata); site-metadata.ts:149-168 applySiteMetadata (website-only branch, scripts/generate.ts:645-666); rendering-ir.ts (RenderingSiteMetadataInput + RenderingMetadata, D1-S4)',
    owner: 'IR',
    category: 'represented',
    note: 'Closed by D1-S4-RIR-SEMANTIC-EXPANSION.md — the builder stays I/O-free; a caller passes the already-loaded SiteMetadata object in, mirroring how `brief` itself is supplied.',
    measure: gated(websiteOnly, (_p, rir) => rirHasKey(rir, 'canonicalUrl') || rirHasKey(rir, 'organization')),
  },
  {
    id: 'metadata-locale-lang',
    description: 'Locale — RenderingMetadata.locale (D1-S4), sourced from the same optional siteMetadata parameter; document language (hardcoded lang="en" in the real renderer) remains unaddressed — no project data source exists for it',
    citation: 'RENDERING_IR_ARCHITECTURE.md:248 (RIRMetadata.locale, proposed); rendering-ir.ts (RenderingMetadata.locale, D1-S4); author.ts:486 (lang:"en" still hardcoded — not this concern\'s data source)',
    owner: 'IR',
    category: 'represented',
    note: 'Locale (SiteMetadata.locale) closed by D1-S4. The renderer\'s hardcoded lang="en" is a separate, still-open concern with no source data anywhere — not reopened here.',
    measure: gated(() => true, (_p, rir) => rirHasKey(rir, 'locale')),
  },

  // ── presentational-only (correctly excluded — the leak the IR was designed to drop) ──────
  {
    id: 'fragment-id',
    description: 'PlanItem.fragmentId — the on-disk exemplar slug (the presentational leak)',
    citation: 'types.ts:137; reconstruct-band.ts:229-234; catalog.ts:137',
    owner: 'Framework',
    category: 'presentational',
    measure: gated((plan) => planHasItem(plan, (i) => !!i.fragmentId), (_p, rir) => rirHasKey(rir, 'fragmentId')),
  },
  {
    id: 'candidates-reason',
    description: 'PlanItem.candidates/reason — the curation audit trail',
    citation: 'types.ts:142,149',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(
      (plan) => planHasItem(plan, (i) => !!i.candidates || !!i.reason),
      (_p, rir) => rirHasKey(rir, 'candidates') || rirHasKey(rir, 'reason'),
    ),
  },
  {
    id: 'section-guidance',
    description: 'PlanItem.sectionGuidance — an on-disk governance excerpt aimed at the author, not the UI tree',
    citation: 'types.ts:176',
    owner: 'Framework',
    category: 'presentational',
    measure: gated((plan) => planHasItem(plan, (i) => !!i.sectionGuidance), (_p, rir) => rirHasKey(rir, 'sectionGuidance')),
  },
  {
    id: 'component-knowledge',
    description: 'PlanItem.componentKnowledge — component-authoring context, not UI structure',
    citation: 'types.ts:213',
    owner: 'Framework',
    category: 'presentational',
    measure: gated((plan) => planHasItem(plan, (i) => !!i.componentKnowledge), (_p, rir) => rirHasKey(rir, 'componentKnowledge')),
  },
  {
    id: 'composition-narrative-string',
    description: 'PlanItem.composition — the raw human-readable steering description (distinct from componentVariant/surfaceRole)',
    citation: 'types.ts:150-158',
    owner: 'Framework',
    category: 'presentational',
    measure: gated((plan) => planHasItem(plan, (i) => !!i.composition), () => false),
  },
  {
    id: 'house-contract',
    description: 'buildAuthorContract(context) — the once-per-run governance contract text handed to the author',
    citation: 'author.ts:289; authoring-seam.ts:74-82',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(() => true, () => false),
  },
  {
    id: 'exemplar-pointer',
    description: 'selectExemplar(archetype, track) — the curated rhythm/density reference fragment',
    citation: 'authoring-seam.ts:83-89; author.ts:340',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(() => true, () => false),
  },
  {
    id: 'study-pointer',
    description: 'routedStudyPointer(contentSignal) — the precise on-disk exemplar to study (collateral rich visuals)',
    citation: 'authoring-seam.ts:98-106; author.ts:313',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(collateralOnly, () => false),
  },
  {
    id: 'base-fragment',
    description: 'loadFragmentHtml(fragmentId) — the real data-crf HTML band the author edits in place',
    citation: 'authoring-seam.ts:107-117; scripts/generate.ts:495; reconstruct-band.ts:229-234',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(websiteOnly, () => false),
  },
  {
    id: 'shell-chrome',
    description: 'websiteShell() — doctype/head/Lucide script/reset CSS chrome the bands are pasted into',
    citation: 'website-shell.ts:36-62',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(websiteOnly, () => false),
  },
  {
    id: 'anchor-stamping',
    description: 'injectAnchor — stamps id/data-archetype onto each fragment\'s data-crf root element',
    citation: 'website-assembly.ts:43-58',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(websiteOnly, () => false),
  },
  {
    id: 'curation-comment',
    description: 'serializeCurationComment — the P2 Curation Table HTML comment pasted before the bands',
    citation: 'scripts/generate.ts:530',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(websiteOnly, () => false),
  },
  {
    id: 'authoring-time-bleed-marker',
    description: 'data-cr-bleed — a full-bleed/layout decision detectable only by scanning the AUTHORED fragment markup after authoring; it cannot be derived pre-HTML under the current Plan → author → HTML order, so it is not merely unmapped but temporally undecided at Plan/RIR-build time',
    citation: 'author.ts:417-421',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(collateralOnly, () => false),
  },
  {
    id: 'canonical-footer',
    description: 'buildCanonicalFooter(context, warnings) — engine-owned running-footer furniture, appended to every collateral page independent of Plan content',
    citation: 'author.ts:395; footer.ts',
    owner: 'Framework',
    category: 'presentational',
    // Structural engine furniture: always exercised by a real collateral run, never derivable
    // from (plan, rir) content alone — reported not-applicable rather than guessed.
    measure: gated(() => false, () => false),
  },
  {
    id: 'collateral-geometry-css',
    description: 'COLLATERAL_INLINE_STYLE — A4 mm-based page geometry + footer pinning CSS',
    citation: 'author.ts:106-137',
    owner: 'Framework',
    category: 'presentational',
    measure: gated(collateralOnly, () => false),
  },

  // ── framework-specific (implementation mechanics, correctly out of IR scope) ──────────────
  {
    id: 'behaviour-script',
    description: 'behavior.js — the reveal/count-up/active-nav Runtime implementation inlined before </body>',
    citation: 'scripts/generate.ts:518-526; RENDERING_IR_ARCHITECTURE.md §9 (Runtime = behaving UI)',
    owner: 'Runtime',
    category: 'framework-specific',
    measure: gated(websiteOnly, () => false),
  },
  {
    id: 'prior-findings',
    description: 'AuthoringRequest.priorFindings — the violation-aware re-authoring feedback channel from the CR-validate loop',
    citation: 'authoring-seam.ts:60-72',
    owner: 'Runtime',
    category: 'framework-specific',
    note: 'Not representable in a point-in-time IR by design: it is loop STATE across authoring passes, not a static property of the deliverable.',
    measure: gated(() => true, () => false),
  },
  {
    id: 'brand-kit-imagery',
    description: 'Collateral logo/cover style (Brand Kit / imagery.md resolution) — asset resolution, not UI structure',
    citation: 'author.ts:167-250',
    owner: 'Theme',
    category: 'framework-specific',
    measure: gated(collateralOnly, () => false),
  },
  {
    id: 'token-values-theme',
    description: 'colors_and_type.css — resolved token VALUES (the IR carries only token role NAMES)',
    citation: 'author.ts:433-450; website-shell.ts:44; RENDERING_IR_ARCHITECTURE.md §4 "Tokens — values / theme: Theme (renderer-side)"',
    owner: 'Theme',
    category: 'framework-specific',
    measure: gated(() => true, () => false),
  },
];

// ── analysis ──────────────────────────────────────────────────────────────────

const REPORT_VERSION_TAG = 'd1-rir-completeness@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REPORT_VERSION_TAG);
}

const OWNERS: readonly InputOwner[] = ['IR', 'Runtime', 'Framework', 'Theme'];
const CATEGORIES: readonly InputCategory[] = ['represented', 'missing-semantic', 'presentational', 'framework-specific'];

/**
 * Analyze what the current HTML renderers consume vs. what the Rendering IR represents, for one
 * specific (plan, rir, brief) triple. Pure: no I/O, no clock, no randomness — identical inputs
 * yield an identical report and an identical digest.
 */
export function analyzeRenderingIRCompleteness(
  plan: AuthoringPlan,
  rir: RenderingIR,
  brief?: Brief,
): RenderingIRCompletenessReport {
  const findings: CompletenessFinding[] = RENDERER_INPUT_REGISTRY.map((entry) => ({
    id: entry.id,
    description: entry.description,
    citation: entry.citation,
    owner: entry.owner,
    category: entry.category,
    presence: entry.measure(plan, rir, brief),
    ...(entry.note ? { note: entry.note } : {}),
  }));

  const present_ = findings.filter((f) => f.presence === 'present').length;
  const absent_ = findings.filter((f) => f.presence === 'absent').length;
  const applicable = present_ + absent_;
  const coverage: CompletenessCoverage = {
    applicable,
    present: present_,
    absent: absent_,
    representedPct: applicable > 0 ? (present_ / applicable) * 100 : 0,
  };

  const byOwner = Object.fromEntries(OWNERS.map((o) => [o, findings.filter((f) => f.owner === o).length])) as Record<
    InputOwner,
    number
  >;
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, findings.filter((f) => f.category === c).length]),
  ) as Record<InputCategory, number>;

  const core = { track: plan.track, findings, coverage, byOwner, byCategory };
  return { ...core, digest: digestOf(core) };
}

export interface CompletenessValidation {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Measured, not claimed: every finding carries exactly one of the four closed categories and
 * ids are unique within the report — the "every renderer dependency is classified into exactly
 * one category" success criterion, checked rather than assumed.
 */
export function validateCompletenessReport(report: RenderingIRCompletenessReport): CompletenessValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of report.findings) {
    if (ids.has(f.id)) errors.push(`duplicate finding id '${f.id}'`);
    ids.add(f.id);
    if (!CATEGORIES.includes(f.category)) errors.push(`finding '${f.id}' has an unclassified category '${String(f.category)}'`);
    if (!OWNERS.includes(f.owner)) errors.push(`finding '${f.id}' has an unrecognized owner '${String(f.owner)}'`);
  }
  return { valid: errors.length === 0, errors };
}
