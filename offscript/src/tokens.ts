import { parseCssStrict } from './css-rep.js';

/** The canonical brand-kit token model: the rewrite target (§5.5). */
export interface TokenModel {
  /** ordered flattened custom properties: "--color-accent" -> "#2563eb" */
  customProps: Map<string, string>;
  /** normalized literal value -> var name, for reverse rewrite: "#2563eb" -> "--color-accent" */
  valueToVar: Map<string, string>;
}

function flatten(obj: Record<string, unknown>, prefix: string, out: Map<string, string>): void {
  for (const [key, val] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      flatten(val as Record<string, unknown>, name, out);
    } else {
      out.set(`--${name}`, String(val));
    }
  }
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Build the canonical TokenModel from a customProps map (first-wins reverse map). */
function buildModel(customProps: Map<string, string>): TokenModel {
  const valueToVar = new Map<string, string>();
  for (const [varName, value] of customProps) {
    const key = normalizeValue(value);
    if (!valueToVar.has(key)) valueToVar.set(key, varName);
  }
  return { customProps, valueToVar };
}

/** Parse a brand-kit tokens.json string into the canonical TokenModel. */
export function loadTokens(tokensJson: string): TokenModel {
  const data = JSON.parse(tokensJson) as Record<string, unknown>;
  const customProps = new Map<string, string>();
  flatten(data, '', customProps);
  return buildModel(customProps);
}

/**
 * Parse a brand-kit colors_and_type.css string (CSS custom properties +
 * @font-face) into the canonical TokenModel. Collects every custom property
 * (declaration whose prop starts with `--`) from ANY rule; ignores everything
 * else (including @font-face, which carries no `--*` declarations).
 */
export function loadTokensFromCss(css: string): TokenModel {
  // Strict: the brand token sheet is load-bearing governance — a malformed sheet must fail
  // loud, not silently yield zero tokens (unlike a tolerable malformed input <style> block).
  const root = parseCssStrict(css);
  const customProps = new Map<string, string>();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) {
      customProps.set(decl.prop, decl.value.trim());
    }
  });
  return buildModel(customProps);
}

/** Render the canonical token block embedded into each deliverable (keeps it single-file). */
export function renderTokenCss(model: TokenModel): string {
  const decls = [...model.customProps].map(([n, v]) => `${n}: ${v}`).join('; ');
  return `:root { ${decls} }`;
}
