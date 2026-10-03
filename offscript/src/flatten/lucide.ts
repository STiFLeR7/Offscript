import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import type { Root, Element, ElementContent } from 'hast';

const require = createRequire(import.meta.url);

/** Directory holding lucide-static's raw kebab-case SVG files (one per icon). */
const ICONS_DIR = require.resolve('lucide-static/package.json').replace(/package\.json$/, 'icons/');

/** Lucide icon names are kebab-case; reject anything that could escape the icons dir. */
function isSafeIconName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/** Read an icon's SVG markup by its kebab-case name, or undefined if unknown. */
function loadIconSvg(name: string): string | undefined {
  if (!isSafeIconName(name)) return undefined;
  try {
    return readFileSync(`${ICONS_DIR}${name}.svg`, 'utf8');
  } catch {
    return undefined;
  }
}

/** Pull a width/height/stroke-width override out of an inline style string. */
function styleValue(style: string | undefined, prop: string): string | undefined {
  if (!style) return undefined;
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = re.exec(style);
  if (!m) return undefined;
  // strip a trailing px unit so it becomes a bare svg attribute value
  return m[1].trim().replace(/px$/i, '').trim();
}

/** Resolve a sizing override from the placeholder: explicit attribute wins over style. */
function override(placeholder: Element, attr: string, styleProp: string): string | undefined {
  const props = placeholder.properties ?? {};
  const direct = props[attr];
  if (direct !== undefined && direct !== null && direct !== '') return String(direct);
  const style = typeof props.style === 'string' ? props.style : undefined;
  return styleValue(style, styleProp);
}

/** Parse an SVG string into its single root <svg> hast Element. */
function parseSvg(svg: string): Element | undefined {
  const tree = fromHtml(svg, { fragment: true });
  for (const child of tree.children) {
    if (child.type === 'element' && child.tagName === 'svg') return child;
  }
  return undefined;
}

/** Build the substituted <svg> element for one placeholder, carrying over sizing/class. */
function buildSvg(placeholder: Element, svgMarkup: string): Element | undefined {
  const svg = parseSvg(svgMarkup);
  if (!svg) return undefined;
  svg.properties = svg.properties ?? {};

  const width = override(placeholder, 'width', 'width');
  if (width !== undefined) svg.properties.width = width;
  const height = override(placeholder, 'height', 'height');
  if (height !== undefined) svg.properties.height = height;
  const strokeWidth = override(placeholder, 'stroke-width', 'stroke-width');
  if (strokeWidth !== undefined) svg.properties.strokeWidth = strokeWidth;

  // carry over the placeholder's class (additive, after lucide's own classes)
  const cls = placeholder.properties?.className;
  if (Array.isArray(cls) && cls.length > 0) {
    const existing = Array.isArray(svg.properties.className) ? svg.properties.className : [];
    svg.properties.className = [...existing, ...cls.map(String)];
  }

  return svg;
}

/** Walk the tree, replacing any element carrying data-lucide in place. */
function substituteIn(parent: Root | Element, warnings: string[]): void {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.type !== 'element') continue;

    const name = child.properties?.['dataLucide'];
    if (typeof name === 'string' && name.length > 0) {
      const svgMarkup = loadIconSvg(name);
      if (svgMarkup === undefined) {
        warnings.push(`unknown lucide icon: "${name}"`);
        continue; // leave the placeholder intact
      }
      const svg = buildSvg(child, svgMarkup);
      if (svg === undefined) {
        warnings.push(`unknown lucide icon: "${name}"`);
        continue;
      }
      parent.children[i] = svg as ElementContent;
      continue; // svg replacement has no further data-lucide descendants
    }

    substituteIn(child, warnings);
  }
}

/**
 * Replace every element carrying `data-lucide="NAME"` in an HTML fragment with the
 * corresponding inline lucide-static `<svg>`. Sizing/stroke and class on the placeholder
 * are carried onto the emitted svg; unknown names are left in place with a warning.
 */
export function substituteLucide(html: string): { html: string; warnings: string[] } {
  const tree = fromHtml(html, { fragment: true }) as Root;
  const warnings: string[] = [];
  substituteIn(tree, warnings);
  return { html: toHtml(tree), warnings };
}
