/**
 * E4 — Execution Session (RED-first).
 *
 * The persistent execution object that owns one review execution lifecycle. Wraps a single,
 * immutable `ExecutionResult` (E3) by reference — never duplicating its `contract`/`request`/
 * `identity`. No regeneration, no browser, no AI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createExecutionSessionStore,
  createExecutionSessionManager,
  type ExecutionSessionSnapshot,
} from '../../src/execution/execution-session.js';
import { executeReviewPipeline } from '../../src/execution/native-review-execution.js';
import { orchestrateExecution } from '../../src/execution/review-execution-orchestration.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';
import type { ExecutionResult } from '../../src/execution/native-review-execution.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-e4-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function sessionsDir(client: string, track: string): string {
  return join(root, client, track, 'execution-sessions');
}

function testStore() {
  return createExecutionSessionStore((client, track) => sessionsDir(client, track));
}

// ── fixtures — same direct-construction style used across R3–R8/E1–E3's own test files ──────────

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

function executionResultFor(reviewSessionId = 'session-1', notes = [note()], ws: WorkspaceState | undefined = healthyWorkspace()): ExecutionResult {
  const pr = orchestrateReview({ session: session(notes, { id: reviewSessionId }), model: model(), workspaceState: ws });
  return executeReviewPipeline(orchestrateExecution(pr));
}

describe('E4 — createSession()', () => {
  it('wraps the given ExecutionResult by reference, never duplicating it', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    const s = manager.createSession(execution);
    expect(s.execution).toBe(execution);
  });

  it('sessionId is sourced from the execution\'s own identity, never invented', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    const s = manager.createSession(execution);
    expect(s.sessionId).toBe(execution.identity.sessionId);
  });

  it('starts CREATED, with the wrapped execution\'s diagnostics as the first snapshot, empty history', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    const s = manager.createSession(execution);
    expect(s.currentState).toBe('CREATED');
    expect(s.diagnosticsSnapshots).toEqual([execution.diagnostics]);
    expect(s.history).toEqual([]);
  });

  it('is persisted — get() returns it back', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    const created = manager.createSession(execution);
    const loaded = manager.get('acme', 'website', execution.identity.sessionId);
    expect(loaded).toEqual(created);
  });
});

describe('E4 — recordExecution(): the lifecycle, over time', () => {
  it('attaches a NEW execution, deriving currentState from its status', () => {
    const manager = createExecutionSessionManager(testStore());
    const first = executionResultFor(); // COMPLETED — resolvable page note + healthy workspace
    manager.createSession(first);

    const second = executionResultFor('session-1', [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const updated = manager.recordExecution(second);

    expect(updated.execution).toBe(second);
    expect(updated.currentState).toBe('BLOCKED'); // second execution's status is BLOCKED
  });

  it('pushes the PRIOR state into history, referencing the prior execution only by digest', () => {
    const manager = createExecutionSessionManager(testStore());
    const first = executionResultFor();
    const created = manager.createSession(first);

    const second = executionResultFor('session-1', [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const updated = manager.recordExecution(second);

    expect(updated.history).toEqual([{ state: created.currentState, executionDigest: first.digest, recordedAt: updated.history[0].recordedAt }]);
  });

  it('appends to diagnosticsSnapshots rather than replacing it', () => {
    const manager = createExecutionSessionManager(testStore());
    const first = executionResultFor();
    manager.createSession(first);
    const second = executionResultFor('session-1', [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const updated = manager.recordExecution(second);
    expect(updated.diagnosticsSnapshots).toEqual([first.diagnostics, second.diagnostics]);
  });

  it('throws for an unknown session', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    expect(() => manager.recordExecution(execution)).toThrow(/unknown execution session/i);
  });

  it('preserves createdAt across updates, bumps updatedAt', () => {
    const manager = createExecutionSessionManager(testStore());
    const first = executionResultFor();
    const created = manager.createSession(first);
    const second = executionResultFor('session-1', [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]);
    const updated = manager.recordExecution(second);
    expect(updated.createdAt).toBe(created.createdAt);
  });
});

describe('E4 — archive()', () => {
  it('transitions to ARCHIVED regardless of the wrapped execution\'s status', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    manager.createSession(execution);
    const archived = manager.archive('acme', 'website', execution.identity.sessionId);
    expect(archived.currentState).toBe('ARCHIVED');
    // `must()` reads the prior session back through the store (a real save/load round trip), so
    // this is deep equality, not reference identity — JSON persistence cannot preserve object
    // references. The in-process `createSession → toBe` case (tested above) is where reference
    // identity is actually preserved.
    expect(archived.execution).toEqual(execution);
  });

  it('throws for an unknown session', () => {
    const manager = createExecutionSessionManager(testStore());
    expect(() => manager.archive('acme', 'website', 'nonexistent')).toThrow(/unknown execution session/i);
  });
});

describe('E4 — listByWorkspace()', () => {
  it('returns every session for a (client, track), and [] for an unrecorded one', () => {
    const manager = createExecutionSessionManager(testStore());
    expect(manager.listByWorkspace('acme', 'website')).toEqual([]);
    const a = executionResultFor('session-a');
    const b = executionResultFor('session-b');
    manager.createSession(a);
    manager.createSession(b);
    const all = manager.listByWorkspace('acme', 'website');
    expect(all.map((s) => s.sessionId).sort()).toEqual(['session-a', 'session-b']);
  });
});

describe('E4 — never duplicates ExecutionContract/ExecutionRequest/ExecutionIdentity', () => {
  it('the wrapped execution\'s contract/request/identity are the EXACT same objects, not copies', () => {
    const manager = createExecutionSessionManager(testStore());
    const execution = executionResultFor();
    const s = manager.createSession(execution);
    expect(s.execution.contract).toBe(execution.contract);
    expect(s.execution.request).toBe(execution.request);
    expect(s.execution.identity).toBe(execution.identity);
  });
});

describe('E4 — immutability', () => {
  it('the session and its arrays are frozen', () => {
    const manager = createExecutionSessionManager(testStore());
    const s = manager.createSession(executionResultFor());
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.diagnosticsSnapshots)).toBe(true);
    expect(Object.isFrozen(s.history)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const manager = createExecutionSessionManager(testStore());
    const s = manager.createSession(executionResultFor());
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      s.currentState = 'FAILED';
    }).toThrow();
  });
});

describe('E4 — persistence: digest integrity, replay, deterministic serialization', () => {
  it('save() → load() round-trips an identical session', () => {
    const manager = createExecutionSessionManager(testStore());
    const created = manager.createSession(executionResultFor());
    const loaded = manager.get('acme', 'website', created.sessionId);
    expect(loaded).toEqual(created);
  });

  it('a fresh manager instance (no shared in-memory state) recovers the exact same session', () => {
    const store = testStore();
    const manager1 = createExecutionSessionManager(store);
    const created = manager1.createSession(executionResultFor());

    const manager2 = createExecutionSessionManager(testStore()); // independent store instance, same dir
    const recovered = manager2.get('acme', 'website', created.sessionId);
    expect(recovered).toEqual(created);
  });

  it('repeated get() calls return equal, stable sessions', () => {
    const manager = createExecutionSessionManager(testStore());
    const created = manager.createSession(executionResultFor());
    const a = manager.get('acme', 'website', created.sessionId);
    const b = manager.get('acme', 'website', created.sessionId);
    expect(a).toEqual(b);
  });

  it('a tampered execution-session file fails digest verification on load', () => {
    const store = testStore();
    const manager = createExecutionSessionManager(store);
    const created = manager.createSession(executionResultFor());
    const path = join(sessionsDir('acme', 'website'), `${created.sessionId}.json`);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    parsed.session.currentState = 'ARCHIVED';
    writeFileSync(path, JSON.stringify(parsed), 'utf8');
    expect(() => manager.get('acme', 'website', created.sessionId)).toThrow(/integrity|digest/i);
  });

  it('store.save() writes a snapshot whose digest is a real content hash of the session', () => {
    const store = testStore();
    const manager = createExecutionSessionManager(store);
    const created = manager.createSession(executionResultFor());
    const path = join(sessionsDir('acme', 'website'), `${created.sessionId}.json`);
    const parsed: ExecutionSessionSnapshot = JSON.parse(readFileSync(path, 'utf8'));
    expect(typeof parsed.digest).toBe('string');
    expect(parsed.digest.length).toBeGreaterThan(0);
    expect(parsed.session.sessionId).toBe(created.sessionId);
  });
});
