import type { Root } from 'hast';
import { visitElements } from '../working-rep.js';
import { parseHex, contrastRatio, type Rgb } from '../color.js';
import { parseInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { TokenModel } from '../tokens.js';

const AA_NORMAL = 4.5;
const AA_LARGE = 3;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const VAR = /var\(\s*(--[\w-]+)\s*\)/;

/** Resolve a colour value (hex, or var(--token) via the token model) to RGB. */
function resolveColor(value: string, tokens?: TokenModel): Rgb | undefined {
  const v = value.trim();
  const varMatch = VAR.exec(v);
  if (varMatch) {
    const literal = tokens?.customProps.get(varMatch[1]);
    return literal ? parseHex(literal) : undefined;
  }
  const hexMatch = HEX.exec(v);
  return hexMatch ? parseHex(hexMatch[0]) : undefined;
}

/** The background colour declared on this element, from background-color or the background shorthand. */
function resolveBackground(decls: Map<string, string>, tokens?: TokenModel): Rgb | undefined {
  const bc = decls.get('background-color');
  if (bc) return resolveColor(bc, tokens);
  const bg = decls.get('background');
  return bg ? resolveColor(bg, tokens) : undefined;
}

/** Normalise a colour value to its lower-cased hex literal for the finding id (var() resolved via tokens). */
function colorLabel(value: string, tokens?: TokenModel): string {
  const varMatch = VAR.exec(value.trim());
  if (varMatch) {
    const literal = tokens?.customProps.get(varMatch[1]) ?? value.trim();
    return (HEX.exec(literal)?.[0] ?? literal).toLowerCase();
  }
  return (HEX.exec(value.trim())?.[0] ?? value.trim()).toLowerCase();
}

/** WCAG large text: font-size >= 24px, or >= 18.6667px when bold (font-weight >= 700). */
function isLargeText(decls: Map<string, string>): boolean {
  const fs = decls.get('font-size');
  if (!fs) return false;
  const px = /^(\d+(?:\.\d+)?)px$/.exec(fs);
  if (!px) return false;
  const size = parseFloat(px[1]);
  if (size >= 24) return true;
  const weight = parseInt(decls.get('font-weight') ?? '', 10);
  return size >= 18.6667 && weight >= 700;
}

/** Walk inline-styled elements and collect failing "fg-on-bg" pairs (deduped, sorted). */
function scanTree(tree: Root, tokens?: TokenModel): string[] {
  const fails = new Set<string>();
  visitElements(tree, (el) => {
    const style = el.properties?.style;
    if (typeof style !== 'string' || style === '') return;
    const decls = parseInlineDecls(style);
    const fgValue = decls.get('color');
    if (!fgValue) return;
    const fg = resolveColor(fgValue, tokens);
    const bg = resolveBackground(decls, tokens);
    if (!fg || !bg) return; // need both, resolvable, to compute a ratio
    const threshold = isLargeText(decls) ? AA_LARGE : AA_NORMAL;
    if (contrastRatio(fg, bg) < threshold) {
      const bgRaw = decls.get('background-color') ?? decls.get('background') ?? '';
      fails.add(`${colorLabel(fgValue, tokens)}-on-${colorLabel(bgRaw, tokens)}`);
    }
  });
  return [...fails].sort();
}

/**
 * Judgment-pass detector/rail (bounded-LLM vision §4.2): gate WCAG-AA contrast.
 * It REPORTS AA failures; picking a passing colour is a design decision the Claude
 * actuator owns (§4.1), so this operator NEVER mutates — `detect` and `apply` are the
 * same read-only scan (idempotent: apply ∘ apply = apply trivially).
 */
export const contrast: Operator = {
  name: 'contrast',
  tier: 1,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return scanTree(tree, ctx.tokens).map((pair) => ({
      id: `contrast:${pair}`,
      description: `colour pair ${pair} fails WCAG AA contrast; the Claude actuator must choose a passing colour`,
      outcome: 'warning',
    }));
  },

  // Detector/rail: the fix is Claude's (vision §4.1). apply never mutates — pure re-scan.
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
