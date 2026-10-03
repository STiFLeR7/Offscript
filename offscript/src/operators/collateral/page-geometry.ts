import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';
import { parseInlineDecls } from '../../css-rep.js';

function classOf(el: Element): string {
  const c = el.properties?.className;
  return typeof c === 'string' ? c : Array.isArray(c) ? (c as string[]).join(' ') : '';
}

export const squarePageCorners: Operator = {
  name: 'square-page-corners',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    visitElements(tree, (el) => {
      if (!/\bcr-page\b/.test(classOf(el))) return;
      const s = el.properties?.style;
      if (typeof s !== 'string' || !s) return;
      const decls = parseInlineDecls(s);
      const radius = decls.get('border-radius');
      if (radius && !/^0(px|%)?$/.test(radius)) {
        findings.push({
          id: `square-page-corners:${radius}`,
          description: `.cr-page has border-radius ${radius} — brochure pages are paper: square (0) corners.`,
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

export const columnCount: Operator = {
  name: 'column-count',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    visitElements(tree, (el) => {
      const m = classOf(el).match(/\bcr-cols-(\d+)\b/);
      if (m && parseInt(m[1], 10) > 3) {
        findings.push({
          id: `column-count:cr-cols-${m[1]}`,
          description: `${m[1]} columns — Swiss layout allows max 3 (prefer 1–2); never 4.`,
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
