/**
 * P53 — Workflow planner + rule policy. Tasks are generated deterministically from project type,
 * deliverables, creative strategy, and living context; dependencies are explicit; the Living Project
 * Context reduces the workflow by marking already-satisfied tasks complete.
 */
import { describe, it, expect } from 'vitest';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { ruleWorkflowPolicy } from '../../src/project/workflow-policy.js';

const IDENTITY = (deliverables: ProjectIdentity['deliverables']): ProjectIdentity => ({ client: 'x', projectType: 'website', deliverables });

/** A low-risk, standard strategy (the "simple website" shape). */
function strategy(over: Partial<CreativeStrategy> = {}): CreativeStrategy {
  return {
    projectComplexity: 'standard',
    creativeMaturity: 'guided',
    brandMaturity: 'nascent',
    evidenceCompleteness: 0.5,
    riskLevel: 'low',
    expectedDeliverables: ['website'],
    requiredStakeholders: ['project owner'],
    requiredApprovals: [],
    unknownCriticalDecisions: [],
    ...over,
  };
}

/** Pure context fold (no fs) — fold one authored session into an empty context. */
function contextWith(deliverables: ProjectIdentity['deliverables'], input: Parameters<typeof newSession>[0]): ProjectContext {
  const base = emptyContext(IDENTITY(deliverables));
  return applySession(base, newSession(input, base, '2026-01-01T00:00:00Z'));
}

describe('P53 workflow planner', () => {
  it('every project produces a workflow: foundation + a generation task per deliverable', () => {
    const plan = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy() });
    const ids = plan.tasks.map((t) => t.id);
    expect(ids).toContain('review-brand-kit');
    expect(ids).toContain('confirm-audience');
    expect(ids).toContain('validate-assets');
    expect(ids).toContain('generate-website');
    // generation depends on the foundation (explicit dependencies)
    const gen = plan.tasks.find((t) => t.id === 'generate-website')!;
    expect(gen.dependsOn).toEqual(expect.arrayContaining(['review-brand-kit', 'confirm-audience', 'validate-assets']));
    expect(gen.owner).toBe('website-author');
  });

  it('tasks are in topological order and every task carries a status', () => {
    const plan = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy() });
    const pos = (id: string) => plan.tasks.findIndex((t) => t.id === id);
    expect(pos('review-brand-kit')).toBeLessThan(pos('generate-website'));
    expect(plan.tasks.every((t) => ['ready', 'blocked', 'complete'].includes(t.status))).toBe(true);
    // with no context, the generation task is blocked behind the foundation
    expect(plan.tasks.find((t) => t.id === 'generate-website')!.status).toBe('blocked');
  });

  it('ENTERPRISE (high-risk) expands the workflow with stakeholder + approval tasks', () => {
    const simple = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy() });
    const enterprise = planWorkflow({
      projectType: 'website',
      deliverables: ['website'],
      strategy: strategy({
        riskLevel: 'high',
        requiredStakeholders: ['project owner', 'compliance officer'],
        requiredApprovals: ['legal/compliance sign-off'],
      }),
    });
    const eids = enterprise.tasks.map((t) => t.id);
    expect(eids).toContain('stakeholder-review');
    expect(eids.some((id) => id.startsWith('approval-'))).toBe(true);
    expect(enterprise.tasks.length).toBeGreaterThan(simple.tasks.length);
    // an approval gates on the review, which gates on generation → longer critical path
    expect(enterprise.analysis.criticalPath.length).toBeGreaterThan(simple.analysis.criticalPath.length);
  });

  it('WEBSITE + COLLATERAL creates a cross-deliverable dependency (collateral depends on website)', () => {
    const plan = planWorkflow({
      projectType: 'full-brand-package',
      deliverables: ['website', 'collateral'],
      strategy: strategy({ expectedDeliverables: ['website', 'collateral'] }),
    });
    const collateral = plan.tasks.find((t) => t.id === 'prepare-collateral')!;
    expect(collateral.dependsOn).toContain('generate-website');
  });

  it('EXISTING CONTEXT reduces the workflow — satisfied tasks are marked complete', () => {
    const ctx = contextWith(['website'], {
      goal: 'prior work',
      decisions: [
        { kind: 'confirmed', subject: 'brand', to: 'Acme' },
        { kind: 'confirmed', subject: 'audience', to: 'Devs' },
        { kind: 'asset', subject: 'logo.svg' },
      ],
      artifacts: ['website.html'],
    });
    const cold = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy() });
    const warm = planWorkflow({ projectType: 'website', deliverables: ['website'], strategy: strategy(), context: ctx });

    const done = new Set(warm.analysis.completed);
    expect(done.has('review-brand-kit')).toBe(true);
    expect(done.has('confirm-audience')).toBe(true);
    expect(done.has('generate-website')).toBe(true);
    // a known logo drops the "request missing logo" task entirely
    expect(cold.tasks.some((t) => t.id === 'request-missing-logo')).toBe(true);
    expect(warm.tasks.some((t) => t.id === 'request-missing-logo')).toBe(false);
    expect(warm.analysis.completed.length).toBeGreaterThan(cold.analysis.completed.length);
    expect(warm.version).toBe(ctx.version);
  });

  it('is deterministic and replayable — same inputs yield an identical plan', () => {
    const inputs = { projectType: 'website' as const, deliverables: ['website'] as ProjectIdentity['deliverables'], strategy: strategy() };
    expect(planWorkflow(inputs)).toEqual(planWorkflow(inputs));
  });

  it('capabilities gate: an unavailable owner drops its task and its dependents', () => {
    const full = planWorkflow({ projectType: 'fbp', deliverables: ['website', 'collateral'], strategy: strategy() });
    const gated = planWorkflow({
      projectType: 'fbp',
      deliverables: ['website', 'collateral'],
      strategy: strategy(),
      capabilities: ['brand', 'creative-director', 'asset', 'website-author', 'stakeholder'], // no collateral-author
    });
    expect(full.tasks.some((t) => t.id === 'prepare-collateral')).toBe(true);
    expect(gated.tasks.some((t) => t.id === 'prepare-collateral')).toBe(false);
    expect(gated.tasks.some((t) => t.id === 'generate-website')).toBe(true); // unaffected
  });

  it('the rule policy is a named, swappable seam', () => {
    expect(ruleWorkflowPolicy().id).toBe('rule-based');
  });
});
