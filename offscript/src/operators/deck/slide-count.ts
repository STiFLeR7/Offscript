import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { DECK_SLIDE_MIN, DECK_SLIDE_MAX } from './deck-format.js';

/**
 * Static deck rail — `slide-count`.
 *
 * A structural sanity oracle (no render needed): counts `.slide` elements and
 * warns when the deck is empty or outside the sane slide-count range
 * (units.min / units.max from pitch-deck-formats.json). One-page-per-slide
 * print fidelity is covered by `slide-no-overflow` (a slide whose content
 * exceeds the 1080px box bottom-overflows). Warn-only — never freezes.
 */
function classTokens(el: { properties?: Record<string, unknown> }): string[] {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/);
  return [];
}

export const slideCount: Operator = {
  name: 'slide-count',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    let n = 0;
    visitElements(tree, (el) => {
      if (classTokens(el).includes('slide')) n += 1;
    });
    if (n === 0) {
      return [
        {
          id: 'slide-count:none',
          description: 'no .slide elements found — is this a deck bundle?',
          outcome: 'warning',
        },
      ];
    }
    const out: Finding[] = [];
    if (n < DECK_SLIDE_MIN) {
      out.push({
        id: `slide-count:under:${n}`,
        description: `deck has ${n} slide(s) — under the ${DECK_SLIDE_MIN}-slide minimum.`,
        outcome: 'warning',
      });
    }
    if (n > DECK_SLIDE_MAX) {
      out.push({
        id: `slide-count:over:${n}`,
        description: `deck has ${n} slide(s) — over the ${DECK_SLIDE_MAX}-slide maximum.`,
        outcome: 'warning',
      });
    }
    return out;
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};
