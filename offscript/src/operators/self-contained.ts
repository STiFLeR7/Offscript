import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';

/**
 * Tier-0 website rail: self-contained (the single-file HARD invariant — "no
 * CDN, no external refs, no framework runtime").
 *
 * The deliverable is ONE self-contained HTML file. This rail enforces that
 * invariant mechanically by flagging the unambiguous ways a fragment breaks it:
 *   - `<script src="…">`     where src is not a `data:` URI (an external/CDN script)
 *   - `<link rel=stylesheet href="…">` where href is not a `data:` URI (external CSS)
 *   - any element still carrying `data-lucide="…"` (an un-materialised icon
 *     placeholder — on the website path icons must be authored as inline <svg>;
 *     the harden/flatten path substitutes these to inline svg BEFORE validate,
 *     so a residual one means a generate-path author left a CDN dependency)
 *   - `@import` or `url(http(s)://…)` / `url(//…)` inside a <style> block
 *     (an external stylesheet / asset pulled at runtime)
 *
 * These are all binary, zero-judgment checks (low false-positive). Warn-only in
 * v1, matching the other charter rails; the fix is always "inline it" and is a
 * mechanical author change, not a frozen decision. Never mutates. Website-track
 * only (defaultRegistry, not collateralRegistry).
 */
const EXTERNAL_URL = /(^|[\s:,(])(https?:)?\/\//i;
const CSS_EXTERNAL = /@import\b|url\(\s*['"]?\s*(https?:)?\/\//i;

function styleText(el: Element): string {
  const f = el.children[0];
  return f && f.type === 'text' ? f.value : '';
}

function isExternalRef(url: string): boolean {
  const u = url.trim();
  if (u === '' || u.startsWith('data:') || u.startsWith('#')) return false;
  return EXTERNAL_URL.test(u);
}

function relIsStylesheet(rel: unknown): boolean {
  if (Array.isArray(rel)) return rel.some((r) => String(r).toLowerCase() === 'stylesheet');
  return typeof rel === 'string' && rel.toLowerCase().split(/\s+/).includes('stylesheet');
}

export const selfContained: Operator = {
  name: 'self-contained',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const findings: Finding[] = [];
    let lucide = 0;
    let cssExternal = 0;

    visitElements(tree, (el) => {
      // external <script src>
      if (el.tagName === 'script') {
        const src = el.properties?.src;
        if (typeof src === 'string' && isExternalRef(src)) {
          findings.push({
            id: `self-contained:external-script:${src}`,
            description: `external <script src="${src}"> — the deliverable is a single self-contained file; inline the script (no CDN runtime).`,
            outcome: 'warning',
          });
        }
      }
      // external <link rel=stylesheet href>
      if (el.tagName === 'link' && relIsStylesheet(el.properties?.rel)) {
        const href = el.properties?.href;
        if (typeof href === 'string' && isExternalRef(href)) {
          findings.push({
            id: `self-contained:external-stylesheet:${href}`,
            description: `external stylesheet <link href="${href}"> — inline the CSS in a <style> block (no external sheet).`,
            outcome: 'warning',
          });
        }
      }
      // un-materialised lucide placeholder
      if (typeof el.properties?.dataLucide === 'string' && el.properties.dataLucide !== '') {
        lucide += 1;
      }
      // external refs inside a <style> block (@import / url(http…))
      if (el.tagName === 'style') {
        const css = styleText(el);
        if (css && CSS_EXTERNAL.test(css)) cssExternal += 1;
      }
    });

    if (lucide > 0) {
      findings.push({
        id: `self-contained:data-lucide:${lucide}`,
        description: `${lucide} un-materialised data-lucide placeholder(s) — author icons as inline <svg> (the single-file output carries no Lucide CDN).`,
        outcome: 'warning',
      });
    }
    if (cssExternal > 0) {
      findings.push({
        id: `self-contained:css-external-ref:${cssExternal}`,
        description: `${cssExternal} <style> block(s) with an @import or url(http(s)://…) — inline the asset as a data: URI (no runtime fetch).`,
        outcome: 'warning',
      });
    }
    return findings;
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
