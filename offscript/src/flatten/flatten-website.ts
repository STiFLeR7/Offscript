/**
 * Flatten — Path C / P5: turn the validated MULTI-FILE website page into a single
 * self-contained deployable (the deliverable promise: "a single self-contained HTML file").
 *
 * The Path-C page (P3) is shell-rooted and multi-file: it links `colors_and_type.css`,
 * references `fonts/*.ttf`, and references `../assets/*` images (the fragments' avatars /
 * logos / backgrounds). The multi-file form stays the CANONICAL working artifact (what
 * validate-page + selection-diversity read). This pass derives the deployable from it:
 *
 *   1. AP5.1 — inline the linked `colors_and_type.css` as a `<style>` (the behaviour JS is
 *      already inline from P3; only the token sheet is external).
 *   2. AP5.2 — subset every referenced font to the page's used glyph set and inline it as a
 *      `data:` URI (see subset-fonts.ts) — the 2.3 MB → ~tens-of-KB bloat fix.
 *   3. AP5.3 — inline every referenced image asset (img src + CSS url()), resolving
 *      `…/assets/<rest>` against the surviving website asset root (v2AssetSource() — WS8
 *      repointed it to the in-repo `design_processes/website/assets/`; still `V2_ASSET_SOURCE`-
 *      overridable) — copy-on-use: only assets the page actually references travel. CSS `url()`
 *      assets are DEDUPED: each unique asset is hoisted to a `:root` custom property and
 *      dereferenced via `var()`, so a background used by N selectors inlines its base64 ONCE
 *      (PRISM's blur-7.png is referenced 5× — naive per-occurrence inlining ballooned the
 *      flat file to ~40 MB; hoisting collapses it to one copy). When the library ships a
 *      web-optimized sibling (`<dir>/web/<base>.{jpg,webp}`), the deployable carries THAT
 *      (`blur-7.png` 4.6 MB → `web/blur-7.jpg` 117 KB) — the only way to tame a heavy image
 *      repeated as multiple `<img src>`, which can't share a CSS var.
 *
 * STRING-LEVEL by design: every transform is a targeted replace, NOT a parse→serialize
 * round-trip. The Curation Table HTML comment leading <main> and the per-fragment
 * `data-crf` wrappers + scoped `<style>` must survive byte-for-byte so `validate-page.js`
 * still PASSES on the flattened form (AP5.4). A hast round-trip could re-emit comments /
 * attributes and break the gate; string edits touch only what they target.
 *
 * Idempotent enough: a re-run finds the link already inlined (no `<link rel=stylesheet>`)
 * and the font/asset urls already `data:` (skipped). Graceful: a missing font / asset / the
 * subsetter being absent never throws — the ref is left as-is (full font inlined / url kept)
 * and a warning is pushed, so the deployable still ships.
 */

import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve as resolvePath, join, dirname, basename, extname, relative } from 'node:path';
import { v2AssetSource } from '../paths.js';
import { MIME, isAbsoluteOrSkippable, stripSuffix, toDataUri } from './inline-assets.js';
import { collectUsedText, subsetFontToDataUri } from './subset-fonts.js';

const FONT_EXT = /\.(?:ttf|woff2?|otf)$/i;
const IMG_EXT = /\.(?:png|jpe?g|webp|gif|svg)$/i;

export interface FlattenWebsiteOptions {
  /** the multi-file page HTML (shell-rooted, links colors_and_type.css + fonts/). */
  html: string;
  /** dir where colors_and_type.css + fonts/ live beside the page (= the generate outDir). */
  baseDir: string;
  /** the website asset root (the `assets/` dir). Defaults to v2AssetSource() (WS8: the surviving in-repo root). */
  assetSource?: string;
  /** override the used-glyph text (else derived from the page). */
  usedText?: string;
}

export interface FlattenWebsiteResult {
  html: string;
  warnings: string[];
  stats: {
    /** raw font bytes BEFORE subsetting (sum of the full files the page referenced). */
    fontBytesBefore: number;
    /** raw font bytes AFTER subsetting (sum of the inlined subset fonts). */
    fontBytesAfter: number;
    /** distinct fonts inlined. */
    fonts: number;
    /** distinct image assets inlined. */
    assetsInlined: number;
    /** final deployable size in bytes (the returned html). */
    deployableBytes: number;
  };
}

