import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import type { Root, Element, RootContent, ElementContent } from 'hast';

/** Parse a full HTML document into the ephemeral working representation (hast tree). */
export function parseHtml(html: string): Root {
  return fromHtml(html, { fragment: false });
}

/** Parse an HTML *fragment* (no <html>/<body> wrapper) into a hast Root. */
export function parseFragment(html: string): Root {
  return fromHtml(html, { fragment: true });
}

/** Serialize the working representation back to an HTML string. */
export function serializeHtml(tree: Root): string {
  return toHtml(tree);
}

/** Depth-first search for the first element with the given tag name. */
export function findElement(tree: Root | Element, tagName: string): Element | undefined {
  const stack: Array<RootContent | ElementContent> = [...tree.children];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.type === 'element') {
      if (node.tagName === tagName) return node;
      stack.unshift(...node.children);
    }
  }
  return undefined;
}

/** Depth-first visit of every element in the tree (pre-order), calling fn on each. */
export function visitElements(tree: Root | Element, fn: (el: Element) => void): void {
  for (const child of tree.children) {
    if (child.type === 'element') {
      fn(child);
      visitElements(child, fn);
    }
  }
}
