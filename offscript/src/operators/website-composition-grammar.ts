import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';

/**
 * Tier-1 website rail: website-composition-grammar (audit §9-B2, static subset).
 *
 * The tree-decidable half of COMPOSE.md §C, per <section> band:
 *  - rule 7 (escalate): one display tier — no two co-equal top-ramp headlines
 *    (cr-h-hero / cr-h-section) in one band.
 * Glyphs and punctuation follow the supplied project's voice and iconography.
 *
 * COMPOSE rule 1 (one surface per band) is NOT here: website surfaces are inline
 * `background:` on the section root, not classes, so it is render-measured by B4.
 * Rules 2 (one focal) / 5 (accent ≤20%) need render → B4.
 *
 * Website-only: defaultRegistry() only.
 */

const DISPLAY_TIER_CLASSES = ['cr-h-hero', 'cr-h-section'];

function classList(el: Element): string[] {
  const c = el.properties?.className;
  if (Array.isArray(c)) return c.map(String);
  if (typeof c === 'string') return c.split(/\s+/);
  return [];
}

function sectionRoots(tree: Root): Element[] {
  const out: Element[] = [];
  visitElements(tree, (el) => {
    if (el.tagName === 'section') out.push(el);
  });
  return out;
}

export const websiteCompositionGrammar: Operator = {
  name: 'website-composition-grammar',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    for (const [i, section] of sectionRoots(tree).entries()) {
      const id = typeof section.properties?.id === 'string' ? section.properties.id : `section-${i}`;

      // rule 7 — one display tier
      const tierCounts = new Map<string, number>();
      visitElements({ type: 'root', children: [section] } as Root, (el) => {
        for (const cls of classList(el)) {
          if (DISPLAY_TIER_CLASSES.includes(cls)) tierCounts.set(cls, (tierCounts.get(cls) ?? 0) + 1);
        }
      });
      for (const [cls, count] of tierCounts) {
        if (count >= 2) {
          findings.push({
            id: `website-composition-grammar:display-tier:${id}:${cls}`,
            description: `section "${id}" has ${count} co-equal "${cls}" headlines — one display tier per band (COMPOSE rule 7). Demote all but one to a lower ramp step.`,
            outcome: 'escalated',
          });
        }
      }

    }
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
