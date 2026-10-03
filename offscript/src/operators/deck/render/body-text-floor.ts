import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../../operator.js';
import type { RenderContext } from '../../../render-context.js';
import { safeProbe } from '../../../render-probe.js';
import { DECK_MIN_TEXT_PX, GRAPHIC_EXEMPT_SELECTOR } from '../deck-format.js';

/**
 * Tier-1 deck render rail — `body-text-floor`.
 *
 * Any rendered text whose computed font-size is below the 20px deck body floor
 * (legible from the back of a room), EXCLUDING graphic content — chart
 * axes/legends/callouts, device-mockup internals, SVG <text>, and anything
 * flagged `.cr-graphic` / `[data-graphic]`. Sub-floor body text is a QA note →
 * `outcome:'warning'`.
 *
 * Async render-rail pattern: sync `detect`/`apply` return `[]`; the work is
 * `detectBodyTextFloorAsync(rc, tree)` driven by `harden-deck.ts`.
 */
export const bodyTextFloor: Operator = {
  name: 'body-text-floor',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

export async function detectBodyTextFloorAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<Array<{ size: number; text: string }>>(rc, `(function(){
    var FLOOR = ${DECK_MIN_TEXT_PX};
    var EX = ${JSON.stringify(GRAPHIC_EXEMPT_SELECTOR)};
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var seen = {}, out = [];
    while (walker.nextNode()){
      var node = walker.currentNode; if (!node.nodeValue || !node.nodeValue.trim()) continue;
      var el = node.parentElement; if (!el) continue;
      if (el.closest && el.closest(EX)) continue;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < FLOOR){
        var k = Math.round(fs)+':'+node.nodeValue.trim().slice(0,12);
        if (!seen[k]){ seen[k]=1; out.push({ size: Math.round(fs), text: node.nodeValue.trim().slice(0,24) }); }
      }
    }
    return out;
  })()`, bodyTextFloor.name);
  if (!res.ok) return res.degrade;
  const probe = res.value;
  return probe
    .map((f) => ({
      id: `body-text-floor:${f.size}:${f.text}`,
      description: `rendered text "${f.text}" is ${f.size}px — below the ${DECK_MIN_TEXT_PX}px deck body floor (graphic content exempt).`,
      outcome: 'warning' as const,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
