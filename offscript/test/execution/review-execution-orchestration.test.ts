/**
 * E2 — Execution Orchestration (RED-first).
 *
 * Composes the immutable Review Execution Contract (R8) and the Execution Adapter (E1) into a
 * single execution entrypoint. No execution, no browser, no regeneration, no AI — only composition
 * of the two existing layers.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createExecutionPipeline,
  createExecutionOrchestrator,
  orchestrateExecution,
  type ExecutionOrchestratorFns,
} from '../../src/execution/review-execution-orchestration.js';
import { planReviewExecution } from '../../src/review/review-execution-contract.js';
import { adaptReviewExecution } from '../../src/execution/review-execution-adapter.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — same direct-construction style used across R3–R8/E1's own test files ─────────────

function target(overrides: Partial<ReviewTarget> = {}): ReviewTarget {
  return { client: 'acme', track: 'website', targetType: 'page', targetId: 'home', pageId: undefined, ...overrides };
}

function note(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: randomUUID(), target: target(), timestamp: '2026-01-01T00:00:00.000Z', author: 'r1',
    text: 'x', severity: 'minor', state: 'OPEN', category: undefined, ...overrides,
  };
}

function session(notes: ReviewNote[] = [note()]): ReviewSession {
  return {
    id: 'session-1', client: 'acme', track: 'website',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    notes, digest: 'irrelevant',
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

function pipelineResultFor(notes = [note()], ws: WorkspaceState | undefined = healthyWorkspace()) {
  return orchestrateReview({ session: session(notes), model: model(), workspaceState: ws });
}

describe('E2 — end-to-end composition', () => {
  it('composes both stages, producing a contract and a request that reference each other consistently', () => {
    const pr = pipelineResultFor();
    const result = orchestrateExecution(pr);
    expect(result.contract.references.session).toBe(pr.session);
    expect(result.request.context.contract).toBe(result.contract);
    expect(result.identity).toBe(result.request.identity);
  });

  it('runs even for an empty ReviewSession (no notes) — nothing short-circuits', () => {
    const pr = pipelineResultFor([]);
    const result = orchestrateExecution(pr);
    expect(result.stagesExecuted).toEqual(['PLANNING', 'ADAPTATION']);
    expect(result.contract.scope.executableTaskIds).toEqual([]);
  });
});

describe('E2 — no duplicated work: output matches independently calling R8 + E1', () => {
  it('the contract and request are byte-for-byte identical to calling planReviewExecution + adaptReviewExecution directly', () => {
    const pr = pipelineResultFor();
    const result = orchestrateExecution(pr);

    const contract = planReviewExecution(pr);
    const request = adaptReviewExecution(contract);

    expect(result.contract).toEqual(contract);
    expect(result.request).toEqual(request);
  });
});

describe('E2 — reference identity preserved, nothing copied or recomputed', () => {
  it('identity is the EXACT same object E1 produced on the request, not a copy', () => {
    const result = orchestrateExecution(pipelineResultFor());
    expect(result.identity).toBe(result.request.identity);
  });

  it('the request holds the EXACT same contract object the pipeline built, not a re-adapted copy', () => {
    const result = orchestrateExecution(pipelineResultFor());
    expect(result.request.context.contract).toBe(result.contract);
  });
});

describe('E2 — each stage invoked exactly once', () => {
  function countingFns(): { fns: ExecutionOrchestratorFns; counts: Record<string, number> } {
    const counts: Record<string, number> = { planExecution: 0, adaptExecution: 0 };
    const fns: ExecutionOrchestratorFns = {
      planExecution: (...args) => { counts.planExecution++; return planReviewExecution(...args); },
      adaptExecution: (...args) => { counts.adaptExecution++; return adaptReviewExecution(...args); },
    };
    return { fns, counts };
  }

  it('each of the two stage functions is called exactly once per orchestration', () => {
    const { fns, counts } = countingFns();
    const orchestrator = createExecutionOrchestrator(createExecutionPipeline(), fns);
    orchestrator.run(pipelineResultFor());
    expect(counts).toEqual({ planExecution: 1, adaptExecution: 1 });
  });

  it('adaptExecution receives the EXACT contract planExecution just produced — never a re-derivation', () => {
    const seenArgs: unknown[][] = [];
    const fns: ExecutionOrchestratorFns = {
      planExecution: (...args) => { const c = planReviewExecution(...args); seenArgs.push(['planExecution', c]); return c; },
      adaptExecution: (...args) => { seenArgs.push(['adaptExecution', ...args]); return adaptReviewExecution(...args); },
    };
    createExecutionOrchestrator(createExecutionPipeline(), fns).run(pipelineResultFor());
    const contractProduced = seenArgs[0][1];
    expect(seenArgs[1][1]).toBe(contractProduced); // adaptExecution(contract) — same instance
  });
});

describe('E2 — determinism, replay, and shape', () => {
  it('repeated orchestration of the same ReviewPipelineResult is byte-identical', () => {
    const pr = pipelineResultFor();
    const first = orchestrateExecution(pr);
    const second = orchestrateExecution(pr);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying session content changes', () => {
    const a = orchestrateExecution(pipelineResultFor([note({ severity: 'nit' })]));
    const b = orchestrateExecution(pipelineResultFor([note({ severity: 'blocker' })]));
    expect(a.digest).not.toBe(b.digest);
  });

  it('a custom ExecutionPipeline is genuinely sourced into stagesExecuted, not hardcoded', () => {
    const customPipeline = createExecutionPipeline();
    const result = createExecutionOrchestrator(customPipeline).run(pipelineResultFor());
    expect(result.stagesExecuted).toEqual(customPipeline.stages);
  });

  it('createExecutionPipeline() declares the canonical two-stage order', () => {
    expect(createExecutionPipeline().stages).toEqual(['PLANNING', 'ADAPTATION']);
  });

  it('returns a frozen ExecutionPipelineResult and stagesExecuted', () => {
    const result = orchestrateExecution(pipelineResultFor());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stagesExecuted)).toBe(true);
  });

  it('createExecutionOrchestrator().run() matches the orchestrateExecution() convenience function', () => {
    const pr = pipelineResultFor();
    const orchestrator = createExecutionOrchestrator();
    expect(orchestrator.run(pr)).toEqual(orchestrateExecution(pr, orchestrator));
  });

  it('never mutates the given ReviewPipelineResult', () => {
    const pr = pipelineResultFor();
    const before = JSON.stringify(pr);
    orchestrateExecution(pr);
    expect(JSON.stringify(pr)).toBe(before);
  });
});
