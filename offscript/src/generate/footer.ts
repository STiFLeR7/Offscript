/**
 * Stage 3 — Generate: the canonical collateral footer (project identity).
 *
 * Issue 2 fix: the footer is engine-owned, not author-authored. buildCanonicalFooter
 * builds ONE footer per run from project identity so it is byte-
 * identical on every collateral page. Supplied project names and explicit parent URLs
 * determine its text; resource branding never overrides them.
 * COLLATERAL ONLY (track isolation rule #1).
 */
import { parseFragment, serializeHtml } from '../working-rep.js';
import type { Root, Element } from 'hast';
import type { DesignContext } from './types.js';

export interface FooterText {
  domain: string;
  descriptor: string;
}

/** Project identity is explicit; display names never manufacture a domain. */
export function loadFooterGovernance(context: DesignContext, warnings: string[]): FooterText {
  const descriptor = context.brandKit?.subject?.trim() || context.brandContract?.subject?.trim() ||
    context.brief.brand?.trim() || (context.brandSource === 'default' ? 'Example Brand' : context.client);
  let domain = '';
  const declaredUrl = context.brief.parentUrl ?? context.parentUrl;
  if (declaredUrl) {
    try {
      const url = new URL(declaredUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') domain = url.hostname;
    } catch {
      warnings.push('footer: invalid project parent URL — domain omitted.');
    }
  }
  return { domain, descriptor };
}

/** Build one escaped, deterministic footer, repeated across collateral pages. */
export function buildCanonicalFooter(context: DesignContext, warnings: string[]): string {
  const { domain, descriptor } = loadFooterGovernance(context, warnings);
  const tree = parseFragment(
    '<footer class="cr-page-foot" style="margin-top:auto">' +
    '<span style="font-weight:600;letter-spacing:var(--tracking-eyebrow);' +
    'text-transform:uppercase;font-size:var(--fs-eyebrow);color:var(--cr-graphite)"></span>' +
    '<span></span></footer>',
  );
  const footer = tree.children[0] as Element;
  const spans = footer.children as Element[];
  spans[0].children = [{ type: 'text', value: domain }];
  spans[1].children = [{ type: 'text', value: descriptor }];
  return serializeHtml(tree);
}

function hasClass(el: Element, cls: string): boolean {
  const c = el.properties?.className;
  const list = Array.isArray(c) ? c : typeof c === 'string' ? c.split(/\s+/) : [];
  return list.includes(cls);
}

/** Remove every <footer class="cr-page-foot"> from a fragment tree, in place. Idempotent. */
export function stripPageFoot(tree: Root): void {
  const prune = (node: Root | Element): void => {
    node.children = node.children.filter(
      (ch) => !(ch.type === 'element' && ch.tagName === 'footer' && hasClass(ch, 'cr-page-foot')),
    );
    for (const ch of node.children) {
      if (ch.type === 'element') prune(ch);
    }
  };
  prune(tree);
}

/** Append the canonical footer (parsed) as the LAST child of the fragment's root element. */
export function injectCanonicalFooter(tree: Root, canonicalFooterHtml: string): void {
  const footTree = parseFragment(canonicalFooterHtml);
  const root = tree.children.find((c): c is Element => c.type === 'element');
  if (!root) return; // defensive: no root element → nothing to attach to
  // A fragment parse yields only element/text content (never a Doctype), but RootContent
  // is wider — narrow to ElementContent so the append is type-safe.
  for (const ch of footTree.children) {
    if (ch.type === 'element' || ch.type === 'text' || ch.type === 'comment') {
      root.children.push(ch);
    }
  }
}
