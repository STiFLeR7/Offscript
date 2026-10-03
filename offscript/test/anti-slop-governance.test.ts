import { describe, it, expect } from 'vitest';
import { hslSaturation, saturationOfHex, parseHex } from '../src/color.js';
import { antiSlopGovernance } from '../src/operators/anti-slop-governance.js';
import { parseHtml } from '../src/working-rep.js';
import { deriveBrandPosture } from '../src/posture.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { deriveBrandContract } from '../src/brand-contract.js';
import type { OperatorContext } from '../src/operator.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function ctxFor(kitFixtureDir: string): OperatorContext {
  const css = readFileSync(join(here, '..', 'fixtures', kitFixtureDir, 'colors_and_type.css'), 'utf8');
  const tokens = loadTokensFromCss(css);
  const brandContract = deriveBrandContract(css, { subject: kitFixtureDir });
  const posture = deriveBrandPosture({ tokens, brandContract });
  return { params: {}, tokens, brandContract, posture };
}

// An off-token, non-stock, mid-saturation colour (#2563eb, S≈0.83) used inline.
const MID_SAT_DOC = `<main><p style="color:#2563eb">hi</p></main>`;
// A generic stock red used inline (off-token on both fixtures).
const STOCK_DOC = `<main><p style="color:#ff0000">hi</p></main>`;

describe('color saturation helpers', () => {
  it('computes HSL saturation of a pure primary as 1', () => {
    expect(saturationOfHex('#ff0000')).toBeCloseTo(1, 5);
  });

  it('computes a near-zero saturation for a grey', () => {
    expect(saturationOfHex('#808080')).toBeCloseTo(0, 5);
  });

  it('computes a mid saturation for CR blue', () => {
    // #2563eb → HSL S ≈ 0.83
    expect(saturationOfHex('#2563eb')).toBeGreaterThan(0.78);
    expect(saturationOfHex('#2563eb')).toBeLessThan(0.88);
  });

  it('returns 0 for an unparseable hex', () => {
    expect(saturationOfHex('not-a-color')).toBe(0);
  });

  it('hslSaturation accepts an Rgb', () => {
    const rgb = parseHex('#ff0000')!;
    expect(hslSaturation(rgb)).toBeCloseTo(1, 5);
  });
});

describe('antiSlopGovernance — saturation tell (posture-relative)', () => {
  it('flags a mid-saturation off-token colour on a muted (low-ceiling) brand', () => {
    const findings = antiSlopGovernance.detect(parseHtml(MID_SAT_DOC), ctxFor('muted-kit'));
    expect(findings.some((f) => f.id.includes('saturation'))).toBe(true);
  });

  it('does NOT flag the same colour on a loud (high-ceiling) brand', () => {
    const findings = antiSlopGovernance.detect(parseHtml(MID_SAT_DOC), ctxFor('loud-kit'));
    expect(findings.some((f) => f.id.includes('saturation'))).toBe(false);
  });
});

describe('antiSlopGovernance — generic-stock tell', () => {
  it('flags a generic stock literal even when under the ceiling (loud brand)', () => {
    // #ff0000 has S=1.0 which is NOT > loud ceiling (1.0) — so this proves the
    // stock tell fires independently of the saturation tell.
    const findings = antiSlopGovernance.detect(parseHtml(STOCK_DOC), ctxFor('loud-kit'));
    expect(findings.some((f) => f.id.includes('stock'))).toBe(true);
    expect(findings.some((f) => f.id.includes('saturation'))).toBe(false);
  });
});

describe('antiSlopGovernance — brand-true loudness is not slop', () => {
  it('emits nothing for a brand-token colour used heavily (loud brand)', () => {
    const doc = `<main><p style="color:var(--brand-magenta)">a</p><p style="color:var(--brand-magenta)">b</p></main>`;
    const findings = antiSlopGovernance.detect(parseHtml(doc), ctxFor('loud-kit'));
    expect(findings).toEqual([]);
  });

  it('does not flag a saturated-but-under-ceiling non-stock off-token colour on a loud brand', () => {
    const findings = antiSlopGovernance.detect(parseHtml(MID_SAT_DOC), ctxFor('loud-kit'));
    expect(findings).toEqual([]);
  });
});

describe('antiSlopGovernance — no posture falls back to default ceiling', () => {
  it('flags a very saturated off-token colour with no posture present', () => {
    const doc = `<main><p style="color:#ff00aa">x</p></main>`; // S≈1.0 > 0.7 default
    const findings = antiSlopGovernance.detect(parseHtml(doc), { params: {} });
    expect(findings.some((f) => f.id.includes('saturation'))).toBe(true);
  });

  it('apply is a pure re-scan (idempotent, no mutation)', () => {
    const tree = parseHtml(STOCK_DOC);
    const ctx = ctxFor('muted-kit');
    const a = antiSlopGovernance.apply(tree, ctx);
    const b = antiSlopGovernance.apply(tree, ctx);
    expect(a).toEqual(b);
  });
});
