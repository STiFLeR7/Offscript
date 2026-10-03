/**
 * P51 — Acquisition Planning. The rule-based PlanningPolicy turns strategy + gaps into an explicit,
 * serializable Acquisition Plan: ordered questions with dependencies, optional/critical flags, and
 * high-risk confirmations. The interview EXECUTES this plan (dependency-gated, replayable) instead
 * of emitting raw gaps.
 */
import { describe, it, expect } from 'vitest';
import { CONFIDENCE, type Evidence } from '../../src/project/evidence.js';
import { inferFacts } from '../../src/project/inference.js';
import { analyzeGaps } from '../../src/project/gap-analysis.js';
import { getProjectType, type ProjectType } from '../../src/project/project-registry.js';
import { rulePlanningPolicy, type PlanningInput } from '../../src/project/planning-policy.js';
import {
  nextQuestions,
  isPlanComplete,
  serializeAcquisitionPlan,
  deserializeAcquisitionPlan,
} from '../../src/project/acquisition-plan.js';

const NOW = '2026-01-01T00:00:00Z';
function ev(field: string, value: unknown, confidence: number, source = 'brand-kit'): Evidence {
  return { field, value, source, confidence, timestamp: NOW, origin: source };
}
function planFor(type: ProjectType, evidence: Evidence[]) {
  const facts = inferFacts(evidence);
  const gap = analyzeGaps(type.requiredArtifacts, facts);
  const input: PlanningInput = {
    projectType: type,
    track: type.deliverables[0],
    deliverables: [...type.deliverables],
    sourceId: 'manual',
    facts,
    gap,
    evidence,
  };
  return rulePlanningPolicy().plan(input);
}

describe('P51 acquisition planning', () => {
  it('a bare website plans exactly its required questions, in dependency+priority order', () => {
    const p = planFor(getProjectType('website'), []);
    expect(p.questions).toEqual(['one-liner', 'audience', 'must-include']);
    expect(p.ready).toBe(false);
    const idx = (f: string) => p.questionPlan.questions.findIndex((q) => q.field === f);
    expect(idx('one-liner')).toBeLessThan(idx('must-include')); // must-include depends on one-liner
    expect(p.questionPlan.questions.find((q) => q.field === 'must-include')!.dependsOn).toContain('one-liner');
  });

  it('SIMPLE projects create SHORT plans; COMPLEX projects create LARGER plans', () => {
    const simple = planFor(getProjectType('social-campaign'), []); // 2 required, not complex ⇒ no optional
    const complex = planFor(getProjectType('full-brand-package'), []); // 4 required + optional enrichment
    expect(simple.questionPlan.questions.length).toBeLessThan(complex.questionPlan.questions.length);
    expect(simple.questionPlan.questions.some((q) => q.optional)).toBe(false);
    expect(complex.questionPlan.questions.some((q) => q.optional)).toBe(true); // complex enriches with optionals
  });

  it('the interview executes the plan: a dependent question is gated until its dependency is answered', () => {
    const p = planFor(getProjectType('website'), []);
    const round1 = nextQuestions(p, []).map((q) => q.field);
    expect(round1).toEqual(['one-liner', 'audience']); // must-include gated on one-liner
    const round2 = nextQuestions(p, ['one-liner']).map((q) => q.field);
    expect(round2).toEqual(['audience', 'must-include']); // dependency now satisfied
    expect(isPlanComplete(p, ['one-liner', 'audience', 'must-include'])).toBe(true);
    expect(isPlanComplete(p, ['one-liner'])).toBe(false);
  });

  it('HIGH-RISK projects add confirmation questions even for already-known fields', () => {
    const type = getProjectType('website');
    const allKnown: Evidence[] = [
      ev('one-liner', 'Bank smarter', 0.8),
      ev('audience', 'Retail banking customers', 0.8),
      ev('must-include', ['hero', 'security'], 0.8),
    ];
    const banking = planFor(type, allKnown);
    expect(banking.strategy.riskLevel).toBe('high');
    expect(banking.ready).toBe(false); // must be confirmed, not silently inferred
    expect(banking.questionPlan.questions.every((q) => q.reason === 'confirm')).toBe(true);
    expect(banking.mustConfirm.length).toBeGreaterThan(0);
    expect(banking.neverInfer).toContain('one-liner');

    // A low-risk project with the SAME evidence completeness needs no confirmations.
    const lowRisk = planFor(type, [
      ev('one-liner', 'Ship fast', 0.8),
      ev('audience', 'Growth teams', 0.8),
      ev('must-include', ['hero', 'footer'], 0.8),
    ]);
    expect(lowRisk.ready).toBe(true);
    expect(lowRisk.questions).toEqual([]);
  });

  it('known fields land in alreadyKnown / inferable (discovered, not human-confirmed)', () => {
    const p = planFor(getProjectType('website'), [ev('audience', 'Devs', 0.8)]);
    expect(p.alreadyKnown).toContain('audience');
    expect(p.inferable).toContain('audience'); // brand-kit is inferred, not CERTAIN
    expect(p.questions).toEqual(['one-liner', 'must-include']); // audience not re-asked (low risk)
  });

  it('plans are SERIALIZABLE and REPLAYABLE (round-trips, deterministic, same interview progression)', () => {
    const p = planFor(getProjectType('website'), []);
    const text = serializeAcquisitionPlan(p);
    expect(serializeAcquisitionPlan(p)).toBe(text); // deterministic
    const restored = deserializeAcquisitionPlan(text);
    expect(restored.strategy.riskLevel).toBe(p.strategy.riskLevel);
    expect(restored.questions).toEqual(p.questions);
    // the restored plan drives the identical dependency-gated interview
    expect(nextQuestions(restored, []).map((q) => q.field)).toEqual(nextQuestions(p, []).map((q) => q.field));
    expect(nextQuestions(restored, ['one-liner']).map((q) => q.field)).toEqual(
      nextQuestions(p, ['one-liner']).map((q) => q.field),
    );
  });
});
