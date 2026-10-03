/**
 * Stage 2 — Adaptive-Design-Intelligence: plan(ctx) → AuthoringPlan
 *
 * Deterministic design intelligence. No LLM, no HTML authoring, no rails.
 * Turns a DesignContext (brief + tokens + governance) into an ordered AuthoringPlan:
 *   - each item is a PlanItem with anchor, archetype, tokenRoles, and intent
 *   - the plan meets the track floor before authoring (website: 5–9 sections,
 *     5–7 distinct archetypes; collateral: 1–4 pages from the one-pager vocabulary)
 *   - deck is explicitly blocked (mirrors buildContext's deck guard)
 *
 * The plan is persisted as sections.md (where) + rulebook.md (what):
 *   - sections.md: YAML that round-trips through loadSections()
 *   - rulebook.md: declarative operator-selection markdown (no code, no conditionals)
 *
 * Serialization helpers are exported as pure string-returners so tests can
 * verify round-trips without filesystem I/O. generate.ts writes the files.
 *
 * DEVIATION FROM TASK WORDING (registry loading):
 *   The task says "load the collateral registry the same way existing code does
 *   (study deck-format.ts)". deck-format.ts copies constants into TS rather than
 *   reading `.claude/lib/` at runtime — that IS the established pattern. The
 *   engine stays self-contained in the portable export (`.claude/lib/` absent there).
 *   Collateral constants are therefore inlined in `collateral-constants.ts`.
 *
 * WEBSITE ARCHETYPE ASSIGNMENT:
 *   brief.mustInclude strings are matched to the closed Archetype vocabulary
 *   using the same keyword patterns that archetype-tag.ts uses for HTML inference.
 *   This re-uses the same vocabulary at plan time (pre-HTML) that archetype-tag
 *   uses at rail time (post-HTML), keeping the two consistent. A bounded keyword
 *   lookup is deterministic and not a "sprawling heuristic" — the spec's STOP
 *   clause targets open-ended design judgment, not a closed keyword map.
 */

import { stringify } from 'yaml';
import type { Archetype } from '../archetype.js';
import { isArchetype } from '../operators/archetype-tag.js';
import { serializeCurationComment } from './curation.js';
import { serializeReasoningLines } from './section-reasoning.js';
import { attachSourceContent } from './section-notes.js';
import { assignWebsiteCompositions, type RhythmAdjustment } from './website-composition.js';
import { projectedCompositionRows } from '../knowledge/projection.js';
import { loadFragmentCatalog, selectCandidates, pickFragment, ARCHETYPE_TO_SERVES, type FragmentEntry } from './catalog.js';
import { briefSelectionProfile, fragmentBriefScore, type VariantMeta } from './website-selection-signal.js';
import {
  createSemanticSelectionConsumer,
  briefTermsOf,
  roleTermsForArchetype,
  type SemanticSelection,
} from './semantic-selection.js';
import { createFamilySelectionConsumer, type FamilySelection } from './family-selection.js';
import {
  createMissionAudienceConsumer,
  briefProfileOf,
  type MissionAudienceSelection,
} from './mission-audience.js';
import { createComponentKnowledgeProvider } from './semantic-author-context.js';
import { createContentCapacityProvider } from './content-capacity.js';
import { compositionCandidatesFor, SPATIAL_HERO_COVER } from './author-contract.js';
import { deriveContentSignal } from './content-signal.js';
import { createPresentationIntentProvider } from './presentation-intent.js';
import { createWebsiteVisualDiscoveryProvider, websiteVisualDiscoveryTieBreak } from './website-visual-discovery.js';
import {
  compositionPreferenceFor,
  loadIntentCompositionMap,
  intentCompositionMapPath,
  reorderCandidatesByPreference,
} from './intent-consumption.js';
import { extractSourceUnits } from './source-units.js';
import { bindSourceUnits, type BindingResult } from './source-binding.js';
import { buildSourceAccounting, type SourceAccounting } from './source-accounting.js';
import type { SectionAnchor } from '../sections.js';
import { SECTION_RHYTHM_DEFAULTS } from '../operators/section-count-rhythm.js';
import type { DesignContext } from './types.js';
import type { AuthoringPlan, PlanItem } from './types.js';
import {
  type CollateralArchetype,
  COLLATERAL_ARCHETYPE_NOTES,
  COLLATERAL_PAGE_MIN,
  COLLATERAL_PAGE_MAX,
  COLLATERAL_PAGE_DEFAULT,
} from './collateral-constants.js';

// ── Website floor — single source of truth is section-count-rhythm.ts ────────
// The planner pre-satisfies the same §2.3 bounds the rail checks, so the plan
// is rail-satisfiable by construction.
const WEBSITE_MIN_SECTIONS = SECTION_RHYTHM_DEFAULTS.minSections;
const WEBSITE_MAX_SECTIONS = SECTION_RHYTHM_DEFAULTS.maxSections;
const WEBSITE_MIN_DISTINCT = SECTION_RHYTHM_DEFAULTS.minDistinct;
const WEBSITE_MAX_DISTINCT = SECTION_RHYTHM_DEFAULTS.maxDistinct;

// ── Default website section sequence for floor-padding ───────────────────────
// Drawn from the SECTION_INTELLIGENCE.md §3 vocabulary (all 20 archetypes).
// Ordered as a minimal story arc: hero → features → social proof → CTA → footer.
// Must contain ≥ WEBSITE_MIN_DISTINCT distinct archetypes.
const WEBSITE_DEFAULT_SECTIONS: Array<{ archetype: Archetype; id: string; intent: string }> = [
  { archetype: 'hero', id: 'hero', intent: 'Primary value proposition and hero section' },
  { archetype: 'feature-grid', id: 'features', intent: 'Key product capabilities and features' },
  { archetype: 'metrics', id: 'metrics', intent: 'Quantitative proof points and social proof' },
  { archetype: 'cta-banner', id: 'cta', intent: 'Primary call to action' },
  { archetype: 'footer', id: 'footer', intent: 'Navigation, legal, and contact' },
];

/**
 * Sprint W83 — the closed set of website floor-padding ids (§ above). These are website's OWN
 * non-brief-derived structural defaults: they have no counterpart on any other track by
 * construction (collateral never floor-pads — see buildCollateralPlan's GAP-1 note). Exported
 * so `reasoning/governance-reference.ts` can recognize a reference to one of these as
 * legitimately track-scoped rather than duplicating this list.
 */
export const WEBSITE_DEFAULT_SECTION_IDS: ReadonlySet<string> = new Set(
  WEBSITE_DEFAULT_SECTIONS.map((d) => d.id),
);

