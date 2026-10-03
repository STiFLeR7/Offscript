/**
 * D2-S1 — RenderingIRHtmlRenderer: an EXPERIMENTAL HTML renderer whose only semantic input is
 * the Rendering IR (`RenderingIR`, `rendering-ir.ts`).
 *
 * Exists to VALIDATE the IR contract — does it carry enough to render a structurally faithful
 * document? — not to replace, influence, or flip the production renderer
 * (`assembleWebsiteBySelection` / `authorDocument`, both untouched). Per
 * `RENDERING_IR_ARCHITECTURE.md` §4/§9's own ownership split, this module IS the "Framework"
 * plane for one target (HTML): it implements PRESENTATION — tag choice, attribute stamping,
 * escaping, `<head>` markup — which the IR itself must never carry.
 *
 * Purity (enforced by test — "the module imports only from rendering-ir.js"):
 *   - imports ONLY types + `validateRenderingIR` from `./rendering-ir.js`;
 *   - NEVER imports AuthoringPlan/DesignContext/PresentationIntent/Brief, any author module, the
 *     exemplar corpus (reconstruct-band/catalog/website-shell/website-assembly), or `node:fs`;
 *   - the shell, the landmark→tag map, and the metadata-tag builder below are all
 *     RENDERER-OWNED — independent reimplementations, not reuses, of the production shell
 *     (website-shell.ts) or the production metadata builder (site-metadata.ts) — reusing either
 *     would blur the very signal this renderer exists to produce (can the IR alone drive a
 *     renderer?).
 *   - pure and deterministic: identical RenderingIR in → byte-identical HTML out.
 *
 * See docs/offscript/D2-S1-HTML-RENDERER-OVER-RIR.md for the grounding, the parity analysis
 * against the production renderer, and every documented remaining difference.
 */
import {
  validateRenderingIR,
  type RenderingIR,
  type RenderingSection,
  type RenderingPage,
  type RenderingSlot,
  type RenderingMetadata,
} from './rendering-ir.js';

/** Renderer-owned default — the IR carries no locale-for-`<html lang>` source (D1-S4 §2: no
 *  project data exists anywhere in the pipeline for this; the production renderer hardcodes the
 *  identical default, author.ts:486). Not a gap this renderer can close on its own. */
export const RENDERER_DEFAULT_LANG = 'en';

/** Standard HTML5 element ↔ implicit ARIA-landmark-role mapping (not invented — this is the
 *  W3C HTML/ARIA correspondence table). Absent/unrecognized landmark → a generic `<section>`. */
