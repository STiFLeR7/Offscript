/**
 * R7 — Review Regeneration Orchestration (RED-first).
 *
 * Pure composition of the existing R1–R6 pipeline into one deterministic flow. No new planning, no
 * new evaluation, no execution, no regeneration — every stage reuses the existing implementation
 * verbatim.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createReviewPipeline,
  createReviewOrchestrator,
  orchestrateReview,
  type ReviewOrchestratorFns,
} from '../../src/review/review-orchestration.js';
import { analyzeReviewSession } from '../../src/review/review-analysis.js';
import { planReviewSession } from '../../src/review/review-planning.js';
import { resolveReviewScope } from '../../src/review/review-scope.js';
import { resolveRegenerationPlan } from '../../src/review/regeneration-planning.js';
import { evaluateRegenerationReadiness } from '../../src/review/regeneration-readiness.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — plain objects, the same direct-construction style R3–R6 used for their own inputs ──

function target(overrides: Partial<ReviewTarget> = {}): ReviewTarget {
  return { client: 'acme', track: 'website', targetType: 'page', targetId: 'home', pageId: undefined, ...overrides };
}

function note(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: randomUUID(), target: target(), timestamp: '2026-01-01T00:00:00.000Z', author: 'r1',
    text: 'x', severity: 'minor', state: 'OPEN', category: undefined, ...overrides,
  };
}

function session(notes: ReviewNote[] = [note()], overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    id: 'session-1', client: 'acme', track: 'website',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    notes, digest: 'irrelevant',
    ...overrides,
  };
}

function viewNode(kind: 'section' | 'slot', id: string, componentRef = `${kind}:${id}`, children: ViewNode[] = []): ViewNode {
  return { id, kind, componentRef, props: {}, digest: 'irrelevant', children };
}

function page(id: string, view: ViewNode[] = []): ProjectPage {
  return { id, role: 'page', componentRef: 'page:generic', view, digest: 'irrelevant' };
}

function model(overrides: Partial<ProjectModel> = {}): ProjectModel {
  return {
    metadata: { title: 'Acme' }, tokens: [],
    pages: [page('home', [viewNode('section', 'hero')])],
    componentRefs: ['document:website', 'page:generic', 'section:hero'],
    assets: [],
    manifest: { client: 'acme', track: 'website', sourceDigest: 'irrelevant', pageCount: 1, sectionCount: 1, slotCount: 0 },
    digest: 'model-digest-abc',
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
    digests: { generationDigest: 'generated-digest-xyz', materializationDigest: 'generated-digest-xyz' },
    status: 'READY',
    ...overrides,
  };
}

describe('R7 — end-to-end composition', () => {
  it('composes all five stages, each correctly linked to the input session', () => {
    const s = session();
    const m = model();
    const result = orchestrateReview({ session: s, model: m, workspaceState: healthyWorkspace() });
    expect(result.session).toBe(s);
    expect(result.analysis.sessionId).toBe(s.id);
    expect(result.plan.sessionId).toBe(s.id);
    expect(result.scope.sessionId).toBe(s.id);
    expect(result.regenerationPlan.sessionId).toBe(s.id);
    expect(result.readiness.sessionId).toBe(s.id);
  });

  it('every stage runs even for an empty ReviewSession (no notes) — nothing short-circuits', () => {
    const result = orchestrateReview({ session: session([]), model: model() });
    expect(result.stagesExecuted).toEqual(['ANALYSIS', 'PLANNING', 'SCOPE', 'REGENERATION_PLANNING', 'READINESS']);
    expect(result.plan.tasks).toEqual([]);
    expect(result.regenerationPlan.tasks).toEqual([]);
    expect(result.readiness.state).toBe('READY'); // empty plan is vacuously READY (R6 §5)
  });

  it('readiness is still computed when workspaceState is omitted (optional input)', () => {
    const result = orchestrateReview({ session: session(), model: model() });
    expect(result.readiness.state).toBe('WAITING_FOR_WORKSPACE');
  });
});

describe('R7 — no duplicated work: output matches independently calling R2–R6', () => {
  it('every derived artifact is byte-for-byte identical to calling R2–R6 directly', () => {
    const s = session();
    const m = model();
    const ws = healthyWorkspace();
    const result = orchestrateReview({ session: s, model: m, workspaceState: ws });

    const analysis = analyzeReviewSession(s);
    const plan = planReviewSession(s, analysis);
    const scope = resolveReviewScope(plan, m);
    const regenerationPlan = resolveRegenerationPlan(scope, m);
    const readiness = evaluateRegenerationReadiness(regenerationPlan, ws);

    expect(result.analysis).toEqual(analysis);
    expect(result.plan).toEqual(plan);
    expect(result.scope).toEqual(scope);
    expect(result.regenerationPlan).toEqual(regenerationPlan);
    expect(result.readiness).toEqual(readiness);
  });

  it('R7 adds no validation of its own — a client/track mismatch surfaces via R4’s EXISTING check, not a duplicate one', () => {
    const s = session();
    const mismatched = model({ manifest: { client: 'other-co', track: 'website', sourceDigest: 'x', pageCount: 1, sectionCount: 1, slotCount: 0 } });
    expect(() => orchestrateReview({ session: s, model: mismatched })).toThrow(/client|track|mismatch/i);
  });
});

describe('R7 — every stage invoked exactly once', () => {
  function countingFns(): { fns: ReviewOrchestratorFns; counts: Record<string, number> } {
    const counts: Record<string, number> = { analyze: 0, plan: 0, resolveScope: 0, planRegeneration: 0, evaluateReadiness: 0 };
    const fns: ReviewOrchestratorFns = {
      analyze: (...args) => { counts.analyze++; return analyzeReviewSession(...args); },
      plan: (...args) => { counts.plan++; return planReviewSession(...args); },
      resolveScope: (...args) => { counts.resolveScope++; return resolveReviewScope(...args); },
      planRegeneration: (...args) => { counts.planRegeneration++; return resolveRegenerationPlan(...args); },
      evaluateReadiness: (...args) => { counts.evaluateReadiness++; return evaluateRegenerationReadiness(...args); },
    };
    return { fns, counts };
  }

  it('each of the five stage functions is called exactly once per orchestration', () => {
    const { fns, counts } = countingFns();
    const orchestrator = createReviewOrchestrator(createReviewPipeline(), fns);
    orchestrator.run({ session: session(), model: model(), workspaceState: healthyWorkspace() });
    expect(counts).toEqual({ analyze: 1, plan: 1, resolveScope: 1, planRegeneration: 1, evaluateReadiness: 1 });
  });

  it('stages receive exactly the arguments each real function expects — no re-derivation', () => {
    const s = session();
    const m = model();
    const ws = healthyWorkspace();
    const seenArgs: unknown[][] = [];
    const fns: ReviewOrchestratorFns = {
      analyze: (...args) => { seenArgs.push(['analyze', ...args]); return analyzeReviewSession(...args); },
      plan: (...args) => { seenArgs.push(['plan', ...args]); return planReviewSession(...args); },
      resolveScope: (...args) => { seenArgs.push(['resolveScope', ...args]); return resolveReviewScope(...args); },
      planRegeneration: (...args) => { seenArgs.push(['planRegeneration', ...args]); return resolveRegenerationPlan(...args); },
      evaluateReadiness: (...args) => { seenArgs.push(['evaluateReadiness', ...args]); return evaluateRegenerationReadiness(...args); },
    };
    createReviewOrchestrator(createReviewPipeline(), fns).run({ session: s, model: m, workspaceState: ws });
    expect(seenArgs[0][1]).toBe(s); // analyze(session)
    expect(seenArgs[1][1]).toBe(s); // plan(session, analysis)
    expect(seenArgs[2][2]).toBe(m); // resolveScope(plan, model)
    expect(seenArgs[3][2]).toBe(m); // planRegeneration(scope, model)
    expect(seenArgs[4][2]).toBe(ws); // evaluateReadiness(regenerationPlan, workspaceState)
  });
});

describe('R7 — determinism, replay, and shape', () => {
  it('repeated orchestration of the same context is byte-identical', () => {
    const ctx = { session: session(), model: model(), workspaceState: healthyWorkspace() };
    const first = orchestrateReview(ctx);
    const second = orchestrateReview(ctx);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying session content changes', () => {
    const m = model();
    const a = orchestrateReview({ session: session([note({ severity: 'nit' })]), model: m });
    const b = orchestrateReview({ session: session([note({ severity: 'blocker' })]), model: m });
    expect(a.digest).not.toBe(b.digest);
  });

  it('digest changes when workspaceState changes but the session/model do not', () => {
    const s = session();
    const m = model();
    const a = orchestrateReview({ session: s, model: m, workspaceState: healthyWorkspace({ status: 'READY' }) });
    const b = orchestrateReview({ session: s, model: m, workspaceState: healthyWorkspace({ status: 'FAILED' }) });
    expect(a.digest).not.toBe(b.digest);
  });

  it('a custom ReviewPipeline is genuinely sourced into stagesExecuted, not hardcoded', () => {
    const customPipeline = createReviewPipeline();
    const result = createReviewOrchestrator(customPipeline).run({ session: session(), model: model() });
    expect(result.stagesExecuted).toEqual(customPipeline.stages);
  });

  it('createReviewPipeline() declares the canonical five-stage order', () => {
    expect(createReviewPipeline().stages).toEqual(['ANALYSIS', 'PLANNING', 'SCOPE', 'REGENERATION_PLANNING', 'READINESS']);
  });

  it('returns a frozen ReviewPipelineResult and stagesExecuted', () => {
    const result = orchestrateReview({ session: session(), model: model() });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stagesExecuted)).toBe(true);
  });

  it('createReviewOrchestrator().run() matches the orchestrateReview() convenience function', () => {
    const ctx = { session: session(), model: model(), workspaceState: healthyWorkspace() };
    const orchestrator = createReviewOrchestrator();
    expect(orchestrator.run(ctx)).toEqual(orchestrateReview(ctx, orchestrator));
  });

  it('never mutates the given session, model, or workspaceState', () => {
    const s = session();
    const m = model();
    const ws = healthyWorkspace();
    const beforeS = JSON.stringify(s);
    const beforeM = JSON.stringify(m);
    const beforeWs = JSON.stringify(ws);
    orchestrateReview({ session: s, model: m, workspaceState: ws });
    expect(JSON.stringify(s)).toBe(beforeS);
    expect(JSON.stringify(m)).toBe(beforeM);
    expect(JSON.stringify(ws)).toBe(beforeWs);
  });
});
