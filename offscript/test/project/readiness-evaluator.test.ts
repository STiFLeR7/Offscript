/**
 * P54 — Readiness evaluator + rule policy. Evaluates a project (workflow + strategy + living context)
 * against a policy's requirements and produces an explicit, self-explaining readiness assessment.
 */
import { describe, it, expect } from 'vitest';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { ruleReadinessPolicy } from '../../src/project/readiness-policy.js';
import { serializeReadiness, deserializeReadiness } from '../../src/project/readiness.js';

const IDENTITY: ProjectIdentity = { client: 'x', projectType: 'website', deliverables: ['website'] };

function strategy(over: Partial<CreativeStrategy> = {}): CreativeStrategy {
  return {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: ['website'], requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [], ...over,
  };
}

function context(input: SessionInput): ProjectContext {
  const base = emptyContext(IDENTITY);
  return applySession(base, newSession(input, base, '2026-01-01T00:00:00Z'));
}

/** A fully-satisfied website context: brand + audience + tone facts + a logo asset. */
const FULL: SessionInput = {
  goal: 'prep',
  decisions: [
    { kind: 'confirmed', subject: 'brand', to: 'Acme' },
    { kind: 'confirmed', subject: 'audience', to: 'Devs' },
    { kind: 'confirmed', subject: 'tone', to: 'Confident' },
    { kind: 'asset', subject: 'logo.svg' },
  ],
};

function assess(strat: CreativeStrategy, ctx?: ProjectContext) {
  const workflow = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strat, context: ctx });
  return evaluateReadiness({ projectType: 'website', deliverables: ['website'], workflow, strategy: strat, context: ctx });
}

describe('P54 readiness evaluator', () => {
  it('a fully-prepared, low-risk project → READY and admitted', () => {
    const a = assess(strategy(), context(FULL));
    expect(a.state).toBe('READY');
    expect(a.admission.admitted).toBe(true);
    expect(a.blockers).toEqual([]);
  });

  it('missing evidence/assets → WAITING_FOR_INFORMATION, and each blocker explains itself', () => {
    const a = assess(strategy(), context({ goal: 'p', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }));
    expect(a.state).toBe('WAITING_FOR_INFORMATION');
    expect(a.admission.admitted).toBe(false);
    const brand = a.blockers.find((b) => b.category === 'evidence');
    expect(brand).toBeDefined();
    // no opaque failures: every field populated
    expect(brand!.reason).toBeTruthy();
    expect(brand!.owner).toBeTruthy();
    expect(brand!.resolution).toBeTruthy();
    expect(a.blockers.some((b) => b.category === 'asset')).toBe(true); // missing logo
  });

  it('everything present but a required approval ungranted → WAITING_FOR_APPROVAL', () => {
    const a = assess(strategy({ riskLevel: 'high', requiredApprovals: ['legal/compliance sign-off'] }), context(FULL));
    expect(a.state).toBe('WAITING_FOR_APPROVAL');
    const appr = a.blockers.find((b) => b.category === 'approval');
    expect(appr).toBeDefined();
    expect(appr!.dependentTasks.some((t) => t.startsWith('approval-'))).toBe(true);
  });

  it('a granted approval clears the approval blocker → READY', () => {
    const granted = context({ ...FULL, decisions: [...FULL.decisions!, { kind: 'approved', subject: 'legal/compliance sign-off' }] });
    const a = assess(strategy({ riskLevel: 'high', requiredApprovals: ['legal/compliance sign-off'] }), granted);
    expect(a.state).toBe('READY');
  });

  it('a rejected, unresolved required decision → BLOCKED (outstanding conflict)', () => {
    const conflicted = context({ goal: 'p', decisions: [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' },
      { kind: 'asset', subject: 'logo.svg' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' },
      { kind: 'rejected', subject: 'audience' }, // rejected and never re-confirmed
    ] });
    const a = assess(strategy(), conflicted);
    expect(a.state).toBe('BLOCKED');
    expect(a.blockers.some((b) => b.severity === 'critical')).toBe(true);
  });

  it('is deterministic — same inputs yield an identical assessment', () => {
    expect(assess(strategy(), context(FULL))).toEqual(assess(strategy(), context(FULL)));
  });

  it('an evaluated assessment round-trips losslessly (replay)', () => {
    const a = assess(strategy({ riskLevel: 'high', requiredApprovals: ['legal/compliance sign-off'] }), context(FULL));
    expect(deserializeReadiness(serializeReadiness(a))).toEqual(a); // canonical key order, values preserved
  });

  it('the rule policy is a named, swappable seam', () => {
    expect(ruleReadinessPolicy().id).toBe('rule-based');
  });
});
