/**
 * P55 — Generation Plan model: the immutable execution contract. Freeze, self-verifying integrity
 * (content-hash id), deterministic serialization/replay, and manifest correctness.
 */
import { describe, it, expect } from 'vitest';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import type { Track } from '../../src/paths.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { planGeneration } from '../../src/project/generation-planner.js';
import { serializeGenerationPlan, deserializeGenerationPlan, verifyPlanIntegrity } from '../../src/project/generation-plan.js';

const IDENT = (deliverables: Track[]): ProjectIdentity => ({ client: 'acme', projectType: 'website', deliverables });
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
function context(decisions: SessionInput['decisions'], deliverables: Track[]): ProjectContext {
  const base = emptyContext(IDENT(deliverables));
  return applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
}
function readyPlan(deliverables: Track[] = ['website'], strat = strategy(), decisions = FULL) {
  const ctx = context(decisions, deliverables);
  const workflow = planWorkflow({ projectType: 'website', deliverables, strategy: strat, context: ctx });
  const readiness = { projectType: 'website', deliverables, workflow, strategy: strat, context: ctx };
  return planGeneration({ client: 'acme', readiness, assessment: evaluateReadiness(readiness) });
}

describe('P55 generation plan — immutable contract', () => {
  it('the plan is deep-frozen; any mutation throws', () => {
    const plan = readyPlan();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.constraints)).toBe(true);
    expect(Object.isFrozen(plan.scope)).toBe(true);
    expect(() => {
      (plan as { objective: string }).objective = 'HACKED';
    }).toThrow();
    expect(() => plan.constraints.push({} as never)).toThrow();
  });

  it('is self-verifying: the plan id is a content hash, and tampering is detectable', () => {
    const plan = readyPlan();
    expect(plan.planId).toMatch(/^gp-/);
    expect(verifyPlanIntegrity(plan)).toBe(true);
    const tampered = JSON.parse(serializeGenerationPlan(plan));
    tampered.objective = 'HACKED';
    expect(verifyPlanIntegrity(tampered)).toBe(false);
  });
});

describe('P55 generation plan — replay', () => {
  it('serialization round-trips deterministically', () => {
    const plan = readyPlan();
    const s = serializeGenerationPlan(plan);
    expect(serializeGenerationPlan(plan)).toBe(s);
    expect(deserializeGenerationPlan(s)).toEqual(plan);
  });
  it('carries schemaVersion 1 and rejects an unknown one', () => {
    expect(JSON.parse(serializeGenerationPlan(readyPlan())).schemaVersion).toBe(1);
    expect(() => deserializeGenerationPlan(JSON.stringify({ schemaVersion: 4 }))).toThrow(/schemaVersion/);
  });
});

describe('P55 generation manifest correctness', () => {
  it('the manifest is a faithful index of the plan', () => {
    const plan = readyPlan(['website', 'collateral'], strategy({ expectedDeliverables: ['website', 'collateral'] }));
    const m = plan.manifest;
    expect(m.planId).toBe(plan.planId);
    expect(m.checksum).toBe(plan.planId);
    expect(m.deliverables).toEqual(plan.scope.included);
    expect(m.capabilities).toEqual(plan.scope.capabilities);
    // flat, de-duped union of every deliverable's required validations
    const union = [...new Set(plan.requiredValidations.flatMap((v) => v.validations))];
    expect(m.validations).toEqual(union);
    expect(m.constraints).toEqual(plan.constraints.map((c) => c.id));
    expect(m.assumptions).toEqual(plan.assumptions.map((a) => a.id));
    expect(m.assetCount).toBe(plan.requiredAssets.length);
  });
});
