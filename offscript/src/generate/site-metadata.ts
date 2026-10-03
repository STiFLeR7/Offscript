/**
 * Site metadata — production, fully PROJECT-OWNED website `<head>` (Phase 4/5 hardening).
 *
 * The recovered shell head is intentionally minimal (charset / viewport / title). A production
 * client site needs full SEO + social + PWA metadata, and — as a project-owned rule — every value
 * must derive from PROJECT DATA and NEVER default to Example Brand. Sources, in order:
 *
 *   1. projects/<client>/references/site-metadata.json — the client's own declared metadata.
 *   2. the brief — title/description/siteName fall back to the one-liner + brand.
 *   3. absent → the tag is OMITTED (fail-closed; never a house placeholder).
 *
 * Icon/manifest LINKS are emitted only when the client declares the asset path — the design
 * system does not synthesize a client's favicon (that asset is the project's to own). Applied
 * to the flattened deployable AFTER assembly.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectReferencesDir } from '../paths.js';
import type { Brief } from './brief.js';

export interface SiteMetadata {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  siteName?: string;
  locale?: string;
  robots?: string;
  themeColor?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterSite?: string;
  favicon?: string;
  appleTouchIcon?: string;
  manifest?: string;
  copyright?: string;
  organization?: {
    name?: string;
    url?: string;
    logo?: string;
    sameAs?: string[];
  };
}

/** Load the client's declared metadata, or `{}` when none is present. */
export function loadSiteMetadata(client: string): SiteMetadata {
  const path = join(projectReferencesDir(client), 'site-metadata.json');
  if (!existsSync(path)) return {};
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as SiteMetadata) ?? {};
  } catch (err) {
    throw new Error(`site-metadata.json: parse error at ${path} — ${(err as Error).message}`);
  }
}

function escapeAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `<` inside a `<script type="application/ld+json">` must be escaped so it can't break out. */
function escapeJsonLd(json: string): string {
  return json.replace(/</g, '\\u003c');
}

/**
 * The effective, resolved metadata: explicit client values win; the brief fills title /
 * description / siteName; nothing else is invented. Never yields a Example Brand value.
 */
export function resolveMetadata(meta: SiteMetadata, brief: Brief): SiteMetadata {
  const title = meta.title ?? brief.oneLiner ?? brief.brand;
  const description = meta.description ?? brief.oneLiner;
  const siteName = meta.siteName ?? brief.brand;
  return {
    ...meta,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
  };
}

/**
 * Build the ordered list of `<head>` metadata tags from resolved project data. Each tag is
 * emitted ONLY when its source value exists — absent → omitted (never a house default).
 */
export function buildMetadataTags(meta: SiteMetadata, brief: Brief): string[] {
  const m = resolveMetadata(meta, brief);
  const tags: string[] = [];
  const push = (v: string | undefined, tag: (val: string) => string): void => {
    if (v && v.trim()) tags.push(tag(v.trim()));
  };

  // SEO core
  push(m.description, (v) => `<meta name="description" content="${escapeAttr(v)}">`);
  push(m.canonicalUrl, (v) => `<link rel="canonical" href="${escapeAttr(v)}">`);
  push(m.robots, (v) => `<meta name="robots" content="${escapeAttr(v)}">`);
  push(m.themeColor, (v) => `<meta name="theme-color" content="${escapeAttr(v)}">`);

  // Open Graph
  push(m.title, (v) => `<meta property="og:title" content="${escapeAttr(v)}">`);
  push(m.description, (v) => `<meta property="og:description" content="${escapeAttr(v)}">`);
  tags.push(`<meta property="og:type" content="${escapeAttr(m.ogType ?? 'website')}">`);
  push(m.canonicalUrl, (v) => `<meta property="og:url" content="${escapeAttr(v)}">`);
  push(m.siteName, (v) => `<meta property="og:site_name" content="${escapeAttr(v)}">`);
  push(m.ogImage, (v) => `<meta property="og:image" content="${escapeAttr(v)}">`);
  push(m.locale, (v) => `<meta property="og:locale" content="${escapeAttr(v)}">`);

  // Twitter / X
  tags.push(`<meta name="twitter:card" content="${escapeAttr(m.twitterCard ?? (m.ogImage ? 'summary_large_image' : 'summary'))}">`);
  push(m.title, (v) => `<meta name="twitter:title" content="${escapeAttr(v)}">`);
  push(m.description, (v) => `<meta name="twitter:description" content="${escapeAttr(v)}">`);
  push(m.ogImage, (v) => `<meta name="twitter:image" content="${escapeAttr(v)}">`);
  push(m.twitterSite, (v) => `<meta name="twitter:site" content="${escapeAttr(v)}">`);

  // Icons / PWA — links only when the client declares the asset path.
  push(m.favicon, (v) => `<link rel="icon" href="${escapeAttr(v)}">`);
  push(m.appleTouchIcon, (v) => `<link rel="apple-touch-icon" href="${escapeAttr(v)}">`);
  push(m.manifest, (v) => `<link rel="manifest" href="${escapeAttr(v)}">`);

  // Structured data — Organization + WebSite, only when there is an organization to describe.
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
    tags.push(
      `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(ld))}</script>`,
    );
  }
  return tags;
}

const WL_MARK = '<!--wl-meta-->';

/**
 * Inject the resolved metadata into the deployable's `<head>`: substitute the `<title>` when a
 * resolved title exists, then insert the metadata tags before `</head>`. Idempotent — a page
 * already carrying the marker is returned unchanged. No `<head>` → returned unchanged.
 */
export function applySiteMetadata(
  html: string,
  args: { client: string; brief: Brief; meta?: SiteMetadata },
): string {
  if (html.includes(WL_MARK) || !html.includes('</head>')) return html;
  const meta = args.meta ?? loadSiteMetadata(args.client);
  const resolved = resolveMetadata(meta, args.brief);

  let out = html;
  if (resolved.title) {
    const t = `<title>${escapeAttr(resolved.title)}</title>`;
    out = /<title>[\s\S]*?<\/title>/i.test(out)
      ? out.replace(/<title>[\s\S]*?<\/title>/i, t)
      : out.replace('</head>', `${t}\n</head>`);
  }

  const tags = buildMetadataTags(meta, args.brief);
  const block = [WL_MARK, ...tags].join('\n');
  return out.replace('</head>', `${block}\n</head>`);
}
