/**
 * E3 — Native Review Execution (RED-first).
 *
 * The first native execution engine for Program E. Executes the Review Execution Pipeline —
 * deliberately performing NO regeneration — and materializes the canonical ExecutionResult
 * artifact. No AI, no browser, no HTML, no persistence.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createReviewExecutionEngine,
  executeReviewPipeline,
} from '../../src/execution/native-review-execution.js';
import { orchestrateExecution, type ExecutionPipelineResult } from '../../src/execution/review-execution-orchestration.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';
import type { RegenerationReadiness } from '../../src/review/regeneration-readiness.js';

// ── fixtures — same direct-construction style used across R3–R8/E1/E2's own test files ──────────

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

function pipelineFor(notes = [note()], ws: WorkspaceState | undefined = healthyWorkspace()): ExecutionPipelineResult {
  const pr = orchestrateReview({ session: session(notes), model: model(), workspaceState: ws });
  return orchestrateExecution(pr);
}

/** No-default variant for the "no workspace" case — a default *parameter* triggers on an
 *  explicitly-passed `undefined` too (JS semantics), so `pipelineFor(notes, undefined)` would
 *  silently fall back to `healthyWorkspace()` rather than actually omitting it. */
function pipelineWithoutWorkspace(notes: ReviewNote[]): ExecutionPipelineResult {
  const pr = orchestrateReview({ session: session(notes), model: model() });
  return orchestrateExecution(pr);
}

/** Splices a different readiness state onto an otherwise-real pipeline result, mirroring the
 *  tampering technique R8/E1's own test files already use — legitimate here because the engine
 *  reads plain fields, never re-verifies the contract's own digest. Used only to reach the two
 *  readiness states (WAITING_FOR_PROJECT, UNKNOWN) that real fixtures can't cheaply trigger. Keeps
 *  `request.context.contract` pointed at the SAME spliced contract, so this isolates the readiness
 *  change alone — it does not also (accidentally) break reference consistency. */
function withReadinessState(pipeline: ExecutionPipelineResult, state: RegenerationReadiness): ExecutionPipelineResult {
  const contract = {
    ...pipeline.contract,
    scope: { ...pipeline.contract.scope, readinessState: state },
    references: { ...pipeline.contract.references, readiness: { ...pipeline.contract.references.readiness, state } },
  };
  const request = { ...pipeline.request, context: { ...pipeline.request.context, contract } };
  return { ...pipeline, contract, request } as ExecutionPipelineResult;
}

describe('E3 — references preserved, nothing recomputed', () => {
  it('identity/contract/request are the EXACT same objects the pipeline result held', () => {
    const pipeline = pipelineFor();
    const result = executeReviewPipeline(pipeline);
    expect(result.identity).toBe(pipeline.identity);
    expect(result.contract).toBe(pipeline.contract);
    expect(result.request).toBe(pipeline.request);
  });

  it('never mutates the given ExecutionPipelineResult', () => {
    const pipeline = pipelineFor();
    const before = JSON.stringify(pipeline);
    executeReviewPipeline(pipeline);
    expect(JSON.stringify(pipeline)).toBe(before);
  });
});

describe('E3 — stepsCompleted mirrors the pipeline\'s own stagesExecuted', () => {
  it('one ExecutionStep per completed stage, in order, each COMPLETED', () => {
    const pipeline = pipelineFor();
    const result = executeReviewPipeline(pipeline);
    expect(result.stepsCompleted).toEqual(pipeline.stagesExecuted.map((name) => ({ name, status: 'COMPLETED' })));
  });
});

