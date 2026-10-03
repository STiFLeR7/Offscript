/**
 * W3-S3 — Readiness Surfacing.
 *
 * Maps the W3-S2 ReadinessVerdict (inert data) into objective AuthoritySignals and
 * routes them through the EXISTING composeRunHealth ledger (single delivery surface,
 * Option B — concat at the wiring site, composeRunHealth itself untouched).
 *
 * Frozen contract anchors tested here (W3-S3-EXECUTION-PACKAGE.md §2/§5):
 *   - absent artifact            → exactly one Information ("no Intent Brief present"); NEVER Failure (IR1).
 *   - present & ready            → exactly one Information ("present and ready").
 *   - missing floor categories   → one objective Failure each (where = category).
 *   - form oversteps             → one objective Failure each (where = intent-brief).
 *   - every signal is objective, never critical-warning, fully attributed (passes validateSignal).
 *   - routing: a Failure flips the headline to 'failed'; a lone Information leaves status unchanged;
 *     goalMet / systematicRatio carried verbatim (two axes stay two numbers).
 */

import { describe, it, expect } from 'vitest';

import { type AuthoritySignal, validateSignal } from '../../src/authority.js';
import { type ReadinessVerdict, evaluateReadiness } from '../../src/generate/intent-readiness.js';
import {
  INTENT_READINESS_PRODUCER,
  intentReadinessSignals,
} from '../../src/generate/intent-signal.js';
import { composeRunHealth } from '../../src/generate/source-fidelity.js';

const UNITS = ['px', 'pt', 'rem', 'em', 'vh', 'vw', 'vmin', 'vmax', 'mm', 'cm'] as const;

/** Build a ReadinessVerdict directly (precise control over each mapper input state). */
function verdict(overrides: Partial<ReadinessVerdict> = {}): ReadinessVerdict {
  return {
    ready: false,
    missingArtifact: false,
    missingCategories: [],
    formOversteps: [],
    ...overrides,
  };
}

describe('W3-S3 intentReadinessSignals — absent artifact → Information (IR1)', () => {
  it('missingArtifact → exactly one Information signal, fully attributed', () => {
    const signals = intentReadinessSignals(verdict({ missingArtifact: true }));
    expect(signals).toHaveLength(1);
    const s = signals[0];
    expect(s.level).toBe('information');
    expect(s.nature).toBe('objective');
    expect(s.producer).toBe(INTENT_READINESS_PRODUCER);
    expect(s.where).toBe('intent-brief');
    expect(s.what).toBe('no Intent Brief present');
    expect(s.why.length).toBeGreaterThan(0);
  });

  it('absent → never a Failure (the IR1 anti-flood guarantee)', () => {
    const signals = intentReadinessSignals(verdict({ missingArtifact: true }));
    expect(signals.some((s) => s.level === 'failure')).toBe(false);
  });

  it('the absent Information passes validateSignal', () => {
    const [s] = intentReadinessSignals(verdict({ missingArtifact: true }));
    expect(validateSignal(s)).toEqual({ valid: true });
  });
});

describe('W3-S3 intentReadinessSignals — present & ready → Information', () => {
  it('ready → exactly one Information signal confirming readiness', () => {
    const signals = intentReadinessSignals(verdict({ ready: true }));
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('information');
    expect(signals[0].what).toBe('Intent Brief present and ready');
    expect(signals[0].nature).toBe('objective');
  });
});

describe('W3-S3 intentReadinessSignals — missing categories → Failure', () => {
  it('one missing category → one Failure anchored on the category', () => {
    const signals = intentReadinessSignals(verdict({ missingCategories: ['why'] }));
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('failure');
    expect(signals[0].nature).toBe('objective');
    expect(signals[0].where).toBe('why');
    expect(signals[0].what).toContain('why');
  });

  it('multiple missing categories → one Failure each, in verdict order', () => {
    const signals = intentReadinessSignals(
      verdict({ missingCategories: ['oneThing', 'how', 'antiPatterns'] }),
    );
    expect(signals.map((s) => s.where)).toEqual(['oneThing', 'how', 'antiPatterns']);
    expect(signals.every((s) => s.level === 'failure')).toBe(true);
  });

  it('not-ready emits NO "ready" Information', () => {
    const signals = intentReadinessSignals(verdict({ missingCategories: ['why'] }));
    expect(signals.some((s) => s.what === 'Intent Brief present and ready')).toBe(false);
  });
});

