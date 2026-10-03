/**
 * E6 — Execution Admission (RED-first).
 *
 * The deterministic gate a caller consults BEFORE letting a session begin. It never executes and
 * never mutates — it only evaluates whether execution is admissible, reusing R6's own readiness
 * decision verbatim. No AI, no browser, no regeneration.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createExecutionAdmissionEvaluator,
  createDefaultExecutionAdmissionRule,
  evaluateExecutionAdmission,
  type ExecutionAdmissionRule,
  type ExecutionAdmissionBlocker,
} from '../../src/execution/execution-admission.js';
import { orchestrateExecution, type ExecutionPipelineResult } from '../../src/execution/review-execution-orchestration.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — same direct-construction style used across R3–R8/E1–E5's own test files ──────────

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
function pipelineWithoutWorkspace(notes: ReviewNote[]): ExecutionPipelineResult {
  const pr = orchestrateReview({ session: session(notes), model: model() });
  return orchestrateExecution(pr);
}

const blockedNotes = [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]; // → UNRESOLVED_SCOPE → BLOCKED
const invalidWorkspace = healthyWorkspace({ project: { client: 'other-co', track: 'website' } }); // → INVALID_INPUT → INVALID

describe('E6 — never duplicates R6 logic: blockers copied verbatim', () => {
  it('every R6 blocker becomes one ExecutionAdmissionBlocker, reason/resolution untouched', () => {
    const pipeline = pipelineFor(blockedNotes);
    const decision = evaluateExecutionAdmission(pipeline);
    const readinessBlockers = pipeline.contract.references.readiness.blockers;
    expect(decision.blockers).toHaveLength(readinessBlockers.length);
    for (const rb of readinessBlockers) {
      const match = decision.blockers.find((b) => b.source === `r6:${rb.category}`);
      expect(match?.reason).toBe(rb.reason);
      expect(match?.resolution).toBe(rb.resolution);
      expect(match?.severity).toBe(rb.severity);
    }
  });

  it('a WARNING-severity R6 blocker is still surfaced (visible, but never affects state)', () => {
    const pipeline = pipelineFor([note()], healthyWorkspace({ status: 'STALE' }));
    expect(pipeline.contract.references.readiness.blockers.some((b) => b.severity === 'WARNING')).toBe(true);
    const decision = evaluateExecutionAdmission(pipeline);
    expect(decision.blockers.some((b) => b.severity === 'WARNING')).toBe(true);
    expect(decision.state).toBe('ADMITTED');
  });
});

describe('E6 — state: a faithful relabeling of R6\'s own readiness, never a re-decision', () => {
  it('READY readiness → ADMITTED', () => {
    const pipeline = pipelineFor();
    expect(pipeline.contract.scope.readinessState).toBe('READY');
    expect(evaluateExecutionAdmission(pipeline).state).toBe('ADMITTED');
  });

  it('BLOCKED readiness (unresolved scope) → BLOCKED', () => {
    const pipeline = pipelineFor(blockedNotes);
    expect(pipeline.contract.scope.readinessState).toBe('BLOCKED');
    expect(evaluateExecutionAdmission(pipeline).state).toBe('BLOCKED');
  });

  it('WAITING_FOR_WORKSPACE readiness (no workspace) → WAITING', () => {
    const pipeline = pipelineWithoutWorkspace([note()]);
    expect(pipeline.contract.scope.readinessState).toBe('WAITING_FOR_WORKSPACE');
    expect(evaluateExecutionAdmission(pipeline).state).toBe('WAITING');
  });

  it('WAITING_FOR_PROJECT readiness (no generation recorded) → WAITING', () => {
    const pipeline = pipelineFor([note()], healthyWorkspace({ generation: undefined }));
    expect(pipeline.contract.scope.readinessState).toBe('WAITING_FOR_PROJECT');
    expect(evaluateExecutionAdmission(pipeline).state).toBe('WAITING');
  });

  it('INVALID readiness (workspace client/track mismatch) → INVALID', () => {
    const pipeline = pipelineFor([note()], invalidWorkspace);
    expect(pipeline.contract.scope.readinessState).toBe('INVALID');
    expect(evaluateExecutionAdmission(pipeline).state).toBe('INVALID');
  });

  it('every reachable state agrees with a direct remap of contract.scope.readinessState (equivalence proof)', () => {
    const cases: Array<[ExecutionPipelineResult, string]> = [
      [pipelineFor(), 'ADMITTED'],
      [pipelineFor(blockedNotes), 'BLOCKED'],
      [pipelineWithoutWorkspace([note()]), 'WAITING'],
      [pipelineFor([note()], healthyWorkspace({ generation: undefined })), 'WAITING'],
      [pipelineFor([note()], invalidWorkspace), 'INVALID'],
    ];
    for (const [pipeline, expected] of cases) {
      expect(evaluateExecutionAdmission(pipeline).state).toBe(expected);
    }
  });
});

describe('E6 — injectable ExecutionAdmissionRule', () => {
  it('a custom rule fully overrides blocker detection, and state responds to its blockers', () => {
    const alwaysUnknown: ExecutionAdmissionRule = {
      evaluate: (): readonly ExecutionAdmissionBlocker[] => [
        { category: 'INDETERMINATE_CAPABILITY', severity: 'BLOCKING', reason: 'synthetic', resolution: 'synthetic', source: 'test:custom' },
      ],
    };
    const evaluator = createExecutionAdmissionEvaluator();
    const decision = evaluator.decide(pipelineFor(), alwaysUnknown); // pipeline itself is READY, but the custom rule overrides
    expect(decision.state).toBe('UNKNOWN');
    expect(decision.blockers).toHaveLength(1);
    expect(decision.blockers[0].source).toBe('test:custom');
  });

  it('the default rule matches createDefaultExecutionAdmissionRule() exactly', () => {
    const pipeline = pipelineFor(blockedNotes);
    const viaDefault = evaluateExecutionAdmission(pipeline);
    const viaExplicit = evaluateExecutionAdmission(pipeline, createExecutionAdmissionEvaluator(), createDefaultExecutionAdmissionRule());
    expect(viaDefault).toEqual(viaExplicit);
  });
});

describe('E6 — summary: grounded in already-computed contract data', () => {
  it('every summary field is consistent with the actual blockers and contract scope', () => {
    const pipeline = pipelineFor(blockedNotes);
    const decision = evaluateExecutionAdmission(pipeline);
    expect(decision.summary.blockerCount).toBe(decision.blockers.length);
    expect(decision.summary.blockingBlockerCount).toBe(decision.blockers.filter((b) => b.severity === 'BLOCKING').length);
    expect(decision.summary.warningBlockerCount).toBe(decision.blockers.filter((b) => b.severity === 'WARNING').length);
    expect(decision.summary.executableTaskCount).toBe(pipeline.contract.scope.executableTaskIds.length);
    expect(decision.summary.blockedTaskCount).toBe(pipeline.contract.scope.blockedTaskIds.length);
  });
});

describe('E6 — VALIDATION: reference identity, no mutation', () => {
  it('decision.pipeline IS the exact object passed in, not a copy', () => {
    const pipeline = pipelineFor();
    const decision = evaluateExecutionAdmission(pipeline);
    expect(decision.pipeline).toBe(pipeline);
  });

  it('never mutates the given ExecutionPipelineResult', () => {
    const pipeline = pipelineFor(blockedNotes);
    const before = JSON.stringify(pipeline);
    evaluateExecutionAdmission(pipeline);
    expect(JSON.stringify(pipeline)).toBe(before);
  });

  it('sessionId is sourced from the pipeline\'s own identity, never invented', () => {
    const pipeline = pipelineFor();
    expect(evaluateExecutionAdmission(pipeline).sessionId).toBe(pipeline.identity.sessionId);
  });
});

describe('E6 — immutability', () => {
  it('the decision, its blockers, and its summary are frozen', () => {
    const decision = evaluateExecutionAdmission(pipelineFor(blockedNotes));
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.blockers[0])).toBe(true);
    expect(Object.isFrozen(decision.summary)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const decision = evaluateExecutionAdmission(pipelineFor());
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      decision.state = 'BLOCKED';
    }).toThrow();
  });
});

describe('E6 — determinism: repeated admission is identical', () => {
  it('repeated evaluation of the same pipeline result is byte-identical', () => {
    const pipeline = pipelineFor(blockedNotes);
    const first = evaluateExecutionAdmission(pipeline);
    const second = evaluateExecutionAdmission(pipeline);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying pipeline result changes', () => {
    const a = evaluateExecutionAdmission(pipelineFor([note({ severity: 'nit' })]));
    const b = evaluateExecutionAdmission(pipelineFor(blockedNotes));
    expect(a.digest).not.toBe(b.digest);
  });

  it('createExecutionAdmissionEvaluator().decide() matches evaluateExecutionAdmission()', () => {
    const pipeline = pipelineFor(blockedNotes);
    const evaluator = createExecutionAdmissionEvaluator();
    expect(evaluator.decide(pipeline)).toEqual(evaluateExecutionAdmission(pipeline, evaluator));
  });
});
