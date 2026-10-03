import type { Root, Element, Text } from 'hast';
import { findElement, visitElements } from '../working-rep.js';
import { parseInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/**
 * WP1.F.3 — interactivity-accordion operator.
 *
 * The SSR flatten emits 0 <script> blocks: the kit's React useState-driven
 * click-to-expand behaviour is lost. This Tier-1 operator detects accordion
 * shapes (repeating header + body pairs) in the rendered HTML and grafts a
 * tiny vanilla-JS + ARIA layer on top — no framework, self-contained, runs
 * at end-of-body.
 *
 * Detection heuristic (v1, narrow on purpose):
 *   - find a container whose direct children share a structural shape
 *     (same first-tag + same child-count, ≥2 children),
 *   - and where each row contains a clickable HEADER (a <button>, or an
 *     element with `cursor:pointer` AND a visible chevron-like icon) AND
 *     a sibling BODY element after the header.
 *
 * Apply (anchor-durable, replayable):
 *   - assign each accordion-item a stable id `offscript-acc-<i>-<j>`;
 *   - add ARIA to the header (role=button if not a button, aria-expanded,
 *     aria-controls) and to the body (id, aria-hidden, inline display:none);
 *   - append a single <script id="offscript-interactivity"> at end-of-<body>
 *     that wires click + keyboard toggling. Idempotent.
 */

const SCRIPT_BLOCK_ID = 'offscript-interactivity';
const ID_PREFIX = 'offscript-acc-';

interface AccordionItem {
  header: Element;
  body: Element;
  headerId: string;
  bodyId: string;
}

interface Accordion {
  container: Element;
  index: number;
  items: AccordionItem[];
}

function classList(el: Element): string[] {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/).filter(Boolean);
  return [];
}

/** Direct element children of a node. */
function elementChildren(el: Element): Element[] {
  return el.children.filter((c): c is Element => c.type === 'element');
}

/** A header within a row: either a <button>, or an element with cursor:pointer + a chevron-like icon. */
function findHeader(row: Element): Element | undefined {
  let found: Element | undefined;
  visitElements(row, (el) => {
    if (found) return;
    if (el.tagName === 'button') {
      found = el;
      return;
    }
    const style = el.properties?.style;
    if (typeof style === 'string' && style !== '') {
      const decls = parseInlineDecls(style);
      if (decls.get('cursor') === 'pointer' && hasChevronDescendant(el)) {
        found = el;
      }
    }
  });
  return found;
}

/** A chevron-like icon: an <svg> or an element with class containing 'chevron'/'arrow', or unicode arrow text. */
function hasChevronDescendant(el: Element): boolean {
  let hit = false;
  visitElements(el, (e) => {
    if (hit) return;
    if (e.tagName === 'svg') {
      hit = true;
      return;
    }
    const cls = classList(e).join(' ').toLowerCase();
    if (/chevron|arrow|caret|toggle/.test(cls)) {
      hit = true;
      return;
    }
    for (const child of e.children) {
      if (child.type === 'text' && /[⌃⌄▼▶▾◀→↓↑←+\-▼▲►◄→↓↑←]/.test(child.value)) {
        hit = true;
        return;
      }
    }
  });
  return hit;
}

/** Two rows have the same structural shape: same tagName + same element-child count. */
function sameShape(a: Element, b: Element): boolean {
  if (a.tagName !== b.tagName) return false;
  return elementChildren(a).length === elementChildren(b).length;
}

/**
 * A row "looks like an accordion row" if it has a header element and a sibling
 * body element AFTER the header (within the same row container, OR the row IS
 * the header and its NEXT sibling is the body — handled at container level).
 *
 * For the v1 heuristic we treat each direct child of the container as a "row",
 * and within that row we require both header + body to be present.
 */
function rowHasHeaderAndBody(row: Element): { header: Element; body: Element } | undefined {
  const header = findHeader(row);
  if (!header) return undefined;
  // Body = any element child of row that is NOT the header and is NOT a
  // descendant of the header. Prefer the element AFTER the header.
  const kids = elementChildren(row);
  const headerIdx = kids.findIndex((k) => k === header || containsElement(k, header));
  // If the header is at the top level of the row's children, take the next.
  if (headerIdx >= 0 && headerIdx < kids.length - 1) {
    const body = kids[headerIdx + 1];
    if (body && body !== header) return { header, body };
  }
  // Fallback: any other element child that's distinct from the header.
  for (const k of kids) {
    if (k !== header && !containsElement(k, header) && !containsElement(header, k)) {
      return { header, body: k };
    }
  }
  return undefined;
}

