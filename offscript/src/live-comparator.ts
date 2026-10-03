import { spawn } from 'node:child_process';
import type { RenderRuntime } from './render-runtime.js';
import type { RenderContext } from './render-context.js';

/**
 * Live-vs-kit comparator (M2 Track A Task 7).
 *
 * Two responsibilities, kept apart:
 *
 *  1. `fetchLiveHtml(url)` — spawn the Scrapling stealth fetcher
 *     (Python sub-process) and return the rendered HTML string. The
 *     comparator is the only module in `offscript/` that calls Scrapling;
 *     the rest of the codebase is artifact-in-hand.
 *
 *  2. `compareLiveVsKit(rt, kitHtml, liveHtml, opts)` — pure data
 *     function. Loads both HTMLs into the shared `RenderRuntime` at the
 *     same viewport, walks a structural section list (declared selectors
 *     OR default heuristic), measures material attributes per side,
 *     emits a `LiveDivergenceReport`. No network. No mutation.
 *
 * Keeping them apart lets tests + the kit-vs-live rail consume the
 * comparator with stubbed HTML, while the harden CLI hands real bytes
 * via `fetchLiveHtml`.
 *
 * --- Determinism --------------------------------------------------------
 * Sections probed in declared order; divergences sorted by selector ASC,
 * then kind ASC. Same inputs → same report. Tolerances are config
 * (`opts.opacityTol`, `opts.positionTolPx`); defaults below are
 * intentionally lenient — false positives are louder than false
 * negatives for a warn-only oracle.
 */

const DEFAULT_OPACITY_TOL = 0.05;
const DEFAULT_POSITION_TOL_PX = 8;
const SCRAPLING_TIMEOUT_MS = 30_000;

/** The shape of one material divergence found by the comparator. */
export interface SectionDivergence {
  selector: string;
  kind:
    | 'missing-on-live'
    | 'missing-on-kit'
    | 'opacity-mismatch'
    | 'color-mismatch'
    | 'position-mismatch';
  /** Free-form descriptor of the kit-side value (`null` when missing). */
  kit: string | null;
  /** Free-form descriptor of the live-side value (`null` when missing). */
  live: string | null;
  /** 'minor' for tolerance-tier nudges, 'material' for clear gaps. */
  severity: 'minor' | 'material';
}

/** The complete report — what `kit-vs-live` (Task 8) reads. */
export interface LiveDivergenceReport {
  /** The live URL the comparator was run against (or empty when stubbed). */
  url: string;
  /** ISO timestamp of when the comparison was run, when callers stamp it. */
  comparedAt?: string;
  /** Sections actually probed (intersection of selectors with each side). */
  sectionsProbed: number;
  /** Per-divergence findings. Sorted (selector ASC, kind ASC). */
  divergences: SectionDivergence[];
  /** Comparator-level notes (missing python, empty fetch, etc.). */
  warnings: string[];
}

export interface CompareOptions {
  /**
   * Explicit list of section selectors to probe. When omitted, the
   * comparator uses the default heuristic (top-level layout regions:
   * `section, header, footer, main, [data-section]`).
   */
  sections?: string[];
  /** Opacity diff tolerance (absolute). Default 0.05 — anything below is 'minor'. */
  opacityTol?: number;
  /** Position diff tolerance in px (max of |Δx|, |Δy|). Default 8 — sub-grid wiggle. */
  positionTolPx?: number;
}

/* ───────────────────────────── fetcher ───────────────────────────── */

/**
 * Spawn the Scrapling stealth fetcher and return the rendered HTML.
 * Throws when Python or scrapling are not installed, when the URL is
 * unreachable, or when the fetch times out.
 *
 * Caller responsibilities: validate the URL (we pass it directly to
 * Python via argv, but never via shell); cache the result if calling
 * more than once.
 */
export async function fetchLiveHtml(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`fetchLiveHtml: url must be http(s)://, got "${url}"`);
  }
  const timeoutMs = opts.timeoutMs ?? SCRAPLING_TIMEOUT_MS;

  // Inline Python so the comparator has no .py file dependency. Scrapling's
  // StealthyFetcher is the canonical Cloudflare-resilient path per CLAUDE.md.
  const script = [
    'import sys',
    'from scrapling.fetchers import StealthyFetcher',
    'page = StealthyFetcher.fetch(sys.argv[1], headless=True, network_idle=True)',
    'sys.stdout.write(page.html_content)',
  ].join('\n');

  return await new Promise<string>((resolve, reject) => {
    const py = spawn('python', ['-c', script, url], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      py.kill('SIGKILL');
      reject(new Error(`fetchLiveHtml: timeout after ${timeoutMs} ms (${url})`));
    }, timeoutMs);
    py.stdout.on('data', (b: Buffer) => {
      out += b.toString('utf8');
    });
    py.stderr.on('data', (b: Buffer) => {
      err += b.toString('utf8');
    });
    py.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`fetchLiveHtml: failed to spawn python — ${e.message}`));
    });
    py.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `fetchLiveHtml: python exited ${code} fetching ${url}\nstderr: ${err.trim()}`,
          ),
        );
        return;
      }
      if (out.trim() === '') {
        reject(new Error(`fetchLiveHtml: empty body returned for ${url}`));
        return;
      }
      resolve(out);
    });
  });
}

/* ───────────────────────────── comparator ───────────────────────────── */

/**
 * Pure comparator: render both sides at the same viewport, probe each
 * declared section, emit divergences. No network. Caller owns the
 * runtime lifecycle (so the harden run amortises one Chromium across
 * all render rails + the comparator).
 */
