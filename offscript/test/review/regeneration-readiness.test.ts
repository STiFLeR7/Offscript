/**
 * R6 — Regeneration Readiness (RED-first).
 *
 * The admission gate that determines whether a RegenerationPlan may execute — never regeneration
 * itself. No AI, no execution, no workspace mutation, no HTML/browser access.
 */
import { describe, it, expect } from 'vitest';
import {
  createRegenerationReadinessEvaluator,
  createDefaultRegenerationReadinessPolicy,
  evaluateRegenerationReadiness,
  type RegenerationReadinessPolicy,
} from '../../src/review/regeneration-readiness.js';
import type { RegenerationPlan, RegenerationTask } from '../../src/review/regeneration-planning.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — plain RegenerationPlan/WorkspaceState objects, the same direct-construction style
// R3–R5 used for their own inputs ────────────────────────────────────────────────────────────────

function task(overrides: Partial<RegenerationTask> = {}): RegenerationTask {
  return {
    id: 'regen:WHOLE_PROJECT', unit: 'WHOLE_PROJECT', impact: 'COARSENED',
    affectedTargets: ['t1'], reason: 'x', dependencies: [], priority: 'HIGH', digest: 'irrelevant',
    ...overrides,
  };
}

function plan(tasks: RegenerationTask[], overrides: Partial<RegenerationPlan> = {}): RegenerationPlan {
  return {
    sessionId: 'session-1', client: 'acme', track: 'website',
    tasks, sourceModelDigest: 'model-digest-abc', digest: 'irrelevant',
    ...overrides,
  };
}

function healthyWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    project: { client: 'acme', track: 'website' },
    generation: { fileCount: 1, directoryCount: 1, targetDir: '/tmp/acme-website' },
    preview: undefined,
    health: undefined,
    timestamps: { generatedAt: 't', materializedAt: 't', previewStartedAt: undefined, healthCheckedAt: undefined, updatedAt: 't' },
    digests: { generationDigest: 'model-digest-abc', materializationDigest: 'model-digest-abc' },
    status: 'MATERIALIZED',
    ...overrides,
  };
}

describe('R6 — workspace-level readiness checks', () => {
  it('no WorkspaceState provided -> WAITING_FOR_WORKSPACE', () => {
    const decision = evaluateRegenerationReadiness(plan([task()]), undefined);
    expect(decision.state).toBe('WAITING_FOR_WORKSPACE');
    expect(decision.blockers.map((b) => b.category)).toEqual(['WORKSPACE_MISSING']);
  });

  it('a WorkspaceState for a different client/track -> INVALID', () => {
    const ws = healthyWorkspace({ project: { client: 'other-co', track: 'website' } });
    const decision = evaluateRegenerationReadiness(plan([task()]), ws);
    expect(decision.state).toBe('INVALID');
    expect(decision.blockers[0].category).toBe('INVALID_INPUT');
  });

  it('no recorded generation yet (generation undefined) -> WAITING_FOR_PROJECT', () => {
    const ws = healthyWorkspace({ generation: undefined });
    const decision = evaluateRegenerationReadiness(plan([task()]), ws);
    expect(decision.state).toBe('WAITING_FOR_PROJECT');
    expect(decision.blockers[0].category).toBe('PROJECT_NOT_GENERATED');
  });

  it('WorkspaceState.digests.generationDigest is a different hash domain than plan.sourceModelDigest and is never compared', () => {
    // generationDigest (GeneratedProject.digest, F5) vs sourceModelDigest (ProjectModel.digest, F4)
    // are deliberately incomparable (§ header note) — a "mismatch" here must NOT produce a blocker.
    const ws = healthyWorkspace({ digests: { generationDigest: 'totally-unrelated-digest', materializationDigest: 'totally-unrelated-digest' } });
    const decision = evaluateRegenerationReadiness(plan([task()]), ws);
    expect(decision.state).toBe('READY');
    expect(decision.blockers).toEqual([]);
  });

  it('a task unit outside what Program F has confirmed executable -> UNKNOWN (indeterminate capability)', () => {
    // Reachable via R5's own custom-policy extensibility (a plan could legitimately claim a finer
    // unit than 'WHOLE_PROJECT') — R6 has not verified that capability, so it is honestly UNKNOWN,
    // never silently treated as either READY or BLOCKED.
    const decision = evaluateRegenerationReadiness(plan([task({ id: 'regen:SECTION', unit: 'SECTION', impact: 'EXACT' })]), healthyWorkspace());
    expect(decision.state).toBe('UNKNOWN');
    expect(decision.blockers[0].category).toBe('INDETERMINATE_CAPABILITY');
  });

  it('workspace status FAILED -> BLOCKED', () => {
    const ws = healthyWorkspace({ status: 'FAILED' });
    const decision = evaluateRegenerationReadiness(plan([task()]), ws);
    expect(decision.state).toBe('BLOCKED');
    expect(decision.blockers[0].category).toBe('WORKSPACE_UNHEALTHY');
    expect(decision.blockers[0].severity).toBe('BLOCKING');
  });

  it('workspace status STALE is a WARNING only — does not by itself prevent READY', () => {
    const ws = healthyWorkspace({ status: 'STALE' });
    const decision = evaluateRegenerationReadiness(plan([task()]), ws);
    expect(decision.state).toBe('READY');
    expect(decision.blockers).toHaveLength(1);
    expect(decision.blockers[0].severity).toBe('WARNING');
  });
});

