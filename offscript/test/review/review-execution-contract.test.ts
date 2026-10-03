/**
 * R8 — Review Execution Contract (RED-first).
 *
 * The immutable execution contract bridging the deterministic Review Platform to future
 * execution. No new planning, no evaluation, no execution, no AI, no browser.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createReviewExecutionPlanner,
  planReviewExecution,
  serializeExecutionContract,
  verifyExecutionContract,
} from '../../src/review/review-execution-contract.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';

// ── fixtures — same direct-construction style used across R3–R7's own test files ────────────────

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

function pipelineResult(notes = [note()], ws: WorkspaceState | undefined = healthyWorkspace()) {
  return orchestrateReview({ session: session(notes), model: model(), workspaceState: ws });
}

describe('R8 — references, never duplicates', () => {
  it('the contract holds the EXACT same object instances R7 produced, by identity', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    expect(contract.references.session).toBe(result.session);
    expect(contract.references.analysis).toBe(result.analysis);
    expect(contract.references.plan).toBe(result.plan);
    expect(contract.references.scope).toBe(result.scope);
    expect(contract.references.regenerationPlan).toBe(result.regenerationPlan);
    expect(contract.references.readiness).toBe(result.readiness);
  });

  it('deep-freezing the contract never further-mutates or breaks the referenced R1-R7 artifacts', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    expect(contract.references.readiness.state).toBe(result.readiness.state);
    expect(Object.isFrozen(result.readiness)).toBe(true); // was already frozen by R6, unaffected
  });
});

describe('R8 — contract identity', () => {
  it('contractId, digest, and manifest.checksum are all the same content hash', () => {
    const contract = planReviewExecution(pipelineResult());
    expect(contract.contractId).toBe(contract.digest);
    expect(contract.manifest.checksum).toBe(contract.digest);
  });

  it('carries a supported schemaVersion', () => {
    const contract = planReviewExecution(pipelineResult());
    expect(typeof contract.schemaVersion).toBe('number');
  });
});

describe('R8 — execution scope', () => {
  it('readinessState mirrors the referenced ReadinessDecision.state exactly', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    expect(contract.scope.readinessState).toBe(result.readiness.state);
  });

  it('every RegenerationTask id is accounted for exactly once, in executable XOR blocked', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    const allIds = result.regenerationPlan.tasks.map((t) => t.id).sort();
    const scopedIds = [...contract.scope.executableTaskIds, ...contract.scope.blockedTaskIds].sort();
    expect(scopedIds).toEqual(allIds);
    expect(new Set(scopedIds).size).toBe(scopedIds.length);
  });

  it('units reflects the distinct RegenerationUnit values present in the plan', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    expect(contract.scope.units).toEqual([...new Set(result.regenerationPlan.tasks.map((t) => t.unit))].sort());
  });

  it('an empty session produces an empty, valid scope', () => {
    const contract = planReviewExecution(pipelineResult([]));
    expect(contract.scope.executableTaskIds).toEqual([]);
    expect(contract.scope.blockedTaskIds).toEqual([]);
  });
});

describe('R8 — constraints: derived, never authored', () => {
  it('the two base constraints (capability, boundary) are always present', () => {
    const contract = planReviewExecution(pipelineResult([]));
    const kinds = contract.constraints.map((c) => c.kind);
    expect(kinds).toContain('capability');
    expect(kinds).toContain('boundary');
  });

  it('every BLOCKING readiness blocker produces a matching constraint whose description is the blocker\'s own reason verbatim', () => {
    const result = pipelineResult([note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })], undefined); // no workspace -> WAITING_FOR_WORKSPACE + unresolved scope
    const contract = planReviewExecution(result);
    const blockingBlockers = result.readiness.blockers.filter((b) => b.severity === 'BLOCKING');
    for (const blocker of blockingBlockers) {
      const matching = contract.constraints.find((c) => c.source === `r6:${blocker.category}`);
      expect(matching?.description).toBe(blocker.reason);
    }
    expect(contract.constraints.length).toBe(2 + blockingBlockers.length);
  });

  it('a WARNING-severity blocker does NOT produce a constraint', () => {
    const result = pipelineResult([note()], healthyWorkspace({ status: 'STALE' }));
    expect(result.readiness.blockers.some((b) => b.severity === 'WARNING')).toBe(true);
    const contract = planReviewExecution(result);
    expect(contract.constraints).toHaveLength(2); // base only, no constraint from the WARNING blocker
  });
});

describe('R8 — manifest correctness', () => {
  it('every manifest field is consistent with the actual referenced data', () => {
    const result = pipelineResult();
    const contract = planReviewExecution(result);
    expect(contract.manifest.client).toBe(result.session.client);
    expect(contract.manifest.track).toBe(result.session.track);
    expect(contract.manifest.sessionId).toBe(result.session.id);
    expect(contract.manifest.noteCount).toBe(result.session.notes.length);
    expect(contract.manifest.taskCount).toBe(result.regenerationPlan.tasks.length);
    expect(contract.manifest.executableTaskCount).toBe(contract.scope.executableTaskIds.length);
    expect(contract.manifest.blockedTaskCount).toBe(contract.scope.blockedTaskIds.length);
    expect(contract.manifest.constraintCount).toBe(contract.constraints.length);
  });
});

describe('R8 — immutability', () => {
  it('the contract and every sub-structure it OWNS are deep frozen', () => {
    const contract = planReviewExecution(pipelineResult());
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.references)).toBe(true);
    expect(Object.isFrozen(contract.scope)).toBe(true);
    expect(Object.isFrozen(contract.scope.executableTaskIds)).toBe(true);
    expect(Object.isFrozen(contract.constraints)).toBe(true);
    expect(Object.isFrozen(contract.constraints[0])).toBe(true);
    expect(Object.isFrozen(contract.manifest)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const contract = planReviewExecution(pipelineResult());
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      contract.scope.readinessState = 'READY';
    }).toThrow();
  });

  it('never mutates the given ReviewPipelineResult', () => {
    const result = pipelineResult();
    const before = JSON.stringify(result);
    planReviewExecution(result);
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe('R8 — verifyExecutionContract()', () => {
  it('a freshly-built contract verifies fully valid', () => {
    const contract = planReviewExecution(pipelineResult());
    const verification = verifyExecutionContract(contract);
    expect(verification).toEqual({ valid: true, frozen: true, digestValid: true, versionSupported: true, replayValid: true, issues: [] });
  });

  it('detects tampering: a mutated (deserialized, unfrozen) contract fails digest verification', () => {
    const contract = planReviewExecution(pipelineResult());
    const tampered = JSON.parse(serializeExecutionContract(contract));
    tampered.scope.readinessState = 'INVALID'; // flip to a genuinely different value post-hoc
    const verification = verifyExecutionContract(tampered);
    expect(verification.digestValid).toBe(false);
    expect(verification.valid).toBe(false);
    expect(verification.issues.length).toBeGreaterThan(0);
  });

  it('detects tampering of a manifest field even when checksum itself is left untouched', () => {
    // Regression: the first implementation excluded `manifest` from the hashed body entirely, so
    // a manifest-only edit (checksum left alone) slipped past digestValid undetected — caught live
    // during production validation, fixed before this sprint's own verification claims were made.
    const contract = planReviewExecution(pipelineResult());
    const tampered = JSON.parse(serializeExecutionContract(contract));
    tampered.manifest.taskCount = 999; // checksum is NOT touched
    const verification = verifyExecutionContract(tampered);
    expect(verification.digestValid).toBe(false);
    expect(verification.valid).toBe(false);
  });

  it('detects an unsupported schemaVersion', () => {
    const contract = planReviewExecution(pipelineResult());
    const tampered = JSON.parse(serializeExecutionContract(contract));
    tampered.schemaVersion = 999;
    expect(verifyExecutionContract(tampered).versionSupported).toBe(false);
  });

  it('detects a non-frozen contract', () => {
    const contract = planReviewExecution(pipelineResult());
    const unfrozen = JSON.parse(serializeExecutionContract(contract));
    expect(verifyExecutionContract(unfrozen).frozen).toBe(false);
  });
});

describe('R8 — serialization', () => {
  it('serializeExecutionContract produces deterministic, fixed-key-order output', () => {
    const contract = planReviewExecution(pipelineResult());
    expect(serializeExecutionContract(contract)).toBe(serializeExecutionContract(contract));
  });

  it('serialized output round-trips (via JSON.parse) to structurally equal data', () => {
    const contract = planReviewExecution(pipelineResult());
    const parsed = JSON.parse(serializeExecutionContract(contract));
    expect(parsed.digest).toBe(contract.digest);
    expect(parsed.manifest.checksum).toBe(contract.digest);
  });
});

describe('R8 — determinism, replay, and shape', () => {
  it('repeated planning of the same ReviewPipelineResult is byte-identical', () => {
    const result = pipelineResult();
    const first = planReviewExecution(result);
    const second = planReviewExecution(result);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('digest changes when the underlying session content changes', () => {
    const a = planReviewExecution(pipelineResult([note({ severity: 'nit' })]));
    const b = planReviewExecution(pipelineResult([note({ severity: 'blocker' })]));
    expect(a.digest).not.toBe(b.digest);
  });

  it('createReviewExecutionPlanner().plan() matches planReviewExecution()', () => {
    const result = pipelineResult();
    const planner = createReviewExecutionPlanner();
    expect(planner.plan(result)).toEqual(planReviewExecution(result, planner));
  });
});
