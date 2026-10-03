import type { Root, Element, ElementContent } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/**
 * Tier-2 detector: layout-alignment.
 *
 * Walks the hast tree looking for grid/flex parents (an element whose inline
 * `style` declares `display:grid` or `display:flex`) with ≥3 direct-element
 * children. For each such parent, it compares each sibling's "shape" —
 * defined as the set of distinct direct-child tag names PLUS whether the
 * sibling itself is a "card wrapper" (inline style carrying background +
 * border-radius + padding, while its peers are bare content). If one sibling
 * diverges from the structural pattern of the rest, that's a misalignment
 * candidate.
 *
 * Tier 2 is escalation-only in v1 (per the bounded-LLM vision §8.2 / §10).
 * `apply` does NOT mutate the DOM — it re-runs `detect` so verify() correctly
 * reports nothing was remediated. The freeze-wiring layer converts these
 * escalated findings into `overlay/` entries (frozen bespoke regions) so the
 * next harden run surfaces them as "you own this; re-decide on regen".
 *
 * The auto-fix variant (rewriting the divergent sibling to match its peers)
 * is a deliberate future WP — when the divergence is intentional design (the
 * common case for comparison tables that highlight one column), an auto-fix
 * would corrupt the design. Escalating is the correct v1 behaviour.
 */
export const layoutAlignment: Operator = {
  name: 'layout-alignment',
  tier: 2,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    collect(tree, [], findings);
    findings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return findings;
  },

  // Tier-2 escalation-only: never mutates. Re-emits the same findings so the
  // engine's verify() correctly reports residue (the rail stays "dirty" until
  // the freeze-wiring writes the overlay entry).
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};

/** Recursively walk every element; emit findings for any grid/flex parent. */
function collect(
  node: Root | Element,
  path: Array<{ tagName: string; index: number }>,
  out: Finding[],
): void {
  const children = elementChildren(node);

  if (node.type === 'element' && isGridOrFlex(node) && children.length >= 3) {
    const selector = selectorForPath(path);
    flagDivergent(children, selector, out);
  }

  // Recurse with positional indices for selector construction.
  const counts = new Map<string, number>();
  for (const child of (node as { children: ElementContent[] | Root['children'] }).children as ElementContent[]) {
    if (child.type !== 'element') continue;
    const n = (counts.get(child.tagName) ?? 0) + 1;
    counts.set(child.tagName, n);
    collect(child, [...path, { tagName: child.tagName, index: n }], out);
  }
}

function elementChildren(node: Root | Element): Element[] {
  const out: Element[] = [];
  for (const child of (node as { children: ElementContent[] | Root['children'] }).children as ElementContent[]) {
    if (child.type === 'element') out.push(child);
  }
  return out;
}

/** True if inline `style` declares `display:grid` or `display:flex`. */
function isGridOrFlex(el: Element): boolean {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return false;
  // strip comments and lowercase property names; tolerate whitespace
  const lowered = style.toLowerCase();
  return /(^|;|\s)display\s*:\s*(grid|flex|inline-grid|inline-flex)\s*(;|$)/.test(lowered);
}

/** True if inline `style` declares an OPAQUE-tinted background + border-radius + padding (a real card wrapper).
 *
 * Crucially, a declared-but-transparent background (`transparent`, `none`,
 * `rgba(...,0)`, `hsla(...,0)`) does NOT count: those siblings are visually
 * bare, even though the property is present. The CR comparison table's middle
 * columns use `background:transparent;padding:0;border-radius:...` to align
 * geometry without painting a card; without this filter the heuristic would
 * read them as card-wrappers and flag the wrong (bare) header column as the
 * diverger instead of the actually-tinted APA callout.
 */
function isCardWrapper(el: Element): boolean {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return false;
  const lowered = style.toLowerCase();
  if (!/(^|;|\s)border-radius\s*:/.test(lowered)) return false;
  if (!/(^|;|\s)padding(?:-[a-z]+)?\s*:/.test(lowered)) return false;
  const bg = extractBackgroundValue(lowered);
  return bg !== undefined && !isTransparentBackground(bg);
}

/** Pull the value of `background` or `background-color` (whichever appears last, mirroring CSS cascade). */
function extractBackgroundValue(loweredStyle: string): string | undefined {
  let last: string | undefined;
  for (const decl of loweredStyle.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (prop === 'background' || prop === 'background-color') last = value;
  }
  return last;
}

/** True for visually-transparent background tokens: `transparent`, `none`, or rgba/hsla with 0 alpha. */
function isTransparentBackground(value: string): boolean {
  const v = value.trim();
  if (v === 'transparent' || v === 'none' || v === '') return true;
  // rgba(r,g,b,0) / rgba(r,g,b,0.0) / hsla(h,s,l,0) — last channel is the alpha.
  return /^(?:rgba|hsla)\(\s*[^)]*?,\s*0(?:\.0+)?\s*\)$/.test(v);
}

/** A sibling's structural "shape" = sorted distinct child tags + card-wrapper bit. */
function shapeKey(sibling: Element): string {
  const tags = new Set<string>();
  for (const c of sibling.children) {
    if (c.type === 'element') tags.add(c.tagName);
  }
  const tagList = [...tags].sort().join(',');
  return `${isCardWrapper(sibling) ? 'card' : 'bare'}|tags:${tagList}`;
}

/** Find the divergent sibling (the one whose shape differs from the majority) and emit a finding. */
function flagDivergent(siblings: Element[], parentSelector: string, out: Finding[]): void {
  const shapes = siblings.map(shapeKey);
  // Tally shapes; majority is the modal shape.
  const tally = new Map<string, number>();
  for (const s of shapes) tally.set(s, (tally.get(s) ?? 0) + 1);

  let majority = '';
  let majorityCount = -1;
  for (const [s, n] of tally) {
    if (n > majorityCount) {
      majority = s;
      majorityCount = n;
    }
  }
  // Require a real majority (>= 2 peers agreeing). Otherwise no signal.
  if (majorityCount < siblings.length - 1) return;
  if (majorityCount === siblings.length) return; // all match — no divergence

  for (let i = 0; i < siblings.length; i++) {
    if (shapes[i] === majority) continue;
    const sib = siblings[i];
    const majorityIsCard = majority.startsWith('card|');
    const divergentIsCard = isCardWrapper(sib);
    const shapeNote =
      divergentIsCard && !majorityIsCard
        ? 'card-wrapper vs bare content peers'
        : !divergentIsCard && majorityIsCard
          ? 'bare content vs card-wrapper peers'
          : 'distinct child-tag set vs peers';
    const id = `layout-alignment:misaligned:${parentSelector}:${i}`;
    out.push({
      id,
      description: `sibling ${i} of the ${parentSelector} grid/flex parent has a structurally distinct shape (${shapeNote}) that breaks row alignment; classify as Tier-2 bespoke`,
      outcome: 'escalated',
    });
  }
}

/** Deterministic selector from a positional path. Empty path → ":root". */
function selectorForPath(path: Array<{ tagName: string; index: number }>): string {
  if (path.length === 0) return ':root';
  return path.map((p) => `${p.tagName}:nth-of-type(${p.index})`).join('>');
}
