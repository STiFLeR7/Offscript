import { describe, it, expect } from 'vitest';
import {
  buildRunHeadline,
  formatRunHeadline,
  signalsFromPerRail,
  type RunHeadline,
} from '../src/run-headline.js';
import type { AuthoritySignal } from '../src/authority.js';
import type { Finding } from '../src/operator.js';

// W1-S3 — Headline integrity under LOUD-MARK.
// Governed by docs/internals/W1-S3-EXECUTION-PACKAGE.md (Phase 2.5 three-status model),
// OFFSCRIPT-V3-AUTHORITY-SIGNAL-OWNERSHIP-CONTRACT.md, OFFSCRIPT-V3-EXECUTION-CHARTER.md.
// Additive: exercises only the new headline surface over the W1-S1 authority module.
// The status is derived from authority signals ONLY; goalMet + systematicRatio are
// separate reporting axes carried verbatim, never merged.

function obj(level: AuthoritySignal['level'], over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return { producer: 'rail', level, where: 'section:4', what: 'observed', why: 'rationale', nature: 'objective', ...over };
}
function critical(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return {
    producer: 'intent-vagueness',
    level: 'critical-warning',
    where: 'one-thing',
    what: 'the one-thing reads as a brand claim, not a reader outcome',
    why: 'subjective judgement (observability)',
    nature: 'subjective',
    ...over,
  };
}

describe('buildRunHeadline — status from authority signals only', () => {
  it('SUCCESS when there are no failures and no critical warnings', () => {
    const h = buildRunHeadline({ signals: [obj('information'), obj('warning')], goalMet: true, systematicRatio: 0.9 });
    expect(h.status).toBe('success');
  });

  it('REVIEW REQUIRED when a critical warning is present and zero failures', () => {
    const h = buildRunHeadline({ signals: [obj('warning'), critical()], goalMet: true, systematicRatio: 0.9 });
    expect(h.status).toBe('review-required');
  });

  it('FAILED when one or more failures are present', () => {
    const h = buildRunHeadline({ signals: [obj('failure')], goalMet: true, systematicRatio: 0.91 });
    expect(h.status).toBe('failed');
  });
});

describe('headline integrity — a Failure can no longer coexist with a clean SUCCESS headline', () => {
  it('a failure forces FAILED even when goalMet is true and ratio is high', () => {
    const h = buildRunHeadline({ signals: [obj('information'), obj('failure')], goalMet: true, systematicRatio: 0.99 });
    expect(h.status).toBe('failed');
    expect(h.status).not.toBe('success');
  });
});

describe('critical-warning semantics — REVIEW REQUIRED, never FAILED (Alternative-A guard)', () => {
  it('a lone critical warning yields review-required, not failed', () => {
    const h = buildRunHeadline({ signals: [critical()], goalMet: true, systematicRatio: 0.9 });
    expect(h.status).toBe('review-required');
    expect(h.status).not.toBe('failed');
  });

  it('a failure and a critical together yield FAILED (precedence), and the critical stays visible', () => {
    const c = critical();
    const h = buildRunHeadline({ signals: [c, obj('failure')], goalMet: true, systematicRatio: 0.9 });
    expect(h.status).toBe('failed');
    expect(h.criticals).toContain(c); // not absorbed, not upgraded — still surfaced
    expect(h.failures).toHaveLength(1);
  });

  it('a failure and a lone critical are never the same status (distinctness)', () => {
    const failed = buildRunHeadline({ signals: [obj('failure')], goalMet: true, systematicRatio: 0.9 });
    const review = buildRunHeadline({ signals: [critical()], goalMet: true, systematicRatio: 0.9 });
    expect(failed.status).not.toBe(review.status);
  });
});

describe('axis independence — Goal Met, Ratio, Headline Status are independent', () => {
  it('goalMet=NO with clean signals still reads SUCCESS', () => {
    const h = buildRunHeadline({ signals: [obj('information')], goalMet: false, systematicRatio: 0.72 });
    expect(h.status).toBe('success');
    expect(h.goalMet).toBe(false);
    expect(h.systematicRatio).toBe(0.72);
  });

  it('goalMet=YES with a failure reads FAILED, ratio carried verbatim', () => {
    const h = buildRunHeadline({ signals: [obj('failure')], goalMet: true, systematicRatio: 0.91 });
    expect(h.status).toBe('failed');
    expect(h.goalMet).toBe(true);
    expect(h.systematicRatio).toBe(0.91);
  });

  it('carries goalMet and systematicRatio verbatim — never recomputed or merged', () => {
    const h = buildRunHeadline({ signals: [critical()], goalMet: true, systematicRatio: 0.8734 });
    expect(h.systematicRatio).toBe(0.8734);
    expect(h.goalMet).toBe(true);
  });
});

