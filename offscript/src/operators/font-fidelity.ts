import type { Root, Element, Text } from 'hast';
import { visitElements } from '../working-rep.js';
import { parseCss, serializeCss, rewriteInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { TokenModel } from '../tokens.js';

/** Generic font-family keywords that name no brand face and are never flagged. */
const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'emoji',
  'math',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
]);

/** Strip surrounding quotes and trim a single font-family name token. */
function cleanFace(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').trim();
}

/** Split a font-family value into its comma-separated family names (quotes stripped). */
function splitFamilies(value: string): string[] {
  return value
    .split(',')
    .map(cleanFace)
    .filter((f) => f.length > 0);
}

interface FontTokens {
  /** lowercased face name -> var name (the token to rewrite a literal of that face to) */
  faceToVar: Map<string, string>;
  /** lowercased set of every face named in any --cr-font-* token (brand faces) */
  brandFaces: Set<string>;
}

/**
 * Derive the brand-face vocabulary generically from the token model: every custom
 * property whose name matches --*font* and whose value names font families. The first
 * (primary) family of each font token maps that face to that var; every named family is
 * a recognised brand face. Don't hardcode "Manrope"/"Inter".
 */
function fontTokens(tokens?: TokenModel): FontTokens {
  const faceToVar = new Map<string, string>();
  const brandFaces = new Set<string>();
  if (!tokens) return { faceToVar, brandFaces };
  for (const [varName, value] of tokens.customProps) {
    if (!/font/i.test(varName)) continue;
    const families = splitFamilies(value);
    families.forEach((f, i) => {
      const key = f.toLowerCase();
      if (GENERIC.has(key)) return;
      brandFaces.add(key);
      // primary family of a token claims the mapping (first writer wins)
      if (i === 0 && !faceToVar.has(key)) faceToVar.set(key, varName);
    });
  }
  // any brand face never seen as a primary maps to the first token that names it.
  // (e.g. Inter is primary in --cr-font-body, secondary in --cr-font-display -> maps to body.)
  for (const [varName, value] of tokens.customProps) {
    if (!/font/i.test(varName)) continue;
    for (const f of splitFamilies(value)) {
      const key = f.toLowerCase();
      if (GENERIC.has(key) || faceToVar.has(key)) continue;
      faceToVar.set(key, varName);
    }
  }
  return { faceToVar, brandFaces };
}

/**
 * Classify a single font-family declaration value. A value is "tokenized" if it already
 * references a var(). Otherwise its primary family decides: a brand face (in any
 * --cr-font-* token) is a literal-drift FIX target; a non-generic, non-brand family is an
 * off-brand WARNING; a bare generic keyword is neither.
 */
type FontClass =
  | { kind: 'tokenized' }
  | { kind: 'generic' }
  | { kind: 'literal'; face: string; varName: string }
  | { kind: 'offbrand'; family: string };

