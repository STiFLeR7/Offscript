import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../../operator.js';
import type { RenderContext } from '../../../render-context.js';
import { safeProbe } from '../../../render-probe.js';

/**
 * Tier-1 collateral render rail — `a4-bounds` (collateral Task 6).
 *
 * Two A4 geometric oracles measured from the live render at `A4_VIEWPORT`:
 *
 *  - OVERFLOW — any descendant whose rendered right/bottom edge extends past
 *    its `.cr-page`'s 16mm content box. Content past the page box clips or
 *    pushes off-sheet on print → geometric failure → `outcome:'escalated'`
 *    (frozen; v1 does not re-flow A4).
 *
 *  - TEXT-FLOOR — any rendered text whose computed font-size is below the
 *    14px body floor, excluding the 12px eyebrow and graphic content
 *    (`.cr-eyebrow` / `.cr-graphic` / `[data-graphic]` / chart / svg).
 *    Sub-floor body text is a QA note → `outcome:'warning'`.
 *
 * Mirrors the canonical async render-rail pattern: sync `detect`/`apply`
 * return `[]`; the real work lives in `detectA4BoundsAsync(rc, tree)` which
 * calls `rc.probe<T>(fnString)` with a self-contained IIFE string. The probe
 * computes A4 constants in-page: MM = 96/25.4, PAD = 16*MM, FLOOR = 14.
 * Findings sort by id for determinism.
 */

export const a4Bounds: Operator = {
  name: 'a4-bounds',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

export async function detectA4BoundsAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<{
    overflow: Array<{ page: number; side: string; px: number }>;
    floor: Array<{ size: number; text: string }>;
  }>(rc, `(function(){
    var MM = 96/25.4, FLOOR = 14;
    var pages = document.querySelectorAll('.cr-page');
    var overflow = [], floor = [];
    for (var p=0;p<pages.length;p++){
      var box = pages[p].getBoundingClientRect();
      // Use each page's ACTUAL padding as the content box, not a hardcoded 16mm.
      // A full-bleed page (.cr-page--bleed → padding:0, e.g. the cover) legitimately fills
      // to the page edge; measuring it against a phantom 16mm inner box would false-flag it.
      var pcs = getComputedStyle(pages[p]);
      var pl = parseFloat(pcs.paddingLeft)||0, prt = parseFloat(pcs.paddingRight)||0;
      var pt = parseFloat(pcs.paddingTop)||0, pbt = parseFloat(pcs.paddingBottom)||0;
      var inner = { left: box.left+pl, right: box.right-prt, top: box.top+pt, bottom: box.bottom-pbt };
      var kids = pages[p].querySelectorAll('*');
      for (var i=0;i<kids.length;i++){
        var r = kids[i].getBoundingClientRect();
        if (r.width===0 && r.height===0) continue;
        // The running footer is engine furniture pinned into the bottom print margin
        // (like a page number) — it lives BELOW the content box by design and is always
        // within the page edge, so it is not content overflow. Exempt it + its spans
        // (page-fill already excludes it for the same reason).
        if (kids[i].closest && kids[i].closest('.cr-page-foot')) continue;
        if (r.right > inner.right + 1) overflow.push({ page:p, side:'right', px: Math.round(r.right-inner.right) });
        if (r.bottom > inner.bottom + 1) overflow.push({ page:p, side:'bottom', px: Math.round(r.bottom-inner.bottom) });
      }
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var seen = {};
    while (walker.nextNode()){
      var node = walker.currentNode; if (!node.nodeValue || !node.nodeValue.trim()) continue;
      var el = node.parentElement; if (!el) continue;
      var cls = (el.className && el.className.baseVal!==undefined) ? el.className.baseVal : (el.className||'');
      if (/cr-eyebrow|cr-graphic|data-graphic/.test(cls)) continue;
      if (el.closest && el.closest('svg,.chart,.chart-card,.data-viz,.cr-graphic,[data-graphic]')) continue;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < FLOOR && fs !== 12){ var k=Math.round(fs)+':'+node.nodeValue.trim().slice(0,12); if(!seen[k]){ seen[k]=1; floor.push({ size: Math.round(fs), text: node.nodeValue.trim().slice(0,24) }); } }
    }
    return { overflow: overflow, floor: floor };
  })()`, a4Bounds.name);
  if (!res.ok) return res.degrade;
  const probe = res.value;
  const findings: Finding[] = [];
  for (const o of probe.overflow)
    findings.push({
      id: `a4-bounds:overflow:p${o.page}:${o.side}:${o.px}`,
      description: `content overflows the A4 page box on page ${o.page} (${o.side} +${o.px}px past the page content box) — it will clip or push off-sheet.`,
      outcome: 'escalated',
    });
  for (const f of probe.floor)
    findings.push({
      id: `a4-bounds:text-floor:${f.size}:${f.text}`,
      description: `rendered text "${f.text}" is ${f.size}px — below the 14px body floor (12px eyebrow exempt).`,
      outcome: 'warning',
    });
  return findings.sort((a, b) => (a.id < b.id ? -1 : 1));
}