// ── Website keyword → archetype map ──────────────────────────────────────────
// Mirrors the KEYWORD_CUES in archetype-tag.ts so that plan-time assignment
// is consistent with rail-time inference over the generated HTML.
const WEBSITE_KEYWORD_MAP: Array<{ re: RegExp; archetype: Archetype }> = [
  { re: /\bhero\b|masthead|above[-_\s]?the[-_\s]?fold/, archetype: 'hero' },
  { re: /sub[-_\s]?hero/, archetype: 'sub-hero' },
  { re: /logo|trusted|clients?\b|brands?\b|partner/, archetype: 'logo-bar' },
  { re: /feature[-_\s]?grid|capabilit|feature[-_\s]?list/, archetype: 'feature-grid' },
  // feature-spotlight absorbs structural "architecture / zones / topology / layers"
  // sections — a single system explained in depth, not a grid of features. (RC-1a:
  // real briefs name the *structure*, not the archetype.)
  { re: /spotlight|feature[-_\s]?spotlight|architecture|\bzones?\b|topolog|system[-_\s]?design/, archetype: 'feature-spotlight' },
  // process absorbs flow language: arrows, maker→checker chains, human-in-the-loop,
  // workflows, hand-offs, approval chains, orchestration. (RC-1a structural cue.)
  // W69B: `process` is word-boundary-anchored — an unanchored bare token previously
  // substring-matched inside unrelated words (e.g. "processor"), overriding an explicit
  // archetype declaration downstream (SPRINT-W69A-WEBSITE-ROUTING-CORRECTNESS-AUDIT.md §1.1).
  { re: /how[-_\s]?it[-_\s]?works|\bprocess\b|steps?\b|→|⟶|->|\bworkflow\b|hand[-_\s]?off|human[-_\s]?in[-_\s]?the[-_\s]?loop|maker[\s\S]{0,4}checker|approval[-_\s]?(chain|flow|sla)|orchestrat/, archetype: 'process' },
  { re: /metrics?|stats?\b|numbers?\b|counter/, archetype: 'metrics' },
  { re: /testimonial[-_\s]?wall|reviews?\b\s+wall|wall/, archetype: 'testimonial-wall' },
  { re: /testimonial|review|quote/, archetype: 'testimonial' },
  // case-study absorbs the library's "customer story" / "success story" naming —
  // must precede the editorial cue below, which matches the bare word "story".
  { re: /case[-_\s]?stud|customer[-_\s]?stor|success[-_\s]?stor/, archetype: 'case-study' },
  // pricing is PRICING-ANCHORED: only fires on real pricing/subscription language.
  // (RC-2: bare "tiers" / "plans" used to hijack non-pricing sections — e.g. "tiers
  // from policy rows" — into pricing. A bare "plans"/"tiers" is too ambiguous; an
  // author who means a pricing table writes "pricing" or declares "pricing: …".)
  { re: /pricing|\bprice\b|price[-_\s]?tiers?|subscriptions?\b|per[-_\s]?(seat|user|month|year)\b/, archetype: 'pricing' },
  { re: /comparison|compare|\bversus\b|\bvs\.?\b/, archetype: 'plan-comparison' },
  { re: /faq|frequently[-_\s]?asked/, archetype: 'faq' },
  // resources / insights / news (the nurture library) — before the editorial cue.
  { re: /resources?|insights?|\bnews\b|whitepaper|webinar|\bebook\b/, archetype: 'resources' },
  // contact / get-in-touch — its own section, distinct from a generic CTA banner.
  { re: /contact|get[-_\s]?in[-_\s]?touch|reach[-_\s]?(out|us)|talk[-_\s]?to[-_\s]?sales/, archetype: 'contact' },
  { re: /cta\b|call[-_\s]?to[-_\s]?action/, archetype: 'cta-banner' },
  { re: /\bfooter\b/, archetype: 'footer' },
  { re: /editorial|story|manifesto|blog/, archetype: 'editorial' },
  // W69B: `team`/`about` removed — both were bare, unanchored alternatives with a
  // measured 0% true-positive / 100% false-positive rate across the entire real
  // production corpus (SPRINT-W69A-WEBSITE-ROUTING-CORRECTNESS-AUDIT.md §1.2/§1.3/§1.4).
  // `founder` alone is unambiguous; a genuine team/about-us section is still reachable
  // via an explicit `"founder: …"` declaration, the same declared path every other
  // well-served archetype in the real corpus already uses.
  { re: /founder/, archetype: 'founder' },
  { re: /integration/, archetype: 'integrations' },
  // Generic feature / section falls to feature-grid
  { re: /feature|benefit|section/, archetype: 'feature-grid' },
];

/** Map a brief must-include string to the best-fit website Archetype. */
function mustIncludeToArchetype(mustIncludeStr: string): Archetype {
  const lower = mustIncludeStr.toLowerCase();
  for (const { re, archetype } of WEBSITE_KEYWORD_MAP) {
    if (re.test(lower)) return archetype;
  }
  return 'feature-grid'; // safe fallback within the closed set
}

/**
 * Parse an optional explicit archetype declaration from a must-include entry.
 *
 * Syntax: `"<archetype>: <intent>"` where `<archetype>` is a member of the closed
 * Archetype set (spaces are normalized to hyphens, so `"feature spotlight: …"` and
 * `"feature-spotlight: …"` both resolve). When present, the author's declaration
 * WINS over keyword inference (RC-1b: short subject-named sections that keyword
 * inference collapses to the feature-grid fallback can be pinned explicitly), and
 * the prefix is stripped from the stored intent.
 *
 * Backward-compatible: when the head before the first colon is not a known
 * archetype, the entry is treated as a plain must-include string — so ordinary
 * copy with a colon (e.g. `"Statutory Determinism: GST 18%"`) is preserved verbatim
 * and still classified by keyword inference.
 */
function parseMustInclude(raw: string): { declared?: Archetype; intent: string } {
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const head = raw.slice(0, colon).trim().toLowerCase().replace(/\s+/g, '-');
    if (isArchetype(head)) {
      return { declared: head, intent: raw.slice(colon + 1).trim() };
    }
  }
  return { intent: raw };
}

/** Slugify a string to a valid HTML id (deterministic). */
function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';
}

/**
 * Sprint W83 — the track-neutral governance reference identity for a must-include-derived
 * PlanItem: the SAME intent-only slug website already computes for its own anchor id (the
 * declared-archetype prefix, if any, stripped via parseMustInclude — see PlanItem.governance-
 * ReferenceId in types.ts). Pure function of the brief content alone: never track-specific,
 * never client-specific. Exported so both track builders (and no one else) attach the same
 * identity for the same must-include entry, closing the W82 cross-track id divergence without
 * duplicating this derivation.
 */
export function governanceReferenceIdFor(mustInclude: string): string {
  return toSlug(parseMustInclude(mustInclude).intent);
}

/**
 * De-duplicate a base id against an already-used set, suffixing `-2`, `-3`, ... on collision.
 * Mutates `used` by adding the resolved id. The single shared suffixing algorithm for every
 * id-assigning loop in this file (anchor ids, W83 governance reference ids) — one
 * implementation, not a re-derived copy per call site.
 */
