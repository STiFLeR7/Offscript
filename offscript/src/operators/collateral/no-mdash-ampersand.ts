import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';

/**
 * Collect visible copy, skipping <style>/<script> subtrees so CSS `&` nesting
 * or script source never reads as body text. Attribute values (e.g. href query
 * strings `?a=1&b=2`) are not text nodes, so they're already excluded.
 */
function visibleText(tree: Root): string {
  let out = '';
  const walk = (node: { type?: string; tagName?: string; value?: string; children?: unknown[] }): void => {
    if (node.type === 'text') { out += node.value ?? ''; return; }
    if (node.type === 'element' && (node.tagName === 'style' || node.tagName === 'script')) return;
    for (const c of (node.children ?? []) as typeof node[]) walk(c);
  };
  walk(tree as never);
  return out;
}

/**
 * Tier-0 brand-style rail: Example Brand copy uses no em-dashes and no ampersands.
 * Em-dashes (—, U+2014) get rephrased (period / comma / colon / parentheses);
 * ampersands (&) get spelled out as "and". The → arrow (U+2192) is unaffected.
 * Detect-only oracle, actuator-clearable `warning` (apply ∘ apply = apply).
 */
export const noMdashAmpersand: Operator = {
  name: 'no-mdash-ampersand', tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const t = visibleText(tree);
    const findings: Finding[] = [];
    const emDashes = (t.match(/—/g) ?? []).length;
    if (emDashes > 0) {
      findings.push({
        id: `no-mdash:${emDashes}`,
        description: `${emDashes} em-dash(es) (—) in copy — Example Brand style uses no em-dashes; rephrase with a period, comma, colon, or parentheses.`,
        outcome: 'warning',
      });
    }
    const ampersands = (t.match(/&/g) ?? []).length;
    if (ampersands > 0) {
      findings.push({
        id: `no-ampersand:${ampersands}`,
        description: `${ampersands} ampersand(s) (&) in copy — spell out "and"; the ampersand is not a Example Brand text style.`,
        outcome: 'warning',
      });
    }
    return findings;
  },
  apply(tree, ctx) { return this.detect(tree, ctx); },
};
