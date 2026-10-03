import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { parseHtml, serializeHtml, visitElements } from '../working-rep.js';

/** True when the HTML looks like an A4 collateral doc (a .cr-doc container). */
export function isCollateral(html: string): boolean {
  return /class\s*=\s*["'][^"']*\bcr-doc\b/.test(html);
}

const MIME: Record<string, string> = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif',
};

function dataUri(absPath: string): string | undefined {
  if (!existsSync(absPath)) return undefined;
  const mime = MIME[extname(absPath).toLowerCase()];
  if (!mime) return undefined;
  const b64 = readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

/** Rewrite url(...) refs in a CSS string to data URIs, relative to cssBaseDir. */
function inlineCssUrls(css: string, cssBaseDir: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, _q, ref) => {
    if (/^(data:|https?:|#)/.test(ref)) return m;
    const uri = dataUri(resolve(cssBaseDir, ref));
    return uri ? `url(${uri})` : m;
  });
}

/** Extract a string class list from a hast element, regardless of array vs string. */
function getClassString(el: { properties?: Record<string, unknown> }): string {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String).join(' ');
  if (typeof cls === 'string') return cls;
  return '';
}

/** Extract the rel value as a string from a hast <link> element.
 *  hast represents rel as an array (e.g. ['stylesheet']). */
function getRelString(el: { properties?: Record<string, unknown> }): string {
  const rel = el.properties?.rel;
  if (Array.isArray(rel)) return rel.map(String).join(' ');
  if (typeof rel === 'string') return rel;
  return '';
}

export interface CollateralIntake {
  /** self-contained HTML (linked CSS inlined, url()/img assets → data URIs). */
  selfContained: string;
  /** number of .cr-page elements (the declared page count). */
  pageCount: number;
}

/**
 * Intake a finished A4 collateral artifact. `baseDir` is the directory the
 * artifact's relative hrefs resolve against (where the pasted file lives).
 */
export function intakeCollateral(html: string, baseDir: string): CollateralIntake {
  const tree = parseHtml(html);
  let pageCount = 0;

  visitElements(tree, (el) => {
    const cls = getClassString(el);
    if (/\bcr-page\b/.test(cls)) pageCount += 1;

    // <link rel=stylesheet href> → inline <style>
    if (el.tagName === 'link') {
      const rel = getRelString(el);
      const href = String(el.properties?.href ?? '');
      if (/stylesheet/i.test(rel) && href && !/^(https?:|data:)/.test(href)) {
        const cssPath = resolve(baseDir, href);
        if (existsSync(cssPath)) {
          const css = inlineCssUrls(readFileSync(cssPath, 'utf8'), dirname(cssPath));
          el.tagName = 'style';
          el.properties = {};
          el.children = [{ type: 'text', value: css }];
        }
      }
    }

    // <img src> → data URI
    if (el.tagName === 'img') {
      const src = String(el.properties?.src ?? '');
      if (src && !/^(https?:|data:)/.test(src)) {
        const uri = dataUri(resolve(baseDir, src));
        if (uri) (el.properties as Record<string, unknown>).src = uri;
      }
    }

    // inline <style> url() rewriting (handles style blocks already in the doc)
    if (el.tagName === 'style') {
      const first = el.children[0];
      if (first && first.type === 'text') first.value = inlineCssUrls(first.value, baseDir);
    }

    // inline style="...url()..." attribute rewriting
    const style = el.properties?.style;
    if (typeof style === 'string' && style.includes('url(')) {
      (el.properties as Record<string, unknown>).style = inlineCssUrls(style, baseDir);
    }
  });

  return { selfContained: serializeHtml(tree), pageCount };
}