function dedupeId(base: string, used: Set<string>, fallback = 'section'): string {
  let id = base || fallback;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base || fallback}-${suffix++}`;
  }
  used.add(id);
  return id;
}

/** Build a SectionAnchor from a section id (anchor = id, no landmark for generated sections). */
function anchorFor(id: string, landmark?: string): SectionAnchor {
  return { id, anchor: id, ...(landmark ? { landmark } : {}) };
}

// ── Landmark assignment for well-known website archetypes ─────────────────────
const WEBSITE_ARCHETYPE_LANDMARK: Partial<Record<Archetype, string>> = {
  footer: 'contentinfo',
};

function landmarkFor(archetype: Archetype): string | undefined {
  return WEBSITE_ARCHETYPE_LANDMARK[archetype];
}

// ── Token-role binding ────────────────────────────────────────────────────────
// Minimal: provide the custom-prop names the archetype conventionally uses.
// Derived from the available token keys in ctx.tokens. For website, the typical
// pattern is color tokens (--color-* or --cr-*) + type tokens (--font-*).
// Phase 3 reads these; keep YAGNI.
function bindTokenRoles(archetype: Archetype | string, tokenKeys: string[]): string[] {
  // For specific archetypes, bind the most relevant roles (minimal — YAGNI).
  const archetypeStr = String(archetype).toLowerCase();
  const roles: string[] = [];

  // Always include a background + foreground token if present
  for (const key of tokenKeys) {
    if (/bg|background/.test(key)) { roles.push(key); break; }
  }
  for (const key of tokenKeys) {
    if (/fg|foreground|text/.test(key)) { roles.push(key); break; }
  }
  // Include brand/accent for hero and cta-banner
  if (archetypeStr === 'hero' || archetypeStr === 'cta-banner' || archetypeStr === 'coverpage') {
    for (const key of tokenKeys) {
      if (/accent|brand|primary/.test(key)) { roles.push(key); break; }
    }
  }
  // Include font tokens for content-heavy archetypes
  if (/feature|content|editorial|footer|testimonial/.test(archetypeStr)) {
    for (const key of tokenKeys) {
      if (/font|type/.test(key)) { roles.push(key); break; }
    }
  }

  // Deduplicate (preserve order)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const r of roles) {
    if (!seen.has(r)) { seen.add(r); deduped.push(r); }
  }

  return deduped;
}

// ── Website plan building ─────────────────────────────────────────────────────

function buildWebsitePlan(
  ctx: DesignContext,
  warnings: string[],
  opts: PlanOptions = {},
): {
  items: PlanItem[];
  binding: BindingResult;
  accounting: SourceAccounting;
  enginePaddingConsumerIds: string[];
} {
  const tokenKeys = Array.from(ctx.tokens.customProps.keys());
  const items: PlanItem[] = [];
  const usedIds = new Set<string>();
  // Items added by floor-padding (not from the brief) — trimmed FIRST when over
  // the section ceiling so explicit brief input is never silently dropped.
  const paddingItems = new Set<PlanItem>();

  // 1. Seed from brief.mustInclude (primary) — ordered, traceable to the brief.
  //    An explicit `"<archetype>: intent"` declaration (RC-1b) wins over keyword
  //    inference; otherwise the (stripped) intent is classified by keyword cues.
  for (const mustInclude of ctx.brief.mustInclude) {
    const { declared, intent } = parseMustInclude(mustInclude);
    const archetype = declared ?? mustIncludeToArchetype(intent);
    const baseId = toSlug(intent);
    // Deduplicate ids by appending -2, -3, etc.
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) { id = `${baseId}-${suffix++}`; }
    usedIds.add(id);

    items.push({
      anchor: anchorFor(id, landmarkFor(archetype)),
      archetype,
      tokenRoles: bindTokenRoles(archetype, tokenKeys),
      intent,
      // W83 — website's own id for a must-include-derived item IS ALREADY the track-neutral
      // identity (intent-only, prefix stripped): no separate computation needed.
      governanceReferenceId: id,
    });
  }

  // 2. Enforce the track floor: pad to ≥ WEBSITE_MIN_SECTIONS + ≥ WEBSITE_MIN_DISTINCT
  //    Deterministic: pad from WEBSITE_DEFAULT_SECTIONS in fixed order; skip if already present.
  const presentArchetypes = new Set(items.map((i) => i.archetype));
  let padIndex = 0;
  while (
    items.length < WEBSITE_MIN_SECTIONS ||
    presentArchetypes.size < WEBSITE_MIN_DISTINCT
  ) {
    // If we've exhausted the defaults, stop (no infinite loop)
    if (padIndex >= WEBSITE_DEFAULT_SECTIONS.length) break;

    const def = WEBSITE_DEFAULT_SECTIONS[padIndex++];

    // Skip if this archetype is already well-covered AND we have enough sections
    if (presentArchetypes.has(def.archetype) && items.length >= WEBSITE_MIN_SECTIONS) {
      continue;
    }
    // Also skip if adding this would push distinct count beyond max (only if already meeting min)
    if (
      !presentArchetypes.has(def.archetype) &&
      presentArchetypes.size >= WEBSITE_MAX_DISTINCT
    ) {
      continue;
    }

    // Avoid duplicate ids
    let id = def.id;
    if (usedIds.has(id)) {
      id = `${def.id}-default`;
      if (usedIds.has(id)) continue;
    }
    usedIds.add(id);

    const padItem: PlanItem = {
      anchor: anchorFor(id, landmarkFor(def.archetype)),
      archetype: def.archetype,
      tokenRoles: bindTokenRoles(def.archetype, tokenKeys),
      intent: def.intent,
      // W83 — a floor-padding default has no brief-derived identity; its own id IS its
      // (track-scoped) governance reference — see WEBSITE_DEFAULT_SECTION_IDS.
      governanceReferenceId: id,
    };
    items.push(padItem);
    paddingItems.add(padItem);
    presentArchetypes.add(def.archetype);
  }

  // 3. Cap at the section ceiling WITHOUT silently destroying brief input.
  //    Trim padding first (newest-padding-first, so the floor's leading story
  //    arc survives longest); only if the brief's own mustInclude exceeds the
  //    ceiling do we drop brief items — loudly, and from the TAIL of the
  //    brief-derived block (never the middle by index).
  trimToCeiling(items, paddingItems, ctx, warnings);

  // 4. Footer last, then break §2.8 adjacent-repeats deterministically.
  pinFooterLast(items);
  breakAdjacentRepeats(items);

  // 5. Forward the brief body's per-section copy onto the matching items
  //    (W2-S2 explicit two-tier binding). Identity-based, so it is order-independent
  //    of the reorders above.
  const binding = attachBriefContent(items, ctx.brief.mustInclude, ctx.brief.body, warnings);

  // W70 — Website Visual Discovery TRANSPORT (default OFF ⇒ byte-identical). Computed AFTER content
  // is fully bound (step 5, just above) so the discriminator sees the section's actual bound copy,
  // and BEFORE composition assignment (step 6) per the W68 architecture's stated ordering (§7.1).
  // W72 — now genuinely consumed as the FINAL late-stage tie-break in BOTH selectors (the composition
  // router, below, and assignWebsiteFragments's pickFragment call) — never candidate widening, never
  // an override of a structurally superior match; see websiteVisualDiscoveryTieBreak.
  if (opts.websiteVisualDiscovery) {
    const visualDiscoveryProvider = createWebsiteVisualDiscoveryProvider();
    for (const item of items) {
      item.visualDiscovery = visualDiscoveryProvider.discoveryFor(item);
    }
  }

  // W16 Goal 2 — one brief-affinity scorer, shared by BOTH website selectors so the chosen variant is
  // coherent (the composition router's componentVariant/sectionGuidance + the pasted base fragment agree
  // on the brief-appropriate variant). Built ONLY when governed selection is enabled; otherwise undefined
  // ⇒ both selectors keep their catalog-order/rotation behaviour ⇒ byte-identical (the disabled default).
  const briefScorer: ((v: VariantMeta) => number) | undefined = opts.governedSelection
    ? ((): ((v: VariantMeta) => number) => {
        const profile = briefSelectionProfile(ctx.brief);
        return (v: VariantMeta) => fragmentBriefScore(v, profile);
      })()
    : undefined;

  // W19 — the FIRST semantic consumer. Built ONLY when semantic selection is enabled; threaded into
  // BOTH selectors (same coherence rule as the W16 brief scorer) so the router's componentVariant and
  // the pasted fragmentId agree. It participates ONLY as the final tie-breaker (after structural /
  // governance / adjacency) and consumes ONLY Choose-when / Avoid-when / Composition. Absent
  // (default) ⇒ both selectors byte-identical.
  const semantic: SemanticSelection | undefined = opts.semanticSelection
    ? { consumer: createSemanticSelectionConsumer(), briefTerms: briefTermsOf(ctx.brief) }
    : undefined;

  // W24 — the FIRST consumer of the W23 family layer. Built ONLY when family selection is enabled;
  // threaded into BOTH selectors (same coherence rule as W16/W19) so the router's componentVariant and
  // the pasted fragmentId agree. It participates ONLY as a SECONDARY discriminator (below structural /
  // governance / adjacency / W19 component semantics) and consumes ONLY the 16 family dimensions. The
  // candidate→family mapping is the canonical projection (PKG-2 bridge). Absent (default) ⇒ both
  // selectors byte-identical.
  const family: FamilySelection | undefined = opts.familySelection
    ? { consumer: createFamilySelectionConsumer(), briefTerms: briefTermsOf(ctx.brief) }
    : undefined;

  // W30 — the FIRST consumer of the mission/audience metadata layer. Built ONLY when mission selection
  // is enabled; threaded into BOTH selectors (same coherence rule as W16/W19/W24) so the router's
  // componentVariant and the pasted fragmentId agree. It participates ONLY as the FINAL quality
  // discriminator (below structural / governance / adjacency / W19 / W24) and consumes ONLY the derived
  // mission/audience profile (grounded in each variant's projection direction/angle/blocks). Absent
  // (default) ⇒ both selectors byte-identical.
  const mission: MissionAudienceSelection | undefined = opts.missionSelection
    ? { consumer: createMissionAudienceConsumer(), briefProfile: briefProfileOf(briefTermsOf(ctx.brief)) }
    : undefined;

  // 6. A2/A1: route each section to a COMPOSITION.md variant + emit its per-section recipe
  //    (componentVariant / surfaceRole / composition / sectionGuidance). Runtime-parses the
  //    catalog (fail-loud) so a governance edit updates routing + limits with no code change.
  //    W16: brief-aware when a scorer is present (the authoritative router for rails + guidance).
  const rhythmAudit: RhythmAdjustment[] = [];
  assignWebsiteCompositions(items, projectedCompositionRows(), warnings, undefined, briefScorer, semantic, family, mission, opts.w16BandDelta ?? 0, opts.rhythmCadence ?? false, rhythmAudit);
  // W50 Track 3.5 — surface the presentation-cadence trail (deterministic, explainable). These are
  // NOT problems; each records a surface-only change with structural intent unchanged.
  for (const a of rhythmAudit) {
    warnings.push(
      `Rhythm adjustment: section[${a.sectionIndex}] "${a.anchorId}" (${a.archetype}) surface ` +
        `${a.beforeSurface}→${a.afterSurface} (variant ${a.beforeVariant}→${a.afterVariant}) — ${a.reason}`,
    );
  }

  // 6b. WS9a (EA-019): constitution-by-selection — SELECT each section's catalog fragment
  //     (fragmentId + candidates) via the existing selection algebra. This sets the LIVE band the
  //     website assembly pastes/edits (assembleWebsiteBySelection → loadFragmentHtml(fragmentId)).
  //     W16: same brief scorer as the router above, so the pasted base fragment agrees with the
  //     router's chosen variant for the hero; disabled ⇒ catalog-order tiebreak ⇒ byte-identical.
  assignWebsiteFragments(items, briefScorer, semantic, family, mission, opts.w16BandDelta ?? 0, opts.sectionUsageHistory);

  // 6c. W20 — semantic AUTHOR CONTEXT (transport only). Attach each selected component's authored
  //     Purpose / Character / Contract / Judgement (verbatim) to its PlanItem, so the author request
  //     can surface a `## Component Knowledge` block. Built ONLY when enabled; nothing interprets it.
  //     Absent (default) ⇒ no field attached ⇒ author request byte-identical. Keyed on the SELECTED
  //     component (fragmentId, the band the author edits; falls back to componentVariant).
  if (opts.semanticAuthorContext) {
    const provider = createComponentKnowledgeProvider();
    for (const item of items) {
      const slug = item.fragmentId ?? item.componentVariant;
      if (!slug) continue;
      const knowledge = provider.knowledgeFor(slug);
      if (knowledge) item.componentKnowledge = knowledge;
    }
  }

  // 6d. P24 — Content Capacity TRANSPORT (Foundation stage only). Attach each selected component's
  //     authored `## Content Capacity` (P23-designed slot/shape/bounds declaration) to its PlanItem,
  //     verbatim, so a FUTURE consumer may read it. Built ONLY when enabled; nothing interprets it
  //     this sprint. Absent (default) ⇒ no field attached ⇒ byte-identical. Same keying discipline as
  //     W20 componentKnowledge (fragmentId, falling back to componentVariant) — the SELECTED
  //     component is the only one Content Capacity has an opinion about.
  if (opts.contentCapacity) {
    const capacityProvider = createContentCapacityProvider();
    for (const item of items) {
      const slug = item.fragmentId ?? item.componentVariant;
      if (!slug) continue;
      const capacity = capacityProvider.capacityFor(slug);
      if (capacity) item.contentCapacity = capacity;
    }
  }

  // 7. W2-S3: complete fidelity accounting over the binding. The website path has no
  //    declared source-doc, so there is no source-document grounding to fold in.
  const accounting = buildSourceAccounting(binding);

  // 8. GAP-1: declare which surviving consumers are engine-default floor-padding (DATA
  //    only). Computed from the final item list ∩ paddingItems so reordered/trimmed
  //    padding is reflected exactly; the fidelity classifier downgrades these to Warning.
  const enginePaddingConsumerIds = items
    .filter((i) => paddingItems.has(i))
    .map((i) => i.anchor.id);

  return { items, binding, accounting, enginePaddingConsumerIds };
}

