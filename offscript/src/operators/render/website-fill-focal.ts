import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import type { RenderContext } from '../../render-context.js';
import { safeProbe } from '../../render-probe.js';
import * as websiteNumerics from '../../generate/website-numerics.js';

/**
 * Tier-1 website render rail — website-fill-focal (audit §9-B4).
 *
 * The scroll-medium analog of collateral's a4-bounds/page-fill. ESCALATING (unlike
 * collateral page-fill's advisory warnings) so a website `ratio 1.0` finally certifies
 * design quality, not just "it renders" (audit §3). Built from website's own numerics
 * (fill ratio, focal-dominance ratio) — never A4 millimetres.
 *
 * Per <section> band: escalate (a) sparse — content fills under minFillPct of the band
 * height; (b) no focal dominance — the largest element's area is under minFocalRatio×
 * the median element area (render form of COMPOSE rule 2 "exactly one FOCAL block").
 *
 * Pure buildWebsiteFillFindings is browser-free (unit-tested); detect…Async feeds it the
 * probe rows. Website-only: appended to renderOperators (defaultRegistry), wired into
 * validate.ts runWebsiteRenderRails. Collateral branch untouched.
 */

export interface WebsiteFillRow {
  index: number;
  /** the section root id — embedded in the finding id for re-author routing */
  anchor: string;
  /** (content height / band height) as a percentage */
  fillPct: number;
  /** largest direct-content element area ÷ median content element area */
  focalRatio: number;
}

export interface WebsiteFillThresholds {
  minFillPct: number;
  minFocalRatio: number;
}

/** Emergency fallback only — governance (numerics.md, via resolveFillThresholds) is the source of truth. */
export const DEFAULT_WEBSITE_FILL_THRESHOLDS: WebsiteFillThresholds = {
  minFillPct: 55,
  minFocalRatio: 1.4,
};

/**
 * Resolve fill thresholds from website governance (numerics.md). Browser-free + unit-tested.
 * Governance is the source of truth; on any load failure we degrade to the baked constant and
 * surface ONE warning (belt-and-suspenders — a packaging slip can't brick the rail).
 */
export function resolveFillThresholds(): { thresholds: WebsiteFillThresholds; warning: Finding | null } {
  try {
    const n = websiteNumerics.loadWebsiteNumerics();
    return { thresholds: { minFillPct: n.minFillPct, minFocalRatio: n.minFocalRatio }, warning: null };
  } catch (e) {
    return {
      thresholds: DEFAULT_WEBSITE_FILL_THRESHOLDS,
      warning: {
        id: 'website-fill-focal:numerics-fallback',
        description:
          `website numerics unavailable (${e instanceof Error ? e.message : String(e)}) — using baked fallback ` +
          `${DEFAULT_WEBSITE_FILL_THRESHOLDS.minFillPct}% / ${DEFAULT_WEBSITE_FILL_THRESHOLDS.minFocalRatio}. ` +
          `Restore resources/design_processes/website/rulebooks/numerics.md.`,
        outcome: 'warning',
      },
    };
  }
}

export function buildWebsiteFillFindings(
  rows: WebsiteFillRow[],
  t: WebsiteFillThresholds = DEFAULT_WEBSITE_FILL_THRESHOLDS,
): Finding[] {
  const findings: Finding[] = [];
  for (const r of rows) {
    if (r.fillPct < t.minFillPct) {
      findings.push({
        id: `website-fill-focal:sparse:${r.anchor}`,
        description: `band "${r.anchor}" fills only ${r.fillPct}% of its height (target ≥${t.minFillPct}%) — a sparse, under-built section. Add substance or tighten the band.`,
        outcome: 'escalated',
      });
    }
    if (r.focalRatio < t.minFocalRatio) {
      findings.push({
        id: `website-fill-focal:no-focal:${r.anchor}`,
        description: `band "${r.anchor}" has no dominant element (largest/median area ${r.focalRatio.toFixed(2)} < ${t.minFocalRatio}) — every band needs exactly one FOCAL block (COMPOSE rule 2).`,
        outcome: 'escalated',
      });
    }
  }
  return findings.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export const websiteFillFocal: Operator = {
  name: 'website-fill-focal',
  tier: 1,
  detect(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
  apply(_t: Root, _c: OperatorContext): Finding[] {
    return [];
  },
};

/** Measure each <section> band and emit escalating fill/focal findings. */
export async function detectWebsiteFillFocalAsync(
  rc: RenderContext | undefined,
  _tree: Root,
): Promise<Finding[]> {
  if (!rc) return [];
  const res = await safeProbe<WebsiteFillRow[]>(rc, `(function(){
    var secs = document.querySelectorAll('main > section, body > section');
    var out = [];
    for (var p=0;p<secs.length;p++){
      var s = secs[p];
      var box = s.getBoundingClientRect();
      var bandH = box.height || 1;
      var anchor = s.id || ('s'+p);
      // fill: bottom of the lowest visible content child relative to the band top
      var kids = s.querySelectorAll('*');
      var top = box.top, lastBottom = top, areas = [];
      for (var i=0;i<kids.length;i++){
        var el = kids[i];
        // skip pinned descendants — a fixed/sticky element can sit anywhere and distort fill
        var pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') continue;
        var r = el.getBoundingClientRect();
        if (r.width===0 && r.height===0) continue;
        if (r.bottom > lastBottom && r.bottom <= box.bottom + 1) lastBottom = r.bottom;
      }
      // focal: areas of the band's DIRECT children (the composition blocks)
      var dc = s.children;
      for (var k=0;k<dc.length;k++){
        if (dc[k].tagName === 'STYLE' || dc[k].tagName === 'SCRIPT') continue;
        var rr = dc[k].getBoundingClientRect();
        var a = rr.width*rr.height;
        if (a>0) areas.push(a);
      }
      areas.sort(function(x,y){return x-y;});
      var median = areas.length ? areas[Math.floor(areas.length/2)] : 1;
      var max = areas.length ? areas[areas.length-1] : 0;
      // single-block band IS the "one focal block" case — a finite sentinel above
      // the threshold suppresses the no-focal check. NOT Infinity: page.evaluate
      // JSON-serializes Infinity to null, and null < minFocalRatio is true → would
      // still false-flag. 999 survives serialization and stays above the threshold.
      out.push({
        index: p, anchor: anchor,
        fillPct: Math.round(((lastBottom-top)/bandH)*100),
        focalRatio: areas.length < 2 ? 999 : (median>0 ? max/median : 1)
      });
    }
    return out;
  })()`, websiteFillFocal.name);
  const { thresholds, warning } = resolveFillThresholds();
  if (!res.ok) return warning ? [warning, ...res.degrade] : res.degrade;
  const findings = buildWebsiteFillFindings(res.value, thresholds);
  return warning ? [warning, ...findings] : findings;
}
