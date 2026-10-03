import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import { visitElements } from '../../working-rep.js';

/**
 * no-script — collateral hard rule #6: HTML+CSS only, a one-pager has ZERO JS.
 *
 * Detects any executable surface in a collateral artifact:
 *   - a <script> element,
 *   - an inline event-handler attribute (onclick / onload / on*),
 *   - a `javascript:` URL in href/src.
 * Static print collateral never carries any of these, so each is a finding.
 * tier-0 (global, no anchor): the rule is document-wide.
 */
function propKeys(el: Element): string[] {
  return el.properties ? Object.keys(el.properties) : [];
}

function urlProps(el: Element): string[] {
  const out: string[] = [];
  for (const k of ['href', 'src', 'action', 'formAction']) {
    const v = el.properties?.[k];
    if (typeof v === 'string') out.push(v);
  }
  return out;
}

export const noScript: Operator = {
  name: 'no-script',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    visitElements(tree, (el) => {
      if (el.tagName === 'script') {
        findings.push({
          id: 'no-script:element',
          description: '<script> element found — collateral is HTML+CSS only (hard rule #6); a one-pager carries zero JS.',
          outcome: 'warning',
        });
        return;
      }
      // hast lowercases attribute names; inline handlers surface as on* property keys.
      const handler = propKeys(el).find((k) => /^on[a-z]/i.test(k));
      if (handler) {
        findings.push({
          id: `no-script:handler:${handler.toLowerCase()}`,
          description: `inline event handler "${handler}" on <${el.tagName}> — collateral carries no JS (hard rule #6).`,
          outcome: 'warning',
        });
      }
      if (urlProps(el).some((u) => /^\s*javascript:/i.test(u))) {
        findings.push({
          id: 'no-script:javascript-url',
          description: `javascript: URL on <${el.tagName}> — collateral carries no JS (hard rule #6).`,
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