/** Inline the linked token stylesheet (`<link rel="stylesheet" href="…">`) as a `<style>`. */
function inlineLinkedCss(html: string, baseDir: string, warnings: string[]): string {
  const linkRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
  return html.replace(linkRe, (tag) => {
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) return tag;
    const href = hrefMatch[1];
    if (isAbsoluteOrSkippable(href)) return tag; // CDN / absolute sheet — leave it
    const abs = resolvePath(baseDir, stripSuffix(href).path);
    if (!existsSync(abs)) {
      warnings.push(`flatten-website: linked stylesheet "${href}" not found at ${abs} — left as <link>`);
      return tag;
    }
    const css = readFileSync(abs, 'utf8');
    return `<style data-flattened="${href}">\n${css}\n</style>`;
  });
}

/**
 * Rewrite every font `url(...)` (across all now-inline <style> blocks) to a subset `data:`
 * URI. Each distinct font file is subset ONCE (cached by absolute path) to the page's used
 * glyph set. Already-`data:` font urls are left untouched (idempotent).
 */
function inlineFonts(
  html: string,
  baseDir: string,
  usedText: string,
  warnings: string[],
  stats: FlattenWebsiteResult['stats'],
): string {
  const cache = new Map<string, string | null>(); // abs path → dataUri (null = leave as-is)
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

  return html.replace(urlRe, (match, _q: string, raw: string) => {
    const url = raw.trim();
    if (isAbsoluteOrSkippable(url)) return match;
    const path = stripSuffix(url).path;
    if (!FONT_EXT.test(path)) return match; // not a font — handled by inlineImages
    const abs = resolvePath(baseDir, path);

    if (!cache.has(abs)) {
      if (!existsSync(abs)) {
        warnings.push(`flatten-website: font "${url}" not found at ${abs} — left as-is`);
        cache.set(abs, null);
      } else {
        const before = readFileSync(abs).length;
        const subset = subsetFontToDataUri(abs, usedText);
        if (subset) {
          stats.fontBytesBefore += before;
          stats.fontBytesAfter += subset.bytes;
          stats.fonts += 1;
          cache.set(abs, subset.dataUri);
        } else {
          // subsetter unavailable / failed → inline the FULL font so the page still ships.
          stats.fontBytesBefore += before;
          stats.fontBytesAfter += before;
          stats.fonts += 1;
          warnings.push(
            `flatten-website: subsetting unavailable for "${url}" — inlined the FULL font ` +
              `(install fonttools' pyftsubset to shrink it).`,
          );
          cache.set(abs, toDataUri(abs));
        }
      }
    }
    const dataUri = cache.get(abs);
    return dataUri ? `url(${dataUri})` : match;
  });
}

/**
 * Resolve an image ref to an absolute path. `…/assets/<rest>` maps into the v2 asset
 * library (copy-on-use); anything else resolves against the page dir. Returns null when
 * the asset can't be found (caller warns + leaves the ref).
 */
/**
 * Deterministic basename search over the asset library (W50 Track 2). The curated
 * exemplar fragments carry flat/legacy `assets/<file>` refs (e.g. `assets/logo-color.svg`,
 * `assets/creative-background/blur-7.png`) that do NOT mirror the nested v2 library layout
 * (`assets/logo/…`, `assets/imagery/backgrounds/…`, `assets/imagery/textures/…`). When the
 * direct join misses, resolve by unique basename so the deployable is ACTUALLY self-contained.
 * Returns the single match, or null when there are zero OR ≥2 matches (never guesses — an
 * ambiguous or absent asset stays unresolved and is surfaced as a warning by the caller).
 */
/** Normalise a filename to a logical stem: drop extension and a trailing `-web` variant marker. */
function assetStem(name: string): string {
  return basename(name, extname(name)).replace(/-web$/i, '');
}

interface AssetIndex {
  /** exact basename → path, or `null` when the basename appears ≥2× (ambiguous). */
  byBasename: Map<string, string | null>;
  /** logical stem → path (optimized `-web` variant preferred), or `null` when ambiguous. */
  byStem: Map<string, string | null>;
}
const assetIndexCache = new Map<string, AssetIndex>();
function buildAssetIndex(root: string): AssetIndex {
  const byBasename = new Map<string, string | null>();
  const stemFiles = new Map<string, string[]>();
  const walk = (dir: string): void => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        byBasename.set(e.name, byBasename.has(e.name) ? null : full);
        const stem = assetStem(e.name);
        (stemFiles.get(stem) ?? stemFiles.set(stem, []).get(stem)!).push(full);
      }
    }
  };
  if (existsSync(root)) walk(root);
  const byStem = new Map<string, string | null>();
  for (const [stem, files] of stemFiles) {
    // A stem group is a single logical asset ONLY when every member shares the same raw
    // base name up to a `-web` variant marker (master + its web variant). If two members
    // are genuinely different images that merely share a stem, abstain (null).
    const rawBases = new Set(files.map((f) => basename(f, extname(f)).replace(/-web$/i, '')));
    if (rawBases.size !== 1) {
      byStem.set(stem, null);
      continue;
    }
    // Prefer the optimized `-web` variant; else the sole/first (deterministic — walk is sorted).
    const web = files.find((f) => /-web$/i.test(basename(f, extname(f))));
    byStem.set(stem, web ?? files[0]);
  }
  return { byBasename, byStem };
}

