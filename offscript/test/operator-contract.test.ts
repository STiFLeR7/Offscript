import { describe, it, expect } from 'vitest';
import type { Finding, OperatorContext } from '../src/operator.js';
import type { SectionsModel } from '../src/sections.js';
import { deriveBrandPosture } from '../src/posture.js';
import { loadTokensFromCss } from '../src/tokens.js';

describe('finding contract', () => {
  it('admits all three finding outcomes', () => {
    // This array only type-checks if 'warning' is part of Finding['outcome'].
    const outcomes: Finding['outcome'][] = ['auto-remediated', 'escalated', 'warning'];
    expect(outcomes).toContain('warning');
  });
});

describe('operator-context contract', () => {
  it('admits an optional sections map of type SectionsModel', () => {
    const sections: SectionsModel = { sections: [], byId: new Map() };
    // Only type-checks if OperatorContext.sections is SectionsModel | undefined.
    const ctx: OperatorContext = { params: {}, sections };
    expect(ctx.sections).toBe(sections);
  });
});

describe('OperatorContext carries BrandPosture', () => {
  it('accepts a posture field', () => {
    const tokens = loadTokensFromCss(':root { --x: #fff; }');
    const ctx: OperatorContext = { params: {}, posture: deriveBrandPosture({ tokens }) };
    expect(ctx.posture?.accentUsageBudget).toBeCloseTo(0.1, 5);
  });
});