function classify(value: string, ft: FontTokens): FontClass {
  if (/var\(\s*--/.test(value)) return { kind: 'tokenized' };
  const families = splitFamilies(value);
  if (families.length === 0) return { kind: 'generic' };
  const primary = families[0];
  const key = primary.toLowerCase();
  if (GENERIC.has(key)) return { kind: 'generic' };
  const varName = ft.faceToVar.get(key);
  if (varName && ft.brandFaces.has(key)) return { kind: 'literal', face: primary, varName };
  return { kind: 'offbrand', family: primary };
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

function setStyleText(el: Element, css: string): void {
  el.children = [{ type: 'text', value: css } as Text];
}

/**
 * True if an @import pulls from a non-local URL. CSS allows both the url(...) form and a
 * bare quoted string (`@import "https://...";`) — Google Fonts documents the latter — so we
 * test the params for a remote `(https?:)?//` whether or not it is wrapped in url(). Relative
 * (`./`) and `data:` URLs are local and kept untouched.
 */
function isNonLocalImport(name: string, params: string): boolean {
  if (name.toLowerCase() !== 'import') return false;
  return /(?:url\(\s*)?["']?\s*(https?:)?\/\//i.test(params) || /fonts\.googleapis\./i.test(params);
}

function fontFaceIsNonLocal(srcBlock: string): boolean {
  return /url\(\s*["']?\s*(https?:)?\/\//i.test(srcBlock);
}

/**
 * Shared detect (mutate=false) / apply (mutate=true) pass. Walks font-family declarations
 * (inline style="" + embedded <style>) and @import/@font-face atRules. Literal brand-face
 * font-family values are rewritten to the matching var() (a); non-local font @import /
 * remote @font-face rules are removed (b); off-brand families are warn-only (c).
 */
function run(tree: Root, ctx: OperatorContext, mutate: boolean): Finding[] {
  const ft = fontTokens(ctx.tokens);
  if (ft.faceToVar.size === 0 && ft.brandFaces.size === 0) return [];

  const literals = new Set<string>(); // brand face names -> auto-remediated
  const offbrand = new Set<string>(); // family names -> warning
  let sawNonLocal = false;

  // 1. embedded <style> blocks
  visitElements(tree, (el) => {
    if (el.tagName !== 'style') return;
    const css = styleText(el);
    if (!css) return;
    const root = parseCss(css);
    let changed = false;

    // @import / @font-face removal
    root.walkAtRules((at) => {
      const name = at.name.toLowerCase();
      let nonLocal = false;
      if (name === 'import') {
        nonLocal = isNonLocalImport(name, at.params);
      } else if (name === 'font-face') {
        let src = '';
        at.walkDecls((d) => {
          if (d.prop.toLowerCase() === 'src') src += ` ${d.value}`;
        });
        nonLocal = fontFaceIsNonLocal(src);
      }
      if (nonLocal) {
        sawNonLocal = true;
        if (mutate) {
          at.remove();
          changed = true;
        }
      }
    });

    // font-family literal rewrites
    root.walkDecls((decl) => {
      if (decl.prop.toLowerCase() !== 'font-family') return;
      const c = classify(decl.value, ft);
      if (c.kind === 'literal') {
        literals.add(c.face);
        if (mutate) {
          decl.value = `var(${c.varName})`;
          changed = true;
        }
      } else if (c.kind === 'offbrand') {
        offbrand.add(c.family);
      }
    });

    if (mutate && changed) setStyleText(el, serializeCss(root));
  });

  // 2. inline style="" attributes
  visitElements(tree, (el) => {
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    const result = rewriteInlineDecls(style, (prop, val) => {
      if (prop.trim().toLowerCase() !== 'font-family') return undefined;
      const c = classify(val, ft);
      if (c.kind === 'literal') {
        literals.add(c.face);
        return `var(${c.varName})`;
      }
      if (c.kind === 'offbrand') offbrand.add(c.family);
      return undefined;
    });
    if (mutate && result.changed && el.properties) {
      el.properties.style = result.style;
    }
  });

  const findings: Finding[] = [];
  for (const face of [...literals].sort()) {
    findings.push({
      id: `font-fidelity:literal:${face}`,
      description: `literal brand-face font-family "${face}"; rewrite to the matching --cr-font-* token`,
      outcome: 'auto-remediated',
    });
  }
  if (sawNonLocal) {
    findings.push({
      id: 'font-fidelity:nonlocal-import',
      description: 'non-local font @import / remote @font-face (violates local-fonts-only); removed',
      outcome: 'auto-remediated',
    });
  }
  for (const family of [...offbrand].sort()) {
    findings.push({
      id: `font-fidelity:offbrand:${family}`,
      description: `off-brand font-family "${family}" (not in any --cr-font-* token); warn-only, not mutated`,
      outcome: 'warning',
    });
  }
  return findings;
}

/**
 * Tier-0 global transform: enforce the brand's local-fonts-only / ≤2-families rule.
 * Tokenizes literal brand-face font-family declarations to var(--cr-font-*), removes
 * non-local font @import / remote @font-face rules, and warns (never mutates) on
 * off-brand families. Idempotent for the auto-remediated parts.
 */
export const fontFidelity: Operator = {
  name: 'font-fidelity',
  tier: 0,
  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, false);
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, true);
  },
};