/**
 * WS9a (EA-019/EA-020) — constitution-by-selection planner step (website-only).
 *
 * After composition routing, SELECT each section's catalog fragment from the WS1
 * COMPOSITION-backed catalog by `serves` meta (≥2 candidates, never by filename),
 * reusing the existing selection algebra exactly as-is: `selectCandidates` for the
 * candidate set and `pickFragment` (best-fit on the serves target + within-page
 * rotation) for the choice. Sets `item.fragmentId` + `item.candidates` — the audit
 * trail curation.ts serializes as the Curation Table.
 *
 * DORMANT until WS6/WS9b: the metadata is persisted into rulebook.md but is not yet
 * assembled into the shipped page, so the live website deliverable stays byte-identical.
 * Deterministic given the catalog + item order. The collateral plan path never calls this.
 */
function assignWebsiteFragments(
  items: PlanItem[],
  briefScore?: (f: FragmentEntry) => number,
  semantic?: SemanticSelection,
  family?: FamilySelection,
  mission?: MissionAudienceSelection,
  w16BandDelta = 0,
  recent: ReadonlyMap<string, number> = new Map(),
): void {
  const catalog = loadFragmentCatalog();
  const usedThisPage = new Set<string>();
  let prevArchetype: Archetype | undefined;
  for (const item of items) {
    const serves = ARCHETYPE_TO_SERVES[item.archetype as Archetype];
    if (!serves) continue; // defensive: a non-website archetype on the website track
    const candidates = selectCandidates(serves, catalog);
    // W19 — the final tie-breaker (after best-fit/adjacency/within-page/brief). Higher = better; an
    // effectively-excluded candidate is passed a large penalty so it loses the tie but is never
    // removed. Absent ⇒ pickFragment's semantic key is a constant 0 ⇒ byte-identical.
    const semanticScore = semantic
      ? ((): ((f: FragmentEntry) => number) => {
          const ctx = {
            briefTerms: semantic.briefTerms,
            precedingRoleTerms: prevArchetype ? roleTermsForArchetype(prevArchetype) : undefined,
          };
          return (f: FragmentEntry) => {
            const v = semantic.consumer.scoreFor(f.slug, ctx);
            return v ? (v.excluded ? -1e6 : v.score) : 0;
          };
        })()
      : undefined;
    // W24 — the family discriminator, BELOW the W19 component-semantic key. Higher = better; an
    // effectively-excluded candidate is passed a large penalty so it loses the tie but is never
    // removed. The candidate→family mapping is the canonical projection (consumer-resolved). Absent
    // ⇒ pickFragment's family key is a constant 0 ⇒ byte-identical.
    const familyScore = family
      ? ((): ((f: FragmentEntry) => number) => {
          const ctx = {
            briefTerms: family.briefTerms,
            precedingRoleTerms: prevArchetype ? roleTermsForArchetype(prevArchetype) : undefined,
          };
          return (f: FragmentEntry) => {
            const v = family.consumer.scoreFor(f.slug, ctx);
            return v ? (v.excluded ? -1e6 : v.score) : 0;
          };
        })()
      : undefined;
    // W30 — the mission/audience discriminator, BELOW the W24 family key. Higher = better; no
    // exclusion (a zero-overlap candidate scores 0 and stays). The candidate's derived profile is
    // resolved from the projection (consumer). Absent ⇒ pickFragment's mission key is a constant 0 ⇒
    // byte-identical.
    const missionScore = mission
      ? ((): ((f: FragmentEntry) => number) => {
          const ctx = { briefProfile: mission.briefProfile };
          return (f: FragmentEntry) => mission.consumer.scoreFor(f.slug, ctx) ?? 0;
        })()
      : undefined;
    // W72 — the FINAL late-stage discriminator, consuming ONLY the item's own already-transported
    // `visualDiscovery` (W70); never a new evidence source, never a widened pool (same `candidates`
    // every key above already ranks). Absent transport / agreement ⇒ undefined ⇒ constant 0 ⇒
    // byte-identical (the disabled default).
    const visualTieBreak = websiteVisualDiscoveryTieBreak(item.visualDiscovery);
    const visualScore = visualTieBreak ? (f: FragmentEntry) => visualTieBreak(f.serves) : undefined;
    // W16 Goal 2: briefScore (when present) breaks the equal-fit tie by brief character; absent ⇒
    // catalog-order tiebreak (byte-identical). prev is undefined here (the page-level adjacency pass
    // is COMPOSITION-routed; fragment selection diversifies within-page + by brief affinity).
    // P47: `recent` is the persisted cross-page section-usage history — the picker's rotation key
    // now pushes toward unused inventory across generations. Empty (default) ⇒ constant-0 key ⇒
    // byte-identical to the pre-P47 baseline.
    const chosen = pickFragment(candidates, usedThisPage, recent, serves, undefined, briefScore, semanticScore, familyScore, missionScore, w16BandDelta, visualScore);
    usedThisPage.add(chosen);
    item.candidates = candidates.map((c) => c.slug);
    item.fragmentId = chosen;
    prevArchetype = item.archetype as Archetype;
  }
}