describe('R6 — plan-level readiness checks', () => {
  it('a plan whose only task is UNKNOWN-unit -> BLOCKED (unresolved scope), even with a healthy workspace', () => {
    const decision = evaluateRegenerationReadiness(plan([task({ id: 'regen:UNKNOWN', unit: 'UNKNOWN', impact: 'UNKNOWN' })]), healthyWorkspace());
    expect(decision.state).toBe('BLOCKED');
    expect(decision.blockers[0].category).toBe('UNRESOLVED_SCOPE');
    expect(decision.summary.executableTasks).toBe(0);
    expect(decision.summary.blockedTasks).toBe(1);
  });

  it('a fully healthy workspace + an all-WHOLE_PROJECT plan -> READY, zero blockers', () => {
    const decision = evaluateRegenerationReadiness(plan([task()]), healthyWorkspace());
    expect(decision.state).toBe('READY');
    expect(decision.blockers).toEqual([]);
  });

  it('an empty plan (zero tasks) -> READY regardless of workspace, even when undefined', () => {
    expect(evaluateRegenerationReadiness(plan([]), undefined).state).toBe('READY');
    expect(evaluateRegenerationReadiness(plan([]), healthyWorkspace({ status: 'FAILED' })).state).toBe('READY');
  });

  it('a mixed WHOLE_PROJECT + UNKNOWN plan is BLOCKED, with correct per-task accounting', () => {
    const tasks = [task({ id: 'regen:WHOLE_PROJECT' }), task({ id: 'regen:UNKNOWN', unit: 'UNKNOWN', impact: 'UNKNOWN', affectedTargets: ['t2'] })];
    const decision = evaluateRegenerationReadiness(plan(tasks), healthyWorkspace());
    expect(decision.state).toBe('BLOCKED');
    expect(decision.summary.totalTasks).toBe(2);
    expect(decision.summary.executableTasks).toBe(1);
    expect(decision.summary.blockedTasks).toBe(1);
    expect(decision.blockers[0].affectedTasks).toEqual(['regen:UNKNOWN']);
  });
});

describe('R6 — precedence: the worst blocker wins', () => {
  it('INVALID (mismatched workspace) wins even when the plan also has an unresolved-scope task', () => {
    const ws = healthyWorkspace({ project: { client: 'other-co', track: 'website' } });
    const decision = evaluateRegenerationReadiness(plan([task({ unit: 'UNKNOWN', impact: 'UNKNOWN' })]), ws);
    expect(decision.state).toBe('INVALID');
  });

  it('WAITING_FOR_WORKSPACE wins over a would-be BLOCKED plan issue when no workspace is given', () => {
    const decision = evaluateRegenerationReadiness(plan([task({ unit: 'UNKNOWN', impact: 'UNKNOWN' })]), undefined);
    expect(decision.state).toBe('WAITING_FOR_WORKSPACE');
  });
});