describe('E3 — status: never boolean, explicit states derived from readiness', () => {
  it('READY readiness (vacuous, empty session) → COMPLETED', () => {
    const result = executeReviewPipeline(pipelineFor([]));
    expect(result.contract.scope.readinessState).toBe('READY');
    expect(result.status).toBe('COMPLETED');
  });

  it('BLOCKED readiness (unresolved scope target) → BLOCKED', () => {
    const pipeline = pipelineFor([note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const result = executeReviewPipeline(pipeline);
    expect(result.contract.scope.readinessState).toBe('BLOCKED');
    expect(result.status).toBe('BLOCKED');
  });

  it('WAITING_FOR_WORKSPACE readiness (no workspace given) → BLOCKED', () => {
    const pipeline = pipelineWithoutWorkspace([note()]);
    const result = executeReviewPipeline(pipeline);
    expect(result.contract.scope.readinessState).toBe('WAITING_FOR_WORKSPACE');
    expect(result.status).toBe('BLOCKED');
  });

  it('WAITING_FOR_PROJECT readiness → BLOCKED', () => {
    const result = executeReviewPipeline(withReadinessState(pipelineFor(), 'WAITING_FOR_PROJECT'));
    expect(result.status).toBe('BLOCKED');
  });

  it('INVALID readiness (workspace client/track mismatch) → INVALID', () => {
    const mismatched = healthyWorkspace({ project: { client: 'other-co', track: 'website' } });
    const pipeline = pipelineFor([note()], mismatched);
    const result = executeReviewPipeline(pipeline);
    expect(result.contract.scope.readinessState).toBe('INVALID');
    expect(result.status).toBe('INVALID');
  });

  it('UNKNOWN readiness → UNKNOWN', () => {
    const result = executeReviewPipeline(withReadinessState(pipelineFor(), 'UNKNOWN'));
    expect(result.status).toBe('UNKNOWN');
  });

  it('an internally inconsistent pipeline result (stages missing) → FAILED', () => {
    const pipeline = pipelineFor();
    const broken = { ...pipeline, stagesExecuted: Object.freeze(['PLANNING']) } as ExecutionPipelineResult;
    const result = executeReviewPipeline(broken);
    expect(result.status).toBe('FAILED');
    expect(result.diagnostics.stagesComplete).toBe(false);
  });

  it('an internally inconsistent pipeline result (request points at a different contract) → FAILED', () => {
    const pipeline = pipelineFor();
    const otherPipeline = pipelineFor([note({ severity: 'blocker' })]);
    const broken = { ...pipeline, request: otherPipeline.request } as ExecutionPipelineResult;
    const result = executeReviewPipeline(broken);
    expect(result.status).toBe('FAILED');
    expect(result.diagnostics.referencesConsistent).toBe(false);
  });
});

describe('E3 — diagnostics: grounded in already-computed contract data, never fabricated', () => {
  it('every diagnostics field is consistent with the actual contract it was built from', () => {
    const pipeline = pipelineFor([note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const result = executeReviewPipeline(pipeline);
    const readiness = pipeline.contract.references.readiness;
    expect(result.diagnostics.readinessState).toBe(readiness.state);
    expect(result.diagnostics.blockingBlockerCount).toBe(readiness.summary.blockingBlockerCount);
    expect(result.diagnostics.warningBlockerCount).toBe(readiness.summary.warningBlockerCount);
    expect(result.diagnostics.constraintCount).toBe(pipeline.contract.constraints.length);
    expect(result.diagnostics.executableTaskCount).toBe(pipeline.contract.scope.executableTaskIds.length);
    expect(result.diagnostics.blockedTaskCount).toBe(pipeline.contract.scope.blockedTaskIds.length);
    expect(result.diagnostics.stagesComplete).toBe(true);
    expect(result.diagnostics.referencesConsistent).toBe(true);
  });
});

describe('E3 — immutability', () => {
  it('the result, its stepsCompleted, and its diagnostics are frozen', () => {
    const result = executeReviewPipeline(pipelineFor());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stepsCompleted)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const result = executeReviewPipeline(pipelineFor());
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      result.status = 'FAILED';
    }).toThrow();
  });
});

describe('E3 — determinism and shape', () => {
  it('repeated execution of the same pipeline result is byte-identical', () => {
    const pipeline = pipelineFor();
    const first = executeReviewPipeline(pipeline);
    const second = executeReviewPipeline(pipeline);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying pipeline result changes', () => {
    const a = executeReviewPipeline(pipelineFor([note({ severity: 'nit' })]));
    const b = executeReviewPipeline(pipelineFor([note({ severity: 'blocker' })]));
    expect(a.digest).not.toBe(b.digest);
  });

  it('createReviewExecutionEngine().execute() matches executeReviewPipeline()', () => {
    const pipeline = pipelineFor();
    const engine = createReviewExecutionEngine();
    expect(engine.execute(pipeline)).toEqual(executeReviewPipeline(pipeline, engine));
  });

  it('consumes exactly one pipeline result — consecutive calls on different results never cross-contaminate', () => {
    const engine = createReviewExecutionEngine();
    const a = pipelineFor([note({ severity: 'nit' })]);
    const b = pipelineFor([note({ severity: 'blocker' })]);
    const resultA = engine.execute(a);
    const resultB = engine.execute(b);
    expect(engine.execute(a)).toEqual(resultA);
    expect(engine.execute(b)).toEqual(resultB);
    expect(resultA.digest).not.toBe(resultB.digest);
  });
});
