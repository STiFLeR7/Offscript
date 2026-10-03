import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss } from '../css-rep.js';

/**
 * Tier-1 website rail: website-style-scope (audit §9-B3).
 *
 * Per-section <style> blocks must (1) id-scope any selector touching a house `.cr-*`
 * class — a bare `.cr-*` rule leaks page-wide and re-styles the house ramp — and
 * (2) never set raw `font-size`/`font-weight` on a type-ramp class (the off-ramp
 * invented-size slop). Grounds in the author contract (authoring-seam.ts §324-328:
 * "never re-style a heading … the house already defines") + visual-language.md §4
 * ("build emphasis only from the existing ramp; add no new size, weight…").
 *
 * Both are `escalated`: a real, frozen-bespoke-worthy defect, not advisory. Tier-1 —
 * anchored on the CSS-rule CATEGORY (house-class selector), not one fragile element.
 *
 * Website-only: registered in defaultRegistry(), never collateralRegistry().
 */

// Any house class. Selector tokens referencing one must be id-scoped.
const HOUSE_CLASS_RE = /\.cr-[a-z0-9-]+/i;
// The type ramp — raw font-size/font-weight on these is forbidden (bespoke classes are fine).
const RAMP_CLASS_RE = /\.cr-(?:h-[a-z]+|num-display|eyebrow|p|p-[a-z]+|caption|quote)(?![a-z0-9-])/i;
const RAW_TYPE_PROPS = new Set(['font-size', 'font-weight']);

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

/** A single comma-separated sub-selector is "scoped" iff it contains an #id token. */
function isIdScoped(subSelector: string): boolean {
  return /#[\w-]/.test(subSelector);
}

export const websiteStyleScope: Operator = {
  name: 'website-style-scope',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    let n = 0;
    // Inspect ONLY per-section <style> blocks (descendants of a <section>). The
    // document/head house sheet legitimately DEFINES the global .cr-* ramp
    // (.cr-h-hero { font-size; font-weight }, etc.) — it must NOT be flagged.
    const sections: Element[] = [];
    visitElements(tree, (el) => { if (el.tagName === 'section') sections.push(el); });
    const seen = new Set<Element>();
    const styles: Element[] = [];
    for (const s of sections) {
      visitElements({ type: 'root', children: [s] } as Root, (el) => {
        if (el.tagName === 'style' && !seen.has(el)) { seen.add(el); styles.push(el); }
      });
    }
    for (const styleEl of styles) {
      const css = styleText(styleEl);
      if (!css) continue;
      const root = parseCss(css);
      root.walkRules((rule) => {
        // Keyframe step rules (0%, 100%, from, to) match neither HOUSE_CLASS_RE nor
        // RAMP_CLASS_RE, so both checks below naturally no-op on them.
        for (const sub of rule.selector.split(',').map((s) => s.trim())) {
          if (!sub) continue;
          // (a) unscoped house-class selector
          if (HOUSE_CLASS_RE.test(sub) && !isIdScoped(sub)) {
            findings.push({
              id: `website-style-scope:unscoped:${n}:${sub.slice(0, 60)}`,
              description: `selector "${sub}" targets a house .cr-* class without a #section-id prefix — it leaks page-wide and re-styles the house ramp. Scope it to this section's id.`,
              outcome: 'escalated',
            });
            n += 1;
          }
          // (b) raw type on the ramp
          if (RAMP_CLASS_RE.test(sub)) {
            rule.walkDecls((d) => {
              if (RAW_TYPE_PROPS.has(d.prop.toLowerCase())) {
                findings.push({
                  id: `website-style-scope:raw-type:${n}:${d.prop}`,
                  description: `"${d.prop}: ${d.value}" set on ramp selector "${sub}" — build emphasis only from the existing ramp (visual-language §4); never override the ramp's size/weight. Use a house ramp class instead.`,
                  outcome: 'escalated',
                });
                n += 1;
              }
            });
          }
        }
      });
    }
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
