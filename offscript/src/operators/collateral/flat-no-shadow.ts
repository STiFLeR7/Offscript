import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../../css-rep.js';

function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

function hasShadow(prop: string, val: string): boolean {
  return prop.trim().toLowerCase() === 'box-shadow'
    && val.trim().toLowerCase() !== 'none'
    && val.trim() !== '';
}

export const flatNoShadow: Operator = {
  name: 'flat-no-shadow',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    let n = 0;
    visitElements(tree, (el) => {
      if (el.tagName === 'style') {
        const css = styleText(el);
        if (css) parseCss(css).walkDecls((d) => { if (hasShadow(d.prop, d.value)) n += 1; });
      }
      const s = el.properties?.style;
      if (typeof s === 'string' && s) {
        rewriteInlineDecls(s, (p, v) => { if (hasShadow(p, v)) n += 1; return undefined; });
      }
    });
    return n === 0 ? [] : [{
      id: `flat-no-shadow:${n}`,
      description: `${n} box-shadow declaration(s) — the system is flat; separate with a 1px hairline or tonal fill, never elevation.`,
      outcome: 'warning' as const,
    }];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
