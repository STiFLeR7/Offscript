import type { Root, Element, Text } from 'hast';
import { findElement, visitElements } from '../working-rep.js';
import { parseInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/**
 * WP1.F.2 — responsive-breakpoints operator.
 *
 * The flattened deliverable inherits inline styles from the SSR'd kit, which
 * are single-viewport by nature (inline styles can't carry @media rules and
 * the kit's JS-driven responsive logic doesn't survive SSR). This Tier-1
 * operator GENERATES tablet (≤768px) and mobile (≤480px) breakpoints from the
 * rendered inline-style layout, leaving the desktop view byte-identical.
 *
 * Approach (anchor-durable, replayable):
 *   - detect: walk inline styles, identify three responsive-needing patterns
 *     (multi-column grids, flex rows, fixed widths ≥720px) in document order.
 *   - apply: assign each site a stable `offscript-resp-<index>` class (added to
 *     the element's class list — original inline style is preserved), and
 *     append a single `<style id="offscript-responsive">` block to <head> with
 *     two @media queries that override at tablet/mobile.
 *
 * Idempotent: the operator skips elements that already carry an
 * `offscript-resp-*` class, and only emits the style block when missing.
 */

const STYLE_BLOCK_ID = 'offscript-responsive';
const CLASS_PREFIX = 'offscript-resp-';
const TABLET_MAX = 768;
const MOBILE_MAX = 480;
const FIXED_WIDTH_THRESHOLD = 720;

type SiteKind = 'grid-multi' | 'flex-row' | 'fixed-width';

interface Site {
  el: Element;
  kind: SiteKind;
  className: string; // offscript-resp-<n>
  index: number;
}

const PX = /^(\d+(?:\.\d+)?)px$/;

/** Count grid template columns; multi-column = 2+ track tokens. */
function gridColumnCount(value: string): number {
  // Strip parenthesized groups (e.g. minmax(...), repeat(...)) for the count;
  // also strip [line-name] brackets. Then count whitespace-separated tracks.
  const stripped = value
    .replace(/\([^)]*\)/g, 'X')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
  if (!stripped) return 0;
  // repeat(N, …) — try to read N if present.
  const repeat = /repeat\s*\(\s*(\d+)\s*,/i.exec(value);
  if (repeat) return parseInt(repeat[1], 10);
  return stripped.split(/\s+/).filter(Boolean).length;
}

function classify(decls: Map<string, string>): SiteKind | undefined {
  const display = decls.get('display');
  if (display === 'grid') {
    const cols = decls.get('grid-template-columns');
    if (cols && gridColumnCount(cols) >= 2) return 'grid-multi';
  }
  if (display === 'flex') {
    const dir = decls.get('flex-direction');
    // default flex-direction is row
    if (!dir || dir === 'row' || dir === 'row-reverse') return 'flex-row';
  }
  const width = decls.get('width');
  if (width) {
    const m = PX.exec(width);
    if (m && parseFloat(m[1]) >= FIXED_WIDTH_THRESHOLD) return 'fixed-width';
  }
  return undefined;
}

function classList(el: Element): string[] {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/).filter(Boolean);
  return [];
}

function hasOffscriptRespClass(el: Element): boolean {
  return classList(el).some((c) => c.startsWith(CLASS_PREFIX));
}

function addClass(el: Element, name: string): void {
  el.properties = el.properties ?? {};
  const current = classList(el);
  if (current.includes(name)) return;
  el.properties.className = [...current, name];
}

function findStyleBlock(tree: Root): Element | undefined {
  let found: Element | undefined;
  visitElements(tree, (el) => {
    if (
      !found &&
      el.tagName === 'style' &&
      typeof el.properties?.id === 'string' &&
      el.properties.id === STYLE_BLOCK_ID
    ) {
      found = el;
    }
  });
  return found;
}

