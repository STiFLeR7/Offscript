/**
 * P55 — Generation Planner: derives the immutable Generation Plan from READY project state (readiness
 * + workflow + strategy + context), reusing Project-Platform outputs by REFERENCE (not duplication).
 */
import { describe, it, expect } from 'vitest';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import type { Track } from '../../src/paths.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import { planGeneration, planGenerationFor } from '../../src/project/generation-planner.js';

const strategy = (over: Partial<CreativeStrategy> = {}): CreativeStrategy => ({
  projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
  riskLevel: 'low', expectedDeliverables: ['website'], requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [], ...over,
});
const FULL: SessionInput['decisions'] = [
  { kind: 'confirmed', subject: 'brand', to: 'Acme' },
  { kind: 'confirmed', subject: 'audience', to: 'Devs' },
  { kind: 'confirmed', subject: 'tone', to: 'Confident' },
  { kind: 'asset', subject: 'logo.svg' },
];
function ctx(decisions: SessionInput['decisions'], deliverables: Track[]): ProjectContext {
  const id: ProjectIdentity = { client: 'acme', projectType: 'website', deliverables };
  const base = emptyContext(id);
  return applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
}
function readiness(deliverables: Track[], strat: CreativeStrategy, decisions = FULL): ProjectReadiness {
  const c = ctx(decisions, deliverables);
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context: c }), strategy: strat, context: c };
}
const plan = (deliverables: Track[], strat = strategy(), decisions = FULL) => {
  const r = readiness(deliverables, strat, decisions);
  return planGeneration({ client: 'acme', readiness: r, assessment: evaluateReadiness(r) });
};

describe('P55 generation planner', () => {
  it('a READY website project → a complete Generation Plan', () => {
    const p = plan(['website']);
    expect(p.identity.client).toBe('acme');
    expect(p.scope.included).toEqual(['website']);
    expect(p.scope.capabilities).toEqual(['website-author']);
    expect(p.requiredValidations.find((v) => v.track === 'website')!.validations.length).toBeGreaterThan(0);
    expect(p.objective).toMatch(/website/i);
    // references, not copies: the brief is a pointer, its content is not embedded
    expect(p.references.canonicalBrief.ref).toMatch(/references\/brief\.md$/);
    expect(p.references.workflow.version).toBe(1); // one folded session ⇒ context/workflow version 1
    expect(p.references.readiness.state).toBe('READY');
  });

  it('base constraints always apply; low-risk adds no approval/governance constraint', () => {
    const p = plan(['website']);
    const kinds = new Set(p.constraints.map((c) => c.kind));
    expect(kinds.has('palette')).toBe(true);
    expect(kinds.has('motion')).toBe(true);
    expect(kinds.has('output')).toBe(true);
    expect(p.constraints.some((c) => c.kind === 'approval')).toBe(false);
    expect(p.constraints.some((c) => c.kind === 'governance')).toBe(false);
  });

  it('ENTERPRISE (high-risk, approvals granted) → additional constraints', () => {
    const granted: SessionInput['decisions'] = [...FULL, { kind: 'approved', subject: 'legal/compliance sign-off' }];
    const enterprise = plan(['website'], strategy({ riskLevel: 'high', requiredApprovals: ['legal/compliance sign-off'] }), granted);
    const simple = plan(['website']);
    expect(enterprise.constraints.some((c) => c.kind === 'governance')).toBe(true);
    expect(enterprise.constraints.some((c) => c.kind === 'approval')).toBe(true);
    expect(enterprise.constraints.length).toBeGreaterThan(simple.constraints.length);
  });

  it('refuses to plan a project that was not admitted (not READY)', () => {
    const r = readiness(['website'], strategy(), [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }]); // no brand/logo → not READY
    const assessment = evaluateReadiness(r);
    expect(assessment.admission.admitted).toBe(false);
    expect(() => planGeneration({ client: 'acme', readiness: r, assessment })).toThrow(/READY|admit/i);
  });

  it('is deterministic — same inputs yield an identical plan (id included)', () => {
    expect(plan(['website'])).toEqual(plan(['website']));
    expect(plan(['website']).planId).toBe(plan(['website']).planId);
  });

  it('does not mutate the Project-Platform inputs it consumes', () => {
    const r = readiness(['website'], strategy());
    const before = JSON.stringify(r.workflow);
    planGeneration({ client: 'acme', readiness: r, assessment: evaluateReadiness(r) });
    expect(JSON.stringify(r.workflow)).toBe(before);
  });

  it('planGenerationFor evaluates readiness and plans in one call', () => {
    const r = readiness(['website'], strategy());
    expect(planGenerationFor('acme', r)).toEqual(planGeneration({ client: 'acme', readiness: r, assessment: evaluateReadiness(r) }));
  });
});
