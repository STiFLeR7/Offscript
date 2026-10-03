/**
 * P55 — Generation Plan as the boundary contract between the Project Platform and the Generation
 * Platform. The four production archetypes, the read-only GenerationContract that Designer Doctor /
 * Designer Author would consume, and proof the Project Platform + Canonical Brief are untouched.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import { recordProjectSession, loadProjectContext } from '../../src/project/context-store.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { planGeneration } from '../../src/project/generation-planner.js';
import { serializeGenerationPlan } from '../../src/project/generation-plan.js';
import { contractDeliverables, contractValidations, contractConstraints, verifyContract } from '../../src/project/generation-contract.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { ProjectContext, ProjectIdentity, SessionInput } from '../../src/project/project-context.js';
import { emptyContext } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import type { Track } from '../../src/paths.js';

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
function plan(deliverables: Track[], strat = strategy(), decisions = FULL) {
  const c = ctx(decisions, deliverables);
  const readiness = { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context: c }), strategy: strat, context: c };
  return planGeneration({ client: 'acme', readiness, assessment: evaluateReadiness(readiness) });
}

const CLIENTS = ['__p55_brief__'];
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

describe('P55 generation planning & execution contract', () => {
  it('WEBSITE project → a Generation Plan', () => {
    const p = plan(['website']);
    expect(p.scope.included).toEqual(['website']);
    expect(contractDeliverables(p)).toEqual(['website']);
    expect(verifyContract(p)).toBe(true);
  });

  it('WEBSITE + COLLATERAL → a unified Generation Plan (one contract, both deliverables)', () => {
    const p = plan(['website', 'collateral'], strategy({ expectedDeliverables: ['website', 'collateral'] }));
    expect(p.scope.included).toEqual(['website', 'collateral']);
    expect(p.scope.capabilities).toEqual(['website-author', 'collateral-author']);
    expect(p.requiredValidations.map((v) => v.track)).toEqual(['website', 'collateral']);
    expect(contractValidations(p, 'collateral').length).toBeGreaterThan(0);
    expect(verifyContract(p)).toBe(true);
  });

  it('ENTERPRISE project → additional constraints in the plan', () => {
    const granted: SessionInput['decisions'] = [...FULL, { kind: 'approved', subject: 'legal/compliance sign-off' }];
    const enterprise = plan(['website'], strategy({ riskLevel: 'high', requiredApprovals: ['legal/compliance sign-off'] }), granted);
    expect(contractConstraints(enterprise, 'governance').length).toBeGreaterThan(0);
    expect(contractConstraints(enterprise, 'approval').length).toBeGreaterThan(0);
  });

  it('REPLAY → an identical Generation Plan (byte-identical serialization)', () => {
    expect(serializeGenerationPlan(plan(['website']))).toBe(serializeGenerationPlan(plan(['website'])));
    expect(plan(['website']).planId).toBe(plan(['website']).planId);
  });

  it('the Canonical Brief and Project Platform are unchanged: planning is a downstream projection', async () => {
    const c = '__p55_brief__';
    const info = { oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'footer'] };
    initProject({ client: c, projectType: 'website' });
    const r = await createCreativeDirector().acquire({ client: c, projectType: 'website', answers: info });
    recordProjectSession(c, { goal: 'p', decisions: [
      { kind: 'confirmed', subject: 'brand', to: 'Growth Co' },
      { kind: 'confirmed', subject: 'audience', to: 'Growth teams' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' },
      { kind: 'asset', subject: 'logo.svg' },
    ] }, '2026-01-01T00:00:00Z');
    const context = loadProjectContext(c);
    const readiness = { projectType: 'website', deliverables: ['website'] as Track[], workflow: planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy(), context }), strategy: strategy(), context };
    const p = planGeneration({ client: c, readiness, assessment: evaluateReadiness(readiness) });
    expect(p.references.canonicalBrief.ref).toContain(c); // the plan POINTS at the brief
    expect(r.briefText).toBe(normalizeBrief({ track: 'website', ...info })); // …and the brief itself is byte-identical
  });
});