function describe(kind: SiteKind): string {
  switch (kind) {
    case 'grid-multi':
      return 'multi-column grid lacks a mobile breakpoint — collapses to single column at narrow widths';
    case 'flex-row':
      return 'flex row lacks a mobile breakpoint — stacks horizontally on narrow viewports';
    case 'fixed-width':
      return 'fixed pixel width forces horizontal overflow on narrow viewports';
  }
}

/** Walk the tree in document order; collect responsive-needing sites. */
function collectSites(tree: Root): Site[] {
  const sites: Site[] = [];
  let counter = 0;
  visitElements(tree, (el) => {
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    // Idempotency: skip if already tagged by a prior apply.
    if (hasOffscriptRespClass(el)) return;
    const decls = parseInlineDecls(style);
    const kind = classify(decls);
    if (!kind) return;
    const index = counter++;
    sites.push({ el, kind, className: `${CLASS_PREFIX}${index}`, index });
  });
  return sites;
}

/** Render the responsive CSS block from a list of sites (sorted by index). */
function renderResponsiveCss(sites: Site[]): string {
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  const sorted = [...sites].sort((a, b) => a.index - b.index);
  for (const s of sorted) {
    const sel = `.${s.className}`;
    switch (s.kind) {
      case 'grid-multi':
        tabletRules.push(`${sel}{grid-template-columns:1fr 1fr}`);
        mobileRules.push(`${sel}{grid-template-columns:1fr}`);
        break;
      case 'flex-row':
        // tablet: keep row; mobile: stack
        mobileRules.push(`${sel}{flex-direction:column}`);
        break;
      case 'fixed-width':
        tabletRules.push(`${sel}{width:100%;max-width:100%}`);
        mobileRules.push(`${sel}{width:100%;max-width:100%}`);
        break;
    }
  }
  const parts: string[] = [];
  if (tabletRules.length > 0) {
    parts.push(`@media (max-width:${TABLET_MAX}px){${tabletRules.join('')}}`);
  }
  // Always emit the mobile block when there are any sites at all (the contract
  // promises TWO @media blocks when any site is detected).
  if (mobileRules.length > 0 || tabletRules.length > 0) {
    parts.push(`@media (max-width:${MOBILE_MAX}px){${mobileRules.join('')}}`);
  }
  return parts.join('');
}

function setStyleText(el: Element, css: string): void {
  el.children = [{ type: 'text', value: css } as Text];
}

function embedStyleBlock(tree: Root, css: string): void {
  let block = findStyleBlock(tree);
  if (!block) {
    block = {
      type: 'element',
      tagName: 'style',
      properties: { id: STYLE_BLOCK_ID },
      children: [],
    };
    const head = findElement(tree, 'head');
    const parent = head ?? findElement(tree, 'html');
    if (parent) parent.children.push(block);
    else tree.children.push(block);
  }
  setStyleText(block, css);
}

/**
 * Tier-1 systematic transform: generate tablet/mobile @media breakpoints from
 * the inline-style layout. Document-order indexing → stable class names →
 * deterministic output. Idempotent (re-detect after apply finds no sites).
 */
export const responsiveBreakpoints: Operator = {
  name: 'responsive-breakpoints',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const sites = collectSites(tree);
    return sites.map((s) => ({
      id: `responsive-breakpoints:.${s.className}`,
      description: describe(s.kind),
      outcome: 'auto-remediated' as const,
    }));
  },

  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    const sites = collectSites(tree);
    if (sites.length === 0) return [];
    // Tag each site (idempotency: collectSites already excluded any element
    // with a pre-existing offscript-resp-* class).
    for (const s of sites) {
      addClass(s.el, s.className);
    }
    const css = renderResponsiveCss(sites);
    if (css !== '') embedStyleBlock(tree, css);
    return sites.map((s) => ({
      id: `responsive-breakpoints:.${s.className}`,
      description: describe(s.kind),
      outcome: 'auto-remediated' as const,
    }));
  },
};

