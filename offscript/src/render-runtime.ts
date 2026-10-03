/**
 * Shared Playwright session manager for render-aware rails (M2 — Track A Task 2).
 *
 * Where `responsive-need-rendered` launches Chromium per measurement call,
 * `RenderRuntime` is the **per-harden-run** session: one Chromium launch,
 * one browser context, many `loadHtml(...)` calls — each producing a fresh
 * page wrapped in a `RenderContext` the render rails consume.
 *
 * The render rails (`render-shorthand-sanity`, `render-overflow-bounds`,
 * `render-visibility-floor`, `kit-vs-live`) all read a single shared runtime
 * via `ctx.renderContext` so the harden run pays the ~1.5 s browser-launch
 * cost ONCE, not per rail.
 *
 * --- Env gate -----------------------------------------------------------
 * `RenderRuntime.launch()` throws when `OFFSCRIPT_PLAYWRIGHT !== '1'` OR when
 * `playwright` cannot be imported. Callers (harden.ts, tests) decide whether
 * to skip the render-rail tier based on `RenderRuntime.canLaunch()` first.
 *
 * --- Lifecycle ----------------------------------------------------------
 *   const rt = await RenderRuntime.launch();           // one Chromium
 *   const live  = await rt.loadHtml(indexHtml);        // page #1
 *   const refer = await rt.loadHtml(referenceHtml);    // page #2 (independent)
 *   const bounds = await live.measureBounds('.tile');  // probe page #1
 *   await rt.close();                                  // closes both pages + browser
 *
 * Each `RenderContext` owns its page; pages stay alive until `rt.close()`
 * so a rail can come back to a previously-loaded doc without re-rendering.
 *
 * --- Determinism --------------------------------------------------------
 * Fixed viewport per runtime (default 1440x900, the desktop review baseline).
 * `measureBounds` / `computedStyle` return null on no-match (never throw).
 * `probe(fnString)` is the escape hatch for richer probes (e.g. cross-element
 * geometry). Probes use stringified JS to avoid tsx's `__name` transpilation
 * quirk that breaks function-passed evaluate.
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import type {
  RenderContext,
  RenderedBounds,
  RenderedStyle,
} from './render-context.js';

/** The default render viewport — desktop-first marketing-page review baseline. */
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 } as const;

/** A4 portrait @96dpi (210×297mm). The collateral render baseline. */
export const A4_VIEWPORT = { width: 794, height: 1123 } as const;

/** 16:9 slide @1920×1080 — the pitch-deck render baseline (the fixed slide canvas). */
export const DECK_VIEWPORT = { width: 1920, height: 1080 } as const;

/** Page-wrap probe result: A4 content height + each .cr-page's rendered block height. */
export interface PrintProbe {
  /** A4 content box height in px (viewport height minus 16mm top+bottom padding). */
  contentHeightPx: number;
  pages: Array<{ index: number; heightPx: number; overflows: boolean }>;
}

export interface RenderRuntimeOptions {
  /** Active viewport for every page in this runtime; default 1440x900. */
  viewport?: { width: number; height: number };
}

/** True when env opt-in is on AND `playwright` is importable. Static probe. */
export async function canLaunchRuntime(): Promise<boolean> {
  if (process.env.OFFSCRIPT_PLAYWRIGHT !== '1') return false;
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}

/**
 * One-per-harden-run Playwright session. Construct via `RenderRuntime.launch()`
 * (async; lazy-imports playwright). Hand a `RenderContext` to each rail via
 * `loadHtml(...)`. Close at the end of the harden run.
 */
