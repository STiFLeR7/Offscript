import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../../css-rep.js';
import { parseHex, type Rgb } from '../../color.js';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const RETIRED = new Set(['#150580', '#a514ff']); // violet, orchid

function isOrangeOrCream(c: Rgb): boolean {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return false;
  const d = mx - mn;
  let h = 0;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = (mx + mn) / 2;
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const orange = h >= 20 && h <= 45 && sat > 0.4;
  const cream = h >= 30 && h <= 60 && sat > 0.1 && sat <= 0.4 && l > 0.85;
  return orange || cream;
}

function offSystem(hex: string): boolean {
  const norm = hex.toLowerCase();
  if (RETIRED.has(norm)) return true;
  const rgb = parseHex(hex);
  return rgb ? isOrangeOrCream(rgb) : false;
}

function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

function scan(tree: Root): string[] {
  const out = new Set<string>();
  const collect = (v: string) => {
    HEX.lastIndex = 0;
    const m = v.match(HEX);
    if (m) for (const h of m) if (offSystem(h)) out.add(h.toLowerCase());
  };
  visitElements(tree, (el) => {
    if (el.tagName === 'style') {
      const css = styleText(el);
      if (css) parseCss(css).walkDecls((d) => { if (!d.prop.startsWith('--')) collect(d.value); });
    }
    const s = el.properties?.style;
    if (typeof s === 'string' && s) {
      rewriteInlineDecls(s, (p, val) => { if (!p.trim().startsWith('--')) collect(val); return undefined; });
    }
  });
  return [...out].sort();
}

export const retiredToken: Operator = {
  name: 'retired-token',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    return scan(tree).map((c) => ({
      id: `retired-token:${c}`,
      description: `off-system colour ${c} used — retired from the Example Brand palette (legacy violet/orchid, ember/orange, or cream/sand). Use a current token.`,
      outcome: 'warning' as const,
    }));
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
