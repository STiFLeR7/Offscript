import type { Root, Element } from 'hast';
import type { Rule } from 'postcss';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

const TOKEN_BLOCK_MARKER = 'offscript-tokens';
/** Hex colour literals: #rgb, #rgba, #rrggbb, #rrggbbaa (longest alternatives first). */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

/**
 * Decorative-artwork markers. A colour rule scoped under one of these — a `.cr-decor`
 * class or a `[data-decor]` element — is exempt from the off-token scan: a multi-stop
 * decorative gradient is governed as artwork, not brand-surface colour. Mirrors the
 * GRAPHIC_EXEMPT_SELECTOR pattern (operators/deck/deck-format.ts) used by the text-floor
 * rails. See docs/internals/OFFSCRIPT-V2-C1-DECOR-COLOR-EXEMPTION.md.
 */
const DECOR_EXEMPT = ['.cr-decor', '[data-decor]'];

/** A `<style>`-rule selector is exempt when it carries a decorative marker. */
function isDecorSelector(selector: string): boolean {
  return DECOR_EXEMPT.some((marker) => selector.includes(marker));
}

/** An element is exempt (for its inline `style=""`) when it carries a decorative marker. */
function isDecorElement(el: Element): boolean {
  const props = el.properties ?? {};
  if ('dataDecor' in props) return true;
  const cn = props.className;
  if (Array.isArray(cn)) return cn.includes('cr-decor');
  if (typeof cn === 'string') return cn.split(/\s+/).includes('cr-decor');
  return false;
}

function isTokenBlock(el: Element): boolean {
  return el.tagName === 'style' && el.properties?.dataOffscript === TOKEN_BLOCK_MARKER;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

/** Add every hex colour in `value` that is not traceable to a brand token to `out`. */
function collectOffToken(value: string, valueToVar: Map<string, string>, out: Set<string>): void {
  const matches = value.match(HEX);
  if (!matches) return;
  for (const m of matches) {
    const norm = m.toLowerCase();
    if (!valueToVar.has(norm)) out.add(norm);
  }
}

/** Walk every consumption site (style blocks + inline styles) and gather off-token colours. */
function scanTree(tree: Root, valueToVar: Map<string, string>): string[] {
  const off = new Set<string>();
  visitElements(tree, (el) => {
    // 1. <style> blocks — skip the canonical token block (its literals are the tokens)
    if (el.tagName === 'style' && !isTokenBlock(el)) {
      const css = styleText(el);
      if (css) {
        const root = parseCss(css);
        root.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) return; // custom-property definitions are not consumption sites
          const parent = decl.parent;
          // Decorative-artwork rules (scoped under .cr-decor / [data-decor]) are exempt.
          if (parent && parent.type === 'rule' && isDecorSelector((parent as Rule).selector)) return;
          collectOffToken(decl.value, valueToVar, off);
        });
      }
    }
    // 2. inline style="" attributes (skip elements explicitly marked decorative)
    const style = el.properties?.style;
    if (typeof style === 'string' && style !== '' && !isDecorElement(el)) {
      rewriteInlineDecls(style, (prop, val) => {
        if (prop.trim().startsWith('--')) return undefined;
        collectOffToken(val, valueToVar, off);
        return undefined; // Never rewrite, just scan
      });
    }
  });
  return [...off].sort();
}

/** Tier-0 warn-only QA oracle: report colours not traceable to tokens.json (spec §5.5, §8.4 #2). Never mutates. */
export const brandFidelityScan: Operator = {
  name: 'brand-fidelity-scan',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    const tokens = ctx.tokens;
    if (!tokens) return [];
    return scanTree(tree, tokens.valueToVar).map((value) => ({
      id: `brand-fidelity-scan:${value}`,
      description: `off-token color ${value} is not traceable to a brand token`,
      outcome: 'warning',
    }));
  },

  // Warn-only: applying is a pure re-scan with no mutation. apply ∘ apply = apply trivially.
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