describe('authority preservation — signals are never mutated, escalated, downgraded, or synthesised', () => {
  it('does not mutate the input signals', () => {
    const signals = [obj('failure'), critical(), obj('warning')];
    const before = JSON.stringify(signals);
    buildRunHeadline({ signals, goalMet: true, systematicRatio: 0.9 });
    expect(JSON.stringify(signals)).toBe(before);
  });

  it('partitions by reference — the same signal objects appear, unchanged', () => {
    const f = obj('failure');
    const c = critical();
    const h = buildRunHeadline({ signals: [f, c], goalMet: false, systematicRatio: 0.5 });
    expect(h.failures[0]).toBe(f);
    expect(h.criticals[0]).toBe(c);
    expect(h.failures[0].level).toBe('failure'); // no reclassification
    expect(h.criticals[0].level).toBe('critical-warning');
  });
});

describe('LOUD-MARK preservation — building a headline never terminates or changes control flow', () => {
  it('buildRunHeadline never throws, even for a FAILED headline', () => {
    expect(() => buildRunHeadline({ signals: [obj('failure')], goalMet: true, systematicRatio: 0.9 })).not.toThrow();
  });
  it('a FAILED headline is just data (returns a value)', () => {
    const h = buildRunHeadline({ signals: [obj('failure')], goalMet: true, systematicRatio: 0.9 });
    expect(h).toBeTypeOf('object');
    expect(h.status).toBe('failed');
  });
});

describe('signalsFromPerRail — run-level bridge from existing rail findings (read-only)', () => {
  function finding(id: string, outcome: Finding['outcome']): Finding {
    return { id, description: `desc ${id}`, outcome };
  }

  it('maps each finding to an objective signal via the frozen outcome→authority bridge', () => {
    const perRail = [
      { operator: { name: 'layout-alignment' }, findings: [finding('layout-alignment:misaligned:section:4', 'escalated')] },
      { operator: { name: 'token-normalize' }, findings: [finding('token-normalize:literal:1', 'auto-remediated')] },
      { operator: { name: 'geometry-unvalidated' }, findings: [finding('geometry-unvalidated:render-skipped', 'warning')] },
    ];
    const signals = signalsFromPerRail(perRail);
    expect(signals).toHaveLength(3);
    expect(signals[0].level).toBe('failure');
    expect(signals[0].producer).toBe('layout-alignment');
    expect(signals[0].where).toBe('layout-alignment:misaligned:section:4');
    expect(signals[0].nature).toBe('objective');
    expect(signals[1].level).toBe('information');
    expect(signals[2].level).toBe('warning');
  });

  it('an escalated finding routed through the bridge drives a FAILED headline', () => {
    const perRail = [{ operator: { name: 'sticky-stack' }, findings: [finding('sticky-stack:bad:hero', 'escalated')] }];
    const h = buildRunHeadline({
      signals: signalsFromPerRail(perRail),
      goalMet: false,
      systematicRatio: 0.5,
    });
    expect(h.status).toBe('failed');
  });

  it('does not mutate the source findings', () => {
    const f = finding('x:1', 'escalated');
    const before = JSON.stringify(f);
    signalsFromPerRail([{ operator: { name: 'x' }, findings: [f] }]);
    expect(JSON.stringify(f)).toBe(before);
  });
});

describe('formatRunHeadline — truthful, distinct rendering per status', () => {
  const base = { goalMet: true, systematicRatio: 0.9 };
  const render = (h: RunHeadline): string => formatRunHeadline(h);

  it('renders the three statuses with distinct text and shows all three axes', () => {
    const success = render(buildRunHeadline({ ...base, signals: [obj('information')] }));
    const review = render(buildRunHeadline({ ...base, signals: [critical()] }));
    const failed = render(buildRunHeadline({ ...base, signals: [obj('failure')] }));

    expect(success).not.toBe(review);
    expect(review).not.toBe(failed);
    expect(success).toMatch(/SUCCESS/);
    expect(review).toMatch(/REVIEW REQUIRED/);
    expect(failed).toMatch(/FAILED/);
    // all three axes present in the readout
    expect(failed).toMatch(/0\.9|0\.9000/);
    expect(failed.toLowerCase()).toContain('goal');
  });
});