/**
 * Trim the plan down to WEBSITE_MAX_SECTIONS. Padding items go first (in reverse
 * insertion order). Only when the brief's own mustInclude count alone exceeds
 * the ceiling do we drop brief-derived items — and then we warn loudly and drop
 * from the tail of the brief block, never by middle index.
 */
function trimToCeiling(
  items: PlanItem[],
  paddingItems: Set<PlanItem>,
  ctx: DesignContext,
  warnings: string[],
): void {
  // Remove padding from the end first.
  for (let i = items.length - 1; i >= 0 && items.length > WEBSITE_MAX_SECTIONS; i--) {
    if (paddingItems.has(items[i])) items.splice(i, 1);
  }
  if (items.length <= WEBSITE_MAX_SECTIONS) return;

  // Brief mustInclude alone exceeds the ceiling — surface what is being cut via the
  // plan's warnings array (not console) so the caller can report or react.
  const dropped = items.slice(WEBSITE_MAX_SECTIONS);
  items.length = WEBSITE_MAX_SECTIONS;
  warnings.push(
    `Offscript plan: brief.mustInclude for "${ctx.client}" has more entries than the ` +
      `§2.3 ceiling of ${WEBSITE_MAX_SECTIONS} sections. Dropped (from the tail, in order): ` +
      `${dropped.map((d) => `"${d.intent}"`).join(', ')}. ` +
      `Reduce mustInclude or split into multiple deliverables.`,
  );
}

/** Move a footer item (if any) to the last position. */
function pinFooterLast(items: PlanItem[]): void {
  const footerIdx = items.findIndex((i) => i.archetype === 'footer');
  if (footerIdx !== -1 && footerIdx !== items.length - 1) {
    const [footer] = items.splice(footerIdx, 1);
    items.push(footer);
  }
}

/**
 * Break §2.8 adjacent same-archetype repeats with a deterministic, stable greedy
 * pass: for each position whose archetype equals its predecessor's, pull the
 * NEXT item with a differing archetype forward into that slot (a stable rotation
 * that preserves relative order of everything else). `footer` stays pinned last
 * and is never moved into an interior slot.
 *
 * Degenerate case: when a single archetype dominates mustInclude beyond what the
 * distinct sections can interleave (e.g. five "features" entries → five
 * feature-grid items), the repeat is genuinely unbreakable. We accept the
 * residual rather than fabricate sections; section-count-rhythm then emits its
 * §2.8 adjacent-repeat warning at rail time (the plan is honest, not silently
 * "perfect").
 */
function breakAdjacentRepeats(items: PlanItem[]): void {
  // The footer (last item) is pinned; only reorder the prefix before it.
  const hasFooterLast = items.length > 0 && items[items.length - 1].archetype === 'footer';
  const end = hasFooterLast ? items.length - 1 : items.length;

  for (let i = 1; i < end; i++) {
    if (items[i].archetype !== items[i - 1].archetype) continue;
    // Find the next item (within the reorderable region) that differs from i-1.
    let swapFrom = -1;
    for (let j = i + 1; j < end; j++) {
      if (items[j].archetype !== items[i - 1].archetype) {
        swapFrom = j;
        break;
      }
    }
    if (swapFrom === -1) continue; // unbreakable from here on — accept residual
    // Stable rotation: move items[swapFrom] into slot i, shifting the rest right.
    const [pulled] = items.splice(swapFrom, 1);
    items.splice(i, 0, pulled);
  }
}

// ── Brief body → per-section content ─────────────────────────────────────────
// W2-S2 replaced the heading-only `splitBodyChunks` (whose zero-chunk early-return
// silently dropped heading-less bodies — the live R1) with the two-tier source-unit
// extractor (source-units.ts) + the explicit binder (source-binding.ts). The binder
// records every unit's disposition (bound | unmatched | unused) + per-consumer
// grounding as DATA — no signals, no failures. See attachBriefContent below.

/**
 * Attach each plan item's brief copy (Option A matcher). One-to-one, order-stable:
 * walk items in plan order; claim the first unconsumed chunk by slug-equality first,
 * then by archetype-equality (so `## 6. Final CTA` → the `cta`/`cta-banner` item,
 * which slug-equality misses). No positional fallback — a positional guess silently
 * mis-assigns copy when a chunk is missing or extra. Unmatched items keep `content`
 * undefined (today's behaviour); unmatched chunks are surfaced loudly via `warnings`.
 *
 * Track-agnostic: for collateral, item.archetype is a CollateralArchetype string
 * (CoverPage/…) that never equals a website Archetype, so slug-equality and the
 * unique-substring tier below carry the matching there — collateral pages match by
 * heading → intent, and real briefs rarely make the heading byte-identical to the
 * must-include intent, so a third tier matches on unique containment (either
 * direction) when EXACTLY ONE unconsumed chunk qualifies (ambiguous → no match).
 *
 * Inter-item edge: because `consumed` is shared and items are walked in order, an
 * early item's tier-3 substring match can claim a chunk that is the exact tier-1
 * match of a later item (e.g. an early "closing-remarks" item consuming the
 * `closing` chunk before a later item whose intent slug is exactly `closing`). This
 * is rare, and it never silently mis-assigns: the starved later item keeps `content`
 * undefined and the trailing `warnings` pass surfaces any chunk left unconsumed.
 */
function attachBriefContent(
  items: PlanItem[],
  mustInclude: string[],
  body: string,
  warnings: string[],
): BindingResult {
  // W2-S2: extract two-tier source units (W2-S1 multi-boundary — heading-less /
  // preamble bodies no longer collapse to zero) and bind them to consumers
  // EXPLICITLY. The binding is DATA only — no AuthoritySignals, no Failure emission
  // (those are W2-S3/S4, owner `source-fidelity`). Content is applied to items here;
  // the BindingResult (every unit's disposition + per-consumer grounding) is returned
  // for the later fidelity-accounting stage.
  const units = extractSourceUnits({ mustInclude, body });
  const { result, contentByConsumer } = bindSourceUnits(
    units,
    items.map((i) => ({ id: i.anchor.id, intent: i.intent, archetype: String(i.archetype) })),
    mustIncludeToArchetype,
  );

  for (const item of items) {
    const content = contentByConsumer.get(item.anchor.id);
    if (content !== undefined) item.content = content;
  }

  // Preserve the prior unmatched-body warning: a Tier-2 segment that found no consumer.
  // (Tier-1 'unused' + per-consumer grounding live in the returned BindingResult, for
  // W2-S3 to account — they are not pushed to the string `warnings` channel here.)
  for (const b of result.bindings) {
    if (b.tier === 2 && b.disposition === 'unmatched') {
      warnings.push(
        `Offscript plan: brief body section "${b.unitSlug || '(untitled)'}" matched no planned ` +
          `section — its content was not forwarded to the author. ` +
          `Align the brief heading with a must-include entry to forward it.`,
      );
    }
  }

  return result;
}

