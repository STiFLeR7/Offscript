/**
 * Flatten — inline every relative asset reference as a `data:` URI.
 *
 * After `assembleDocument` stitches the static HTML together, the body markup
 * still carries the original JSX-relative paths (e.g. `<img src="../../assets/
 * logo.svg">`) and the inlined `colors_and_type.css` still carries its
 * kit-root-relative `url(...)` refs (e.g. `url("./fonts/Inter.ttf")` or
 * `url(./assets/hero-bg.png)`). From the eventual output file's location these
 * paths don't resolve — so the logo silently 404s and brand fonts fall back to
 * system defaults.
 *
 * v1's contract is a "single self-contained HTML file with embedded CSS", so
 * every relative URL is rewritten to a `data:` URI sourced from the kit:
 *
 *   - `<img src>` / `<source src>` and inline `style="…url(…)…"` use the HARNESS
 *     directory (`<kit.dir>/ui_kits/website/`) as the resolution base — that is
 *     where the JSX components author their paths relative to.
 *   - `<style>` block contents use the KIT ROOT (`<kit.dir>`) as the resolution
 *     base — that is where `colors_and_type.css` (which authored those refs)
 *     lives on disk.
 *
 * Already-absolute (`data:`, `http:`, `https:`, `//`) and anchor-only (`#…`)
 * refs are left untouched. Unresolved relative refs are warned (not thrown) and
 * left as-is so the rest of the document still ships. Idempotent: a second pass
 * touches no `data:` URIs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname, extname, isAbsolute } from 'node:path';
import type { Element } from 'hast';
import type { WebsiteKit } from '../intake.js';
import { parseHtml, serializeHtml, visitElements } from '../working-rep.js';

/** Extension → MIME map for the small set the kit actually uses. */
export const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
};

/** Is this URL one we should NOT rewrite? */
export function isAbsoluteOrSkippable(url: string): boolean {
  const u = url.trim();
  if (u === '') return true;
  if (u.startsWith('data:')) return true;
  if (u.startsWith('http://') || u.startsWith('https://')) return true;
  if (u.startsWith('//')) return true;
  if (u.startsWith('#')) return true;
  // mailto:, tel:, javascript:, etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return true;
  return false;
}

/** Strip a `#fragment` or `?query` suffix off a relative path before resolving on disk. */
export function stripSuffix(url: string): { path: string; suffix: string } {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  let cut = -1;
  if (hash >= 0 && query >= 0) cut = Math.min(hash, query);
  else cut = Math.max(hash, query);
  if (cut < 0) return { path: url, suffix: '' };
  return { path: url.slice(0, cut), suffix: url.slice(cut) };
}

/**
 * Encode a file at `absPath` as a `data:` URI. SVG is utf8-encoded (smaller +
 * dev-tools-readable); everything else is base64.
 */
