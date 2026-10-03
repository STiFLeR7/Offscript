import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { parseInlineDecls } from '../../css-rep.js';

const DARK = new Set(['var(--cr-ink)', 'var(--cr-charcoal)', '#020b1b', '#292929']);

function classOf(el: Element): string {
  const c = el.properties?.className;
  return typeof c === 'string' ? c : Array.isArray(c) ? (c as string[]).join(' ') : '';
}

export const metricsInDark: Operator = {
  name: 'metrics-in-dark',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    visitElements(tree, (el) => {
      if (!/\bcr-stat-value\b/.test(classOf(el))) return;
      const s = el.properties?.style;
      if (typeof s !== 'string' || !s) return;
      const decls = parseInlineDecls(s);
      const color = decls.get('color');
      if (color && !DARK.has(color.toLowerCase())) {
        findings.push({
          id: `metrics-in-dark:${color}`,
          description: `stat numeral coloured ${color} — metrics must use dark primary text (#020B1B/#292929); accents/tones never touch a number.`,
          outcome: 'warning',
        });
      }
    });
    return findings;
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
