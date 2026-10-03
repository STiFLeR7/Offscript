/**
 * E5 — Execution History (RED-first).
 *
 * The canonical, append-only execution timeline for one `ExecutionSession` (E4). It never executes
 * and never changes execution — it only derives and records chronological facts already present on
 * the session. No AI, no browser, no regeneration.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createExecutionHistoryStore,
  createExecutionHistoryManager,
  type ExecutionHistorySnapshot,
} from '../../src/execution/execution-history.js';
import { createExecutionSessionStore, createExecutionSessionManager, type ExecutionSession } from '../../src/execution/execution-session.js';
import { executeReviewPipeline } from '../../src/execution/native-review-execution.js';
import { orchestrateExecution } from '../../src/execution/review-execution-orchestration.js';
import { orchestrateReview } from '../../src/review/review-orchestration.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';
import type { WorkspaceState } from '../../src/fullstack/workspace-state.js';
import type { ExecutionResult } from '../../src/execution/native-review-execution.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-e5-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function sessionsDir(client: string, track: string): string {
  return join(root, client, track, 'execution-sessions');
}
function historyDir(client: string, track: string): string {
  return join(root, client, track, 'execution-history');
}

function testSessionManager() {
  return createExecutionSessionManager(createExecutionSessionStore((c, t) => sessionsDir(c, t)));
}
function testHistoryStore() {
  return createExecutionHistoryStore((c, t) => historyDir(c, t));
}
function testHistoryManager() {
  return createExecutionHistoryManager(testHistoryStore());
}

// ── fixtures — same direct-construction style used across R3–R8/E1–E4's own test files ──────────

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

const blockedNotes = [note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing' }) })]; // → readiness BLOCKED
const invalidWorkspace = healthyWorkspace({ project: { client: 'other-co', track: 'website' } }); // → readiness INVALID → status INVALID → session FAILED

describe('E5 — record(): SESSION_CREATED for a freshly-created session', () => {
  it('a session with no recordExecution calls yields exactly one SESSION_CREATED event', () => {
    const sessions = testSessionManager();
    const execution = executionResultFor();
    const s = sessions.createSession(execution);

    const history = testHistoryManager().record(s);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].sequence).toBe(0);
    expect(history.entries[0].event.type).toBe('SESSION_CREATED');
    expect(history.entries[0].event.executionDigest).toBe(execution.digest);
    expect(history.entries[0].event.occurredAt).toBe(s.createdAt);
  });
});

describe('E5 — record(): the full sequence over multiple transitions', () => {
  it('one recordExecution → two events, SESSION_CREATED then the new state\'s event', () => {
    const sessions = testSessionManager();
    const first = executionResultFor();
    sessions.createSession(first);
    const second = executionResultFor('session-1', blockedNotes);
    const s = sessions.recordExecution(second);

    const history = testHistoryManager().record(s);
    expect(history.entries.map((e) => e.event.type)).toEqual(['SESSION_CREATED', 'SESSION_BLOCKED']);
    expect(history.entries.map((e) => e.sequence)).toEqual([0, 1]);
    expect(history.entries[1].event.executionDigest).toBe(second.digest);
  });

  it('two recordExecutions → three events, each referencing its own execution digest', () => {
    const sessions = testSessionManager();
    const first = executionResultFor();
    sessions.createSession(first);
    const second = executionResultFor('session-1', blockedNotes);
    sessions.recordExecution(second);
    const third = executionResultFor(); // back to COMPLETED
    const s = sessions.recordExecution(third);

    const history = testHistoryManager().record(s);
    expect(history.entries.map((e) => e.event.type)).toEqual(['SESSION_CREATED', 'SESSION_BLOCKED', 'EXECUTION_COMPLETED']);
    expect(history.entries.map((e) => e.event.executionDigest)).toEqual([first.digest, second.digest, third.digest]);
  });

  it('a FAILED-status execution maps to the STATUS_CHANGED fallback (no dedicated suggested event name)', () => {
    const sessions = testSessionManager();
    const first = executionResultFor();
    sessions.createSession(first);
    const second = executionResultFor('session-1', [note()], invalidWorkspace);
    expect(second.status).toBe('INVALID');
    const s = sessions.recordExecution(second);
    expect(s.currentState).toBe('FAILED');

    const history = testHistoryManager().record(s);
    expect(history.entries.map((e) => e.event.type)).toEqual(['SESSION_CREATED', 'STATUS_CHANGED']);
  });
});

describe('E5 — record(): archive() with no prior recordExecution still recovers SESSION_CREATED', () => {
  it('archiving a freshly-created session yields SESSION_CREATED then SESSION_ARCHIVED, never losing the creation fact', () => {
    const sessions = testSessionManager();
    const execution = executionResultFor();
    sessions.createSession(execution);
    const archived = sessions.archive('acme', 'website', execution.identity.sessionId);
    expect(archived.history).toEqual([]); // E4's own history array is untouched by archive()

    const history = testHistoryManager().record(archived);
    expect(history.entries.map((e) => e.event.type)).toEqual(['SESSION_CREATED', 'SESSION_ARCHIVED']);
    expect(history.entries[0].event.executionDigest).toBe(execution.digest);
    expect(history.entries[1].event.executionDigest).toBe(execution.digest); // same execution, never replaced
  });
});

describe('E5 — append-only: rewriting or deleting prior events is rejected', () => {
  it('recording a REGRESSED session (fewer derivable events than already persisted) throws', () => {
    const sessions = testSessionManager();
    const first = executionResultFor();
    const created = sessions.createSession(first);
    const second = executionResultFor('session-1', blockedNotes);
    const updated = sessions.recordExecution(second);

    const historyManager = testHistoryManager();
    historyManager.record(updated); // 2 events persisted

    expect(() => historyManager.record(created)).toThrow(/append-only|regress|prior/i); // only 1 derivable event — would delete history[1]
  });

  it('recording the SAME session twice is idempotent — no duplicate or rewritten events', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const historyManager = testHistoryManager();
    const first = historyManager.record(s);
    const second = historyManager.record(s);
    expect(second).toEqual(first);
  });
});

describe('E5 — never duplicates ExecutionContract/ExecutionRequest/ExecutionIdentity/ExecutionResult', () => {
  it('ExecutionEvent carries only a digest reference, never the full execution objects', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const history = testHistoryManager().record(s);
    const event = history.entries[0].event as unknown as Record<string, unknown>;
    expect(event.contract).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.identity).toBeUndefined();
    expect(typeof event.executionDigest).toBe('string');
  });
});

describe('E5 — immutability', () => {
  it('the history, its entries, and each event are frozen', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const history = testHistoryManager().record(s);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.entries)).toBe(true);
    expect(Object.isFrozen(history.entries[0])).toBe(true);
    expect(Object.isFrozen(history.entries[0].event)).toBe(true);
  });

  it('mutation attempts throw in strict mode', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const history = testHistoryManager().record(s);
    expect(() => {
      // @ts-expect-error deliberately violating readonly for the mutation-throws proof
      history.entries[0].sequence = 99;
    }).toThrow();
  });
});

describe('E5 — persistence: digest integrity, replay, deterministic serialization', () => {
  it('save() (via record()) → get() round-trips an identical history', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const historyManager = testHistoryManager();
    const recorded = historyManager.record(s);
    const loaded = historyManager.get('acme', 'website', s.sessionId);
    expect(loaded).toEqual(recorded);
  });

  it('a fresh manager instance (no shared in-memory state) recovers the exact same history', () => {
    const store = testHistoryStore();
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const recorded = createExecutionHistoryManager(store).record(s);

    const manager2 = createExecutionHistoryManager(testHistoryStore()); // independent store instance, same dir
    const recovered = manager2.get('acme', 'website', s.sessionId);
    expect(recovered).toEqual(recorded);
  });

  it('a tampered execution-history file fails digest verification on load', () => {
    const sessions = testSessionManager();
    const s = sessions.createSession(executionResultFor());
    const historyManager = testHistoryManager();
    historyManager.record(s);

    const path = join(historyDir('acme', 'website'), `${s.sessionId}.json`);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    parsed.history.entries[0].event.type = 'SESSION_ARCHIVED';
    writeFileSync(path, JSON.stringify(parsed), 'utf8');
    expect(() => historyManager.get('acme', 'website', s.sessionId)).toThrow(/integrity|digest/i);
  });
});

describe('E5 — listByWorkspace()', () => {
  it('returns every history for a (client, track), and [] for an unrecorded one', () => {
    const historyManager = testHistoryManager();
    expect(historyManager.listByWorkspace('acme', 'website')).toEqual([]);
    const sessions = testSessionManager();
    const a = sessions.createSession(executionResultFor('session-a'));
    const b = sessions.createSession(executionResultFor('session-b'));
    historyManager.record(a);
    historyManager.record(b);
    const all = historyManager.listByWorkspace('acme', 'website');
    expect(all.map((h) => h.sessionId).sort()).toEqual(['session-a', 'session-b']);
  });

  it('get() on an unrecorded session returns undefined', () => {
    expect(testHistoryManager().get('acme', 'website', 'nonexistent')).toBeUndefined();
  });
});
