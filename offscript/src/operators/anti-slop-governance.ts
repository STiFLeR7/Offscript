import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';
import { parseHex, saturationOfHex } from '../color.js';

/**
 * Tier-0 warn-only governance rail: posture-aware anti-slop colour detection
 * (spec §3 anti-slop, §1.2). Run AFTER an actuator edit to answer "did this edit
 * introduce a slop tell *for this brand*?". Two tells, both scoped to OFF-token
 * colour consumption sites (brand-token colours are brand-true and exempt):
 *
 *  - saturation tell: an off-token colour whose HSL saturation exceeds
 *    `ctx.posture.saturationCeiling` (the brand's OWN loudest accent chroma +
 *    headroom). A loud brand has a high ceiling, so its brand-true loudness is
 *    not flagged; a restrained brand has a low ceiling, so a generic saturated
 *    colour trips it.
 *  - generic-stock tell: an off-token colour equal to a recognisable generic
 *    stock literal, regardless of saturation — the classic `#ff0000` error,
 *    `#00ff00` success, etc. chosen because the brand's own hue was ignored.
 *
 * Outcome is `warning` (a design call surfaced, never auto-mutated). Falls back
 * to DEFAULT_CEILING when no posture is on the context.
 */

const DEFAULT_CEILING = 0.7;

/** Hex colour literals: #rgb, #rgba, #rrggbb, #rrggbbaa (longest alternatives first). */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

/** Generic stock-semantic literals (normalised to #rrggbb lowercase). */
const STOCK = new Set(
  ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffaa00', '#00ffff', '#ff00ff', '#39ff14'].map(
    (h) => normalizeHex(h) ?? h,
  ),
);

const TOKEN_BLOCK_MARKER = 'offscript-tokens';

function isTokenBlock(el: Element): boolean {
  return el.tagName === 'style' && el.properties?.dataOffscript === TOKEN_BLOCK_MARKER;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

/** Canonical #rrggbb (lowercase) for a hex string, or undefined if unparseable. */
function normalizeHex(hex: string): string | undefined {
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Collect off-token hex colours (not traceable to a brand token) from a value string. */
function collectOffToken(value: string, valueToVar: Map<string, string>, out: Set<string>): void {
  const matches = value.match(HEX);
  if (!matches) return;
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (valueToVar.has(lower)) continue; // traceable to a token → brand-true
    out.add(lower);
  }
}

function scanOffTokenColors(tree: Root, valueToVar: Map<string, string>): string[] {
  const off = new Set<string>();
  visitElements(tree, (el) => {
    if (el.tagName === 'style' && !isTokenBlock(el)) {
      const css = styleText(el);
      if (css) {
        const root = parseCss(css);
        root.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) return;
          collectOffToken(decl.value, valueToVar, off);
        });
      }
    }
    const style = el.properties?.style;
    if (typeof style === 'string' && style !== '') {
      rewriteInlineDecls(style, (prop, val) => {
        if (prop.trim().startsWith('--')) return undefined;
        collectOffToken(val, valueToVar, off);
        return undefined;
      });
    }
  });
  return [...off].sort();
}

export const antiSlopGovernance: Operator = {
  name: 'anti-slop-governance',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    const valueToVar = ctx.tokens?.valueToVar ?? new Map<string, string>();
    const ceiling = ctx.posture?.saturationCeiling ?? DEFAULT_CEILING;
    const offToken = scanOffTokenColors(tree, valueToVar);

    const findings: Finding[] = [];
    for (const color of offToken) {
      const canonical = normalizeHex(color) ?? color;
      if (STOCK.has(canonical)) {
        findings.push({
          id: `anti-slop-governance:stock:${canonical}`,
          description:
            `generic stock-semantic colour ${canonical} is off-token — a slop tell: ` +
            `chosen because the brand's own hue was ignored. Derive the semantic colour ` +
            `in the brand's hue family instead (anti-slop-checklist §6).`,
          outcome: 'warning',
        });
        continue; // a stock literal is already a tell; don't double-report on saturation
      }
      const sat = saturationOfHex(color);
      if (sat > ceiling) {
        findings.push({
          id: `anti-slop-governance:saturation:${canonical}`,
          description:
            `off-token colour ${canonical} (HSL saturation ${sat.toFixed(2)}) exceeds the ` +
            `brand's saturation ceiling ${ceiling.toFixed(2)} — uncontrolled relative to the ` +
            `declared BrandPosture (anti-slop-checklist §6). Brand-true loudness stays under ` +
            `the brand's own ceiling; this is over it.`,
          outcome: 'warning',
        });
      }
    }
    return findings;
  },

  // Warn-only: applying is a pure re-scan with no mutation. apply ∘ apply = apply.
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
