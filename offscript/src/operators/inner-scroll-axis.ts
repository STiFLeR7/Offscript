import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';

/**
 * Tier-1 detector: inner-scroll-axis.
 *
 * From the rail slate (Group A) / SECTION_INTELLIGENCE §5.4. Two patterns
 * the playbook rules out by default — both create a scroll-inside-a-scroll
 * that violates spatial wayfinding:
 *
 *  1. A nested **vertical** `overflow:auto` / `overflow:scroll` (anywhere
 *     other than html/body). The page scroll is the wayfinding axis — a
 *     second vertical scroll inside it is a "carousel coffin" by analogy:
 *     content is reachable, but the user can't tell where they are.
 *
 *  2. A **horizontal** `overflow:auto` / `overflow:scroll` on a container
 *     NOT explicitly marked as a deliberate horizontal scroller. A
 *     "lateral" container — opted in via `class*=lateral`, `data-lateral`,
 *     or `class*=cr-lateral` (a brand-prefix carve-out) — is the marketing
 *     vocabulary for an intentional horizontal rail (logo wall, code
 *     snippets, comparison tables). Without that opt-in marker, a
 *     horizontal scroll is an accidental break in the wayfinding contract.
 *
 * Both fire as `escalated` (Tier-1 bespoke). The systematic core cannot
 * decide whether a nested scroll is intentional (it might be the design's
 * deliberate dual-axis exploration UI) or whether a horizontal scroll
 * should be promoted to a lateral container (the fix may be tagging, not
 * removing). Hand-decision in the frozen bespoke region per the
 * foundational rule.
 *
 * Detection looks at inline-style declarations only (consistent with
 * sticky-stack and the rest of the post-flatten layer).
 */
export const innerScrollAxis: Operator = {
  name: 'inner-scroll-axis',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    let n = 0;
    visitElements(tree, (el) => {
      // html and body host the page scroll — exempt by definition.
      if (el.tagName === 'html' || el.tagName === 'body') return;

      const axes = scrollAxes(el);
      if (axes.vertical) {
        findings.push({
          id: `inner-scroll-axis:vertical:${stableLocation(el, n)}`,
          description: `${describeEl(el)} declares a nested vertical overflow:${axes.vertical} inside the page scroll — second wayfinding axis; classify as Tier-1 bespoke`,
          outcome: 'escalated',
        });
        n++;
      }
      if (axes.horizontal && !isLateralOptIn(el)) {
        findings.push({
          id: `inner-scroll-axis:horizontal:${stableLocation(el, n)}`,
          description: `${describeEl(el)} declares horizontal overflow:${axes.horizontal} but is not marked as a lateral container (class*=lateral / data-lateral) — accidental horizontal scroll; classify as Tier-1 bespoke`,
          outcome: 'escalated',
        });
        n++;
      }
    });
    findings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

/**
 * Inspect inline `style` for overflow declarations on either axis. The
 * shorthand `overflow:` applies to both axes; the axis-specific properties
 * `overflow-x:` / `overflow-y:` win over the shorthand if they come later
 * in the declaration string (last-wins, as CSS cascades). Returns the
 * specific keyword (`auto` / `scroll`) per axis, or undefined if the axis
 * doesn't introduce a scrollable area (`hidden` / `visible` / unset).
 */
function scrollAxes(el: Element): { vertical?: string; horizontal?: string } {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return {};
  const lowered = style.toLowerCase();

  let vertical: string | undefined;
  let horizontal: string | undefined;
  for (const decl of lowered.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (prop === 'overflow') {
      vertical = isScrollKeyword(value) ? value : undefined;
      horizontal = isScrollKeyword(value) ? value : undefined;
    } else if (prop === 'overflow-y') {
      vertical = isScrollKeyword(value) ? value : undefined;
    } else if (prop === 'overflow-x') {
      horizontal = isScrollKeyword(value) ? value : undefined;
    }
  }
  return { vertical, horizontal };
}

function isScrollKeyword(value: string): boolean {
  return value === 'auto' || value === 'scroll';
}

/**
 * Marketing-vocabulary opt-in for an intentional horizontal scroller:
 *
 *  - `class*=lateral` — the playbook word for a deliberate horizontal rail
 *  - `class*=cr-lateral` — brand-prefixed variant
 *  - `data-lateral` attribute — semantic opt-in independent of styling
 *
 * The matcher is permissive (any class token containing 'lateral'), so
 * `cr-lateral-row` or `lateral-track` both satisfy the opt-in.
 */
function isLateralOptIn(el: Element): boolean {
  const props = el.properties;
  if (!props) return false;
  if ('dataLateral' in props || 'data-lateral' in props) return true;
  const cls = props.className;
  if (Array.isArray(cls)) {
    for (const c of cls) {
      if (typeof c === 'string' && /lateral/i.test(c)) return true;
    }
  } else if (typeof cls === 'string') {
    if (/lateral/i.test(cls)) return true;
  }
  return false;
}

function describeEl(el: Element): string {
  let s = el.tagName;
  const id = el.properties?.id;
  if (typeof id === 'string' && id) s += `#${id}`;
  const cls = el.properties?.className;
  if (Array.isArray(cls) && cls.length > 0) s += `.${cls.join('.')}`;
  return s;
}

function stableLocation(el: Element, fallbackIndex: number): string {
  const id = el.properties?.id;
  if (typeof id === 'string' && id) return `id-${id}`;
  const cls = el.properties?.className;
  if (Array.isArray(cls) && cls.length > 0) return `class-${cls.join('-')}`;
  return `n${fallbackIndex}`;
}
