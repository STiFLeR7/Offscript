/**
 * W3-S5 — Vagueness Observability (the first SUBJECTIVE producer).
 *
 * The frozen contract (W3-S5-CONTRACT-RECONCILIATION.md): a separate subjective intent-critic
 * emits, at most once per brief, a `critical-warning` when the CENTRAL OBJECTIVE is not legible
 * to a human reviewer — observability-only, surfaced via the existing composeRunHealth ledger as
 * REVIEW REQUIRED. It never emits Failure/Warning/Information, never gates/scores/freezes, and
 * the default scripted critic is a deterministic no-op (legible → no signal).
 *
 * These tests cover the pure mapper, the default scripted critic, and routing through the EXISTING
 * delivery surface (Option B — concat, as W3-S3 did). No live LLM; the subjective judgment is the
 * injected seam, exercised here only via deterministic doubles.
 */

import { describe, it, expect } from 'vitest';

import { type AuthoritySignal, validateSignal } from '../../src/authority.js';
import { composeRunHealth } from '../../src/generate/source-fidelity.js';
import type { IntentBrief } from '../../src/generate/intent-brief.js';
import {
  type CriticVerdict,
  INTENT_CRITIC_PRODUCER,
  intentCriticSignals,
  defaultScriptedCritic,
} from '../../src/generate/intent-critic.js';

function mkBrief(overrides: Partial<IntentBrief> = {}): IntentBrief {
  return {
    oneThing: 'A wary buyer leaves believing migration is low-risk.',
    what: 'A landing page.',
    why: 'The reader is mid-evaluation; the change sought is one demo booking.',
    how: 'Calm, exact.',
    constraints: 'House brand.',
    antiPatterns: 'No hype.',
    ...overrides,
  };
}

describe('W3-S5 intentCriticSignals — verdict → signal mapper (pure)', () => {
  it('AC-1: a legible verdict emits NO signal', () => {
    expect(intentCriticSignals({ legible: true })).toEqual([]);
  });

  it('AC-2 + AC-3: an illegible verdict emits exactly ONE critical-warning', () => {
    const v: CriticVerdict = {
      legible: false,
      what: 'the One Thing names no concrete reader outcome',
      why: 'a reviewer cannot tell what success looks like for this piece',
    };
    const signals = intentCriticSignals(v);
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('critical-warning');
    expect(signals[0].nature).toBe('subjective');
    expect(signals[0].producer).toBe(INTENT_CRITIC_PRODUCER);
    expect(signals[0].where.trim().length).toBeGreaterThan(0);
    expect(signals[0].what).toContain('One Thing');
    expect(signals[0].why.trim().length).toBeGreaterThan(0);
  });

  it('AC-4: the emitted signal passes validateSignal (subjective + critical-warning)', () => {
    const [s] = intentCriticSignals({
      legible: false,
      what: 'central objective is a slogan, not an outcome',
      why: 'no reader, no change, no success condition is legible',
    });
    expect(validateSignal(s)).toEqual({ valid: true });
  });

  it('AC-14/15/16: never emits Failure / Warning / Information', () => {
    const v: CriticVerdict = { legible: false, what: 'x is vague', why: 'y is unclear' };
    const levels = intentCriticSignals(v).map((s) => s.level);
    expect(levels).toEqual(['critical-warning']);
    expect(levels).not.toContain('failure');
    expect(levels).not.toContain('warning');
    expect(levels).not.toContain('information');
  });
});

describe('W3-S5 defaultScriptedCritic — deterministic inert no-op', () => {
  it('AC-13: the default critic is legible → mapper yields no signal (byte-identical no-op)', async () => {
    const verdict = await defaultScriptedCritic().critique(mkBrief());
    expect(verdict.legible).toBe(true);
    expect(intentCriticSignals(verdict)).toEqual([]);
  });
});

describe('W3-S5 routing — through the existing composeRunHealth delivery surface (Option B)', () => {
  const illegible: AuthoritySignal[] = intentCriticSignals({
    legible: false,
    what: 'the central objective is not legible',
    why: 'a reviewer should clarify the One Thing before relying on this',
  });

  it('AC-5: the critic signal routes through composeRunHealth into the delivered set', () => {
    const { delivered } = composeRunHealth({
      fidelity: [],
      rail: illegible, // Option B: rides the existing bucket; per-signal producer is authoritative.
      goalMet: true,
      systematicRatio: 1,
    });
    expect(delivered.some((d) => d.producer === INTENT_CRITIC_PRODUCER)).toBe(true);
  });

  it('AC-6 + AC-7: a lone critic critical-warning yields REVIEW REQUIRED, never FAILED', () => {
    const { headline } = composeRunHealth({
      fidelity: [],
      rail: illegible,
      goalMet: true,
      systematicRatio: 1,
    });
    expect(headline.status).toBe('review-required');
    expect(headline.status).not.toBe('failed');
    expect(headline.criticals.some((c) => c.producer === INTENT_CRITIC_PRODUCER)).toBe(true);
  });

  it('AC-12: goalMet and systematicRatio are carried verbatim (a critic never changes them)', () => {
    const { headline } = composeRunHealth({
      fidelity: [],
      rail: illegible,
      goalMet: false,
      systematicRatio: 0.42,
    });
    expect(headline.goalMet).toBe(false);
    expect(headline.systematicRatio).toBe(0.42);
  });

  it('a legible critic adds nothing to the delivered set', () => {
    const none = intentCriticSignals({ legible: true });
    const { delivered, headline } = composeRunHealth({
      fidelity: [],
      rail: none,
      goalMet: true,
      systematicRatio: 1,
    });
    expect(delivered.some((d) => d.producer === INTENT_CRITIC_PRODUCER)).toBe(false);
    expect(headline.status).toBe('success');
  });
});
