import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';

/**
 * Tier-0 website rail: reduced-motion (Example Brand website charter / accessibility
 * — "every motion declaration MUST include a `prefers-reduced-motion: reduce`
 * fallback").
 *
 * Document-level mechanical check (low false-positive): if the document declares
 * any CSS ANIMATION (a `@keyframes` block or an `animation` / `animation-name`
 * trigger) but carries NO `@media (prefers-reduced-motion: reduce)` block, the
 * page animates with no reduced-motion escape hatch → one finding.
 *
 * Scoped to animations, NOT transitions: a hover `transition` is intentional,
 * ubiquitous, and not the vestibular-trigger the rule targets — requiring a
 * reduced-motion guard for every transition would false-positive heavily. This
 * mirrors `motion-budget`'s trigger definition (`@keyframes` is a definition, an
 * `animation:`/`animation-name:` is a trigger).
 *
 * Warn-only; the fix (add the `@media` no-op) is a mechanical author change.
 * Never mutates. Website-track only.
 */
const ANIMATION_TRIGGER = /@keyframes\b|(^|[;{}\s])animation(-name)?\s*:/i;
const REDUCED_MOTION = /prefers-reduced-motion\s*:\s*reduce/i;

function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

export const reducedMotion: Operator = {
  name: 'reduced-motion',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    let hasAnimation = false;
    let hasReducedMotion = false;

    visitElements(tree, (el) => {
      if (el.tagName === 'style') {
        const css = styleText(el);
        if (!css) return;
        if (ANIMATION_TRIGGER.test(css)) hasAnimation = true;
        if (REDUCED_MOTION.test(css)) hasReducedMotion = true;
      }
      // inline style="animation:…" is also a trigger
      const s = el.properties?.style;
      if (typeof s === 'string' && /(^|[;{}\s])animation(-name)?\s*:/i.test(s)) hasAnimation = true;
    });

    if (hasAnimation && !hasReducedMotion) {
      return [{
        id: 'reduced-motion:missing',
        description: 'the page declares CSS animation(s) but no `@media (prefers-reduced-motion: reduce)` block — add a reduced-motion no-op (animation:none / opacity:1) so motion-sensitive visitors get a still page.',
        outcome: 'warning',
      }];
    }
    return [];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