describe('W3-S3 intentReadinessSignals — form oversteps → Failure', () => {
  it('one overstep → one Failure anchored on intent-brief, naming the token', () => {
    const signals = intentReadinessSignals(verdict({ formOversteps: ['#2563eb'] }));
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('failure');
    expect(signals[0].where).toBe('intent-brief');
    expect(signals[0].what).toContain('#2563eb');
  });

  it('missing categories + oversteps → Failures for both, no Information', () => {
    const signals = intentReadinessSignals(
      verdict({ missingCategories: ['how'], formOversteps: ['16px'] }),
    );
    expect(signals.filter((s) => s.level === 'failure')).toHaveLength(2);
    expect(signals.some((s) => s.level === 'information')).toBe(false);
  });
});

describe('W3-S3 intentReadinessSignals — doctrine invariants (every state)', () => {
  const states: ReadinessVerdict[] = [
    verdict({ missingArtifact: true }),
    verdict({ ready: true }),
    verdict({ missingCategories: ['oneThing', 'why'] }),
    verdict({ formOversteps: ['#fff', '24px'] }),
    verdict({ missingCategories: ['how'], formOversteps: ['rgb(0,0,0)'] }),
  ];

  it('every emitted signal is objective and never critical-warning', () => {
    for (const v of states) {
      for (const s of intentReadinessSignals(v)) {
        expect(s.nature).toBe('objective');
        expect(s.level).not.toBe('critical-warning');
      }
    }
  });

  it('every emitted signal is fully attributed and passes validateSignal', () => {
    for (const v of states) {
      for (const s of intentReadinessSignals(v)) {
        expect(s.producer).toBe(INTENT_READINESS_PRODUCER);
        expect(s.where.trim().length).toBeGreaterThan(0);
        expect(s.what.trim().length).toBeGreaterThan(0);
        expect(s.why.trim().length).toBeGreaterThan(0);
        expect(validateSignal(s)).toEqual({ valid: true });
      }
    }
  });

  it('absent verdict from evaluateReadiness(undefined) maps to the absent Information (seam)', () => {
    const signals = intentReadinessSignals(evaluateReadiness(undefined, UNITS));
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('information');
    expect(signals[0].what).toBe('no Intent Brief present');
  });
});

describe('W3-S3 routing through the single delivery surface (Option B — concat into rail)', () => {
  it('a readiness Failure routed through composeRunHealth flips the headline to FAILED', () => {
    const readiness = intentReadinessSignals(verdict({ missingCategories: ['why'] }));
    const { headline, delivered } = composeRunHealth({
      fidelity: [],
      rail: readiness, // Option B: readiness rides the existing bucket; producer stays authoritative.
      goalMet: true,
      systematicRatio: 1,
    });
    expect(headline.status).toBe('failed');
    expect(headline.failures.some((f) => f.producer === INTENT_READINESS_PRODUCER)).toBe(true);
    expect(delivered.some((d) => d.producer === INTENT_READINESS_PRODUCER)).toBe(true);
  });

  it('a lone readiness Information leaves the headline status unchanged (IR1 — no false FAILED)', () => {
    const readiness = intentReadinessSignals(verdict({ missingArtifact: true }));
    const { headline, delivered } = composeRunHealth({
      fidelity: [],
      rail: readiness,
      goalMet: true,
      systematicRatio: 1,
    });
    expect(headline.status).toBe('success');
    // Routed through the one ledger (counted), even though formatRunHeadline does not line-item it.
    expect(delivered.some((d) => d.producer === INTENT_READINESS_PRODUCER)).toBe(true);
    expect(headline.signalCount).toBeGreaterThan(0);
  });

  it('goalMet and systematicRatio are carried verbatim (two axes stay two numbers)', () => {
    const readiness = intentReadinessSignals(verdict({ missingArtifact: true }));
    const { headline } = composeRunHealth({
      fidelity: [],
      rail: readiness,
      goalMet: false,
      systematicRatio: 0.42,
    });
    expect(headline.goalMet).toBe(false);
    expect(headline.systematicRatio).toBe(0.42);
  });

  it('an empty readiness set adds nothing (additive — no readiness signals delivered)', () => {
    const readiness = intentReadinessSignals(verdict({ ready: true })).filter(
      () => false,
    ) as AuthoritySignal[];
    const { delivered } = composeRunHealth({
      fidelity: [],
      rail: readiness,
      goalMet: true,
      systematicRatio: 1,
    });
    expect(delivered.some((d) => d.producer === INTENT_READINESS_PRODUCER)).toBe(false);
  });
});
