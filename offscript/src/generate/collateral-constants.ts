/**
 * Collateral format constants — the A4 one-pager geometry and archetype
 * vocabulary the collateral plan uses.
 *
 * Source of truth: `.claude/lib/collateral-formats.json` (`formats.one-pager`).
 * Copied here rather than read at runtime so the engine stays self-contained in
 * the portable export, where `.claude/lib/` is absent. Keep in sync with that
 * file if the page dimensions / archetype vocabulary ever change.
 *
 * Note: this follows the same "copy into TS" pattern as
 * `src/operators/deck/deck-format.ts` — the established convention for registry
 * data that the portable mirror cannot access.
 */

/**
 * Page-count range for the collateral format. The default (4) is the sell-sheet;
 * the max (24) is the long-form field-guide ceiling — the page count FOLLOWS THE
 * BRIEF (one page per must-include item), so a 20-section brief yields 20 pages.
 * The fixed 4-archetype vocabulary below is reused across the sequence; the cap is
 * only a runaway guard, not a target.
 */
export const COLLATERAL_PAGE_MIN = 1;
export const COLLATERAL_PAGE_MAX = 24;
export const COLLATERAL_PAGE_DEFAULT = 4;

/**
 * Ordered collateral page archetypes (page_archetypes from one-pager format).
 * These are not members of the website Archetype union — they are collateral-track
 * vocabulary and are used as strings in PlanItem.archetype.
 */
export const COLLATERAL_PAGE_ARCHETYPES = [
  'CoverPage',
  'ContentPage',
  'StatsPage',
  'ClosingPage',
] as const;

export type CollateralArchetype = (typeof COLLATERAL_PAGE_ARCHETYPES)[number];

/**
 * Human intent descriptions for each collateral archetype (archetype_notes).
 * Used to populate PlanItem.intent when padding from brief is thin.
 */
export const COLLATERAL_ARCHETYPE_NOTES: Record<CollateralArchetype, string> = {
  CoverPage: 'dark hero sheet — headline + subhead + a single CTA + the brand watermark',
  ContentPage: 'the mechanism — section headline + intro + a 3-up FeatureRow and/or a hairline DiagnosticList',
  StatsPage: 'the proof — section headline + intro + a 2x2 stat-card grid (optionally a compact comparison strip)',
  ClosingPage: 'the ask — short label/text rows ("how it works") + a dark CtaStrip + a footer row',
};

/**
 * Per-archetype HOW guidance for the collateral track — the §3.N-equivalent that
 * the website track gets from SECTION_INTELLIGENCE.md but collateral never had
 * (playbookAnchorFor returns undefined for these archetypes by design). This is a
 * CLOSED Record over the 4 collateral archetypes — it never touches the website
 * Archetype Record (track isolation). Dev-seeded default; a Design-supplied
 * design_processes/collateral/SECTION_NOTES.md can override it later (a future seam).
 * Terse, structural — the global contract carries voice/caps.
 */
export const COLLATERAL_ARCHETYPE_GUIDANCE: Record<CollateralArchetype, string> = {
  CoverPage:
    'Lead with one idea at display scale. Eyebrow → oversized headline (≤10 words) → one 25–40 word sub-line → optionally ONE 3-up stat strip on the floor. White text on the bleed navy; room to breathe.',
  ContentPage:
    'ONE lead component of exactly 3 items (label ≤6 words + one ≤18-word line each); a 25–40 word intro above it; AT MOST one supporting band after. 3 rows not 4. Do not stack a second content block — that overflows 265mm.',
  StatsPage:
    'ONE stat treatment of 3–4 rows (ledger / wall / 2×2 cards), numerals ≤4 glyphs; a 25–35 word intro; optionally ONE doc-scoped chart (≤40mm). One stat block + one chart is the ceiling — never two charts.',
  ClosingPage:
    'ONE CTA band (within the margins, no bleed): lede headline ≤14 words + 25–40 word body + a `.cr-btn` + a `.cr-checklist` of ≤4 points (≤9 words each). Flows after a short intro, never anchored into a void.',
};

/** The collateral HOW guidance for an archetype, or '' for an unknown/website archetype. */
export function collateralGuidanceFor(archetype: string): string {
  return (COLLATERAL_ARCHETYPE_GUIDANCE as Record<string, string>)[archetype] ?? '';
}