// ── Collateral plan building ──────────────────────────────────────────────────

function buildCollateralPlan(
  ctx: DesignContext,
  warnings: string[],
  opts: PlanOptions = {},
): {
  items: PlanItem[];
  binding: BindingResult;
  accounting: SourceAccounting;
  enginePaddingConsumerIds: string[];
} {
  const tokenKeys = Array.from(ctx.tokens.customProps.keys());
  const items: PlanItem[] = [];

  // Long-form collateral: the page count FOLLOWS THE BRIEF (one page per must-include
  // item), clamped to the format's [MIN, MAX] range. The fixed 4-archetype vocabulary
  // is reused across the sequence — Cover first, Closing last, interiors are Content or
  // Stats — so a multi-page field guide stays within the closed component library
  // (anti-framework invariant) while honouring the house rule "page count + order
  // chosen for this content — nothing is fixed". An empty brief falls back to the
  // 4-page sell-sheet default.
  const targetCount = Math.min(
    Math.max(
      ctx.brief.mustInclude.length > 0
        ? ctx.brief.mustInclude.length
        : COLLATERAL_PAGE_DEFAULT,
      COLLATERAL_PAGE_MIN,
    ),
    COLLATERAL_PAGE_MAX,
  );

  // An interior page is a StatsPage when its brief item reads metric/comparison/
  // numbers-heavy; otherwise a ContentPage. Cover (first) and Closing (last) are
  // positional. The four archetype STRINGS are the closed vocabulary — no new types.
  // Bounded suffix groups tolerate plurals and common inflections (metrics, numbers,
  // comparing, evaluating, reliability) WITHOUT over-firing on stat-PREFIXED non-stat
  // words (statement, static, statutory): every stem closes on a \b after an explicit,
  // enumerated suffix set — never \w*.
  const STATS_RE =
    /\b(stats?|metrics?|numbers?|compar(?:e|es|ed|ing|ison|isons|able)?|eval(?:uate|uates|uated|uating|uation|uations)?|scal(?:e|es|ed|ing|ability)?|pilots?|reliab(?:le|ility)?|benchmark(?:s|ed|ing)?|proofs?|who\s+it)\b/i;

  // Unique-id guard: archetypes now repeat across pages, so the page id — which keys
  // the dispatch <id>.request.md / <id>.response.html — must be derived per item and
  // de-duped, or two pages would collide onto one dispatch file.
  const usedIds = new Set<string>();
  const uniqueId = (base: string): string => {
    let id = base || 'page';
    for (let n = 2; usedIds.has(id); n++) id = `${base || 'page'}-${n}`;
    usedIds.add(id);
    return id;
  };
  // W83 — a SEPARATE de-dup namespace for the track-neutral governance reference id (never the
  // collateral-specific anchor id, which retains any declared-archetype prefix — see
  // governanceReferenceIdFor). Both track builders iterate ctx.brief.mustInclude in the same
  // original order, so the same collision produces the same suffix on both tracks.
  const usedGovernanceIds = new Set<string>();

  for (let i = 0; i < targetCount; i++) {
    const isLast = i === targetCount - 1;
    const mustInclude = ctx.brief.mustInclude[i];
    const archetype: CollateralArchetype =
      i === 0
        ? 'CoverPage'
        : isLast
          ? 'ClosingPage'
          : mustInclude && STATS_RE.test(mustInclude)
            ? 'StatsPage'
            : 'ContentPage';

    const id = uniqueId(mustInclude ? toSlug(mustInclude) : archetype.toLowerCase());
    const intent = mustInclude ?? COLLATERAL_ARCHETYPE_NOTES[archetype];
    // W83 — must-include-derived pages share website's intent-only identity (closes the
    // prefix-stripping asymmetry); an archetype-fallback page (no brief content behind it) has
    // no cross-track counterpart, so it keeps its own anchor id as its reference.
    const governanceReferenceId = dedupeId(
      mustInclude ? governanceReferenceIdFor(mustInclude) : id,
      usedGovernanceIds,
      'page',
    );

    items.push({
      anchor: anchorFor(id),
      archetype,
      tokenRoles: bindTokenRoles(archetype, tokenKeys),
      intent,
      governanceReferenceId,
    });
  }

  // Forward the brief body's per-page copy (W2-S2 explicit two-tier binding). For
  // collateral only slug-equality is effective (page archetypes are not website Archetypes).
  const binding = attachBriefContent(items, ctx.brief.mustInclude, ctx.brief.body, warnings);

  // WS4: fill any still-empty page from the declared source doc (brief body wins).
  // W2-S3 carry-forward: snapshot which pages the brief already grounded (have content)
  // BEFORE the source-doc fill, so a page filled ONLY by the source doc is attributable
  // to 'source-doc' grounding (and never reads as authored-from-void).
  const briefFilledIds = new Set(
    items.filter((i) => i.content !== undefined).map((i) => i.anchor.id),
  );
  if (ctx.sourceContent) {
    attachSourceContent(items, ctx.sourceContent, warnings);
  } else if (ctx.brief.sourceDoc) {
    // Declared but not loaded → the path is a typo or the file is missing. Surface it,
    // since silent loss of grounding is worse than a noisy warning.
    warnings.push(
      `Offscript source-doc: declared source-doc "${ctx.brief.sourceDoc}" was not found under ` +
        `references/ — pages fall back to must-include + brief body.`,
    );
  }
  const sourceGroundedIds = items
    .filter((i) => i.content !== undefined && !briefFilledIds.has(i.anchor.id))
    .map((i) => i.anchor.id);

  // W2-S3: complete fidelity accounting, folding source-document grounding into the
  // binding's brief-side grounding (DATA only — no signals/failures).
  const accounting = buildSourceAccounting(binding, sourceGroundedIds);

  // W3-S4: consume IntentBrief.how (register/mood/pace) into composition routing — the
  // single frozen proof site (D8). Load the governance lexicon ONLY when a `how` is present,
  // so absent-intent runs never depend on it (byte-identical baseline). The result is a
  // deterministic re-ordering of EXISTING candidates; an absent/no-cue `how` → [] → no-op.
  const how = ctx.intentBrief?.how;
  const compositionPreference =
    how && how.trim().length > 0
      ? compositionPreferenceFor(how, loadIntentCompositionMap(intentCompositionMapPath()))
      : [];

  // W52 — Presentation Intent TRANSPORT (default OFF ⇒ byte-identical). Computed AFTER content is
  // fully bound (brief body + source-doc fill above) so the classification sees the section's
  // actual bound copy, and BEFORE composition assignment per the W51 architecture's stated
  // ordering (§11). Pure transport: nothing below reads item.presentationIntent in this sprint —
  // composition assignment, WS5 flagship routing, and authoring are all unchanged.
  if (opts.presentationIntent) {
    const presentationIntentProvider = createPresentationIntentProvider();
    for (const item of items) {
      item.presentationIntent = presentationIntentProvider.intentFor(item);
    }
  }

  // WS1: content-aware lead composition per page (after content is fully attached).
  assignCollateralCompositions(items, compositionPreference);
  // WS5: route rich relationship/spatial content — designate one flagship visual page
  // and give the cover a spatial hero when the whole deck is system-heavy.
  routeCollateralVisuals(items);

  // GAP-1: collateral has no floor-padding (pages = one per must-include, or the
  // empty-brief default which the briefSupplied=false path already treats as Warning).
  return { items, binding, accounting, enginePaddingConsumerIds: [] };
}

/**
 * WS5 — count the rich (diagram/spatial) shapes in a page's content signal (0–2).
 *
 * W53 — prefers the already-transported PresentationIntent's source signal (computed once,
 * upstream, from this exact bound content — see presentation-intent.ts) over an independent
 * deriveContentSignal(item) re-derivation. Falls back to a direct derivation when
 * presentationIntent transport is off (default) or absent, so behaviour is unchanged either
 * way: same underlying array, just read once instead of recomputed.
 */
