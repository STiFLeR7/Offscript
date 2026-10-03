import type { Root, Element, Text } from 'hast';
import { findElement, visitElements } from '../working-rep.js';
import { parseInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/**
 * WP1.F.4 — interactivity-master-detail operator.
 *
 * Sibling to `interactivity-accordion`. The accordion shape is N stacked
 * header+body pairs that toggle in place. The master-detail shape — the
 * Example Brand FAQ shape — is different: a list of clickable "master" items
 * in one column and ONE shared "detail" panel in a sibling column. Clicking
 * a master item changes which one is "active" and swaps the panel content.
 *
 * In SSR-flattened output, all the master items are in the DOM but only ONE
 * carries the visual "active" style and the detail panel renders only that
 * one item's content — the React `useState(active)` is gone, so clicks do
 * nothing. This Tier-1 operator detects the shape and grafts vanilla JS +
 * ARIA: clicks now toggle which master item is `aria-pressed=true` AND, if
 * the page provides `<template data-detail-for="<n>">` blocks (full source
 * mapping), swaps the panel innerHTML.
 *
 * Detection heuristic (v1, narrow on purpose):
 *   - find a parent whose layout is `display:grid` (any template) or
 *     `display:flex` with `flex-direction:row` (the default), and which has
 *     exactly TWO direct element children.
 *   - child A (the master list) is itself a flex column (or any container)
 *     with ≥ 3 element children where every child carries `cursor:pointer`
 *     in its inline style AND has a non-trivial text label.
 *   - child B (the detail panel) is ANY element distinct from A. We don't
 *     require it to "match" any of the master items' contents — that would
 *     be a false-negative magnet in SSR'd output. The presence of the
 *     N-cursor-pointer-siblings + sibling block is the heuristic.
 *
 * v1 limit (honest):
 *   The SSR output only contains the active item's answer. The kit JSX has
 *   all `{q, a}` pairs but they don't survive flatten. Without source access
 *   we cannot swap the detail panel content. The MVP wires the *click
 *   feedback* — `aria-pressed` toggles across master items, the panel gets
 *   `aria-live="polite"`, and the script will swap innerHTML iff
 *   `<template data-detail-for="<n>">` blocks are present (a future stage
 *   that has the source pairs can emit those templates). Without templates,
 *   the user sees the click is recognised but the answer text doesn't
 *   change — better than the current "click does literally nothing".
 *
 * Apply (anchor-durable, replayable):
 *   - assign each master container a stable index by document order;
 *   - assign each master item id `offscript-md-<container>-<i>`,
 *     `data-offscript-md-master="<container>"`, `data-offscript-md-index="<i>"`,
 *     `role="button"`, `tabindex="0"`, `aria-pressed="<true|false>"`
 *     (true iff the item is the visually-active one — heuristically
 *     detected by inline background-color differing from siblings),
 *     `aria-controls="<panel-id>"`.
 *   - the detail panel gets `id="offscript-md-<container>-panel"`,
 *     `role="region"`, `aria-live="polite"`.
 *   - append a single `<script id="offscript-interactivity-md">` at end-of-body
 *     (separate from the accordion script — different shape, different id).
 *
 * Idempotent: rescan skips containers whose master items already carry
 * `data-offscript-md-master`; script appended at most once.
 */

const SCRIPT_BLOCK_ID = 'offscript-interactivity-md';
const ID_PREFIX = 'offscript-md-';

interface MasterItem {
  el: Element;
  itemId: string;
  active: boolean;
}

interface MasterDetail {
  container: Element;
  master: Element;
  panel: Element;
  index: number;
  items: MasterItem[];
  panelId: string;
}

function classList(el: Element): string[] {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/).filter(Boolean);
  return [];
}

function elementChildren(el: Element): Element[] {
  return el.children.filter((c): c is Element => c.type === 'element');
}

function inlineDecls(el: Element): Map<string, string> {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return new Map();
  return parseInlineDecls(style);
}

/** Container layout = grid OR flex (row direction; row is the flex default). */
function isRowLayoutContainer(el: Element): boolean {
  const d = inlineDecls(el);
  const display = d.get('display');
  if (display === 'grid') return true;
  if (display === 'flex') {
    const dir = d.get('flex-direction');
    // row is the default; treat absent OR explicit row/row-reverse as row.
    return !dir || dir === 'row' || dir === 'row-reverse';
  }
  return false;
}