const LANDMARK_TAGS: Readonly<Record<string, string>> = {
  main: 'main',
  nav: 'nav',
  contentinfo: 'footer',
  complementary: 'aside',
  region: 'section',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** `<` inside a `<script type="application/ld+json">` must be escaped so it can't break out. */
function escapeJsonLd(json: string): string {
  return json.replace(/</g, '\\u003c');
}

function renderSlot(slot: RenderingSlot): string {
  return `<p data-cr-slot="${escapeAttr(slot.name)}">${escapeHtml(slot.content)}</p>`;
}

/** Renders one RenderingSection: a landmark-appropriate wrapper stamped with every semantic
 *  attribute the IR carries — role/order/composition/presentation — and never anything else. */
function renderSection(section: RenderingSection): string {
  const tag = (section.landmark && LANDMARK_TAGS[section.landmark]) || 'section';
  const attrs = [
    `id="${escapeAttr(section.id)}"`,
    `data-cr-role="${escapeAttr(section.role)}"`,
    `data-cr-order="${section.order}"`,
    section.composition?.variant ? `data-cr-variant="${escapeAttr(section.composition.variant)}"` : '',
    section.composition?.surface ? `data-cr-surface="${escapeAttr(section.composition.surface)}"` : '',
    section.presentation ? `data-cr-presentation-medium="${escapeAttr(section.presentation.medium)}"` : '',
    section.presentation ? `data-cr-presentation-commitment="${escapeAttr(section.presentation.commitment)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const body = section.slots.map(renderSlot).join('\n');
  return `<${tag} ${attrs}>\n${body}\n</${tag}>`;
}

/** website: sections are placed directly (the shell IS the page; no extra wrapper — avoids a
 *  redundant landmark around a section that may already declare its own). Every other track:
 *  one generic page container per RenderingPage (collateral pages, deck slides). */
function renderPage(page: RenderingPage, track: RenderingIR['track']): string {
  const sections = page.sections.map(renderSection).join('\n');
  if (track === 'website') return sections;
  return `<article data-cr-page="${escapeAttr(page.id)}" data-cr-page-role="${escapeAttr(page.role)}">\n${sections}\n</article>`;
}

/** Renderer-owned `<head>` metadata builder — structurally mirrors the production renderer's own
 *  tag SHAPE (site-metadata.ts:90-140, an independent reimplementation, not a reuse) because both
 *  are producing standard SEO/OG/Twitter markup from the same semantic fields; every value comes
 *  ONLY from `RenderingMetadata` — no defaults invented beyond `og:type`/`twitter:card`, which the
 *  production renderer itself also defaults the identical way. */
function metaTags(m: RenderingMetadata): string[] {
  const tags: string[] = [];
  const push = (v: string | undefined, tag: (val: string) => string): void => {
    if (v && v.trim()) tags.push(tag(v.trim()));
  };

  push(m.description, (v) => `<meta name="description" content="${escapeAttr(v)}">`);
  push(m.canonicalUrl, (v) => `<link rel="canonical" href="${escapeAttr(v)}">`);
  push(m.robots, (v) => `<meta name="robots" content="${escapeAttr(v)}">`);
  push(m.themeColor, (v) => `<meta name="theme-color" content="${escapeAttr(v)}">`);

  push(m.title, (v) => `<meta property="og:title" content="${escapeAttr(v)}">`);
  push(m.description, (v) => `<meta property="og:description" content="${escapeAttr(v)}">`);
  tags.push(`<meta property="og:type" content="${escapeAttr(m.ogType ?? 'website')}">`);
  push(m.canonicalUrl, (v) => `<meta property="og:url" content="${escapeAttr(v)}">`);
  push(m.siteName, (v) => `<meta property="og:site_name" content="${escapeAttr(v)}">`);
  push(m.ogImage, (v) => `<meta property="og:image" content="${escapeAttr(v)}">`);
  push(m.locale, (v) => `<meta property="og:locale" content="${escapeAttr(v)}">`);

  tags.push(
    `<meta name="twitter:card" content="${escapeAttr(m.twitterCard ?? (m.ogImage ? 'summary_large_image' : 'summary'))}">`,
  );
  push(m.title, (v) => `<meta name="twitter:title" content="${escapeAttr(v)}">`);
  push(m.description, (v) => `<meta name="twitter:description" content="${escapeAttr(v)}">`);
  push(m.ogImage, (v) => `<meta name="twitter:image" content="${escapeAttr(v)}">`);
  push(m.twitterSite, (v) => `<meta name="twitter:site" content="${escapeAttr(v)}">`);

  push(m.favicon, (v) => `<link rel="icon" href="${escapeAttr(v)}">`);
  push(m.appleTouchIcon, (v) => `<link rel="apple-touch-icon" href="${escapeAttr(v)}">`);
  push(m.manifest, (v) => `<link rel="manifest" href="${escapeAttr(v)}">`);

  const org = m.organization;
  if (org && (org.name || org.url)) {
    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      ...(org.name ? { name: org.name } : {}),
      ...(org.url ? { url: org.url } : {}),
      ...(org.logo ? { logo: org.logo } : {}),
      ...(org.sameAs && org.sameAs.length ? { sameAs: org.sameAs } : {}),
    };
    tags.push(`<script type="application/ld+json">${escapeJsonLd(JSON.stringify(ld))}</script>`);
  }
  return tags;
}

export interface RenderingIRHtmlRenderResult {
  readonly html: string;
}

/**
 * Render a RenderingIR to a complete, self-contained HTML document. Pure and deterministic — no
 * I/O, no clock, no randomness. Fails loud (does not silently render) when the IR itself does not
 * validate (`validateRenderingIR`) — the same "measured, not claimed" posture every operator in
 * this codebase holds; a renderer that trusted unverified input would defeat the point of having
 * a validated contract at all.
 *
 * Consumes ONLY the given `RenderingIR` — no AuthoringPlan, no DesignContext, no brief, no
 * Generation state of any kind reaches this function or anything it calls.
 */
export function renderRenderingIRToHtml(rir: RenderingIR): RenderingIRHtmlRenderResult {
  const check = validateRenderingIR(rir);
  if (!check.valid) {
    throw new Error(`renderRenderingIRToHtml: invalid RenderingIR — ${check.errors.join('; ')}`);
  }

  const m = rir.document.metadata;
  const title = m.title ? escapeHtml(m.title) : '';
  const body = rir.document.pages.map((p) => renderPage(p, rir.track)).join('\n');

  // Title always renders (production sets <title> from brief.oneLiner unconditionally on every
  // track — author.ts:485). The SEO/OG/Twitter/icon/JSON-LD block is website-only, matching
  // production exactly: applySiteMetadata only ever runs in the website branch of Stage 4
  // (scripts/generate.ts:645-666) — collateral ships with no head-metadata injection at all.
  const html = [
    '<!doctype html>',
    `<html lang="${RENDERER_DEFAULT_LANG}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    title ? `<title>${title}</title>` : '',
    ...(rir.track === 'website' ? metaTags(m) : []),
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { html };
}