export async function compareLiveVsKit(
  rt: RenderRuntime,
  kitHtml: string,
  liveHtml: string,
  opts: CompareOptions = {},
): Promise<LiveDivergenceReport> {
  const opacityTol = opts.opacityTol ?? DEFAULT_OPACITY_TOL;
  const positionTolPx = opts.positionTolPx ?? DEFAULT_POSITION_TOL_PX;
  const sectionSelectors =
    opts.sections && opts.sections.length > 0
      ? opts.sections
      : ['section', 'header', 'footer', 'main', '[data-section]'];

  const warnings: string[] = [];
  if (kitHtml.trim() === '') warnings.push('compareLiveVsKit: empty kitHtml — nothing to compare.');
  if (liveHtml.trim() === '')
    warnings.push('compareLiveVsKit: empty liveHtml — comparator has no live side.');

  const [kitCtx, liveCtx] = await Promise.all([rt.loadHtml(kitHtml), rt.loadHtml(liveHtml)]);

  const [kitProbe, liveProbe] = await Promise.all([
    probeSections(kitCtx, sectionSelectors),
    probeSections(liveCtx, sectionSelectors),
  ]);

  const divergences = diffSides(kitProbe, liveProbe, opacityTol, positionTolPx);
  divergences.sort((a, b) => {
    if (a.selector !== b.selector) return a.selector < b.selector ? -1 : 1;
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
  });

  return {
    url: '',
    sectionsProbed: Math.min(kitProbe.length, liveProbe.length),
    divergences,
    warnings,
  };
}

/* ───────────────────────────── probe (per side) ───────────────────────────── */

interface SectionSample {
  selector: string;
  index: number; // nth match of the selector on the page
  /** opacity 0..1 */
  opacity: number;
  /** computed color, raw rgb string */
  color: string;
  /** computed backgroundColor, raw rgb string */
  backgroundColor: string;
  /** bounds at the shared viewport, in css px */
  x: number;
  y: number;
  width: number;
  height: number;
}

async function probeSections(
  ctx: RenderContext,
  selectors: string[],
): Promise<SectionSample[]> {
  const payload = JSON.stringify(selectors);
  const fnSource = `(function() {
    var selectors = ${payload};
    var out = [];
    var seen = new Set();
    for (var i = 0; i < selectors.length; i++) {
      var sel = selectors[i];
      var matches;
      try { matches = document.querySelectorAll(sel); }
      catch (_e) { continue; }
      for (var j = 0; j < matches.length; j++) {
        var el = matches[j];
        if (seen.has(el)) continue;
        seen.add(el);
        var r = el.getBoundingClientRect();
        var cs = getComputedStyle(el);
        out.push({
          selector: sel,
          index: j,
          opacity: parseFloat(cs.opacity || '1'),
          color: cs.color || '',
          backgroundColor: cs.backgroundColor || '',
          x: Math.round(r.x * 100) / 100,
          y: Math.round(r.y * 100) / 100,
          width: Math.round(r.width * 100) / 100,
          height: Math.round(r.height * 100) / 100,
        });
      }
    }
    return out;
  })()`;
  return await ctx.probe<SectionSample[]>(fnSource);
}

/* ───────────────────────────── diff ───────────────────────────── */

/**
 * Pair kit/live samples by `(selector, index)` — the same selector at the
 * same nth-match slot. Missing on either side = a structural divergence
 * (`missing-on-…`). Material attribute divergences within a pair: opacity,
 * background-color, position.
 */
function diffSides(
  kit: SectionSample[],
  live: SectionSample[],
  opacityTol: number,
  positionTolPx: number,
): SectionDivergence[] {
  const byKey = (s: SectionSample): string => `${s.selector}#${s.index}`;
  const kitMap = new Map(kit.map((s) => [byKey(s), s]));
  const liveMap = new Map(live.map((s) => [byKey(s), s]));
  const out: SectionDivergence[] = [];

  for (const [key, k] of kitMap) {
    const l = liveMap.get(key);
    if (!l) {
      out.push({
        selector: key,
        kind: 'missing-on-live',
        kit: `present (${k.width}x${k.height} @ ${k.x},${k.y})`,
        live: null,
        severity: 'material',
      });
      continue;
    }
    const dOpacity = Math.abs(k.opacity - l.opacity);
    if (dOpacity > opacityTol) {
      out.push({
        selector: key,
        kind: 'opacity-mismatch',
        kit: String(k.opacity),
        live: String(l.opacity),
        severity: dOpacity > 0.2 ? 'material' : 'minor',
      });
    }
    if (k.backgroundColor !== l.backgroundColor) {
      out.push({
        selector: key,
        kind: 'color-mismatch',
        kit: k.backgroundColor,
        live: l.backgroundColor,
        severity: 'material',
      });
    }
    const dPos = Math.max(Math.abs(k.x - l.x), Math.abs(k.y - l.y));
    if (dPos > positionTolPx) {
      out.push({
        selector: key,
        kind: 'position-mismatch',
        kit: `(${k.x}, ${k.y})`,
        live: `(${l.x}, ${l.y})`,
        severity: dPos > 32 ? 'material' : 'minor',
      });
    }
  }
  for (const [key, l] of liveMap) {
    if (kitMap.has(key)) continue;
    out.push({
      selector: key,
      kind: 'missing-on-kit',
      kit: null,
      live: `present (${l.width}x${l.height} @ ${l.x},${l.y})`,
      severity: 'material',
    });
  }
  return out;
}