describe('R6 — determinism, replay, purity, and shape', () => {
  it('blocker ordering is stable across repeated evaluations of the same input', () => {
    const ws = healthyWorkspace({ status: 'FAILED', digests: { generationDigest: 'other', materializationDigest: 'other' } });
    const p = plan([task({ unit: 'UNKNOWN', impact: 'UNKNOWN' })]);
    const first = evaluateRegenerationReadiness(p, ws);
    const second = evaluateRegenerationReadiness(p, ws);
    expect(first.blockers.map((b) => b.category)).toEqual(second.blockers.map((b) => b.category));
  });

  it('repeated evaluation of the same plan+workspace is byte-identical', () => {
    const p = plan([task()]);
    const ws = healthyWorkspace();
    const first = evaluateRegenerationReadiness(p, ws);
    const second = evaluateRegenerationReadiness(p, ws);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('never mutates the given RegenerationPlan or WorkspaceState', () => {
    const p = plan([task()]);
    const ws = healthyWorkspace();
    const beforePlan = JSON.stringify(p);
    const beforeWs = JSON.stringify(ws);
    evaluateRegenerationReadiness(p, ws);
    expect(JSON.stringify(p)).toBe(beforePlan);
    expect(JSON.stringify(ws)).toBe(beforeWs);
  });

  it('sourceModelDigest traces back to the plan it was computed from', () => {
    const decision = evaluateRegenerationReadiness(plan([task()], { sourceModelDigest: 'specific-digest' }), healthyWorkspace({ digests: { generationDigest: 'specific-digest', materializationDigest: 'specific-digest' } }));
    expect(decision.sourceModelDigest).toBe('specific-digest');
  });

  it('returns a frozen ReadinessDecision, blockers, and summary', () => {
    const decision = evaluateRegenerationReadiness(plan([task({ unit: 'UNKNOWN', impact: 'UNKNOWN' })]), healthyWorkspace());
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.blockers[0])).toBe(true);
    expect(Object.isFrozen(decision.blockers[0].affectedTasks)).toBe(true);
    expect(Object.isFrozen(decision.summary)).toBe(true);
  });

  it('blocker reason and resolution are real, non-empty, data-driven strings', () => {
    const decision = evaluateRegenerationReadiness(plan([task(), task({ id: 'regen:UNKNOWN2', unit: 'UNKNOWN', impact: 'UNKNOWN', affectedTargets: ['a', 'b'] })]), healthyWorkspace());
    const blocker = decision.blockers.find((b) => b.category === 'UNRESOLVED_SCOPE')!;
    expect(blocker.reason.length).toBeGreaterThan(10);
    expect(blocker.resolution.length).toBeGreaterThan(10);
    expect(blocker.reason).toMatch(/1/); // one unresolved task, a real count
  });

  it('a plan with ALL tasks UNKNOWN-unit is BLOCKED with zero executable tasks', () => {
    const tasks = [task({ id: 'a', unit: 'UNKNOWN', impact: 'UNKNOWN', affectedTargets: ['x'] })];
    const decision = evaluateRegenerationReadiness(plan(tasks), healthyWorkspace());
    expect(decision.state).toBe('BLOCKED');
    expect(decision.summary.executableTasks).toBe(0);
    expect(decision.summary.blockedTasks).toBe(1);
  });

  it('a custom RegenerationReadinessPolicy fully overrides blocker detection', () => {
    const policy: RegenerationReadinessPolicy = {
      evaluate: () => [{ category: 'WORKSPACE_UNHEALTHY', severity: 'BLOCKING', reason: 'custom', affectedTasks: [], resolution: 'custom' }],
    };
    const decision = createRegenerationReadinessEvaluator().decide(plan([task()]), healthyWorkspace(), policy);
    expect(decision.state).toBe('BLOCKED');
    expect(decision.blockers[0].reason).toBe('custom');
  });

  it('createRegenerationReadinessEvaluator().decide() matches evaluateRegenerationReadiness()', () => {
    const p = plan([task()]);
    const ws = healthyWorkspace();
    const evaluator = createRegenerationReadinessEvaluator();
    expect(evaluator.decide(p, ws)).toEqual(evaluateRegenerationReadiness(p, ws, evaluator));
  });

  it('createDefaultRegenerationReadinessPolicy() is the implicit default used when no policy is passed', () => {
    const p = plan([task()]);
    const ws = healthyWorkspace();
    const viaDefault = evaluateRegenerationReadiness(p, ws);
    const viaExplicit = createRegenerationReadinessEvaluator().decide(p, ws, createDefaultRegenerationReadinessPolicy());
    expect(viaDefault).toEqual(viaExplicit);
  });
});