function richShapeCount(item: PlanItem): number {
  const s = item.presentationIntent?.source ?? deriveContentSignal(item);
  return (s.includes('diagram') ? 1 : 0) + (s.includes('spatial') ? 1 : 0);
}

/**
 * WS5 — deterministic rich-visual routing over an assembled collateral plan.
 *
 * (D1) Flagship: among the non-cover/closing pages carrying a diagram/spatial signal,
 *      designate the SINGLE strongest (most rich cues; ties → lowest index) as the one
 *      page allowed the relaxed fit budget. At most one; zero for a prose deck.
 * (C1) Spatial-hero cover: if the deck in aggregate is system-heavy (≥ THRESHOLD pages
 *      carry a rich signal), swap the cover's composition for the spatial-hero variant.
 *
 * Pure index math — no randomness, no LLM. Collateral-only (called from the collateral
 * plan path); website never reaches here.
 */
const SPATIAL_HERO_DECK_THRESHOLD = 3;
function routeCollateralVisuals(items: PlanItem[]): void {
  // (D1) flagship — argmax rich-cue count over content pages, lowest index breaks ties.
  let flagshipIdx = -1;
  let flagshipScore = 0;
  items.forEach((item, i) => {
    if (item.archetype === 'CoverPage' || item.archetype === 'ClosingPage') return;
    const score = richShapeCount(item);
    if (score > flagshipScore) {
      flagshipScore = score;
      flagshipIdx = i;
    }
  });
  if (flagshipIdx >= 0) items[flagshipIdx].flagshipVisual = true;

  // (C1) spatial-hero cover — whole-deck system density over non-cover pages.
  const density = items.filter(
    (item) => item.archetype !== 'CoverPage' && richShapeCount(item) > 0,
  ).length;
  if (density >= SPATIAL_HERO_DECK_THRESHOLD) {
    const cover = items.find((item) => item.archetype === 'CoverPage');
    if (cover) cover.composition = SPATIAL_HERO_COVER;
  }
}

/**
 * WS1 — assign each collateral page a content-aware lead composition.
 *
 * Mirrors assignWebsiteFragments' select→diversify shape: per item, derive a content
 * signal → candidate compositions that fit it → pick the first candidate not used in
 * the last N pages (anti-monotony memory), else the globally least-used. Cover/Closing
 * keep their fixed treatments (their candidate set is the single fixed string). Sets
 * item.composition; author.ts prefers it over the positional assignComposition fallback.
 * Deterministic given the item order.
 */
