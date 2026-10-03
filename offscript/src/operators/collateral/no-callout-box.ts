import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { parseInlineDecls } from '../../css-rep.js';

function leftBorderPx(decls: Map<string, string>): number {
  const shorthand = decls.get('border-left');
  if (shorthand) {
    const m = shorthand.match(/(\d+(?:\.\d+)?)px/);
    if (m) return parseFloat(m[1]);
  }
  const w = decls.get('border-left-width');
  if (w) {
    const m = w.match(/(\d+(?:\.\d+)?)px/);
    if (m) return parseFloat(m[1]);
  }
  return 0;
}

export const noCalloutBox: Operator = {
  name: 'no-callout-box',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    let i = 0;
    visitElements(tree, (el) => {
      const s = el.properties?.style;
      if (typeof s !== 'string' || !s) return;
      const decls = parseInlineDecls(s);
      const bg = decls.get('background') ?? decls.get('background-color');
      const hasFill = !!bg && !/^(none|transparent|#0000|rgba\([^)]*,\s*0\s*\))$/i.test(bg);
      const hasLeftAccent = leftBorderPx(decls) >= 3;
      if (hasFill && hasLeftAccent) {
        findings.push({
          id: `no-callout-box:${i++}`,
          description: `callout/highlight box (tinted fill + thick coloured left-border) — not a Example Brand motif. Use a plain lead paragraph, a tonal band, or a hairline divider.`,
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
