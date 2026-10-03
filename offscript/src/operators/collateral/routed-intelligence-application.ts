import type { Root, Element, ElementContent } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';

/**
 * Tier-1 collateral rail: routed-intelligence-application (Option 2).
 *
 * Closes the "pointed-but-unused" gap the APA runtime exposed: the engine routes a
 * specific diagram/spatial exemplar to a rich-content page (Option 1), but nothing
 * verified the page actually REALIZED that intelligence — a page could be routed a
 * process diagram and ship as plain text, invisibly.
 *
 * This rail makes non-application VISIBLE. The engine stamps the routed intelligence
 * CLASS on each page wrapper (`<section class="cr-page" data-cr-routed="diagram|spatial">`,
 * deterministic from the content-signal — author.ts; the author cannot dodge it). The
 * rail reads that stamp and checks the section subtree carries an acceptable realization
 * of that CLASS.
 *
 * REFINEMENT (detect the class, not a component): a class is "applied" if ANY of its
 * acceptable realizations is present — never one specific component. The house wrapper
 * `.cr-graphic` OR a hand-authored inline `<svg>` (with enough drawing primitives to be a
 * real relational/spatial visual, not a lone icon) both satisfy it. So an author who
 * realizes the routed intelligence ANY legitimate way passes; only a page that applies
 * NONE of the class's realizations is flagged.
 *
 * Pure observability: `outcome: 'warning'` — it never gates, scores, or freezes. It
 * surfaces the gap (and, via the finding's section-id, routes to that page in the
 * violation-aware re-author loop). It transports NOTHING — it reads the artifact only.
 *
 * Collateral-only: registered in collateralRegistry(), never the website registry.
 */

// W54 — Data Visualization parity: 'chart' is now a routable/verifiable class, the same
// way 'diagram'/'spatial' already are (README-DATA-VIZ governs its own realization rules).
type RoutedClass = 'diagram' | 'spatial' | 'chart';

/** SVG drawing primitives that constitute a real authored visual (not a lone glyph). */
const SVG_PRIMITIVES = new Set([
  'path',
  'line',
  'polyline',
  'polygon',
  'rect',
  'circle',
  'ellipse',
]);

/** Minimum primitive count per class for a raw inline SVG to count as a realization. */
const MIN_PRIMITIVES: Record<RoutedClass, number> = {
  diagram: 2, // a flow / hub-spoke / relationship needs ≥2 marks
  spatial: 3, // a layered / iso system illustration is richer
  // A chart's own house convention (author-contract.ts's "Data-viz idioms") is a doc-scoped
  // `.viz-*` class, checked separately below (hasVizClass) — this SVG-primitive count is
  // only the fallback for the SVG-based chart types (donut/ring/trend/pair/delta all use
  // inline SVG). Per README-DATA-VIZ's own "a single metric is a hero metric visualization"
  // allowance, one drawn mark (e.g. a single ring/arc) is already a complete realization.
  chart: 1,
};

function className(el: Element): string[] {
  const c = el.properties?.className;
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? [c] : [];
}

function routedAttr(el: Element): RoutedClass | undefined {
  const v = el.properties?.dataCrRouted;
  return v === 'diagram' || v === 'spatial' || v === 'chart' ? v : undefined;
}

/** Walk an element's own subtree (inclusive), calling `cb` for every element node. */
function eachElement(node: Element, cb: (el: Element) => void): void {
  cb(node);
  for (const child of node.children as ElementContent[]) {
    if ((child as Element).type === 'element') eachElement(child as Element, cb);
  }
}

/** Walk the whole tree for element nodes (Root or Element children). */
function eachElementInTree(tree: Root, cb: (el: Element) => void): void {
  for (const child of tree.children as ElementContent[]) {
    if ((child as Element).type === 'element') eachElement(child as Element, cb);
  }
}

/** Does this section subtree carry an acceptable realization of the routed class? */
function classRealized(section: Element, cls: RoutedClass): boolean {
  let hasGraphic = false;
  let svgPrimitives = 0;
  let hasSvg = false;
  let hasVizClass = false;
  eachElement(section, (el) => {
    const classes = className(el);
    if (classes.includes('cr-graphic')) hasGraphic = true;
    if (classes.some((c) => c.startsWith('viz-'))) hasVizClass = true;
    if (el.tagName === 'svg') hasSvg = true;
    if (SVG_PRIMITIVES.has(el.tagName)) svgPrimitives += 1;
  });
  // Realization 1: the house rich-visual wrapper. Realization 2: a hand-authored inline
  // SVG with enough marks to be a real visual. Realization 3 (chart only): a doc-scoped
  // `.viz-*` class — the house data-viz convention (author-contract.ts), covering the
  // plain-div chart types (bar/cluster/rank/table) that carry no SVG at all. ANY of these
  // satisfies the CLASS.
  if (hasGraphic) return true;
  if (cls === 'chart' && hasVizClass) return true;
  if (hasSvg && svgPrimitives >= MIN_PRIMITIVES[cls]) return true;
  return false;
}

/** The first descendant element id (the inner page root) — for finding attribution. */
function sectionId(section: Element, fallbackIndex: number): string {
  let id = '';
  eachElement(section, (el) => {
    if (!id && typeof el.properties?.id === 'string' && el.properties.id) id = el.properties.id;
  });
  return id || `page-${fallbackIndex}`;
}

function detectApplication(tree: Root): Finding[] {
  const findings: Finding[] = [];
  let pageIndex = -1;
  eachElementInTree(tree, (el) => {
    // Only top-level page wrappers carry both cr-page and the routed stamp.
    if (el.tagName !== 'section') return;
    const cls = routedAttr(el);
    if (!cls) return;
    if (!className(el).includes('cr-page')) return;
    pageIndex += 1;
    if (classRealized(el, cls)) return;
    const id = sectionId(el, pageIndex);
    const what =
      cls === 'spatial'
        ? 'a layered / system illustration'
        : cls === 'chart'
          ? 'a data visualization / chart'
          : 'a relational / flow diagram';
    const noRealizationOf =
      cls === 'chart'
        ? 'no `.cr-graphic`, no doc-scoped `.viz-*` chart, and no inline SVG visual'
        : 'no `.cr-graphic` and no inline SVG visual';
    findings.push({
      id: `routed-intelligence-application:${cls}:${id}`,
      description:
        `Page "${id}" was routed the "${cls}" intelligence class (${what} exemplar was ` +
        `pointed at this page) but applies NO realization of it — ${noRealizationOf}. ` +
        `The routed intelligence was not used; the page is text-only where its content ` +
        `called for ${what}.`,
      outcome: 'warning',
    });
  });
  return findings;
}

export const routedIntelligenceApplication: Operator = {
  name: 'routed-intelligence-application',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectApplication(tree);
  },
  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectApplication(tree);
  },
};
