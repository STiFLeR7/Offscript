import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../../operator.js';
import type { RenderContext } from '../../../render-context.js';
import { safeProbe } from '../../../render-probe.js';

/**
 * Tier-1 deck render rail — `no-text-overlap`.
 *
 * Pairwise bounding-box intersection of text-bearing leaf elements within each
 * `.slide` (the deck analog of collateral's `text-overlap` over `.cr-page`).
 * Deck hard rule: no two text elements may overlap. An overlap is a geometric
 * failure v1 does not re-flow → `outcome:'escalated'` (frozen). Containment
 * pairs are skipped; only sibling/disjoint rectangles intersecting by > 2px on
 * both axes are reported. Capped at 50 hits.
 */
export const deckTextOverlap: Operator = {
  name: 'no-text-overlap',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

export async function detectDeckTextOverlapAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<Array<{ a: string; b: string; slide: number }>>(rc, `(function(){
    function leaves(root){ var all=root.querySelectorAll('*'); var out=[];
      for (var i=0;i<all.length;i++){ var el=all[i];
        var hasText=false; for (var j=0;j<el.childNodes.length;j++){ var c=el.childNodes[j]; if (c.nodeType===3 && c.nodeValue.trim()){ hasText=true; break; } }
        if (hasText) out.push(el); } return out; }
    function rectsOverlap(a,b){ return !(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top); }
    function area(r){ return Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top); }
    var slides=document.querySelectorAll('.slide'); var out=[];
    for (var p=0;p<slides.length;p++){ var els=leaves(slides[p]);
      for (var i=0;i<els.length;i++) for (var j=i+1;j<els.length;j++){
        if (els[i].contains(els[j])||els[j].contains(els[i])) continue;
        var ra=els[i].getBoundingClientRect(), rb=els[j].getBoundingClientRect();
        if (area(ra)===0||area(rb)===0) continue;
        if (rectsOverlap(ra,rb)){
          var ox=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left);
          var oy=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);
          if (ox>2 && oy>2) out.push({ a: els[i].tagName+'.'+(els[i].className||''), b: els[j].tagName+'.'+(els[j].className||''), slide:p });
        }
      }
    }
    return out.slice(0,50);
  })()`, deckTextOverlap.name);
  if (!res.ok) return res.degrade;
  const hits = res.value;
  return hits.map((h, i) => ({
    id: `no-text-overlap:s${h.slide}:${i}`,
    description: `text elements overlap on slide ${h.slide} (${h.a} ∩ ${h.b}) — no two text elements may overlap.`,
    outcome: 'escalated' as const,
  }));
}
