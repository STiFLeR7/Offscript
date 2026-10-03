import type { Root, Element, Text } from 'hast';
import { findElement, visitElements } from '../working-rep.js';
import { parseCss, serializeCss, replaceLiterals, rewriteInlineStyle } from '../css-rep.js';
import { renderTokenCss } from '../tokens.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

const TOKEN_BLOCK_MARKER = 'offscript-tokens';

function isTokenBlock(el: Element): boolean {
  return el.tagName === 'style' && el.properties?.dataOffscript === TOKEN_BLOCK_MARKER;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

function setStyleText(el: Element, css: string): void {
  el.children = [{ type: 'text', value: css } as Text];
}

function findTokenBlock(tree: Root): Element | undefined {
  let found: Element | undefined;
  visitElements(tree, (el) => {
    if (!found && isTokenBlock(el)) found = el;
  });
  return found;
}

function embedTokenCss(tree: Root, css: string): void {
  let block = findTokenBlock(tree);
  if (!block) {
    block = {
      type: 'element',
      tagName: 'style',
      properties: { dataOffscript: TOKEN_BLOCK_MARKER },
      children: [],
    };
    const head = findElement(tree, 'head');
    const parent = head ?? findElement(tree, 'html');
    if (parent) parent.children.unshift(block);
    else tree.children.unshift(block);
  }
  setStyleText(block, css);
}

/**
 * The core pass, shared by detect (mutate=false) and apply (mutate=true).
 * §8.1 single shape: a detector that, when applying, auto-remediates uniformly.
 */
function run(tree: Root, ctx: OperatorContext, mutate: boolean): Finding[] {
  const tokens = ctx.tokens;
  if (!tokens || tokens.valueToVar.size === 0) return [];
  const findings: Finding[] = [];
  let literalCount = 0;

  // 1. <style> blocks — skip the canonical token block (its --custom props stay literal)
  visitElements(tree, (el) => {
    if (el.tagName !== 'style' || isTokenBlock(el)) return;
    const css = styleText(el);
    if (!css) return;
    const root = parseCss(css);
    let changed = 0;
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) return; // never rewrite custom-property definitions
      const r = replaceLiterals(decl.value, tokens.valueToVar);
      if (r.changed > 0) {
        changed += r.changed;
        if (mutate) decl.value = r.value;
      }
    });
    if (changed > 0) {
      literalCount += changed;
      if (mutate) setStyleText(el, serializeCss(root));
    }
  });

  // 2. inline style="" attributes
  visitElements(tree, (el) => {
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    const r = rewriteInlineStyle(style, tokens.valueToVar);
    if (r.changed > 0) {
      literalCount += r.changed;
      if (mutate && el.properties) el.properties.style = r.style;
    }
  });

  if (literalCount > 0) {
    findings.push({
      id: 'token-normalize:literals',
      description: `${literalCount} literal value(s) match a brand token and should use var(--token)`,
      outcome: 'auto-remediated',
    });
  }

  // 3. ensure canonical token CSS is embedded (single-file guarantee, §5.5)
  const wanted = renderTokenCss(tokens);
  const block = findTokenBlock(tree);
  const embedOk = block !== undefined && styleText(block) === wanted;
  if (!embedOk) {
    findings.push({
      id: 'token-normalize:embed',
      description: 'canonical brand-token CSS is not embedded in the document head',
      outcome: 'auto-remediated',
    });
    if (mutate) embedTokenCss(tree, wanted);
  }

  return findings;
}

/** Tier-0 global transform: literals -> var(--token) + embed canonical token CSS (spec §8.1, guardrail #1). */
export const tokenNormalize: Operator = {
  name: 'token-normalize',
  tier: 0,
  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, false);
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, true);
  },
};
