import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../../operator.js';
import type { RenderContext } from '../../../render-context.js';
import { safeProbe } from '../../../render-probe.js';

/**
 * Tier-1 deck render rail — `slide-no-overflow`.
 *
 * Measures every `.slide`'s descendants against its 1920×1080 box (the fixed
 * slide canvas). Any element whose rendered right/bottom edge extends past the
 * slide edge clips or pushes off-slide (and a bottom-overflow means the slide
 * won't print to one landscape page) → geometric failure → `outcome:'escalated'`
 * (frozen; v1 does not re-flow slides).
 *
 * Async render-rail pattern: sync `detect`/`apply` return `[]`; the real work is
 * `detectSlideOverflowAsync(rc, tree)` driven by `harden-deck.ts`.
 */
export const slideNoOverflow: Operator = {
  name: 'slide-no-overflow',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

export async function detectSlideOverflowAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<Array<{ slide: number; side: string; px: number }>>(rc, `(function(){
    var slides = document.querySelectorAll('.slide');
    var out = [];
    for (var s=0;s<slides.length;s++){
      var box = slides[s].getBoundingClientRect();
      var kids = slides[s].querySelectorAll('*');
      for (var i=0;i<kids.length;i++){
        var r = kids[i].getBoundingClientRect();
        if (r.width===0 && r.height===0) continue;
        if (r.right > box.right + 1) out.push({ slide:s, side:'right', px: Math.round(r.right-box.right) });
        if (r.bottom > box.bottom + 1) out.push({ slide:s, side:'bottom', px: Math.round(r.bottom-box.bottom) });
      }
    }
    return out;
  })()`, slideNoOverflow.name);
  if (!res.ok) return res.degrade;
  const probe = res.value;
  return probe
    .map((o) => ({
      id: `slide-no-overflow:s${o.slide}:${o.side}:${o.px}`,
      description: `content overflows slide ${o.slide} (${o.side} +${o.px}px past the 1920×1080 box) — it will clip or push off-slide.`,
      outcome: 'escalated' as const,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
