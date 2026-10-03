import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import type { RenderContext } from '../../render-context.js';
import { safeProbe, type ProbeResult } from '../../render-probe.js';

/**
 * Tier-1 render-aware rail — `render-overflow-bounds` (M2 Track A Task 5).
 *
 * Catches the absolute-positioned-bleed class. The CR diagnostic surfaced a
 * hero blur ornament rendered with `position:absolute; right:-…; width:…`
 * that extended past the hero band's right edge — the band's `overflow`
 * was the browser default (`visible`), so the blur bled into the page
 * gutter on desktop. Static scans can't see this — the source LOOKS
 * fine; only the rendered bounds reveal the bleed.
 *
 * --- Detection ---------------------------------------------------------
 * Probe-side, walk every element with computed `position: absolute |
 * fixed`. For each, compare its bounding rect to the nearest positioned
 * ancestor's rect (the element's CSS containing block). When the child's
 * rect extends beyond the ancestor's rect by more than a small tolerance
 * (1 px — sub-pixel rounding noise), report a finding.
 *
 * Bleed direction matters for the remediation:
 *  - All four sides clipped by `overflow: hidden` on the ancestor when
 *    we control that knob — the Tier-1 path.
 *  - When the ancestor already declares a different `overflow` value
 *    (e.g., `visible` deliberately, or `auto` for scroll), the fix needs
 *    a design call — escalate to Tier-2.
 *
 * --- Auto-remediation --------------------------------------------------
 * For Tier-1 bleeds (ancestor `overflow` is initial / `visible` by
 * default), set the ancestor's inline `overflow: hidden`. The change is
 * minimal (one declaration on a single element) and idempotent. The
 * source ancestor element is identified by structural path — the same
 * path encoding `render-shorthand-sanity` uses, so the resolve step is
 * reused.
 *
 * --- Contract surface --------------------------------------------------
 * Sync `detect` / `apply` return `[]`, matching the `responsive-need-
 * rendered` pattern. Real work on `detectOverflowBoundsAsync(rc, tree)`
 * and `applyOverflowBoundsAsync(rc, tree)`. The engine's async-aware
 * verification rail (M2 Task 10 wiring) calls those directly.
 *
 * --- Determinism -------------------------------------------------------
 * Findings sort by ancestor path asc, then by child path asc. Idempotent:
 * the second apply finds nothing further (the ancestor now has
 * `overflow: hidden` set, so the bleed is clipped before the probe
 * measures it).
 */

const BLEED_TOLERANCE_PX = 1;

interface OverflowBleed {
  /** Child element path (root → leaf child-index sequence). */
  childPath: number[];
  /** Containing-block ancestor path (the element whose overflow we'd set). */
  ancestorPath: number[];
  /** Bleed amounts per side, in px. Positive = bled past the side. */
  bleed: { top: number; right: number; bottom: number; left: number };
  /** The ancestor's currently-resolved overflow shorthand. */
  ancestorOverflow: string;
  /** Whether auto-remediation is safe (ancestor has no explicit overflow). */
  tier1: boolean;
}

/** Sync Operator surface — work lives on the async helpers. */
export const renderOverflowBounds: Operator = {
  name: 'render-overflow-bounds',
  tier: 1,

  detect(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },

  apply(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },
};

