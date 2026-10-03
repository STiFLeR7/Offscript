/**
 * E1 — Review Execution Adapter (RED-first).
 *
 * The first execution boundary over the immutable Review Execution Contract (R8). Adapts the
 * contract into a framework-neutral execution request. Executes nothing — no regeneration, no
 * browser, no AI.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createExecutionAdapter,
  adaptReviewExecution,
  verifyExecutionAdaptation,
} from '../../src/execution/review-execution-adapter.js';
import { planReviewExecution, serializeExecutionContract } from '../../src/review/review-execution-contract.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — same direct-construction style used across R3–R8's own test files ────────────────

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

function contractFor(notes = [note()], ws: WorkspaceState | undefined = healthyWorkspace()) {
  const result = orchestrateReview({ session: session(notes), model: model(), workspaceState: ws });
  return planReviewExecution(result);
}

describe('E1 — identity sourced from the contract, never recomputed', () => {
  it('client/track/sessionId/contractId mirror the contract exactly', () => {
    const contract = contractFor();
    const request = adaptReviewExecution(contract);
    expect(request.identity.client).toBe(contract.manifest.client);
    expect(request.identity.track).toBe(contract.manifest.track);
    expect(request.identity.sessionId).toBe(contract.manifest.sessionId);
    expect(request.identity.contractId).toBe(contract.contractId);
  });
});

describe('E1 — nothing duplicated, references preserved', () => {
  it('context.contract IS the same object instance passed in, by identity', () => {
    const contract = contractFor();
    const request = adaptReviewExecution(contract);
    expect(request.context.contract).toBe(contract);
  });

  it('never mutates the given contract', () => {
    const contract = contractFor();
    const before = JSON.stringify(contract);
    adaptReviewExecution(contract);
    expect(JSON.stringify(contract)).toBe(before);
  });
});

describe('E1 — immutability', () => {
  it('the request and its context are frozen', () => {
    const request = adaptReviewExecution(contractFor());
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.identity)).toBe(true);
    expect(Object.isFrozen(request.context)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const request = adaptReviewExecution(contractFor());
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      request.identity.client = 'someone-else';
    }).toThrow();
  });
});

describe('E1 — determinism and shape', () => {
  it('repeated adaptation of the same contract is byte-identical', () => {
    const contract = contractFor();
    const first = adaptReviewExecution(contract);
    const second = adaptReviewExecution(contract);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying contract changes', () => {
    const a = adaptReviewExecution(contractFor([note({ severity: 'nit' })]));
    const b = adaptReviewExecution(contractFor([note({ severity: 'blocker' })]));
    expect(a.digest).not.toBe(b.digest);
  });

  it('createExecutionAdapter().adapt() matches adaptReviewExecution()', () => {
    const contract = contractFor();
    const adapter = createExecutionAdapter();
    expect(adapter.adapt(contract)).toEqual(adaptReviewExecution(contract, adapter));
  });
});

describe('E1 — verifyExecutionAdaptation()', () => {
  it('a freshly-adapted request verifies fully valid', () => {
    const contract = contractFor();
    const request = adaptReviewExecution(contract);
    expect(verifyExecutionAdaptation(contract, request)).toEqual({
      valid: true, identityPreserved: true, scopePreserved: true, constraintsPreserved: true, referencesPreserved: true, issues: [],
    });
  });

  it('detects an identity mismatch against the source contract', () => {
    const contract = contractFor();
    const request = adaptReviewExecution(contract);
    const tampered = { ...request, identity: { ...request.identity, client: 'someone-else' } };
    const verification = verifyExecutionAdaptation(contract, tampered);
    expect(verification.identityPreserved).toBe(false);
    expect(verification.valid).toBe(false);
  });

  it('detects a context whose contract is a structurally-equal but distinct object (duplicated, not referenced)', () => {
    const contract = contractFor();
    const request = adaptReviewExecution(contract);
    const duplicated = { ...request, context: { contract: JSON.parse(serializeExecutionContract(contract)) } };
    const verification = verifyExecutionAdaptation(contract, duplicated);
    expect(verification.referencesPreserved).toBe(false);
    expect(verification.scopePreserved).toBe(false);
    expect(verification.constraintsPreserved).toBe(false);
    expect(verification.valid).toBe(false);
  });
});