/**
 * Resolve a fragment asset ref by its filename against the library, tolerant of layout drift:
 * (1) exact basename (unique), else (2) logical stem — the master and its `-web` optimized
 * sibling are one asset, and the `-web` variant is preferred. Abstains (null) on zero or
 * genuinely-ambiguous matches; never guesses between different images.
 */
function findAssetByName(root: string, refBasename: string): string | null {
  let index = assetIndexCache.get(root);
  if (!index) {
    index = buildAssetIndex(root);
    assetIndexCache.set(root, index);
  }
  const exact = index.byBasename.get(refBasename);
  if (exact) return exact;
  if (exact === null) return null; // ambiguous basename → never guess
  return index.byStem.get(assetStem(refBasename)) ?? null;
}

function resolveImageRef(url: string, baseDir: string, assetSource: string): string | null {
  const path = stripSuffix(url).path;
  if (path === '') return null;
  const assetMatch = path.match(/(?:^|\/)assets\/(.+)$/);
  if (assetMatch) {
    const abs = join(assetSource, assetMatch[1]);
    if (existsSync(abs)) return preferWebVariant(abs);
    // Fallback: the fragment's ref path may not mirror the library layout — resolve by
    // filename (exact basename, then logical stem preferring the `-web` variant). Deterministic;
    // abstains on zero/ambiguous matches.
    const byName = findAssetByName(assetSource, basename(assetMatch[1]));
    return byName ? preferWebVariant(byName) : null;
  }
  const abs = resolvePath(baseDir, path);
  return existsSync(abs) ? abs : null;
}

/**
 * Prefer a web-optimized sibling variant if the asset library ships one. The v2 library
 * keeps `<dir>/web/<base>.{jpg,webp}` next to a full-resolution master (e.g.
 * `creative-background/blur-7.png` 4.6 MB → `creative-background/web/blur-7.jpg` 117 KB).
 * A deployable should carry the web variant — a ~40× cut on heavy backgrounds, and the only
 * way to tame a heavy image repeated as multiple `<img src>` (which can't share a CSS var).
 * Returns the original when no variant exists (e.g. avatars — already small).
 */
function preferWebVariant(abs: string): string {
  const dir = dirname(abs);
  const base = basename(abs, extname(abs));
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    const cand = join(dir, 'web', `${base}.${ext}`);
    if (cand !== abs && existsSync(cand)) return cand;
  }
  return abs;
}

/** Inline every referenced image asset — `<img src>`/`<source src>` + CSS `url()` images. */
function inlineImages(
  html: string,
  baseDir: string,
  assetSource: string,
  warnings: string[],
  stats: FlattenWebsiteResult['stats'],
): string {
  const cache = new Map<string, string | null>();
  const seen = new Set<string>();
  const inline = (url: string): string | null => {
    if (isAbsoluteOrSkippable(url)) return null;
    if (!IMG_EXT.test(stripSuffix(url).path)) return null;
    if (!cache.has(url)) {
      const abs = resolveImageRef(url, baseDir, assetSource);
      if (abs === null) {
        warnings.push(`flatten-website: image asset "${url}" unresolved — left as-is`);
        cache.set(url, null);
      } else {
        cache.set(url, toDataUri(abs));
        if (!seen.has(abs)) {
          seen.add(abs);
          stats.assetsInlined += 1;
        }
      }
    }
    return cache.get(url) ?? null;
  };

  // <img src="…"> / <source src="…"> — inlined DIRECTLY (an <img src> can't reference a
  // CSS var, and avatars are small + rarely repeated).
  let out = html.replace(/(<(?:img|source)\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, (m, pre, q, url) => {
    const data = inline(url);
    return data ? `${pre}${q}${data}${q}` : m;
  });

  // CSS url(...) images (inline <style> + style="…") — HOISTED to :root custom properties
  // and dereferenced via var(). DEDUP is the whole point: a large background referenced by N
  // selectors (PRISM's blur-7.png is used 5×) would otherwise inline its full base64 N times
  // (40 MB). Keyed by the resolved data URI so the same file via different paths collapses to
  // one copy. Font url()s are already `data:`/skippable, so `inline` returns null and they pass
  // through untouched.
  const varByUri = new Map<string, string>(); // dataUri → --flat-img-N
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, _q, raw) => {
    const data = inline(raw.trim());
    if (!data) return m;
    let name = varByUri.get(data);
    if (!name) {
      name = `--flat-img-${varByUri.size}`;
      varByUri.set(data, name);
    }
    return `var(${name})`;
  });

  // Inject the single :root block holding each unique asset's data URI exactly once.
  if (varByUri.size > 0) {
    const decls = [...varByUri.entries()].map(([uri, name]) => `${name}:url(${uri})`).join(';');
    const block = `<style data-flat-assets>:root{${decls}}</style>`;
    out = out.includes('</head>') ? out.replace('</head>', `${block}\n</head>`) : `${block}\n${out}`;
  }
  return out;
}

