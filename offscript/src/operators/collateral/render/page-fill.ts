import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../../operator.js';
import type { RenderContext } from '../../../render-context.js';
import { safeProbe } from '../../../render-probe.js';

/**
 * Tier-1 collateral render rail — `page-fill` (WS2).
 *
 * ADVISORY measurement of the enforcement blind spot: overflow already
 * escalates/freezes (a4-bounds), but underfill and layout monotony were never
 * measured. Every finding here is `outcome:'warning'` — it surfaces in the
 * score's warnings bucket and (for per-page underfill) embeds the page's anchor
 * id so the re-author loop can route it, but it NEVER escalates, never freezes,
 * never changes the systematic ratio or goalMet. Overflow stays the only hard fail.
 *
 * The metric→finding logic (`buildPageFillFindings`) is pure and browser-free so
 * it unit-tests without Playwright; `detectPageFillAsync` feeds it the probe rows.
 * Thresholds are Design-owned values (WS6 externalizes them later).
 */

/** One measured page, produced by the probe IIFE. */
export interface PageFillRow {
  index: number;
  /** the fragment root id (== plan item anchor.id) — embedded in the finding id for routing */
  anchor: string;
  /** cr-page--bleed (the cover) legitimately fills edge-to-edge → exempt from underfill */
  bleed: boolean;
  /** empty millimetres between the last content element and the footer/box bottom */
  voidMm: number;
  /** (lastContentBottom - innerTop) / usableHeight, as a percentage */
  fillPct: number;
  /** ordered lead-component signature, e.g. "LIST+BAND" */
  skeleton: string;
  /** whether the page ends in a tonal band */
  hasBand: boolean;
}

/** Advisory thresholds. DESIGN-OWNED values (WS6 will source these from governance). */
export interface PageFillThresholds {
  underfillMm: number;
  underfillStrongMm: number;
  monotonyDistinctRatio: number;
  monotonyMaxShare: number;
  trailingShare: number;
  /** monotony/repetition only evaluated when the doc has at least this many pages */
  minPagesForDocMetrics: number;
}

export const DEFAULT_PAGE_FILL_THRESHOLDS: PageFillThresholds = {
  underfillMm: 40,
  underfillStrongMm: 60,
  monotonyDistinctRatio: 0.5,
  monotonyMaxShare: 0.3,
  trailingShare: 0.5,
  minPagesForDocMetrics: 4,
};

/** Pure: turn measured rows into advisory findings. Browser-free, deterministic. */
export function buildPageFillFindings(
  rows: PageFillRow[],
  t: PageFillThresholds = DEFAULT_PAGE_FILL_THRESHOLDS,
): Finding[] {
  const findings: Finding[] = [];

  for (const r of rows) {
    if (r.bleed) continue;
    if (r.voidMm >= t.underfillMm) {
      const strong = r.voidMm >= t.underfillStrongMm;
      findings.push({
        id: `page-fill:underfill:${r.anchor}`,
        description: `page "${r.anchor}" leaves ${r.voidMm}mm empty below its content (fills ${r.fillPct}% of the column)${strong ? ' — well under the fill target' : ' — under the fill target'}.`,
        outcome: 'warning',
      });
    }
  }

  if (rows.length >= t.minPagesForDocMetrics) {
    const skeletons = rows.map((r) => r.skeleton);
    const counts = new Map<string, number>();
    for (const s of skeletons) counts.set(s, (counts.get(s) ?? 0) + 1);
    const distinct = counts.size;
    let dominant = '';
    let dominantCount = 0;
    for (const [s, c] of counts) if (c > dominantCount) { dominant = s; dominantCount = c; }
    const maxShare = dominantCount / rows.length;
    if (distinct / rows.length < t.monotonyDistinctRatio || maxShare > t.monotonyMaxShare) {
      findings.push({
        id: `page-fill:monotony`,
        description: `only ${distinct} distinct page layouts across ${rows.length} pages; "${dominant}" recurs on ${dominantCount}. Vary the composition (anti-clone).`,
        outcome: 'warning',
      });
    }

    const bandCount = rows.filter((r) => r.hasBand).length;
    if (bandCount / rows.length > t.trailingShare) {
      findings.push({
        id: `page-fill:repetition:trailing-band`,
        description: `${bandCount} of ${rows.length} pages end in a tonal band — a per-page summary box becomes a tic. Reserve the closing band for the actual close.`,
        outcome: 'warning',
      });
    }
  }

  return findings.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export const pageFill: Operator = {
  name: 'page-fill',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

/**
 * Measure each `.cr-page` at A4_VIEWPORT and emit advisory fill/monotony findings.
 * One serialisable probe IIFE (mirrors a4-bounds.ts). Tolerates `undefined` rc
 * (no render runtime → no-op) and degrades a probe failure to a single warning.
 */
export async function detectPageFillAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<PageFillRow[]>(rc, `(function(){
    var MM = 96/25.4;
    var pages = document.querySelectorAll('.cr-page');
    var out = [];
    function present(pg, sel){ return pg.querySelector(sel) ? 1 : 0; }
    for (var p=0;p<pages.length;p++){
      var pg = pages[p];
      var box = pg.getBoundingClientRect();
      var cs = getComputedStyle(pg);
      var pt = parseFloat(cs.paddingTop)||0, pb = parseFloat(cs.paddingBottom)||0;
      var innerTop = box.top+pt, innerBottom = box.bottom-pb;
      var usable = innerBottom - innerTop;
      var rootChild = pg.firstElementChild;
      var anchor = (rootChild && rootChild.id) || pg.id || ('p'+p);
      var bleed = pg.classList && pg.classList.contains('cr-page--bleed');
      var foot = pg.querySelector('.cr-page-foot');
      var footTop = foot ? foot.getBoundingClientRect().top : innerBottom;
      var kids = pg.querySelectorAll('*');
      var lastBottom = innerTop;
      for (var i=0;i<kids.length;i++){
        var el = kids[i];
        if (foot && foot.contains(el)) continue;
        if (el.classList && el.classList.contains('cr-page-foot')) continue;
        if (el.closest && el.closest('.cr-graphic,[data-graphic]')) continue;
        var r = el.getBoundingClientRect();
        if (r.width===0 && r.height===0) continue;
        if (r.bottom <= footTop + 1 && r.bottom > lastBottom) lastBottom = r.bottom;
      }
      var voidPx = footTop - lastBottom;
      var fill = usable>0 ? (lastBottom - innerTop)/usable : 1;
      var sig = [];
      if (present(pg,'.cr-list-row')) sig.push('LIST');
      if (present(pg,'.cr-stat-ledger')) sig.push('LEDGER');
      if (present(pg,'.cr-stat-wall')) sig.push('WALL');
      if (present(pg,'.cr-stat-card') || present(pg,'.cr-grid')) sig.push('CARDS');
      if (present(pg,'.cr-data-group')) sig.push('2COL');
      if (present(pg,'.cr-checklist')) sig.push('CHECK');
      if (present(pg,'.cr-quote')) sig.push('QUOTE');
      var lead = sig.length ? sig.join('/') : 'TEXT';
      var hasBand = present(pg,'.cr-band') ? true : false;
      out.push({
        index: p, anchor: anchor, bleed: !!bleed,
        voidMm: Math.round(voidPx/MM),
        fillPct: Math.round(fill*100),
        skeleton: lead + (hasBand ? '+BAND' : ''),
        hasBand: hasBand
      });
    }
    return out;
  })()`, pageFill.name);
  if (!res.ok) return res.degrade;
  return buildPageFillFindings(res.value);
}
