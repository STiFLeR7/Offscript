import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import type { RenderRuntime } from '../../render-runtime.js';
import { serializeHtml } from '../../working-rep.js';
import {
  compareLiveVsKit,
  type LiveDivergenceReport,
  type CompareOptions,
} from '../../live-comparator.js';

/**
 * Tier-0 render-aware oracle — `kit-vs-live` (M2 Track A Task 8).
 *
 * Wraps the `live-comparator` and surfaces every material divergence as
 * a single warning `Finding`. The motivating case: CR's brand-watermark
 * ships in the kit at ~75% opacity but renders at ~90% on the live site
 * — a brand-fidelity drift no static rail can see (the kit's literal
 * opacity says 0.9 because that's what the actuator-baked HTML carries;
 * the reference truth lives on the live URL).
 *
 * --- Why a separate oracle vs probing in the comparator -----------
 * `compareLiveVsKit` is a pure data function reusable for ad-hoc
 * comparison tooling (the planned `scripts/fetch-live.ts` CLI calls it
 * directly too). The oracle here adapts the report shape into the
 * `Operator` contract — one rail, one set of findings.
 *
 * --- Tier 0 because the oracle anchors the WHOLE document ---------
 * Findings reference rendered sections (selector + nth-of-type), not
 * source-anchored bytes. That's still 'global' in the tier sense — the
 * rail asserts a relationship between the entire kit document and its
 * live counterpart.
 *
 * --- Contract surface --------------------------------------------------
 * Sync `detect` / `apply` return `[]`. Real work on
 * `detectKitVsLiveAsync(rt, kitTree, liveHtml, opts)`. The harden wiring
 * (Task 10) is the only caller and runs the async helper directly.
 *
 * The kit-vs-live rail is OFF by default — it only contributes findings
 * when the caller supplies live HTML. No live HTML → empty report → no
 * findings. This matches the spec's "off unless --live-url is set" gate.
 *
 * --- Determinism --------------------------------------------------------
 * One finding per divergence; ids derived from selector#index. Sorted
 * via the comparator (selector ASC, kind ASC). Pure-warning outcome.
 */

export interface KitVsLiveOptions extends CompareOptions {
  /** Only material-severity divergences emit findings (default true). */
  materialOnly?: boolean;
}

/** Sync Operator surface — work lives on the async helper. */
export const kitVsLive: Operator = {
  name: 'kit-vs-live',
  tier: 0,

  detect(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },

  apply(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },
};

/**
 * Async detection: render kit + live, diff sections, emit one warning
 * per material divergence. Caller owns the runtime + the live HTML
 * (the rail does NOT fetch — callers either pass cached bytes or call
 * `fetchLiveHtml` upstream first).
 */
export async function detectKitVsLiveAsync(
  rt: RenderRuntime | undefined,
  kitTree: Root,
  liveHtml: string | undefined,
  opts: KitVsLiveOptions = {},
): Promise<Finding[]> {
  if (!rt) return [];
  if (!liveHtml || liveHtml.trim() === '') return [];

  const kitHtml = serializeHtml(kitTree);
  const report = await compareLiveVsKit(rt, kitHtml, liveHtml, opts);
  return reportToFindings(report, opts.materialOnly ?? true);
}

/**
 * Format a `LiveDivergenceReport` into Operator `Finding[]`. Exported so
 * Task 10's harden wiring can compose a fetch → report → findings flow
 * without re-walking the divergence shape.
 */
export function reportToFindings(
  report: LiveDivergenceReport,
  materialOnly: boolean,
): Finding[] {
  const out: Finding[] = [];
  for (const d of report.divergences) {
    if (materialOnly && d.severity !== 'material') continue;
    out.push({
      id: `kit-vs-live:${d.selector}:${d.kind}`,
      description:
        `kit vs live divergence at \`${d.selector}\` (${d.kind}, ${d.severity}): ` +
        `kit=${d.kit ?? '<absent>'} · live=${d.live ?? '<absent>'}.`,
      outcome: 'warning',
    });
  }
  return out;
}
