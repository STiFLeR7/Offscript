import type { Root, Element, Text } from 'hast';
import { visitElements } from '../working-rep.js';
import { parseCss, serializeCss, rewriteInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { TokenModel } from '../tokens.js';

/** A brand radius token: its var name and its px magnitude. */
interface RadiusToken {
  varName: string;
  px: number;
}

const PX = /^(\d+(?:\.\d+)?)px$/;

/**
 * Derive the brand radius vocabulary generically from the token model: any custom
 * property whose name mentions "radius" and whose value is a single px length.
 * (Don't hardcode the six --cr-radius-* names.)
 */
function radiusTokens(tokens?: TokenModel): RadiusToken[] {
  if (!tokens) return [];
  const out: RadiusToken[] = [];
  for (const [varName, value] of tokens.customProps) {
    if (!/radius/i.test(varName)) continue;
    const m = PX.exec(value.trim());
    if (m) out.push({ varName, px: parseFloat(m[1]) });
  }
  return out;
}

/**
 * Snap an off-vocab px magnitude to the nearest brand radius token by absolute
 * distance; ties resolve to the smaller radius.
 */
function nearest(px: number, vocab: RadiusToken[]): RadiusToken {
  return vocab.reduce((best, t) => {
    const dBest = Math.abs(px - best.px);
    const dT = Math.abs(px - t.px);
    if (dT < dBest) return t;
    if (dT === dBest && t.px < best.px) return t; // tie -> smaller radius
    return best;
  });
}

/**
 * Classify a border-radius value. Returns the snap target var name iff the value
 * is a single px length that is NOT already a brand token value, NOT 0/0px, and
 * NOT a percentage; otherwise undefined (left untouched).
 */
function snapTarget(value: string, vocab: RadiusToken[]): string | undefined {
  const v = value.trim();
  const m = PX.exec(v);
  if (!m) return undefined; // 0, 0px, 50%, multi-value shorthands, var(), etc.
  const px = parseFloat(m[1]);
  if (px === 0) return undefined;
  if (vocab.some((t) => t.px === px)) return undefined; // in-vocab literal: token-normalize's job
  return `var(${nearest(px, vocab).varName})`;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

function setStyleText(el: Element, css: string): void {
  el.children = [{ type: 'text', value: css } as Text];
}

/**
 * Shared detect (mutate=false) / apply (mutate=true) pass. Walks border-radius
 * declarations in embedded <style> CSS and inline style="" attributes, records each
 * distinct off-vocab value once, and (when applying) rewrites it to the nearest
 * brand radius var().
 */
function run(tree: Root, ctx: OperatorContext, mutate: boolean): Finding[] {
  const vocab = radiusTokens(ctx.tokens);
  if (vocab.length === 0) return []; // no bounds to snap to

  const offVocab = new Set<string>();

  // 1. embedded <style> blocks
  visitElements(tree, (el) => {
    if (el.tagName !== 'style') return;
    const css = styleText(el);
    if (!css) return;
    const root = parseCss(css);
    let changed = false;
    root.walkDecls((decl) => {
      if (decl.prop.toLowerCase() !== 'border-radius') return;
      const target = snapTarget(decl.value, vocab);
      if (!target) return;
      offVocab.add(decl.value.trim());
      if (mutate) {
        decl.value = target;
        changed = true;
      }
    });
    if (mutate && changed) setStyleText(el, serializeCss(root));
  });

  // 2. inline style="" attributes
  visitElements(tree, (el) => {
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    const result = rewriteInlineDecls(style, (prop, val) => {
      if (prop.trim().toLowerCase() !== 'border-radius') return undefined;
      const target = snapTarget(val, vocab);
      if (!target) return undefined;
      offVocab.add(val.trim());
      return target;
    });
    if (mutate && result.changed && el.properties) {
      el.properties.style = result.style;
    }
  });

  return [...offVocab].sort().map((value) => ({
    id: `radius-vocabulary:${value}`,
    description: `off-vocabulary border-radius ${value}; snap to nearest brand radius token`,
    outcome: 'auto-remediated' as const,
  }));
}

/**
 * Tier-0 global transform: snap off-vocabulary border-radius px values to the nearest
 * brand radius custom property. Idempotent (post-apply, every off-vocab value is a
 * var() the rail no longer touches). In-vocab literals, 0, and percentages are left
 * untouched (in-vocab literal->var is token-normalize's job).
 */
export const radiusVocabulary: Operator = {
  name: 'radius-vocabulary',
  tier: 0,
  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, false);
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, true);
  },
};