function assignCollateralCompositions(
  items: PlanItem[],
  preferredCompositions: readonly string[] = [],
): void {
  const WINDOW = 3; // avoid repeating a composition within the last 3 pages
  const recent: string[] = [];
  const useCount = new Map<string, number>();

  for (const item of items) {
    // W53 — read the already-transported signal when available (see richShapeCount above);
    // falls back to a fresh derivation when presentationIntent transport is off/absent.
    const signal = item.presentationIntent?.source ?? deriveContentSignal(item);
    // W3-S4: re-order the EXISTING candidates by the intent-derived preference (identity
    // when preference is empty), THEN run the unchanged anti-monotony pick below. This is
    // the consumption point: intent moves which candidate the existing logic selects.
    const candidates = reorderCandidatesByPreference(
      compositionCandidatesFor(item.archetype, signal),
      preferredCompositions,
    );

    // Prefer a candidate not in the recent window; tie-break by lowest global use.
    // Trailing `?? candidates[0]` decouples this from compositionCandidatesFor's
    // non-empty guarantee — chosen can never be undefined. Identical behaviour for
    // the (always-true) non-empty case.
    const chosen =
      candidates.find((c) => !recent.includes(c)) ??
      [...candidates].sort(
        (a, b) => (useCount.get(a) ?? 0) - (useCount.get(b) ?? 0),
      )[0] ??
      candidates[0];
    item.composition = chosen;
    useCount.set(chosen, (useCount.get(chosen) ?? 0) + 1);
    recent.push(chosen);
    if (recent.length > WINDOW) recent.shift();
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * W16 — plan options. `governedSelection` (website only) turns on brief-aware fragment selection:
 * the brief's character breaks the equal-structural tie instead of catalog order, so different briefs
 * pick different variants. Default (omitted/false) ⇒ catalog-order tiebreak ⇒ byte-identical. Set by
 * generate.ts to match the governance-enabled gate (a per-client pack is present).
 */
export interface PlanOptions {
  readonly governedSelection?: boolean;
  /**
   * W19 — turn on the semantic-body SELECTION consumer (website only): the component's authored
   * Choose-when / Avoid-when / Composition breaks otherwise-tied selection choices. Default
   * (omitted/false) ⇒ no consumer ⇒ both selectors byte-identical. Set by generate.ts from the
   * OFFSCRIPT_SEMANTIC_SELECTION env gate, independent of governance.
   */
  readonly semanticSelection?: boolean;
  /**
   * W20 — attach each selected component's authored Purpose / Character / Contract / Judgement
   * (verbatim) to its PlanItem for TRANSPORT into the author request's `## Component Knowledge`
   * block. Default (omitted/false) ⇒ no field attached ⇒ author request byte-identical. Pure
   * transport: nothing interprets it. Set by generate.ts from the OFFSCRIPT_SEMANTIC_AUTHOR env gate.
   */
  readonly semanticAuthorContext?: boolean;
  /**
   * W24 — turn on the FAMILY-knowledge SELECTION consumer (website only): the candidate's canonical
   * family (the W23 abstract-role layer) breaks otherwise-tied selection choices as a SECONDARY
   * discriminator BELOW structural / governance / adjacency / W19 component semantics. Default
   * (omitted/false) ⇒ no consumer ⇒ both selectors byte-identical. Set by generate.ts from the
   * OFFSCRIPT_FAMILY_SELECTION env gate, independent of governance and of W19.
   */
  readonly familySelection?: boolean;
  /**
   * W30 — turn on the MISSION/AUDIENCE SELECTION consumer (website only): each candidate's derived
   * mission/audience profile (grounded in its projection direction/angle/blocks) is the FINAL quality
   * discriminator, BELOW structural / governance / adjacency / W19 component semantics / W24 family and
   * ABOVE only catalog order. It may raise/lower confidence or break a tie; it never removes a valid
   * candidate. Default (omitted/false) ⇒ no consumer ⇒ both selectors byte-identical. Set by
   * generate.ts from the OFFSCRIPT_MISSION_SELECTION env gate, independent of governance / W19 / W24.
   */
  readonly missionSelection?: boolean;
  /**
   * W33 — the W16 brief-affinity tolerance band δ (the Soft-Band Cascade, W32). The router's W16
   * stage keeps candidates whose brief score is within δ of the best (`keep score >= max − δ`)
   * instead of the exact maximum, so near-tie candidates survive to the W19/W24/W30 stages below.
   * Non-negative integer; default 0 reproduces the exact-max collapse byte-for-byte. Set by
   * generate.ts from the OFFSCRIPT_W16_BAND_DELTA env var. Applies to the composition router only
   * (the authoritative selector); the dormant fragment-picker audit trail is unchanged.
   */
  readonly w16BandDelta?: number;
  /**
   * W50 Track 3 — turn on the presentation-cadence pass (website only): where two adjacent
   * same-archetype sections share a surface, re-pick the later to a within-intent variant of a
   * DIFFERENT surface (identical information, better visual rhythm). Never changes archetype,
   * section role, order, or count — only the surface band. Each change is recorded to the plan's
   * `warnings` as an explainable "Rhythm adjustment:" trail. Default (omitted/false) ⇒ pass never
   * runs ⇒ byte-identical. Set by generate.ts from the OFFSCRIPT_RHYTHM_CADENCE env gate.
   */
  readonly rhythmCadence?: boolean;
  /**
   * W52 — turn on Presentation Intent TRANSPORT (collateral only): each item's governed
   * visual-communication medium + commitment level (per the W51 architecture) is computed once and
   * attached to its PlanItem. Pure transport — nothing reads the attached field in this sprint; no
   * composition/archetype/flagship/author behaviour changes. Default (omitted/false) ⇒ no field
   * attached ⇒ plan + HTML byte-identical. Set by generate.ts from the OFFSCRIPT_PRESENTATION_INTENT
   * env gate. Never attached on website (no content-signal-driven decision exists there).
   */
  readonly presentationIntent?: boolean;
  /**
   * W70 — turn on Website Visual Discovery TRANSPORT (website only): a disagreement flag between
   * each item's already-assigned archetype and its bound content's own structural shape
   * (process/comparison/stats), per the W68 architecture. Pure transport — nothing reads the
   * attached field in this sprint; no selector/archetype/author behaviour changes. Default
   * (omitted/false) ⇒ no field attached ⇒ plan + HTML byte-identical. Set by generate.ts from the
   * OFFSCRIPT_WEBSITE_VISUAL_DISCOVERY env gate. Never attached on collateral (no archetype-shaped
   * selection pool exists there).
   */
  readonly websiteVisualDiscovery?: boolean;
  /**
   * P24 — turn on Content Capacity TRANSPORT (website only, Foundation stage): each selected
   * component's authored `## Content Capacity` (the P23-designed per-slot shape + bounds
   * declaration) is attached to its PlanItem, verbatim. Pure transport — nothing reads the attached
   * field this sprint; no planner/selector/author/renderer/validator behaviour changes. Mirrors
   * W70's OWN Foundation-stage precedent exactly: a plain, default-off flag — NOT
   * resolveGovernedActivation — since there is no consumer yet to govern-activate. Default
   * (omitted/false) ⇒ no field attached ⇒ plan + HTML byte-identical. Set by generate.ts from the
   * OFFSCRIPT_CONTENT_CAPACITY env gate. Never attached on collateral (no catalog-fragment selection
   * exists there). Also absent even when enabled against today's real repository, since no
   * component has yet authored the section (corpus authoring is deferred).
   */
  readonly contentCapacity?: boolean;
  /**
   * P47 — the persisted per-deliverable cross-page section-usage history (slug→prior-use count),
   * fed to the website fragment picker's `recent` rotation key so selection is pushed toward
   * UNUSED inventory across generations (FINDINGS-SECTION-VARIETY-COLLAPSE.md Candidate Remedy #1).
   * An EXPLICIT input — deterministic, no randomness, no hidden state. Website only (collateral has
   * no fragment catalog). Absent/empty ⇒ pickFragment's rotation key is a constant 0 ⇒ byte-identical
   * to the pre-P47 baseline (the first generation for a client). Set by generate.ts from the persisted
   * section-usage.json in the deliverable working dir.
   */
  readonly sectionUsageHistory?: ReadonlyMap<string, number>;
}

/**
 * Turn a DesignContext into a deterministic AuthoringPlan.
 * Throws for deck (mirrors buildContext's deck guard — the plan stage should
 * never silently accept deck even if buildContext fires first).
 */
export function plan(ctx: DesignContext, opts: PlanOptions = {}): AuthoringPlan {
  if (ctx.track === 'deck') {
    throw new Error(
      `Offscript generate: deck track is blocked in the plan stage.\n` +
        `resources/design_processes/deck/ has not yet been supplied by the design team.\n` +
        `buildContext should have thrown first — if you see this, something bypassed Stage 1.`,
    );
  }

  const warnings: string[] = [];
  const { items, binding, accounting, enginePaddingConsumerIds } =
    ctx.track === 'website'
      ? buildWebsitePlan(ctx, warnings, opts)
      : buildCollateralPlan(ctx, warnings, opts);

  return { track: ctx.track, items, warnings, binding, accounting, enginePaddingConsumerIds };
}

// ── Serialization (pure string-returners — no filesystem I/O here) ────────────

/**
 * Serialize the plan's anchors to a YAML string that round-trips through
 * loadSections(). The format is `{ sections: [{ id, anchor, landmark? }] }`.
 * `landmark` is omitted when undefined (never null) to keep the YAML clean.
 */
export function serializeSections(authoringPlan: AuthoringPlan): string {
  const sections = authoringPlan.items.map((item) => {
    const entry: Record<string, string> = {
      id: item.anchor.id,
      anchor: item.anchor.anchor,
    };
    if (item.anchor.landmark) entry.landmark = item.anchor.landmark;
    return entry;
  });
  return stringify({ sections });
}

/**
 * Serialize the plan to a human-readable declarative rulebook markdown.
 * Each item is one markdown section: archetype header + operator params + anchor.
 * INVARIANT: no conditionals, loops, or user-authored operators.
 * This is declarative config only (operator-selection + params + anchors).
 */
export function serializeRulebook(authoringPlan: AuthoringPlan, client: string): string {
  const lines: string[] = [
    `# Offscript Authoring Rulebook`,
    ``,
    `**Track:** ${authoringPlan.track}  `,
    `**Client:** ${client}  `,
    `**Sections:** ${authoringPlan.items.length}`,
    ``,
    `---`,
    ``,
    `<!-- This file is declarative config — operator-selection + params + anchors.`,
    `     No conditionals, loops, or user-authored operators. A programmable`,
    `     rulebook is a banned framework (architecture invariant). -->`,
    ``,
  ];

  for (const item of authoringPlan.items) {
    lines.push(`## ${item.anchor.id}`);
    lines.push(``);
    lines.push(`- **archetype:** \`${String(item.archetype)}\``);
    lines.push(`- **anchor:** \`#${item.anchor.anchor}\``);
    if (item.anchor.landmark) lines.push(`- **landmark:** \`${item.anchor.landmark}\``);
    lines.push(`- **token-roles:** ${item.tokenRoles.length > 0 ? item.tokenRoles.map((r) => `\`${r}\``).join(', ') : '_(none)_'}`);
    lines.push(`- **intent:** ${item.intent}`);
    // W3-S4: record the consumed composition decision in the durable recipe so the
    // intent→composition delta is observable in the persisted plan, not just in-memory.
    if (item.composition) lines.push(`- **composition:** ${item.composition}`);
    lines.push(``);
    // W1 reasoning channel — surfaced in the durable recipe ONLY when a producer populated it.
    // Absent on every item today (the planner never sets it), so this adds NOTHING and the
    // rulebook is byte-identical to pre-W1. See src/generate/section-reasoning.ts.
    const reasoningLines = serializeReasoningLines(item.reasoning);
    if (reasoningLines.length > 0) {
      lines.push(`### Reasoning`);
      lines.push(``);
      lines.push(...reasoningLines);
      lines.push(``);
    }
    lines.push(`### Operators`);
    lines.push(``);
    lines.push(`- **token-normalize** — params: \`{ scope: "${item.anchor.id}" }\``);
    lines.push(`- **contrast** — params: \`{ scope: "${item.anchor.id}", tier: 1 }\``);
    if (item.archetype === 'hero' || item.archetype === 'cta-banner' || item.archetype === 'CoverPage') {
      lines.push(`- **accent-saturation-budget** — params: \`{ scope: "${item.anchor.id}" }\``);
    }
    lines.push(``);
  }

  // Path C (website) — the Curation Table: the catalog audit trail the gate reads from the
  // built page's <main>. Emitted as the exact shippable HTML comment (P3 lifts it verbatim).
  // Empty for collateral (no catalog), so the block is skipped there.
  const curation = serializeCurationComment(authoringPlan.items);
  if (curation) {
    lines.push(`## Curation Table`);
    lines.push(``);
    lines.push(`Every band is SELECTED from the v2 catalog by \`serves\` meta (≥2 candidates,`);
    lines.push(`never by filename). validate-page.js reads the comment below from the built`);
    lines.push(`page's \`<main>\` — the curation audit trail (BRIDGE-1 / ALIGNMENT.md).`);
    lines.push(``);
    lines.push(curation);
    lines.push(``);
  }

  return lines.join('\n');
}