export function toDataUri(absPath: string): string {
  const ext = extname(absPath).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  if (ext === '.svg') {
    const text = readFileSync(absPath, 'utf8');
    // Minimal escape: # and % break the URI; ' and " collide with the attr quote;
    // newlines are illegal in unquoted data: URIs.
    const escaped = text
      .replace(/%/g, '%25')
      .replace(/#/g, '%23')
      .replace(/"/g, '%22')
      .replace(/'/g, '%27')
      .replace(/\r?\n/g, '%0A')
      .replace(/\s+/g, ' ')
      .trim();
    return `data:${mime};utf8,${escaped}`;
  }
  const buf = readFileSync(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Resolve a (possibly fragment/query-suffixed) URL against a base dir. Returns
 * the absolute path if the file exists on disk, otherwise `null`.
 */
function resolveAsset(url: string, baseDir: string): string | null {
  const { path } = stripSuffix(url);
  if (path === '') return null;
  const abs = isAbsolute(path) ? path : resolvePath(baseDir, path);
  if (!existsSync(abs)) return null;
  return abs;
}

/**
 * Try to inline a single URL. Returns the rewritten value (a `data:` URI) on
 * success, or `null` if the URL was already absolute / a fragment / unresolved
 * (caller decides whether to warn for the unresolved case).
 */
function inlineUrl(url: string, baseDir: string): string | null {
  if (isAbsoluteOrSkippable(url)) return null;
  const abs = resolveAsset(url, baseDir);
  if (abs === null) return null;
  return toDataUri(abs);
}

/**
 * Rewrite every `url(...)` token in a CSS string against `baseDir`. Pushes a
 * warning for each unresolved relative ref; leaves it as-is in the output.
 *
 * Exported so the generate pipeline can inline the brand CSS's relative
 * `@font-face { src: url("fonts/*.ttf") }` refs directly (they live in the brand
 * dir, not on the eventual output's path). Additive export — no behaviour change.
 */
export function rewriteCssUrls(css: string, baseDir: string, warnings: string[]): string {
  // Match url(...) with optional single/double quotes. Captures the inner URL.
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  return css.replace(re, (_match, quote: string, raw: string) => {
    const url = raw.trim();
    if (isAbsoluteOrSkippable(url)) return `url(${quote}${raw}${quote})`;
    const abs = resolveAsset(url, baseDir);
    if (abs === null) {
      warnings.push(`inline-assets: unresolved CSS url(${url}) — left as-is`);
      return `url(${quote}${raw}${quote})`;
    }
    const dataUri = toDataUri(abs);
    // Use no quotes — data: URIs contain only safe chars from our encoders.
    return `url(${dataUri})`;
  });
}

/** Text content of a hast element (concatenated direct text children). */
function textOf(el: Element): string {
  return el.children
    .filter((c): c is { type: 'text'; value: string } => c.type === 'text')
    .map((c) => c.value)
    .join('');
}

/** Explicit resolution bases for the inliner (markup vs <style> blocks). */
export interface InlineBase {
  /** Resolution base for body-markup refs (<img src>, srcset, inline style url()). */
  markupBaseDir: string;
  /** Resolution base for embedded <style> block url() refs. */
  styleBaseDir: string;
}

/**
 * Walk the document and rewrite every relative asset reference to a `data:` URI, resolving against
 * the given explicit bases. The kit-driven `inlineAssets` below delegates here; the generate stage
 * passes a GOVERNANCE imagery dir for both bases (Fix A). See module docblock for the dual-base rule.
 */
export function inlineAssetsFrom(
  html: string,
  base: InlineBase,
): { html: string; warnings: string[] } {
  const warnings: string[] = [];
  const harnessDir = base.markupBaseDir;
  const kitRoot = base.styleBaseDir;

  const tree = parseHtml(html);

  visitElements(tree, (el) => {
    // <img src="..."> / <source src="...">
    if (el.tagName === 'img' || el.tagName === 'source') {
      const props = (el.properties ??= {});
      const src = props.src;
      if (typeof src === 'string' && !isAbsoluteOrSkippable(src)) {
        const abs = resolveAsset(src, harnessDir);
        if (abs === null) {
          warnings.push(`inline-assets: unresolved <${el.tagName} src="${src}"> — left as-is`);
        } else {
          props.src = toDataUri(abs);
        }
      }
      // <img srcset> / <source srcset> — rewrite each candidate.
      const srcset = props.srcSet ?? props.srcset;
      if (typeof srcset === 'string') {
        const rewritten = srcset
          .split(',')
          .map((cand) => {
            const trimmed = cand.trim();
            if (trimmed === '') return cand;
            // "<url> <descriptor>" — split on first whitespace.
            const m = trimmed.match(/^(\S+)(\s+\S+)?$/);
            if (!m) return cand;
            const url = m[1];
            const desc = m[2] ?? '';
            const inlined = inlineUrl(url, harnessDir);
            if (inlined === null) {
              if (!isAbsoluteOrSkippable(url)) {
                warnings.push(`inline-assets: unresolved srcset url "${url}" — left as-is`);
              }
              return cand;
            }
            return `${inlined}${desc}`;
          })
          .join(', ');
        if (props.srcSet !== undefined) props.srcSet = rewritten;
        else props.srcset = rewritten;
      }
    }

    // Inline style="..." anywhere.
    const styleAttr = el.properties?.style;
    if (typeof styleAttr === 'string' && styleAttr.includes('url(')) {
      const next = rewriteCssUrls(styleAttr, harnessDir, warnings);
      if (next !== styleAttr) (el.properties ??= {}).style = next;
    }

    // Embedded <style> blocks — resolve against the KIT ROOT (that's where the
    // CSS source file authored its url(...) refs).
    if (el.tagName === 'style') {
      const css = textOf(el);
      if (css.includes('url(')) {
        const next = rewriteCssUrls(css, kitRoot, warnings);
        if (next !== css) {
          el.children = [{ type: 'text', value: next }];
        }
      }
    }
  });

  return { html: serializeHtml(tree), warnings };
}

/**
 * Back-compat kit caller: resolve both bases from the kit and delegate. Behavior unchanged —
 * <img>/srcset/inline-style resolve against the website harness dir, <style> blocks against the
 * kit root, exactly as before the explicit-base extraction.
 */
export function inlineAssets(
  html: string,
  kit: WebsiteKit,
): { html: string; warnings: string[] } {
  return inlineAssetsFrom(html, {
    markupBaseDir: dirname(resolvePath(kit.dir, 'ui_kits', 'website', 'index.html')),
    styleBaseDir: kit.dir,
  });
}
