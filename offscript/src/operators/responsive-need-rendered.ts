import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/**
 * Tier-2 judgment-pass detector/rail — RENDERED variant (WP1.E.2).
 *
 * Where the static `responsive-need` operator sniffs the source HTML/CSS for fixed-px
 * widths over a mobile assumption, this variant opens the document in a real headless
 * Chromium at a fixed set of viewports (360, 768, 1440 — all 800h) and flags every
 * element whose right edge actually extends past `documentElement.clientWidth`. This
 * catches overflow caused by min-content children, unbreakable text, fixed-aspect
 * images, etc. — failure modes the static scan can't see.
 *
 * --- ENV GATE — opt-in --------------------------------------------------
 * The rendered path only runs when `process.env.OFFSCRIPT_PLAYWRIGHT === '1'`.
 * Otherwise the measurement is a no-op and the operator returns `[]`. This
 * keeps CI green on machines without Chromium installed.
 *
 * Local dev/op gesture (one-time):
 *     npx playwright install chromium
 *     OFFSCRIPT_PLAYWRIGHT=1 npm test
 *
 * --- Contract surface ---------------------------------------------------
 * The `Operator` interface is synchronous (`detect` returns `Finding[]`, not a
 * promise). Rendered overflow measurement is intrinsically async — it has to
 * await Chromium. The bridge is `measureOverflowsAsync(html)`, the primary
 * public API: tests and the engine's WP1.A render seam call it directly. The
 * sync `detect`/`apply` on the `Operator` impl return `[]` (the gate is
 * effectively two-sided: env off → no measurement; sync contract → no findings
 * delivered via the sync path). When the engine grows an async-aware
 * verification rail, this operator's `detect` becomes a thin shim that awaits
 * `measureOverflowsAsync`.
 *
 * Apply is a no-op (judgment rail — the fix is the actuator's job: the
 * structural change that resolves overflow is a design decision, not a
 * mechanical rewrite).
 *
 * --- Determinism --------------------------------------------------------
 * Viewports are a const-list. Findings are sorted (viewport ASC, then selector
 * ASC). For a given (html, viewport-list) the measurement is idempotent —
 * `measureOverflowsAsync(html)` called twice returns the same findings.
 */

const VIEWPORTS: ReadonlyArray<{ width: number; height: number }> = [
  { width: 360, height: 800 },
  { width: 768, height: 800 },
  { width: 1440, height: 800 },
];

/** True when the env gate is set to the explicit '1' opt-in. */
export function isRenderedGateEnabled(): boolean {
  return process.env.OFFSCRIPT_PLAYWRIGHT === '1';
}

interface OverflowRecord {
  viewport: number;
  selector: string;
  right: number;
  overflowBy: number;
}

/**
 * Open `html` in a headless Chromium at each declared viewport and collect
 * every element whose `getBoundingClientRect().right` exceeds the viewport's
 * `clientWidth`. Returns deterministic records (viewport asc, selector asc).
 *
 * Returns `[]` when `OFFSCRIPT_PLAYWRIGHT` is not set or when `playwright`
 * cannot be imported at runtime.
 */
async function measureOverflows(html: string): Promise<OverflowRecord[]> {
  if (!isRenderedGateEnabled()) return [];

  // Lazy import so module load is free of playwright when the gate is off.
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return [];
  }

  const browser = await chromium.launch();
  const records: OverflowRecord[] = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        // The probe is authored as a STRING IIFE — not a TS arrow — on purpose.
        // Under tsx/esbuild, `keepNames` wraps any *named* inner declaration (a
        // `const describe = …`) with a `__name(…)` helper call. That helper is
        // defined in the Node module scope but NOT in the browser page, so
        // shipping the compiled arrow into `page.evaluate(fn)` throws
        // `ReferenceError: __name is not defined`. A string body skips esbuild
        // instrumentation entirely — the same pattern the render-rail probes use
        // (see src/operators/render/*.ts → RenderContext.probe(fnSource)).
        const overflows = (await page.evaluate(`(function() {
            var clientWidth = document.documentElement.clientWidth;
            function describe(el) {
              var tag = el.tagName.toLowerCase();
              if (el.id) return tag + '#' + el.id;
              var cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean);
              if (cls.length > 0) return tag + '.' + cls.join('.');
              return tag;
            }
            var out = [];
            var seen = Object.create(null);
            var all = document.body.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              var el = all[i];
              var rect = el.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) continue;
              if (rect.right > clientWidth + 0.5) {
                var sel = describe(el);
                if (seen[sel]) continue;
                seen[sel] = true;
                out.push({
                  selector: sel,
                  right: Math.round(rect.right),
                  overflowBy: Math.round(rect.right - clientWidth),
                });
              }
            }
            return out;
          })()`)) as Array<{ selector: string; right: number; overflowBy: number }>;
        for (const o of overflows) records.push({ viewport: vp.width, ...o });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  records.sort((a, b) =>
    a.viewport !== b.viewport ? a.viewport - b.viewport : a.selector.localeCompare(b.selector),
  );
  return records;
}

/**
 * Build a deterministic rendered-measurement `Finding` for a single
 * (viewport, selector, overflowPx) tuple. Shared between
 * `measureOverflowsAsync` and the harden-tail wiring (WP1.E.2 item 6) so
 * every rendered finding carries the same id/description/outcome shape.
 *
 * Note: this is intentionally a pure function — no Playwright, no async —
 * so the harden-tail no-op fallback (env off) can exercise it without
 * spinning up a browser.
 */
export function formatRenderedFinding(
  viewport: number,
  selector: string,
  overflowPx: number,
): Finding {
  return {
    id: `responsive-need:rendered:overflow:${viewport}:${selector}`,
    description: `'${selector}' element overflows by ${overflowPx} px at ${viewport}px viewport`,
    outcome: 'warning' as const,
  };
}

/**
 * Primary public API — async rendered measurement. Tests and the engine's
 * render seam call this directly. See module docstring for the env-gate.
 */
export async function measureOverflowsAsync(html: string): Promise<Finding[]> {
  const records = await measureOverflows(html);
  return records.map((r) => ({
    id: `responsive-need:rendered:overflow:${r.viewport}:${r.selector}`,
    description: `'${r.selector}' element extends to ${r.right} px at ${r.viewport}px viewport (overflow by ${r.overflowBy} px)`,
    outcome: 'warning' as const,
  }));
}

let warnedOnce = false;

export const responsiveNeedRendered: Operator = {
  name: 'responsive-need-rendered',
  tier: 2,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    if (!isRenderedGateEnabled()) {
      if (!warnedOnce && tree.children.length > 0) {
        warnedOnce = true;
        // eslint-disable-next-line no-console
        console.warn(
          'responsive-need-rendered: OFFSCRIPT_PLAYWRIGHT=1 not set — skipping rendered overflow measurement (static responsive-need still runs).',
        );
      }
      return [];
    }
    // Sync contract: rendered measurement is awaited via `measureOverflowsAsync`
    // by tests and (in WP1.A) by the engine's async render seam. Returning []
    // here keeps `verify()` honest on the sync path until the render seam wires
    // the async route in.
    return [];
  },

  // Detector/rail: the fix is Claude's (vision §4.1). apply never mutates — pure re-scan.
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