function textContent(el: Element): string {
  let out = '';
  const stack: Array<Element | Text> = [el as Element];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.type === 'text') {
      out += n.value;
      continue;
    }
    for (const c of n.children) {
      if (c.type === 'text' || c.type === 'element') stack.push(c as Element | Text);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** A "clickable item": cursor:pointer in inline style AND a non-trivial text label. */
function isClickableMasterItem(el: Element): boolean {
  if (inlineDecls(el).get('cursor') !== 'pointer') return false;
  const t = textContent(el);
  return t.length >= 3;
}

/**
 * The master list: a container whose ≥3 direct element children are all
 * clickable master items. The children must share the same tagName (mirrors
 * the kit's `qs.map` pattern).
 */
function looksLikeMasterList(el: Element): boolean {
  const kids = elementChildren(el);
  if (kids.length < 3) return false;
  const tag = kids[0].tagName;
  for (const k of kids) {
    if (k.tagName !== tag) return false;
    if (!isClickableMasterItem(k)) return false;
  }
  return true;
}

/**
 * Heuristic: which master item is the "active" one? In the kit, the active
 * item has a different background-color than its siblings (the React state
 * picks `background: i === active ? brandA : brandB`). We pick the item
 * whose `background`/`background-color` value is the minority across the
 * sibling set. If the heuristic is ambiguous (all-same, or all-different),
 * default to the first item.
 */
function pickActiveIndex(items: Element[]): number {
  const bgs = items.map((it) => {
    const d = inlineDecls(it);
    return d.get('background-color') ?? d.get('background') ?? '';
  });
  const counts = new Map<string, number>();
  for (const bg of bgs) counts.set(bg, (counts.get(bg) ?? 0) + 1);
  // Find the bg with count===1 (the minority) and pick its first occurrence.
  let minority: string | undefined;
  for (const [bg, c] of counts) {
    if (c === 1) {
      minority = bg;
      break;
    }
  }
  if (minority !== undefined) {
    const idx = bgs.indexOf(minority);
    if (idx >= 0) return idx;
  }
  return 0;
}

function alreadyWired(masterList: Element): boolean {
  // hast camelCases `data-*` attributes on parse (so a serialized
  // `data-offscript-md-master="0"` round-trips back as `dataOffscriptMdMaster`).
  // We check BOTH forms so idempotency holds for trees we just mutated
  // AND for trees freshly re-parsed from serialized HTML.
  const kids = elementChildren(masterList);
  for (const k of kids) {
    const p = k.properties;
    if (!p) continue;
    if (typeof p['data-offscript-md-master'] === 'string') return true;
    if (typeof (p as Record<string, unknown>).dataOffscriptMdMaster === 'string') return true;
  }
  return false;
}

function collectMasterDetail(tree: Root): MasterDetail[] {
  const out: MasterDetail[] = [];
  let counter = 0;
  visitElements(tree, (container) => {
    if (!isRowLayoutContainer(container)) return;
    const kids = elementChildren(container);
    if (kids.length !== 2) return;

    // Try (A, B) and (B, A) — either side can be the master list.
    let master: Element | undefined;
    let panel: Element | undefined;
    if (looksLikeMasterList(kids[0]) && !looksLikeMasterList(kids[1])) {
      master = kids[0];
      panel = kids[1];
    } else if (looksLikeMasterList(kids[1]) && !looksLikeMasterList(kids[0])) {
      master = kids[1];
      panel = kids[0];
    }
    if (!master || !panel) return;

    // Idempotency: skip if already wired.
    if (alreadyWired(master)) {
      counter++;
      return;
    }

    const itemEls = elementChildren(master);
    const activeIdx = pickActiveIndex(itemEls);
    const items: MasterItem[] = itemEls.map((el, i) => ({
      el,
      itemId: `${ID_PREFIX}${counter}-${i}`,
      active: i === activeIdx,
    }));
    out.push({
      container,
      master,
      panel,
      index: counter,
      items,
      panelId: `${ID_PREFIX}${counter}-panel`,
    });
    counter++;
  });
  return out;
}

function selectorOf(el: Element): string {
  const id = el.properties?.id;
  if (typeof id === 'string' && id !== '') return `#${id}`;
  const cls = classList(el);
  if (cls.length > 0) return `${el.tagName}.${cls[0]}`;
  return el.tagName;
}

function findScriptBlock(tree: Root): Element | undefined {
  let found: Element | undefined;
  visitElements(tree, (el) => {
    if (
      !found &&
      el.tagName === 'script' &&
      typeof el.properties?.id === 'string' &&
      el.properties.id === SCRIPT_BLOCK_ID
    ) {
      found = el;
    }
  });
  return found;
}

/**
 * Vanilla JS — under 1.5KB. On click of any `[data-offscript-md-master]`:
 *  - find sibling items sharing the same master id,
 *  - flip aria-pressed across them (clicked one → true, others → false),
 *  - if a `<template data-detail-for="<container>-<i>">` exists, replace
 *    the panel's innerHTML with the template's content; otherwise leave
 *    the panel alone (v1 limit — see operator docstring).
 */
const SCRIPT_SOURCE = `(function(){var ms=document.querySelectorAll('[data-offscript-md-master]');if(!ms||!ms.length)return;function act(m){var g=m.getAttribute('data-offscript-md-master');var i=m.getAttribute('data-offscript-md-index');var sibs=document.querySelectorAll('[data-offscript-md-master="'+g+'"]');for(var k=0;k<sibs.length;k++)sibs[k].setAttribute('aria-pressed',sibs[k]===m?'true':'false');var pid=m.getAttribute('aria-controls');var p=pid?document.getElementById(pid):null;if(!p)return;var t=document.querySelector('template[data-detail-for="'+g+'-'+i+'"]');if(t&&t.content)p.innerHTML=t.innerHTML;}for(var j=0;j<ms.length;j++){(function(m){if(!m.hasAttribute('tabindex'))m.setAttribute('tabindex','0');m.addEventListener('click',function(){act(m);});m.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();act(m);}});})(ms[j]);}})();`;

function appendScriptBlock(tree: Root): void {
  if (findScriptBlock(tree)) return;
  const body = findElement(tree, 'body');
  const script: Element = {
    type: 'element',
    tagName: 'script',
    properties: { id: SCRIPT_BLOCK_ID },
    children: [{ type: 'text', value: SCRIPT_SOURCE } as Text],
  };
  if (body) body.children.push(script);
  else tree.children.push(script);
}

function wireMasterDetail(md: MasterDetail): void {
  for (const it of md.items) {
    it.el.properties = it.el.properties ?? {};
    it.el.properties.id = it.itemId;
    it.el.properties.role = 'button';
    it.el.properties.tabindex = '0';
    it.el.properties['aria-pressed'] = it.active ? 'true' : 'false';
    it.el.properties['aria-controls'] = md.panelId;
    it.el.properties['data-offscript-md-master'] = String(md.index);
    // index in document order; same value also encoded in the itemId suffix.
    const parts = it.itemId.split('-');
    it.el.properties['data-offscript-md-index'] = parts[parts.length - 1];
  }
  md.panel.properties = md.panel.properties ?? {};
  md.panel.properties.id = md.panelId;
  md.panel.properties.role = 'region';
  md.panel.properties['aria-live'] = 'polite';
}

export const interactivityMasterDetail: Operator = {
  name: 'interactivity-master-detail',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const mds = collectMasterDetail(tree);
    return mds.map((md) => ({
      id: `interactivity-master-detail:${selectorOf(md.container)}#${md.index}`,
      description: `master-detail (${md.items.length} master items) lacks click-to-switch interactivity — vanilla JS + ARIA grafted`,
      outcome: 'auto-remediated' as const,
    }));
  },

  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    const mds = collectMasterDetail(tree);
    if (mds.length === 0) return [];
    for (const md of mds) wireMasterDetail(md);
    appendScriptBlock(tree);
    return mds.map((md) => ({
      id: `interactivity-master-detail:${selectorOf(md.container)}#${md.index}`,
      description: `master-detail (${md.items.length} master items) lacks click-to-switch interactivity — vanilla JS + ARIA grafted`,
      outcome: 'auto-remediated' as const,
    }));
  },
};
