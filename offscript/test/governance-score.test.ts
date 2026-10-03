import { describe, it, expect } from 'vitest';
import { buildGovernanceReport, formatGovernanceReport } from '../src/governance-score.js';
import type { GovernanceTrace } from '../src/actuation-governed.js';

const TRACES: GovernanceTrace[] = [
  { pass: 'contrast', loops: 1, railsClear: true, slopIntroduced: 0, drift: 0, inBounds: true, status: 'passed' },
  { pass: 'brand-fidelity', loops: 2, railsClear: true, slopIntroduced: 1, drift: 0, inBounds: false, status: 'escalated' },
];

describe('buildGovernanceReport', () => {
  it('aggregates per-pass traces with totals', () => {
    const r = buildGovernanceReport({ subject: 'example-brand', traces: TRACES });
    expect(r.subject).toBe('example-brand');
    expect(r.passes).toHaveLength(2);
    expect(r.totals.passes).toBe(2);
    expect(r.totals.passed).toBe(1);
    expect(r.totals.escalated).toBe(1);
    expect(r.totals.slopIntroduced).toBe(1);
    expect(r.totals.drift).toBe(0);
    expect(r.totals.inBoundsRatio).toBeCloseTo(0.5, 5);
  });

  it('handles an empty trace list (no passes run)', () => {
    const r = buildGovernanceReport({ subject: 's', traces: [] });
    expect(r.totals.passes).toBe(0);
    expect(r.totals.inBoundsRatio).toBe(0);
  });
});

describe('formatGovernanceReport', () => {
  it('renders a stable multi-line report', () => {
    const r = buildGovernanceReport({ subject: 'example-brand', traces: TRACES });
    const text = formatGovernanceReport(r);
    expect(text).toContain('contrast');
    expect(text).toContain('brand-fidelity');
    expect(text).toContain('in-bounds ratio');
  });
});
