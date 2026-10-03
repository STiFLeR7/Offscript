/**
 * Section archetype model (M2 — Track B seam).
 *
 * The 20 marketing-page section archetypes from the website Section Catalog,
 * `resources/design_processes/website/SECTION_INTELLIGENCE.md` Part 3
 * (verbatim names). `ArchetypeModel` is the per-page map from section
 * id to archetype, populated by Track B's `src/operators/archetype-tag.ts`
 * and read by the Group B rails (cta-choreography, section-count-rhythm,
 * narrative-arc-presence, archetype-neighbour-collisions).
 *
 * This module declares the SHAPE only — no detector, no inference logic.
 * Track B's `archetype-tag.ts` ships the population logic. Operators tolerate
 * `undefined` (no archetype model on context → rail no-ops with a single warning).
 *
 * The enum is closed by deliberate spec invariant #2 ("operators are a fixed
 * library, not a DSL"). Adding an archetype is a planning decision, not a
 * config field. New archetypes need a coordinated change across: the website
 * governance catalog (SECTION_INTELLIGENCE.md §3) + this enum + the runtime
 * mirror `ALL_ARCHETYPES` + the detector cues (`archetype-tag.ts` KEYWORD_CUES)
 * + the two TOTAL `Record<Archetype, …>` rail tables (`narrative-arc-presence`
 * STAGE, `archetype-neighbour-collisions` MATRIX_KEY) + the generate author's
 * `ARCHETYPE_PLAYBOOK_ANCHOR` (`generate/playbook-anchors.ts`, archetype → §3.N)
 * + the ONE canonical archetype→serves contract (`generate/archetype-contract.ts`'s
 * `ARCHETYPE_SERVES`, archetype → COMPOSITION.md serves-intent — consumed by BOTH the
 * composition router and the fragment picker; W85 collapsed what used to be two
 * independently-drifting copies, see SPRINT-W85-SELECTOR-CONTRACT-UNIFICATION.md)
 * + the planner's `WEBSITE_KEYWORD_MAP`. tsc enforces the five Record tables; the
 * rest is the coordinated planning decision the closed enum exists to force.
 *
 * `contact` and `resources` were added in the Phase-3 website-vocabulary
 * expansion (the design-team library ships contact/ and resources-insights/
 * sections that had no engine slot). NAV and DIVIDER were deliberately NOT
 * added — a nav carries no arc stage (it composes inside the hero) and a divider
 * is transition chrome with no content; both are author-contract composition
 * guidance, not plan archetypes.
 *
 * Spec: M2 charter (docs/internals/M2-PARALLEL-HANDOFF.md);
 *       playbook source SECTION_INTELLIGENCE.md Part 3;
 *       Phase-3 vocabulary expansion: docs/internals/OFFSCRIPT-V2-WEBSITE-INTEGRATION-PLAN.md §3.
 */

/** The closed set of marketing-page section archetypes (SECTION_INTELLIGENCE.md §3). */
export type Archetype =
  | 'hero'
  | 'sub-hero'
  | 'logo-bar'
  | 'feature-grid'
  | 'feature-spotlight'
  | 'process'
  | 'metrics'
  | 'testimonial'
  | 'testimonial-wall'
  | 'case-study'
  | 'pricing'
  | 'plan-comparison'
  | 'faq'
  | 'cta-banner'
  | 'footer'
  | 'editorial'
  | 'founder'
  | 'integrations'
  | 'contact'
  | 'resources';

/** A single archetype assignment to a section. */
export interface ArchetypeAssignment {
  archetype: Archetype;
  /**
   * How the archetype was decided:
   *  - 'declared'  → from `sections.md` frontmatter
   *  - 'inferred'  → from structural heuristic (h1+image → hero, etc.)
   *  - 'override'  → from `creative-direction.md` policy
   */
  decidedBy: 'declared' | 'inferred' | 'override';
  /** [0..1] confidence — meaningful for 'inferred' only; 1 for declared/override. */
  confidence: number;
}

/**
 * The per-page archetype map. Keys are stable section ids matching
 * `SectionsModel`'s section keys (so rails can join archetype + section
 * data without their own mapping table).
 */
export type ArchetypeModel = Map<string, ArchetypeAssignment>;
