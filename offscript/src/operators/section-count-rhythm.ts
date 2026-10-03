import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { Archetype } from '../archetype.js';

/**
 * Tier-0 rail: section-count-rhythm (M2 Group B, SECTION_INTELLIGENCE.md
 * §2.3 + §2.8).
 *
 * §2.3 — "A marketing page works best with 5–9 sections, drawn from 5–7
 * distinct archetypes. Fewer than five and the page feels like a slogan. More
 * than nine and visitors leave before the CTA."
 * §2.8 — "Don't stack two sections with the same background and the same layout
 * pattern" — two of the same archetype back-to-back reads as one bloated
 * section (the §6.6 "Card carpet").
 *
 * This is a page-level (Tier-0) audit over the ArchetypeModel — no anchor on any
 * one element. Three checks, each a WARNING (the fix — add / cut / reorder
 * sections — is a composition decision, not a mechanical rewrite):
 *   1. total tagged sections outside [5, 9]
 *   2. distinct archetypes outside [5, 7]
 *   3. any two adjacent sections sharing an archetype
 *
 * Counts run over the tagged sections in the ArchetypeModel (insertion order =
 * page order). Per the seam contract, no model → no-op with a single warning.
 *
 * Bounds are params-overridable (minSections / maxSections / minDistinct /
 * maxDistinct) but default to the §2.3 numbers.
 *
 * Spec: M2 charter §4 Task 4; SECTION_INTELLIGENCE.md §2.3, §2.8, §6.6.
 */

/**
 * The §2.3 section-rhythm bounds: 5–9 sections from 5–7 distinct archetypes.
 * Exported as the single source of truth so the generate-stage planner
 * (`src/generate/plan.ts`) can pre-satisfy these floors by construction rather
 * than re-hardcoding the same numbers. Additive export — no behaviour change.
 */
export const SECTION_RHYTHM_DEFAULTS = {
  minSections: 5,
  maxSections: 9,
  minDistinct: 5,
  maxDistinct: 7,
} as const;

const DEFAULTS = SECTION_RHYTHM_DEFAULTS;

export const sectionCountRhythm: Operator = {
  name: 'section-count-rhythm',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    if (!ctx.archetypeModel) {
      return [
        {
          id: 'section-count-rhythm:no-archetype-model',
          description:
            'archetype model not available on context (run archetype-tag first) — section-count-rhythm skipped',
          outcome: 'warning',
        },
      ];
    }

    const minSections = numParam(ctx.params.minSections, DEFAULTS.minSections);
    const maxSections = numParam(ctx.params.maxSections, DEFAULTS.maxSections);
    const minDistinct = numParam(ctx.params.minDistinct, DEFAULTS.minDistinct);
    const maxDistinct = numParam(ctx.params.maxDistinct, DEFAULTS.maxDistinct);

    const sequence: Array<{ id: string; archetype: Archetype }> = [];
    for (const [id, a] of ctx.archetypeModel) sequence.push({ id, archetype: a.archetype });

    const findings: Finding[] = [];
    const total = sequence.length;

    // 1. total section count
    if (total < minSections) {
      findings.push({
        id: 'section-count-rhythm:too-few-sections',
        description: `${total} tagged section(s) — below the §2.3 floor of ${minSections}; the page reads as a slogan, not a story`,
        outcome: 'warning',
      });
    } else if (total > maxSections) {
      findings.push({
        id: 'section-count-rhythm:too-many-sections',
        description: `${total} tagged section(s) — above the §2.3 ceiling of ${maxSections}; visitors leave before the CTA`,
        outcome: 'warning',
      });
    }

    // 2. distinct archetype count
    const distinct = new Set(sequence.map((s) => s.archetype));
    if (distinct.size < minDistinct) {
      findings.push({
        id: 'section-count-rhythm:too-few-archetypes',
        description: `${distinct.size} distinct archetype(s) across ${total} section(s) — below the §2.3 floor of ${minDistinct}; the page lacks variety`,
        outcome: 'warning',
      });
    } else if (distinct.size > maxDistinct) {
      findings.push({
        id: 'section-count-rhythm:too-many-archetypes',
        description: `${distinct.size} distinct archetype(s) — above the §2.3 ceiling of ${maxDistinct}; the page lacks cohesion`,
        outcome: 'warning',
      });
    }

    // 3. adjacent same-archetype sections
    for (let i = 1; i < sequence.length; i++) {
      const prev = sequence[i - 1];
      const cur = sequence[i];
      if (prev.archetype === cur.archetype) {
        findings.push({
          id: `section-count-rhythm:adjacent-repeat:${prev.id}->${cur.id}`,
          description: `adjacent sections "${prev.id}" and "${cur.id}" are both ${cur.archetype} (§2.8) — two of the same archetype back-to-back read as one bloated section; insert a contrasting section or merge them`,
          outcome: 'warning',
        });
      }
    }

    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

function numParam(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
