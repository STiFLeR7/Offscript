import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import type { RenderContext } from '../../render-context.js';
import { safeProbe, type ProbeResult } from '../../render-probe.js';

/**
 * Tier-1 render-aware rail — `render-visibility-floor` (M2 Track A Task 6).
 *
 * The extreme-invisibility safety net. Where `contrast` enforces the WCAG
 * AA/AAA contrast bands on declared token colours, this rail measures the
 * COMPUTED color + effective background at the rendered DOM and flags
 * any text where the two are so close they're effectively invisible to
 * a human eye — relative-luminance delta below `VISIBILITY_FLOOR`.
 *
 * This catches a different failure mode than WCAG contrast:
 *
 *  - `contrast` is a designed-band check (does the AA ratio hold?).
 *  - This rail is a render-time SANITY check: is the text rendered AT
 *    ALL? It catches the bug class where a token-on-token combination
 *    silently resolves to white-on-white / black-on-black, e.g., a
 *    container declares `color: var(--surface-0)` against a background
 *    that itself inherited `--surface-0` — a static scan misses it
 *    because both ends LOOK like distinct tokens.
 *
 * --- Detection ---------------------------------------------------------
 * Probe-side, for every leaf element with non-empty trimmed text and
 * computed `opacity > 0` / `display !== none` / `visibility !== hidden`:
 *  1. Read computed `color` (the text's resolved RGB).
 *  2. Walk ancestors collecting effective background — first ancestor
 *     whose `backgroundColor` is non-transparent + non-zero-alpha wins.
 *     If none, use the page default white.
 *  3. Compute WCAG relative luminance for each, take |Lt - Lb|.
 *  4. If delta < VISIBILITY_FLOOR, flag.
 *
 * --- Tier-1 vs Tier-2 (outcome -------------------------------------)
 * The real invisibility finding is `outcome: 'escalated'` (Phase-3 B5):
 * effectively-invisible text fails the score. The fix requires a designer
 * call (which token, which slot, which surface to swap) — the rail doesn't
 * attempt auto-remediation. It is `tier: 1` (semantic-category anchor —
 * every text-bearing element) for the registry. (A probe-error degrade path
 * stays `warning`.)
 *
 * --- Contract surface --------------------------------------------------
 * Sync `detect` / `apply` return `[]`, matching the canonical pattern.
 * Real work on `detectVisibilityFloorAsync(rc, tree)`. Apply is a no-op
 * because the fix needs the designer.
 *
 * --- Determinism -------------------------------------------------------
 * Findings sort by structural path. Idempotent — pure measurement, no
 * mutation.
 */

const VISIBILITY_FLOOR = 0.02; // |Lt - Lb| < 0.02 ≈ visually indistinguishable

interface VisibilityFailure {
  /** Root→leaf child-index path identifying the element. */
  path: number[];
  /** Computed colour, e.g., `rgb(255, 255, 255)`. */
  textColor: string;
  /** Computed effective background colour. */
  bgColor: string;
  /** |L_text - L_bg|, rounded to 4 dp. */
  luminanceDelta: number;
  /** First ~40 chars of the element's trimmed text content. */
  sample: string;
}

/** Sync Operator surface — work lives on the async helper. */
export const renderVisibilityFloor: Operator = {
  name: 'render-visibility-floor',
  tier: 1,

  detect(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },

  apply(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },
};

