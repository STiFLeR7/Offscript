import type { Root } from 'hast';
import { findElement } from '../working-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/** Tier-0 global transform: ensure <html> has a non-empty lang attribute. Always auto-fixes. */
export const langAttr: Operator = {
  name: 'lang-attr',
  tier: 0,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const html = findElement(tree, 'html');
    if (!html) return [];
    const lang = html.properties?.lang;
    if (typeof lang === 'string' && lang.trim() !== '') return [];
    return [
      {
        id: 'lang-attr:html',
        description: '<html> is missing a lang attribute',
        outcome: 'auto-remediated',
      },
    ];
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    const findings = this.detect(tree, ctx);
    if (findings.length === 0) return [];
    const html = findElement(tree, 'html');
    if (html) {
      html.properties = html.properties ?? {};
      const lang = typeof ctx.params.lang === 'string' ? ctx.params.lang : 'en';
      html.properties.lang = lang;
    }
    return findings;
  },
};
