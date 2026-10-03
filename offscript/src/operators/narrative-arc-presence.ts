import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { Archetype } from '../archetype.js';

/**
 * Tier-0 rail: narrative-arc-presence (M2 Group B, SECTION_INTELLIGENCE.md
 * §2.1).
 *
 * "A marketing page is a story. Pick exactly one narrative arc per page and map
 * every section to a stage of that arc. Pages without an arc feel like a list
 * of features pinned to a wall."  The three sanctioned arcs:
 *   AIDA — Attention · Interest · Desire · Action  (default for product pages)
 *   PAS  — Problem · Agitation · Solution
 *   BAB  — Before · After · Bridge
 *
 * This rail does NOT pick or impose an arc — it only checks the page CARRIES
 * one. An arc is "carried" if either:
 *   (a) it is declared — `ctx.params.arc` is one of aida / pas / bab (a
 *       sections.md frontmatter tag threaded into the recipe params), or
 *   (b) it is inferable — the archetype sequence opens with an attention/
 *       interest stage and reaches an action stage later (a recognisable
 *       opening → … → action progression).
 *
 * Warn when neither holds (the §6.6-adjacent "list of features" failure). A
 * declared-but-unrecognised arc tag is itself a warning (fix the tag).
 *
 * Tier-0: a page-level audit, no element anchor. Per the seam contract, when
 * inference is needed and no archetype model is present, the rail no-ops with a
 * single warning.
 *
 * Spec: M2 charter §4 Task 5; SECTION_INTELLIGENCE.md §2.1.
 */

const KNOWN_ARCS = new Set(['aida', 'pas', 'bab']);

/**
 * Arc-stage rank per archetype (SECTION_INTELLIGENCE.md §3 "Arc stage"):
 *   0 = attention / opening · 1 = interest · 2 = desire · 3 = action · 4 = end
 * Archetypes that don't map to a stage (none, currently) would be omitted.
 */
const STAGE: Record<Archetype, number> = {
  hero: 0,
  'sub-hero': 1,
  'logo-bar': 1,
  'feature-grid': 1,
  'feature-spotlight': 2,
  process: 2,
  metrics: 1,
  testimonial: 2,
  'testimonial-wall': 2,
  'case-study': 2,
  editorial: 1,
  founder: 2,
  integrations: 1,
  pricing: 3,
  'plan-comparison': 3,
  faq: 3,
  'cta-banner': 3,
  // contact (get-in-touch / book-a-demo) is an action-stage ask, like cta-banner.
  contact: 3,
  // resources / insights nurture content sits in the interest band, like editorial.
  resources: 1,
  footer: 4,
};

const ACTION_STAGE = 3;
const OPENING_STAGE_MAX = 1; // attention or interest

export const narrativeArcPresence: Operator = {
  name: 'narrative-arc-presence',
  tier: 0,

  detect(_tree: Root, ctx: OperatorContext): Finding[] {
    // (a) declared arc wins — presence is satisfied by the declaration alone.
    const declared = typeof ctx.params.arc === 'string' ? ctx.params.arc.trim().toLowerCase() : '';
    if (declared) {
      if (KNOWN_ARCS.has(declared)) return [];
      return [
        {
          id: 'narrative-arc-presence:unknown-arc',
          description: `declared narrative arc "${ctx.params.arc}" is not one of AIDA / PAS / BAB (§2.1) — fix the arc tag`,
          outcome: 'warning',
        },
      ];
    }

    // (b) no declaration → try to infer from the archetype sequence.
    if (!ctx.archetypeModel) {
      return [
        {
          id: 'narrative-arc-presence:no-archetype-model',
          description:
            'no declared arc and no archetype model on context (run archetype-tag first) — narrative-arc-presence skipped',
          outcome: 'warning',
        },
      ];
    }

    const stages: number[] = [];
    for (const a of ctx.archetypeModel.values()) stages.push(STAGE[a.archetype]);

    if (isArcInferable(stages)) return [];

    return [
      {
        id: 'narrative-arc-presence:not-recoverable',
        description:
          'no narrative arc declared and none inferable from the archetype sequence (no opening → action progression, §2.1) — the page may read as a list of features pinned to a wall; declare an arc (AIDA / PAS / BAB) or reorder sections into a story',
        outcome: 'escalated',
      },
    ];
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

/**
 * A recognisable arc: an opening stage (attention / interest) appears, an action
 * stage appears, and the first action comes after the first opening — i.e. the
 * page progresses from setup to ask rather than starting at the ask.
 */
function isArcInferable(stages: number[]): boolean {
  const firstOpening = stages.findIndex((s) => s <= OPENING_STAGE_MAX);
  const firstAction = stages.findIndex((s) => s === ACTION_STAGE);
  if (firstOpening === -1 || firstAction === -1) return false;
  return firstAction > firstOpening;
}
