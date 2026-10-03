import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';

/**
 * Tier-0 website rail: no-elevation (Example Brand website charter — RESTRAINED
 * depth: separation is border-first, but the v2 re-theme sanctions ONE soft
 * shadow + glass, used sparingly).
 *
 * The website system stays flat by default: separation comes from a 1px
 * hairline (`var(--cr-line)` / `var(--cr-line-dark)`), spacing, contrast,
 * scale, and surface shifts. The v2 re-theme adds two *sanctioned* depth
 * tools — the soft shadow tokens (`var(--cr-shadow-sm)` / `var(--cr-shadow-lg)`)
 * and glass (`var(--cr-glass-*)`, e.g. `backdrop-filter: blur(var(--cr-glass-blur))`).
 * So this rail flags only *ad-hoc / off-system* elevation: a `box-shadow`,
 * `backdrop-filter`, or `filter: blur()|drop-shadow()` whose value does NOT
 * resolve to a sanctioned `--cr-shadow-*` / `--cr-glass-*` token. A literal
 * `box-shadow: 0 4px 12px rgba(…)` or `backdrop-filter: blur(8px)` still warns;
 * `box-shadow: var(--cr-shadow-lg)` passes. A bare `filter: grayscale()` /
 * `brightness()` is NOT elevation and is left alone (low false-positive), so a
 * de-saturated logo bar still passes.
 *
 * Warn-only (matches collateral `flat-no-shadow`): the fix — use a sanctioned
 * token or a hairline / surface — is a composition decision, not a mechanical
 * rewrite. Never mutates. Website-track only (registered in defaultRegistry,
 * not collateralRegistry — the collateral `flat-no-shadow` rail stays strict).
 */
function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

/** Does the value resolve to a sanctioned depth token (--cr-shadow-* / --cr-glass-*)? */
function isSanctionedDepth(val: string): boolean {
  const v = val.toLowerCase();
  return /var\(\s*--cr-shadow-/.test(v) || /var\(\s*--cr-glass-/.test(v);
}

/** Does this declaration introduce AD-HOC elevation / glow / blur / frosted glass?
 *  Sanctioned `--cr-shadow-*` / `--cr-glass-*` token references are allowed. */
function isElevation(prop: string, val: string): boolean {
  const p = prop.trim().toLowerCase();
  const v = val.trim().toLowerCase();
  if (v === '' || v === 'none') return false;
  if (isSanctionedDepth(v)) return false;
  if (p === 'box-shadow' || p === '-webkit-box-shadow') return true;
  if (p === 'backdrop-filter' || p === '-webkit-backdrop-filter') return true;
  // `filter` is only elevation when it blurs or casts a shadow — grayscale /
  // brightness / contrast on imagery are fine.
  if (p === 'filter' || p === '-webkit-filter') return /\bblur\(|\bdrop-shadow\(/.test(v);
  return false;
}

export const noElevation: Operator = {
  name: 'no-elevation',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    let n = 0;
    visitElements(tree, (el) => {
      if (el.tagName === 'style') {
        const css = styleText(el);
        if (css) parseCss(css).walkDecls((d) => { if (isElevation(d.prop, d.value)) n += 1; });
      }
      const s = el.properties?.style;
      if (typeof s === 'string' && s) {
        rewriteInlineDecls(s, (p, v) => { if (isElevation(p, v)) n += 1; return undefined; });
      }
    });
    return n === 0 ? [] : [{
      id: `no-elevation:${n}`,
      description: `${n} ad-hoc elevation declaration(s) (off-system box-shadow / backdrop-filter / filter:blur|drop-shadow) — use a sanctioned depth token (var(--cr-shadow-sm|lg) or glass var(--cr-glass-*)), a 1px hairline (var(--cr-line)), spacing, contrast, or a surface shift, never a raw shadow / glow value.`,
      outcome: 'warning' as const,
    }];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