function containsElement(root: Element, target: Element): boolean {
  if (root === target) return true;
  let found = false;
  visitElements(root, (e) => {
    if (e === target) found = true;
  });
  return found;
}

/** Walk the tree; collect accordion containers in document order. */
function collectAccordions(tree: Root): Accordion[] {
  const accordions: Accordion[] = [];
  let counter = 0;
  visitElements(tree, (container) => {
    const kids = elementChildren(container);
    if (kids.length < 2) return;
    // All children same shape?
    const first = kids[0];
    for (let i = 1; i < kids.length; i++) {
      if (!sameShape(first, kids[i])) return;
    }
    // Each child has a header + body?
    const items: AccordionItem[] = [];
    for (let j = 0; j < kids.length; j++) {
      const row = kids[j];
      const hb = rowHasHeaderAndBody(row);
      if (!hb) return;
      const idSuffix = `${counter}-${j}`;
      items.push({
        header: hb.header,
        body: hb.body,
        headerId: `${ID_PREFIX}${idSuffix}-h`,
        bodyId: `${ID_PREFIX}${idSuffix}-b`,
      });
    }
    // Idempotency: if any header in this container already carries an
    // aria-controls pointing at offscript-acc-*, skip (already wired).
    if (items.some((it) => {
      const ac = it.header.properties?.['aria-controls'];
      return typeof ac === 'string' && ac.startsWith(ID_PREFIX);
    })) {
      counter++;
      return;
    }
    accordions.push({ container, index: counter++, items });
  });
  return accordions;
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

/** The vanilla-JS click + keyboard handler. Kept under 1.5KB. */
const SCRIPT_SOURCE = `(function(){var hs=document.querySelectorAll('[aria-controls^="${ID_PREFIX}"]');if(!hs||!hs.length)return;function tog(h){var id=h.getAttribute('aria-controls');if(!id)return;var b=document.getElementById(id);if(!b)return;var open=h.getAttribute('aria-expanded')==='true';h.setAttribute('aria-expanded',open?'false':'true');b.setAttribute('aria-hidden',open?'true':'false');b.style.display=open?'none':'';}for(var i=0;i<hs.length;i++){(function(h){if(!h.hasAttribute('tabindex')&&h.tagName!=='BUTTON')h.setAttribute('tabindex','0');h.addEventListener('click',function(){tog(h);});h.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(h);}});})(hs[i]);}})();`;

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

function wireItem(item: AccordionItem): void {
  // Header
  item.header.properties = item.header.properties ?? {};
  if (item.header.tagName !== 'button') {
    item.header.properties.role = 'button';
  }
  item.header.properties.id = item.headerId;
  item.header.properties['aria-expanded'] = 'false';
  item.header.properties['aria-controls'] = item.bodyId;

  // Body — start collapsed.
  item.body.properties = item.body.properties ?? {};
  item.body.properties.id = item.bodyId;
  item.body.properties['aria-hidden'] = 'true';
  const existingStyle =
    typeof item.body.properties.style === 'string' ? item.body.properties.style : '';
  if (!/display\s*:\s*none/.test(existingStyle)) {
    item.body.properties.style = existingStyle
      ? `${existingStyle.replace(/;\s*$/, '')};display:none`
      : 'display:none';
  }
}

export const interactivityAccordion: Operator = {
  name: 'interactivity-accordion',
  tier: 1,

  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const accordions = collectAccordions(tree);
    return accordions.map((a) => ({
      id: `interactivity-accordion:${selectorOf(a.container)}#${a.index}`,
      description: `accordion (${a.items.length} items) lacks click-to-expand interactivity — vanilla JS + ARIA grafted`,
      outcome: 'auto-remediated' as const,
    }));
  },

  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    const accordions = collectAccordions(tree);
    if (accordions.length === 0) return [];
    for (const a of accordions) {
      for (const it of a.items) wireItem(it);
    }
    appendScriptBlock(tree);
    return accordions.map((a) => ({
      id: `interactivity-accordion:${selectorOf(a.container)}#${a.index}`,
      description: `accordion (${a.items.length} items) lacks click-to-expand interactivity — vanilla JS + ARIA grafted`,
      outcome: 'auto-remediated' as const,
    }));
  },
};