/** Async detection: returns one finding per absolute-bleed, Tier-1 or Tier-2. */
export async function detectOverflowBoundsAsync(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<Finding[]> {
  const res = await probeBleeds(rc);
  if (!res.ok) return res.degrade;
  // Reference tree for path consistency (verifies the ancestor + child paths resolve).
  return res.value.filter((b) => resolvePath(tree, b.ancestorPath) && resolvePath(tree, b.childPath))
    .map(bleedToFinding);
}

/**
 * Async auto-remediation: sets `overflow: hidden` on each Tier-1
 * ancestor identified by the probe. Tier-2 bleeds are returned with
 * `outcome: 'escalated'` (no mutation). Idempotent.
 */
export async function applyOverflowBoundsAsync(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<Finding[]> {
  const res = await probeBleeds(rc);
  if (!res.ok) return res.degrade;
  const bleeds = res.value;
  if (bleeds.length === 0) return [];

  // Dedupe by ancestor path: one inline-style write per ancestor regardless
  // of how many bleeding children it hosts.
  const seenAncestors = new Set<string>();
  const findings: Finding[] = [];

  for (const b of bleeds) {
    const ancestor = resolvePath(tree, b.ancestorPath);
    const child = resolvePath(tree, b.childPath);
    if (!ancestor || !child) continue;

    if (!b.tier1) {
      findings.push({ ...bleedToFinding(b), outcome: 'escalated' });
      continue;
    }
    const key = b.ancestorPath.join('/');
    if (seenAncestors.has(key)) {
      findings.push({ ...bleedToFinding(b), outcome: 'auto-remediated' });
      continue;
    }
    if (setInlineOverflowHidden(ancestor)) {
      seenAncestors.add(key);
      findings.push({ ...bleedToFinding(b), outcome: 'auto-remediated' });
    }
  }
  return findings;
}

/* ───────────────────────────── probe ───────────────────────────── */

async function probeBleeds(rc: RenderContext | undefined): Promise<ProbeResult<OverflowBleed[]>> {
  if (!rc) return { ok: true, value: [] };

  const fnSource = `(function() {
    var TOL = ${BLEED_TOLERANCE_PX};

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
      // The walk root is documentElement; we don't push an index for it.
      return path;
    }

    /**
     * The CSS "containing block" for a position:absolute element is its
     * nearest ancestor whose computed position is not 'static', OR the
     * initial containing block (the viewport / documentElement). We use
     * documentElement as the fallback.
     */
    function containingBlock(el) {
      var p = el.parentElement;
      while (p) {
        if (p === document.documentElement) return p;
        var cs = getComputedStyle(p);
        if (cs.position && cs.position !== 'static') return p;
        // Containing block also stops at transformed / will-change ancestors,
        // but for v1 we keep the rule simple — position-non-static OR root.
        p = p.parentElement;
      }
      return document.documentElement;
    }

    var all = document.querySelectorAll('*');
    var results = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs = getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      var anc = containingBlock(el);
      var er = el.getBoundingClientRect();
      var ar = anc.getBoundingClientRect();
      var bleed = {
        top: ar.top - er.top,
        right: er.right - ar.right,
        bottom: er.bottom - ar.bottom,
        left: ar.left - er.left,
      };
      var bleeds =
        bleed.top > TOL || bleed.right > TOL || bleed.bottom > TOL || bleed.left > TOL;
      if (!bleeds) continue;
      // Don't flag elements bleeding past documentElement itself —
      // render-overflow-bounds is about child-vs-ancestor leakage; viewport
      // overflow is responsive-need-rendered's territory.
      if (anc === document.documentElement) continue;
      var ancCs = getComputedStyle(anc);
      var ancOv = ancCs.overflow || 'visible';
      // If the ancestor already clips (hidden / clip / auto / scroll), the
      // bleed isn't a visual problem — skip. Only the leak-allowing
      // 'visible' value produces a finding.
      if (ancOv !== 'visible') continue;
      // Tier-1 vs Tier-2: did the designer explicitly declare visibility
      // (inline 'overflow: visible' = a deliberate design choice) or is
      // it just the browser default (safe to flip to hidden)?
      var inlineDeclared = false;
      var styleAttr = anc.getAttribute && anc.getAttribute('style');
      if (styleAttr) {
        var m = styleAttr.match(/(^|;)\\s*overflow(?:-(?:x|y))?\\s*:/i);
        if (m) inlineDeclared = true;
      }
      var tier1 = !inlineDeclared;
      results.push({
        childPath: pathOf(el),
        ancestorPath: pathOf(anc),
        bleed: {
          top: Math.round(bleed.top * 100) / 100,
          right: Math.round(bleed.right * 100) / 100,
          bottom: Math.round(bleed.bottom * 100) / 100,
          left: Math.round(bleed.left * 100) / 100,
        },
        ancestorOverflow: ancOv,
        tier1: tier1,
      });
    }
    results.sort(function(a, b) {
      var pa = a.ancestorPath.join('/');
      var pb = b.ancestorPath.join('/');
      if (pa !== pb) return pa < pb ? -1 : 1;
      var ca = a.childPath.join('/');
      var cb = b.childPath.join('/');
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
    return results;
  })()`;

  return safeProbe<OverflowBleed[]>(rc, fnSource, renderOverflowBounds.name);
}

/* ───────────────────────────── tree helpers ───────────────────────────── */

/**
 * Mirror of the probe's `pathOf`: a child-index sequence rooted at the
 * `<html>` element. (Probe-side, documentElement isn't pushed; here, the
 * empty path means the `<html>` element itself.)
 */
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

/**
 * Set `overflow: hidden` on the element's inline style. Returns true if
 * the style was changed; false if the inline style already declares
 * `overflow:` (idempotent / re-run safe).
 */
function setInlineOverflowHidden(el: Element): boolean {
  const props = (el.properties ??= {});
  const current = props.style;
  const text = typeof current === 'string' ? current : '';
  if (/(^|;)\s*overflow\s*:/i.test(text)) return false;
  const next = text.trim() === ''
    ? 'overflow: hidden;'
    : `${text.trim().replace(/;$/, '')}; overflow: hidden;`;
  (props as Record<string, unknown>).style = next;
  return true;
}

/* ───────────────────────────── finding ───────────────────────────── */

function bleedToFinding(b: OverflowBleed): Finding {
  const sides = (['top', 'right', 'bottom', 'left'] as const)
    .filter((s) => b.bleed[s] > BLEED_TOLERANCE_PX)
    .map((s) => `${s} +${b.bleed[s]}px`)
    .join(', ');
  const action = b.tier1
    ? 'auto-remediated via overflow:hidden on the ancestor'
    : `escalated: ancestor declares overflow: ${b.ancestorOverflow} — design call needed`;
  return {
    id: `render-overflow-bounds:${b.ancestorPath.join('/')}:${b.childPath.join('/')}`,
    description:
      `absolute/fixed child at /${b.childPath.join('/')} bleeds past containing-block ancestor ` +
      `at /${b.ancestorPath.join('/')} (${sides}); ${action}.`,
    outcome: b.tier1 ? 'auto-remediated' : 'escalated',
  };
}
