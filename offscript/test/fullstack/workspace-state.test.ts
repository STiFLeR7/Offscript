/**
 * F13 — Workspace State (RED-first).
 *
 * A persistent, single-source-of-truth record per (client, track) workspace, derived purely from
 * the ALREADY-REAL outputs of F7 (GeneratedProject)/F8 (WriteResult)/F10 (PreviewSession)/F11
 * (HealthSnapshot)/F12 (RegenerationResult) — never generating, launching, or editing anything
 * itself. Uses real temp-file persistence (mkdtempSync), no mocking of `node:fs`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createWorkspaceStateStore,
  createWorkspaceStateManager,
  type WorkspaceStatus,
} from '../../src/fullstack/workspace-state.js';
import type { GeneratedProject } from '../../src/fullstack/project-generator.js';
import type { WriteResult } from '../../src/fullstack/filesystem-writer.js';
import type { PreviewSession } from '../../src/fullstack/preview-server.js';
import type { HealthSnapshot } from '../../src/fullstack/preview-health.js';
import type { RegenerationResult } from '../../src/fullstack/preview-regeneration.js';

function generatedProject(digest: string, fileCount = 7, dirCount = 1): GeneratedProject {
  return {
    files: Array.from({ length: fileCount }, (_, i) => ({ path: `f${i}.tsx`, kind: 'component' as const, content: 'x', digest: `d${i}` })),
    directories: Array.from({ length: dirCount }, (_, i) => `dir${i}`),
    diagnostics: [],
    manifest: { generator: 'nextjs-app-router', sourceModelDigest: 'm', fileCount, directoryCount: dirCount, diagnosticCount: 0 },
    digest,
  };
}

function writeResult(targetDir: string, digest: string, fileCount = 7, dirCount = 1): WriteResult {
  return {
    targetDir,
    writtenFiles: Array.from({ length: fileCount }, (_, i) => `f${i}.tsx`),
    createdDirectories: Array.from({ length: dirCount }, (_, i) => `dir${i}`),
    diagnostics: [],
    sourceDigest: digest,
  };
}

function previewSession(overrides: Partial<PreviewSession> = {}): PreviewSession {
  return {
    id: 'session-1', client: 'fixture-client', track: 'website', projectPath: '/x', framework: 'nextjs',
    port: 4100, state: 'RUNNING', startedAt: new Date(0).toISOString(), diagnostics: [],
    ...overrides,
  };
}

function healthSnapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    sessionId: 'session-1', readiness: 'READY', lastProbeAt: new Date(0).toISOString(),
    endpoint: 'http://localhost:4100/', responseTimeMs: 12, failureReason: undefined,
    ...overrides,
  };
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-f13-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function statePath(client: string, track: string): string {
  return join(root, client, track, 'workspace-state.json');
}

function testStore() {
  return createWorkspaceStateStore((client, track) => statePath(client, track));
}

describe('F13 — WorkspaceStateStore — persistence', () => {
  it('save() then load() round-trips an identical snapshot', () => {
    const store = testStore();
    const manager = createWorkspaceStateManager(store);
    const snap = manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const loaded = store.load('acme', 'website');
    expect(loaded).toEqual(snap);
  });

  it('load() returns undefined when nothing was ever recorded', () => {
    const store = testStore();
    expect(store.load('never-recorded', 'website')).toBeUndefined();
  });

  it('load() detects a tampered/corrupt state file and throws', () => {
    const store = testStore();
    const manager = createWorkspaceStateManager(store);
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const path = statePath('acme', 'website');
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    raw.state.digests.generationDigest = 'tampered-value';
    writeFileSync(path, JSON.stringify(raw), 'utf8');
    expect(() => store.load('acme', 'website')).toThrow(/integrity|digest|tamper/i);
  });

  it('repeated loads return equal, stable snapshots (replay)', () => {
    const store = testStore();
    const manager = createWorkspaceStateManager(store);
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const a = store.load('acme', 'website');
    const b = store.load('acme', 'website');
    expect(a).toEqual(b);
  });

  it('a fresh store instance pointed at the same path recovers the exact same state (process-restart simulation)', () => {
    const storeA = testStore();
    createWorkspaceStateManager(storeA).recordGeneration('acme', 'website', generatedProject('digest-a'));
    const storeB = testStore(); // brand-new instance, no shared in-memory state
    const recovered = storeB.load('acme', 'website');
    expect(recovered?.state.digests.generationDigest).toBe('digest-a');
  });
});

describe('F13 — WorkspaceStateManager — status transitions', () => {
  it('recordGeneration alone → status GENERATED', () => {
    const manager = createWorkspaceStateManager(testStore());
    const snap = manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    expect(snap.state.status).toBe('GENERATED');
    expect(snap.state.digests.generationDigest).toBe('digest-a');
  });

  it('recordGeneration then recordMaterialization (matching digest) → status MATERIALIZED', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const snap = manager.recordMaterialization('acme', 'website', writeResult('/out/acme/website/fullstack', 'digest-a'));
    expect(snap.state.status).toBe('MATERIALIZED');
    expect(snap.state.digests.materializationDigest).toBe('digest-a');
  });

  it('recordPreview with a STARTING/RUNNING session → status PREVIEW_RUNNING', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordMaterialization('acme', 'website', writeResult('/out', 'digest-a'));
    const snap = manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    expect(snap.state.status).toBe('PREVIEW_RUNNING');
    expect(snap.state.preview?.sessionId).toBe('session-1');
  });

  it('recordHealth READY → status READY', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordMaterialization('acme', 'website', writeResult('/out', 'digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    const snap = manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'READY' }));
    expect(snap.state.status).toBe('READY');
  });

  it('recordHealth UNHEALTHY → status FAILED, even if the underlying process is still RUNNING', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    const snap = manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'UNHEALTHY', failureReason: 'no response' }));
    expect(snap.state.status).toBe('FAILED');
    expect(snap.state.health?.failureReason).toBe('no response');
  });

  it('a fresh recordGeneration with a NEW digest, without a matching recordMaterialization, → status STALE', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordMaterialization('acme', 'website', writeResult('/out', 'digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'READY' }));
    // Someone re-ran generation independently — the running preview no longer reflects it.
    const snap = manager.recordGeneration('acme', 'website', generatedProject('digest-b'));
    expect(snap.state.status).toBe('STALE');
    expect(snap.state.digests.generationDigest).toBe('digest-b');
    expect(snap.state.digests.materializationDigest).toBe('digest-a');
  });

  it('digests differ observably between two distinct generations', () => {
    const manager = createWorkspaceStateManager(testStore());
    const a = manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const b = manager.recordGeneration('acme', 'website', generatedProject('digest-b'));
    expect(a.state.digests.generationDigest).not.toBe(b.state.digests.generationDigest);
    expect(a.digest).not.toBe(b.digest); // the snapshot's own digest also changed
  });
});

describe('F13 — WorkspaceStateManager — regeneration lifecycle', () => {
  it('recordRegeneration with a successful RegenerationResult restores READY with a NEW session/health', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordMaterialization('acme', 'website', writeResult('/out', 'digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ id: 'session-1', state: 'RUNNING' }));
    manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'READY' }));

    const result: RegenerationResult = {
      plan: { sessionId: 'session-1', client: 'acme', track: 'website', targetDir: '/out', previousPort: 4100, plannedAt: new Date(0).toISOString() },
      phase: 'READY',
      failedPhase: undefined,
      session: previewSession({ id: 'session-2', port: 4101, state: 'RUNNING' }),
      health: healthSnapshot({ sessionId: 'session-2', readiness: 'READY', endpoint: 'http://localhost:4101/' }),
      diagnostics: ['PLANNING: ok', 'STOPPING: ok', 'GENERATING: ok', 'STARTING: ok', 'READY: ok'],
    };
    const snap = manager.recordRegeneration('acme', 'website', result);
    expect(snap.state.status).toBe('READY');
    expect(snap.state.preview?.sessionId).toBe('session-2');
    expect(snap.state.preview?.port).toBe(4101);
    expect(snap.state.health?.endpoint).toBe('http://localhost:4101/');
  });

  it('recordRegeneration with a FAILED RegenerationResult (GENERATING phase) sets status FAILED, folding diagnostics into the failure reason', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'READY' }));

    const result: RegenerationResult = {
      plan: { sessionId: 'session-1', client: 'acme', track: 'website', targetDir: '/out', previousPort: 4100, plannedAt: new Date(0).toISOString() },
      phase: 'FAILED',
      failedPhase: 'GENERATING',
      session: undefined,
      health: undefined,
      diagnostics: ['PLANNING: ok', 'STOPPING: ok', 'GENERATING failed: boom: generation exploded'],
    };
    const snap = manager.recordRegeneration('acme', 'website', result);
    expect(snap.state.status).toBe('FAILED');
    expect(snap.state.health?.failureReason).toMatch(/boom/);
  });

  it('recordRegeneration with an unknown-session (PLANNING) failure still surfaces FAILED, never silently unchanged', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordPreview('acme', 'website', previewSession({ state: 'RUNNING' }));
    manager.recordHealth('acme', 'website', healthSnapshot({ readiness: 'READY' }));

    const result: RegenerationResult = {
      plan: undefined,
      phase: 'FAILED',
      failedPhase: 'PLANNING',
      session: undefined,
      health: undefined,
      diagnostics: ['PLANNING failed: PreviewSessionManager: unknown session id session-999'],
    };
    const snap = manager.recordRegeneration('acme', 'website', result);
    expect(snap.state.status).toBe('FAILED');
  });
});

describe('F13 — WorkspaceStateManager — get() and deterministic recovery', () => {
  it('get() returns the same snapshot as the last record*() call, without recomputing anything', () => {
    const manager = createWorkspaceStateManager(testStore());
    const recorded = manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    const fetched = manager.get('acme', 'website');
    expect(fetched).toEqual(recorded);
  });

  it('get() for a workspace that was never recorded returns undefined', () => {
    const manager = createWorkspaceStateManager(testStore());
    expect(manager.get('nobody', 'website')).toBeUndefined();
  });

  it('two independent workspaces (different client/track) never interfere with each other', () => {
    const manager = createWorkspaceStateManager(testStore());
    manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    manager.recordGeneration('other-client', 'collateral', generatedProject('digest-z'));
    expect(manager.get('acme', 'website')?.state.digests.generationDigest).toBe('digest-a');
    expect(manager.get('other-client', 'collateral')?.state.digests.generationDigest).toBe('digest-z');
  });

  it('running the identical sequence of record* calls twice, on two fresh workspaces, produces the identical status sequence', () => {
    function runSequence(manager: ReturnType<typeof createWorkspaceStateManager>, client: string): WorkspaceStatus[] {
      const statuses: WorkspaceStatus[] = [];
      statuses.push(manager.recordGeneration(client, 'website', generatedProject('digest-a')).state.status);
      statuses.push(manager.recordMaterialization(client, 'website', writeResult('/out', 'digest-a')).state.status);
      statuses.push(manager.recordPreview(client, 'website', previewSession({ state: 'RUNNING' })).state.status);
      statuses.push(manager.recordHealth(client, 'website', healthSnapshot({ readiness: 'READY' })).state.status);
      return statuses;
    }
    const manager = createWorkspaceStateManager(testStore());
    const a = runSequence(manager, 'seq-a');
    const b = runSequence(manager, 'seq-b');
    expect(a).toEqual(['GENERATED', 'MATERIALIZED', 'PREVIEW_RUNNING', 'READY']);
    expect(b).toEqual(['GENERATED', 'MATERIALIZED', 'PREVIEW_RUNNING', 'READY']);
  });

  it('returns frozen WorkspaceSnapshot and WorkspaceState', () => {
    const manager = createWorkspaceStateManager(testStore());
    const snap = manager.recordGeneration('acme', 'website', generatedProject('digest-a'));
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.state)).toBe(true);
  });
});
