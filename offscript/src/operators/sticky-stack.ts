import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';

/**
 * Tier-1 detector: sticky-stack.
 *
 * From the rail slate (Group A) / SECTION_INTELLIGENCE §5.5: two
 * `position:sticky` elements pinned to the SAME edge (both `top:` or both
 * `bottom:` resolved on the element) overlap each other as the page scrolls
 * — the second-in-document occludes the first. This is a hand-decided
 * layout collision (a global sticky header + a section-level sticky filter
 * bar may both be intentional, or the design may want one to win); the
 * systematic core cannot pick automatically, so the finding is `escalated`
 * (per the foundational rule: edge-anchored layout collisions belong in
 * the frozen bespoke region).
 *
 * Detection looks at inline-style declarations only (`position:sticky` +
 * an explicit `top:`/`bottom:` value). External stylesheets are out of
 * scope at this layer — the deliverable embeds CSS in inline styles after
 * flatten, so the sticky-discipline signal lives there.
 *
 * Tier-1 escalation-only: `apply` does not mutate. Re-runs `detect` so
 * verify() correctly reports residue until the freeze-wiring writes the
 * overlay entry on the next harden cycle.
 */
export const stickyStack: Operator = {
  name: 'sticky-stack',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const byEdge: { top: Element[]; bottom: Element[] } = { top: [], bottom: [] };
    visitElements(tree, (el) => {
      const edge = stickyEdge(el);
      if (edge === 'top') byEdge.top.push(el);
      else if (edge === 'bottom') byEdge.bottom.push(el);
    });

    const findings: Finding[] = [];
    for (const edge of ['top', 'bottom'] as const) {
      const els = byEdge[edge];
      if (els.length < 2) continue;
      // Emit one finding per redundant sticky beyond the first. The
      // first-in-document wins by default (matches the natural stacking
      // intuition: the header pinned at top:0 outranks the toolbar that
      // arrives later).
      for (let i = 1; i < els.length; i++) {
        const peers = els.map(describeEl).join(', ');
        const here = describeEl(els[i]);
        findings.push({
          id: `sticky-stack:${edge}:${stableLocation(els[i], i)}`,
          description: `${here} declares position:sticky on the same edge (${edge}) as ${els.length - 1} other element(s) (${peers}); they will occlude each other on scroll — classify as Tier-1 bespoke`,
          outcome: 'escalated',
        });
      }
    }
    findings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

/**
 * Returns the edge (`'top'` / `'bottom'`) that an element is sticky-pinned to,
 * or `undefined` if it isn't `position:sticky` or doesn't declare a pinned edge.
 *
 * Looks at the inline `style` attribute only — the flatten step embeds CSS into
 * inline styles, which is where the sticky-discipline signal lives at this layer.
 */
function stickyEdge(el: Element): 'top' | 'bottom' | undefined {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return undefined;
  const lowered = style.toLowerCase();
  if (!/(^|;|\s)position\s*:\s*sticky\s*(;|$)/.test(lowered)) return undefined;
  const hasTop = /(^|;|\s)top\s*:\s*[^;]+/.test(lowered);
  const hasBottom = /(^|;|\s)bottom\s*:\s*[^;]+/.test(lowered);
  // If both are declared, the LAST one in the cascade wins — but for the
  // sticky-collision question, both edges being declared is itself unusual;
  // we treat the element as pinned to whichever appears last.
  if (hasTop && hasBottom) {
    const topIdx = lowered.lastIndexOf('top:');
    const botIdx = lowered.lastIndexOf('bottom:');
    return topIdx > botIdx ? 'top' : 'bottom';
  }
  if (hasTop) return 'top';
  if (hasBottom) return 'bottom';
  return undefined;
}

/** Short, human-readable element descriptor: `tag#id.class` (best-effort). */
function describeEl(el: Element): string {
  let s = el.tagName;
  const id = el.properties?.id;
  if (typeof id === 'string' && id) s += `#${id}`;
  const cls = el.properties?.className;
  if (Array.isArray(cls) && cls.length > 0) s += `.${cls.join('.')}`;
  return s;
}

/**
 * Deterministic id segment for a finding: prefers id/class fingerprint;
 * falls back to a positional index so two anonymous-but-distinct stickies
 * still get distinct finding ids (and idempotency holds across runs).
 */
function stableLocation(el: Element, fallbackIndex: number): string {
  const id = el.properties?.id;
  if (typeof id === 'string' && id) return `id-${id}`;
  const cls = el.properties?.className;
  if (Array.isArray(cls) && cls.length > 0) return `class-${cls.join('-')}`;
  return `n${fallbackIndex}`;
}
