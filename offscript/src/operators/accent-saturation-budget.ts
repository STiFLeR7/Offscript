import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';
import { resolveSlot } from '../brand-contract.js';

/**
 * Tier-0 detector: accent-saturation-budget.
 *
 * From the rail slate (Group A) / SECTION_INTELLIGENCE §2.6 + §4.7: the
 * accent is for *emphasis* — it earns attention by being rare. When more
 * than ~10% of foreground inkings on the page resolve to `--accent`, the
 * accent stops emphasising and starts shouting (the "neon highlighter"
 * failure mode the playbook warns about in §4.7).
 *
 * v1 simplification (mirrors motion-budget): document-wide count, not
 * per-viewport. A tighter viewport-aware count is a follow-up once the
 * rendered measurement seam generalises.
 *
 * Contract dependency. This is the only Group A rail that needs the Brand
 * Contract — it has to know which kit token IS `--accent`. If the contract
 * is missing OR the `--accent` slot is unmapped, we cannot measure, so the
 * rail emits ONE `warning` finding flagging the gap and returns. It does
 * NOT throw; the rest of the suite keeps running.
 *
 * What counts as a "foreground inking":
 *  - inline `style="color: …"` / `background-color: …` / `border-color: …` /
 *    `fill: …` / `stroke: …` declarations
 *  - the same properties inside an embedded `<style>` block
 * Each declaration counts once. Multiple declarations on one element each
 * count separately (a button with `color:--accent; background:--accent;
 * border-color:--accent` is three accent uses, deliberately — that IS
 * three foreground inkings).
 *
 * An inking is "accent" when the value contains `var(--<accent-token>)`
 * OR (when a literal hex value is known for the slot) the literal value
 * itself. Other matches (rgb()/hsl()/etc.) are not first-class in v1.
 *
 * Outcome is `escalated` (Phase-3 B5): a flattened-hierarchy accent over-use
 * fails the score. The fix (cut accent uses, lift one of the offenders to a
 * surface, redesign the section) is a design call; this rail surfaces the
 * ratio so the designer can decide.
 */
const FOREGROUND_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'fill',
  'stroke',
  'outline-color',
]);

const DEFAULT_BUDGET = 0.1; // 10%
const MIN_TOTAL_TO_REPORT = 10; // tiny docs (a unit test fixture) are not over-budget

export const accentSaturationBudget: Operator = {
  name: 'accent-saturation-budget',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    const paramBudget =
      typeof ctx.params.budget === 'number' && ctx.params.budget > 0 && ctx.params.budget <= 1
        ? ctx.params.budget
        : undefined;
    const budget = paramBudget ?? ctx.posture?.accentUsageBudget ?? DEFAULT_BUDGET;

    const accent = resolveSlot(ctx.brandContract, '--accent', ctx.tokens?.customProps);
    if (!accent) {
      return [
        {
          id: 'accent-saturation-budget:no-accent-slot',
          description:
            'cannot measure accent saturation — no brand contract on file or `--accent` slot is unmapped; ' +
            'derive a brand-contract.json (or set `--accent`) to enable this rail',
          outcome: 'warning',
        },
      ];
    }

    const counts = countInkings(tree, accent.token, accent.value);
    if (counts.total < MIN_TOTAL_TO_REPORT) return [];
    const ratio = counts.accent / counts.total;
    if (ratio <= budget) return [];

    const pct = (ratio * 100).toFixed(1);
    const budgetPct = (budget * 100).toFixed(0);
    return [
      {
        id: `accent-saturation-budget:over:${counts.accent}-of-${counts.total}`,
        description:
          `accent inkings ${counts.accent}/${counts.total} (${pct}%) exceed the ${budgetPct}% budget; ` +
          `the accent earns emphasis by being rare — too many uses flatten the hierarchy (SECTION_INTELLIGENCE §2.6, §4.7)`,
        outcome: 'escalated',
      },
    ];
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

interface Counts {
  accent: number;
  total: number;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

function isAccentValue(value: string, accentToken: string, accentValue: string | undefined): boolean {
  const lowered = value.toLowerCase();
  if (lowered.includes(`var(${accentToken.toLowerCase()})`)) return true;
  if (accentValue && lowered.includes(accentValue.toLowerCase())) return true;
  return false;
}

function countInkings(tree: Root, accentToken: string, accentValue: string | undefined): Counts {
  let accent = 0;
  let total = 0;
  visitElements(tree, (el) => {
    // 1. <style> blocks
    if (el.tagName === 'style') {
      const css = styleText(el);
      if (css) {
        const root = parseCss(css);
        root.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) return; // custom-property definitions aren't inkings
          if (!FOREGROUND_PROPS.has(decl.prop.toLowerCase())) return;
          total += 1;
          if (isAccentValue(decl.value, accentToken, accentValue)) accent += 1;
        });
      }
      return;
    }
    // 2. inline style=""
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    rewriteInlineDecls(style, (prop, val) => {
      const p = prop.trim().toLowerCase();
      if (p.startsWith('--')) return undefined;
      if (!FOREGROUND_PROPS.has(p)) return undefined;
      total += 1;
      if (isAccentValue(val, accentToken, accentValue)) accent += 1;
      return undefined;
    });
  });
  return { accent, total };
}
