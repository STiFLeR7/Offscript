import postcss from 'postcss';
import type { Root as CssRoot } from 'postcss';

/**
 * Parse a CSS string into the ephemeral working representation (postcss AST).
 *
 * TOLERANT by design. The operators run this over arbitrary INPUT `<style>` blocks, and a
 * single malformed block must NOT crash the whole rail run. In particular, 8 vendored v2
 * catalog fragments ship a broken "no shared CSS" placeholder block (a `build-fragments.js`
 * artifact: `<style>\n[data-crf="…"] ; no shared CSS.\n-->`) that postcss rejects with
 * "Unknown word [". An unparseable block yields an EMPTY AST — operators that walk it find
 * nothing there (correct degradation: you cannot analyze CSS you cannot parse), and the apply
 * paths guard on `changed > 0`, so an empty AST never wipes a block. Use {@link parseCssStrict}
 * for load-bearing CSS (the brand token sheet) where a parse failure must surface, not degrade.
 */
export function parseCss(css: string): CssRoot {
  try {
    return postcss.parse(css);
  } catch {
    return postcss.parse('');
  }
}

/**
 * Strict parse — throws CssSyntaxError on malformed CSS. For load-bearing sheets (the brand
 * token sheet, src/tokens.ts) where a parse failure means the governance input is broken and
 * must fail loud, not degrade silently.
 */
export function parseCssStrict(css: string): CssRoot {
  return postcss.parse(css);
}

/** Serialize the CSS working representation back to a string. */
export function serializeCss(root: CssRoot): string {
  return root.toString();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace each canonical token literal in a single declaration value with var(--name).
 * Matches a literal only as a standalone token (boundary before, no word/hyphen char after),
 * so it never corrupts a longer value like `#2563ebff` or `18px`. Case-insensitive.
 * Longer literals are tried first so they win over shorter substrings.
 */
export function replaceLiterals(
  value: string,
  valueToVar: Map<string, string>,
): { value: string; changed: number } {
  let out = value;
  let changed = 0;
  const entries = [...valueToVar.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [literal, varName] of entries) {
    const re = new RegExp(`(^|[\\s,(:])(${escapeRegExp(literal)})(?![\\w-])`, 'gi');
    out = out.replace(re, (_m, pre: string) => {
      changed++;
      return `${pre}var(${varName})`;
    });
  }
  return { value: out, changed };
}

/**
 * The single property-level inline-`style=""` rewriter. Split the attribute into
 * declarations, hand each `(prop, value)` to `rewrite`, and rebuild: a returned string is
 * the declaration's new value (rebuilt as `prop:newVal`, preserving the original property
 * text); `undefined` leaves the declaration verbatim. `changed` counts the rewritten
 * declarations. Parts with no `:` (and the trailing empty part after a `;`) pass through
 * untouched. The four operator-level inline parsers all funnel through here.
 */
export function rewriteInlineDecls(
  style: string,
  rewrite: (prop: string, value: string) => string | undefined,
): { style: string; changed: number } {
  let changed = 0;
  const rebuilt = style.split(';').map((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return part;
    const prop = part.slice(0, idx);
    const val = part.slice(idx + 1);
    const next = rewrite(prop, val);
    if (next === undefined) return part;
    changed += 1;
    return `${prop}:${next}`;
  });
  return { style: rebuilt.join(';'), changed };
}

/** Parse an inline style="" value into a property -> value map. Properties are trimmed and lowercased. */
export function parseInlineDecls(style: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of style.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop) out.set(prop, val);
  }
  return out;
}

/** Rewrite an inline style="" attribute value, skipping custom-property (--x) declarations. */
export function rewriteInlineStyle(
  style: string,
  valueToVar: Map<string, string>,
): { style: string; changed: number } {
  let changed = 0;
  const out = rewriteInlineDecls(style, (prop, val) => {
    if (prop.trim().startsWith('--')) return undefined;
    const r = replaceLiterals(val, valueToVar);
    changed += r.changed;
    return r.value;
  });
  return { style: out.style, changed };
}