/** Async detection: returns one warning per text element below the floor. */
export async function detectVisibilityFloorAsync(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<Finding[]> {
  const res = await probeFailures(rc);
  if (!res.ok) return res.degrade;
  return res.value
    .filter((f) => resolvePath(tree, f.path))
    .map(failureToFinding);
}

/* ───────────────────────────── probe ───────────────────────────── */

async function probeFailures(
  rc: RenderContext | undefined,
): Promise<ProbeResult<VisibilityFailure[]>> {
  if (!rc) return { ok: true, value: [] };

  const fnSource = `(function() {
    var FLOOR = ${VISIBILITY_FLOOR};

    function pathOf(el) {
      var path = [];
      var node = el;
      while (node && node.parentElement) {
        var siblings = node.parentElement.children;
        var idx = 0;
        for (var i = 0; i < siblings.length; i++) {
          if (siblings[i] === node) { idx = i; break; }
        }
        path.unshift(idx);
        node = node.parentElement;
      }
      return path;
    }

    function parseRgb(s) {
      if (!s) return null;
      var m = s.match(/rgba?\\(([^)]+)\\)/i);
      if (!m) return null;
      var parts = m[1].split(',').map(function(p){ return parseFloat(p.trim()); });
      if (parts.length < 3) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    function relLuminance(rgb) {
      function ch(v) {
        var c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      }
      return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
    }

    function effectiveBackground(el) {
      var node = el;
      while (node && node !== document.documentElement) {
        var cs = getComputedStyle(node);
        // A gradient / image background composites a colour we cannot read from
        // computed style; a translucent backgroundColor (alpha < 1) composites over
        // whatever is behind it. In both cases the painted backing is INDETERMINATE
        // — return null so the caller SKIPS this element rather than falling through
        // to the white page default (which would false-flag legitimate white-on-dark
        // text on the charter's sanctioned ink-night→ink-violet gradient surfaces).
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        var bg = parseRgb(cs.backgroundColor);
        if (bg && bg.a > 0 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          if (bg.a < 0.999) return null; // translucent veil over an unknown backing
          return bg;
        }
        node = node.parentElement;
      }
      // Page-root fallback: white. (Browsers paint to white unless body declares otherwise.)
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    function isLeafTextElement(el) {
      // An element is a "leaf text element" if it has a non-empty trimmed
      // direct text node and no element children that contain text themselves.
      // For v1: any direct non-empty text node child counts.
      for (var i = 0; i < el.childNodes.length; i++) {
        var n = el.childNodes[i];
        if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim() !== '') return true;
      }
      return false;
    }

    function isRenderedVisible(cs) {
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      return true;
    }

    var all = document.querySelectorAll('*');
    var results = [];
    var skipTags = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TITLE: 1, HEAD: 1 };
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (skipTags[el.tagName]) continue;
      if (!isLeafTextElement(el)) continue;
      var cs = getComputedStyle(el);
      if (!isRenderedVisible(cs)) continue;
      var fg = parseRgb(cs.color);
      if (!fg) continue;
      var bg = effectiveBackground(el);
      if (!bg) continue; // indeterminate backing (gradient / translucent veil) — cannot judge, skip
      var dl = Math.abs(relLuminance(fg) - relLuminance(bg));
      if (dl >= FLOOR) continue;
      var text = '';
      for (var j = 0; j < el.childNodes.length; j++) {
        var n = el.childNodes[j];
        if (n.nodeType === 3 && n.nodeValue) text += n.nodeValue;
      }
      text = text.trim();
      if (text.length > 40) text = text.slice(0, 39) + '…';
      results.push({
        path: pathOf(el),
        textColor: cs.color,
        bgColor: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')',
        luminanceDelta: Math.round(dl * 10000) / 10000,
        sample: text,
      });
    }
    results.sort(function(a, b) {
      var pa = a.path.join('/');
      var pb = b.path.join('/');
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return results;
  })()`;

  return safeProbe<VisibilityFailure[]>(rc, fnSource, renderVisibilityFloor.name);
}

/* ───────────────────────────── tree helpers ───────────────────────────── */

function resolvePath(tree: Root, path: number[]): Element | undefined {
  const html = tree.children.find((c): c is Element => c.type === 'element');
  if (!html) return undefined;
  let node: Element = html;
  for (const childIdx of path) {
    const elementChildren = node.children.filter(
      (c): c is Element => c.type === 'element',
    );
    if (childIdx >= elementChildren.length) return undefined;
    node = elementChildren[childIdx];
  }
  return node;
}

/* ───────────────────────────── finding ───────────────────────────── */

export function failureToFinding(f: VisibilityFailure): Finding {
  return {
    id: `render-visibility-floor:${f.path.join('/')}`,
    description:
      `text "${f.sample}" is effectively invisible at render time — ` +
      `computed color ${f.textColor} on background ${f.bgColor} ` +
      `(luminance delta ${f.luminanceDelta}, floor ${VISIBILITY_FLOOR}). ` +
      `Likely cause: a token-on-token combination collapsed to same-on-same. Designer call.`,
    outcome: 'escalated',
  };
}
