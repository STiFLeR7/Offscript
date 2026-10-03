import { describe, it, expect } from 'vitest';
import { buildOperatorContext } from '../src/operator-context.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { deriveBrandContract } from '../src/brand-contract.js';

describe('buildOperatorContext', () => {
  it('attaches tokens, brandContract, and a derived posture', () => {
    const css = ':root { --brand-blue: #2563eb; --bg: #ffffff; }';
    const tokens = loadTokensFromCss(css);
    const brandContract = deriveBrandContract(css, { subject: 'x' });
    const ctx = buildOperatorContext({ tokens, brandContract });
    expect(ctx.tokens).toBe(tokens);
    expect(ctx.brandContract).toBe(brandContract);
    expect(ctx.posture).toBeDefined();
    expect(ctx.posture?.allowedAccentCount).toBeGreaterThanOrEqual(1);
  });

  it('still derives a posture when brandContract is absent', () => {
    const tokens = loadTokensFromCss(':root { --x: #fff; }');
    const ctx = buildOperatorContext({ tokens });
    expect(ctx.posture?.saturationCeiling).toBeCloseTo(0.7, 5);
  });
});
