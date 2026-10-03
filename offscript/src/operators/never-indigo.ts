import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';

/**
 * Tier-0 website rail: never-indigo (Example Brand website charter — "#150580
 * (`--cr-wordmark-indigo`) is the colour wordmark ONLY — never a UI surface,
 * accent, headline, or icon").
 *
 * `brand-fidelity-scan` cannot catch this: `--cr-wordmark-indigo` IS a valid
 * brand token, so indigo passes the off-token scan — it is a valid-token /
 * wrong-place violation, which only a dedicated rail sees.
 *
 * MECHANICAL BOUND (so the rail does not misfire on the one legitimate use):
 * the wordmark is coloured TEXT, so `color: var(--cr-wordmark-indigo)` is the
 * sanctioned use and is NOT flagged. The forbidden uses are unambiguous and
 * property-based — indigo as a SURFACE / ACCENT / ICON: `background*`,
 * `border*`-color, `fill`, `stroke`, `outline*`, `box-shadow`. Indigo as text
 * `color` on a non-wordmark headline is a real violation too, but distinguishing
 * a wordmark from a headline is a judgment call, so that case stays contract
 * guidance — the rail only owns the mechanical, zero-FP surface/accent/icon set.
 *
 * Warn-only (matches the other website charter rails). Never mutates.
 * Website-track only.
 */
const INDIGO = /var\(\s*--cr-wordmark-indigo\b|#150580\b/i;

/** Surface / accent / icon properties — indigo is forbidden on all of these. */
const SURFACE_ACCENT_ICON =
  /^(background|background-color|background-image|border|border-color|border-(top|right|bottom|left)(-color)?|fill|stroke|outline|outline-color|box-shadow)$/;

function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

function isIndigoMisuse(prop: string, val: string): boolean {
  const p = prop.trim().toLowerCase();
  if (!SURFACE_ACCENT_ICON.test(p)) return false;
  return INDIGO.test(val);
}

export const neverIndigo: Operator = {
  name: 'never-indigo',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    let n = 0;
    visitElements(tree, (el) => {
      if (el.tagName === 'style') {
        const css = styleText(el);
        if (css) parseCss(css).walkDecls((d) => { if (isIndigoMisuse(d.prop, d.value)) n += 1; });
      }
      const s = el.properties?.style;
      if (typeof s === 'string' && s) {
        rewriteInlineDecls(s, (p, v) => { if (isIndigoMisuse(p, v)) n += 1; return undefined; });
      }
      // SVG presentation attributes (fill="…" / stroke="…") carry colour too.
      for (const attr of ['fill', 'stroke'] as const) {
        const a = el.properties?.[attr];
        if (typeof a === 'string' && INDIGO.test(a)) n += 1;
      }
    });
    return n === 0 ? [] : [{
      id: `never-indigo:${n}`,
      description: `${n} indigo (--cr-wordmark-indigo / #150580) use(s) on a surface / accent / icon property — indigo is the colour WORDMARK only; use var(--cr-brand) for action, var(--cr-ink)/var(--cr-ink-night) for dark surfaces.`,
      outcome: 'warning' as const,
    }];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
