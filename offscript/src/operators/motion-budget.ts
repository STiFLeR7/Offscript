import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss } from '../css-rep.js';

/**
 * Tier-0 detector: motion-budget.
 *
 * From the rail slate (Group A) / SECTION_INTELLIGENCE §5.6: more than a
 * handful of simultaneous motion sources at once turns the page into a
 * disco. A page with > 3 `animation` triggers is over budget.
 *
 * v1 simplification (per the handoff): "cannot tell viewport-equivalent
 * without rendering; warn at the page level for now." We count motion
 * sources document-wide, not per-viewport. The threshold ROUGHLY
 * corresponds to a single viewport's worth at typical landing-page
 * density; a tighter viewport-aware count is a follow-up once the
 * rendered measurement seam (responsive-need-rendered's render path)
 * generalises to a "what's in the viewport" oracle.
 *
 * What counts as a trigger:
 *  - Each element with an inline `style="animation: …"` (or
 *    `animation-name:`) declaration → one trigger.
 *  - Each CSS rule inside an embedded `<style>` block that declares
 *    `animation:` (or `animation-name:`) → one trigger. A single
 *    selector matching multiple elements is still ONE motion source
 *    by design (the motion fires once, on all matched elements
 *    together); finer-grained accounting needs render-time data.
 *  - `@keyframes` blocks DEFINE motion but do NOT trigger it on their
 *    own — they're skipped.
 *
 * Outcome is `warning`, not `escalated`. The fix (drop a motion source,
 * raise the budget deliberately, or restructure) is a design call; this
 * rail just surfaces the count so the designer can decide.
 */
const DEFAULT_BUDGET = 3;

export const motionBudget: Operator = {
  name: 'motion-budget',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    const budget =
      typeof ctx.params.budget === 'number' && ctx.params.budget >= 0
        ? ctx.params.budget
        : DEFAULT_BUDGET;

    const triggers = countTriggers(tree);
    if (triggers <= budget) return [];
    return [
      {
        id: `motion-budget:over:${triggers}`,
        description: `document declares ${triggers} simultaneous CSS animation triggers (budget ${budget}); too much motion competing for attention — warn at the page level (viewport-equivalent counting deferred to the render seam)`,
        outcome: 'warning',
      },
    ];
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

/** Count all animation triggers across embedded <style> rules + inline styles. */
function countTriggers(tree: Root): number {
  let count = 0;
  visitElements(tree, (el) => {
    if (el.tagName === 'style') {
      count += countTriggersInStyleBlock(el);
      return;
    }
    if (hasInlineAnimationTrigger(el)) count++;
  });
  return count;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

/**
 * Count rules inside a single `<style>` block that declare an animation
 * trigger. A rule is counted once even if it declares `animation:` AND
 * `animation-name:`. `@keyframes` is a definition, not a trigger — its
 * inner blocks are skipped.
 */
function countTriggersInStyleBlock(el: Element): number {
  const css = styleText(el);
  if (!css) return 0;
  const root = parseCss(css);
  let n = 0;
  // walkRules visits @keyframes inner blocks too — distinguish by checking
  // the rule's parent. PostCSS exposes parent at decl-time; we instead use
  // walkAtRules to mark keyframes ranges and walkRules for non-keyframes.
  const inKeyframes = new Set<unknown>();
  root.walkAtRules((at) => {
    if (/^(-(?:webkit|moz|o|ms)-)?keyframes$/i.test(at.name)) {
      // Mark every descendant rule as "inside @keyframes" so we skip it.
      at.walkRules((r) => {
        inKeyframes.add(r);
      });
    }
  });
  root.walkRules((rule) => {
    if (inKeyframes.has(rule)) return;
    let triggered = false;
    rule.walkDecls((decl) => {
      const p = decl.prop.toLowerCase();
      if (p === 'animation' || p === 'animation-name') triggered = true;
    });
    if (triggered) n++;
  });
  return n;
}

/** Does this element's inline `style` carry an animation trigger? */
function hasInlineAnimationTrigger(el: Element): boolean {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return false;
  const lowered = style.toLowerCase();
  for (const decl of lowered.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim();
    if (prop === 'animation' || prop === 'animation-name') return true;
  }
  return false;
}