/**
 * Flatten a multi-file Path-C website page into a single self-contained deployable:
 * inline the token sheet, subset+inline fonts, inline image assets. String-level — the
 * Curation Table comment + data-crf wrappers survive so validate-page still passes.
 */
export function flattenWebsite(opts: FlattenWebsiteOptions): FlattenWebsiteResult {
  const { html, baseDir } = opts;
  const assetSource = opts.assetSource ?? v2AssetSource();
  const usedText = opts.usedText ?? collectUsedText(html);
  const warnings: string[] = [];
  const stats: FlattenWebsiteResult['stats'] = {
    fontBytesBefore: 0,
    fontBytesAfter: 0,
    fonts: 0,
    assetsInlined: 0,
    deployableBytes: 0,
  };

  let out = inlineLinkedCss(html, baseDir, warnings);
  out = inlineFonts(out, baseDir, usedText, warnings, stats);
  out = inlineImages(out, baseDir, assetSource, warnings, stats);

  // A remaining CDN <script src> (e.g. Lucide) is the one non-self-contained ref P5 does
  // not inline — surface it honestly rather than overclaim "self-contained".
  if (/<script\b[^>]*\bsrc=["']https?:/i.test(out)) {
    warnings.push(
      'flatten-website: a CDN <script src="https://…"> remains (e.g. Lucide) — not inlined by P5; ' +
        'the deployable still depends on that CDN at runtime.',
    );
  }

  stats.deployableBytes = Buffer.byteLength(out, 'utf8');
  return { html: out, warnings, stats };
}

export interface CopyOnUseResult {
  /** the page HTML with `…/assets/<rest>` refs rewritten to the sibling `assets/<rest>`. */
  html: string;
  warnings: string[];
  /** distinct assets copied into `<outDir>/assets/`. */
  copied: number;
}

/**
 * Copy-on-use assets for the MULTI-FILE form (AP5.3): the P3 page pastes fragments whose
 * image refs are catalog-root-relative (`../assets/avatars/x.jpg`), which don't resolve
 * beside the generated page. This resolves each referenced asset from the v2 asset library,
 * copies ONLY those (never the whole asset root) into `<outDir>/assets/<rest>`, and rewrites
 * the ref to the working-dir-relative `assets/<rest>` — so the canonical multi-file
 * `index.html` actually renders its images. The Curation Table comment + data-crf wrappers
 * are untouched (string-level), so the gate is unaffected.
 */
export function copyOnUseAssets(opts: {
  html: string;
  outDir: string;
  assetSource?: string;
}): CopyOnUseResult {
  const assetSource = opts.assetSource ?? v2AssetSource();
  const warnings: string[] = [];
  const seen = new Set<string>();
  let copied = 0;

  const rewrite = (url: string): string | null => {
    if (isAbsoluteOrSkippable(url)) return null;
    const path = stripSuffix(url).path;
    const m = path.match(/(?:^|\/)assets\/(.+)$/);
    if (!m || !IMG_EXT.test(path)) return null;
    const rest = m[1];
    const src = join(assetSource, rest);
    if (!existsSync(src)) {
      warnings.push(`copy-on-use: asset "${url}" unresolved at ${src} — left as-is`);
      return null;
    }
    // Prefer the web-optimized variant; mirror its path under the deliverable's assets/.
    const chosen = preferWebVariant(src);
    const restOut = relative(assetSource, chosen).replace(/\\/g, '/');
    const dest = join(opts.outDir, 'assets', restOut);
    if (!seen.has(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(chosen, dest);
      seen.add(dest);
      copied += 1;
    }
    return `assets/${restOut}`;
  };

  let out = opts.html.replace(/(<(?:img|source)\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, (mAll, pre, q, url) => {
    const next = rewrite(url);
    return next ? `${pre}${q}${next}${q}` : mAll;
  });
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (mAll, q, raw) => {
    const next = rewrite(raw.trim());
    return next ? `url(${q}${next}${q})` : mAll;
  });
  return { html: out, warnings, copied };
}