export class RenderRuntime {
  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    public readonly viewport: { width: number; height: number },
    private readonly pages: Page[] = [],
  ) {}

  /**
   * Launch a Chromium runtime. Throws when the env gate is off or playwright
   * cannot be imported — callers should `canLaunchRuntime()` first.
   */
  static async launch(opts: RenderRuntimeOptions = {}): Promise<RenderRuntime> {
    if (process.env.OFFSCRIPT_PLAYWRIGHT !== '1') {
      throw new Error(
        'RenderRuntime.launch: OFFSCRIPT_PLAYWRIGHT !== "1" — the render-aware ' +
          'rail tier is env-gated. Set the env var to opt in.',
      );
    }
    let chromium: typeof import('playwright').chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch (err) {
      throw new Error(
        `RenderRuntime.launch: failed to import 'playwright' — ${(err as Error).message}. ` +
          `Run 'npx playwright install chromium' first.`,
      );
    }
    const viewport = opts.viewport ?? DEFAULT_VIEWPORT;
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport });
    return new RenderRuntime(browser, context, viewport);
  }

  /**
   * Load a fresh page with the given HTML. Each call produces an INDEPENDENT
   * page wrapped in its own `RenderContext`; previously-returned contexts
   * stay alive until `close()`. Use this for kit-vs-live (two contexts at
   * once) or for re-running a measurement on the same doc.
   */
  async loadHtml(html: string): Promise<RenderContext> {
    const page = await this.context.newPage();
    this.pages.push(page);
    await page.setContent(html, { waitUntil: 'load' });
    return buildContext(page, this.viewport);
  }

  /**
   * Load HTML, emulate print media, and measure each `.cr-page`'s rendered
   * block height against the A4 content box. Used by the page-wrap rail to
   * detect a page that will print to 2 sheets. Reuses this runtime's session.
   */
  async loadHtmlForPrint(html: string): Promise<PrintProbe> {
    const page = await this.context.newPage();
    this.pages.push(page);
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'load' });
    const MM = 96 / 25.4; // px per mm @96dpi
    const contentHeightPx = Math.round(A4_VIEWPORT.height - 2 * 16 * MM);
    // A .cr-page is a FIXED A4 box (height:297mm, overflow:hidden). It only wraps to a
    // second sheet when its CONTENT exceeds that box — i.e. scrollHeight (full content,
    // including clipped overflow) > clientHeight (the page's own box). Comparing the
    // page-box height (~1123px) to the content box (~1002px) would flag EVERY correct
    // A4 page, including empty ones (the prior bug).
    const result = (await page.evaluate(`(function(){
      var pages = document.querySelectorAll('.cr-page'); var out = [];
      for (var i=0;i<pages.length;i++){ var el = pages[i];
        var content = el.scrollHeight, box = el.clientHeight;
        out.push({ index:i, heightPx: content, overflows: content > box + 1 }); }
      return out;
    })()`)) as PrintProbe['pages'];
    return { contentHeightPx, pages: result };
  }

  /** Close all pages + the browser. Safe to call once at end-of-run. */
  async close(): Promise<void> {
    for (const p of this.pages) {
      try {
        await p.close();
      } catch {
        /* page may already be closed; ignore */
      }
    }
    try {
      await this.context.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser.close();
    } catch {
      /* ignore */
    }
  }

  /** Number of pages currently held by this runtime. Test/diagnostics. */
  get pageCount(): number {
    return this.pages.length;
  }
}

function buildContext(page: Page, viewport: { width: number; height: number }): RenderContext {
  return {
    viewport,
    async measureBounds(selector: string): Promise<RenderedBounds | null> {
      return await page.evaluate(
        `(function() {
          var el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          var r = el.getBoundingClientRect();
          return {
            x: r.x, y: r.y, width: r.width, height: r.height,
            clientWidth: el.clientWidth, clientHeight: el.clientHeight,
          };
        })()`,
      );
    },
    async computedStyle(selector: string): Promise<RenderedStyle | null> {
      return await page.evaluate(
        `(function() {
          var el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          var cs = getComputedStyle(el);
          return {
            backgroundColor: cs.backgroundColor,
            backgroundImage: cs.backgroundImage,
            backgroundBlendMode: cs.backgroundBlendMode,
            color: cs.color,
            opacity: cs.opacity,
            display: cs.display,
          };
        })()`,
      );
    },
    async probe<T>(fn: string): Promise<T> {
      return (await page.evaluate(fn)) as T;
    },
  };
}
