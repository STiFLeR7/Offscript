/**
 * F11 — Preview Readiness & Health (RED-first).
 *
 * A read-only observational layer over a `PreviewSession` (F10): "process running" is not
 * "application ready." Unit tests use a hand-written, fully-controllable `ReadinessProbe`
 * (real interface implementation, not a vitest mock) against hand-built `PreviewSession` fixtures.
 * Integration tests use REAL child processes running REAL Node `http` servers, probed with the
 * real `createHttpReadinessProbe()`, through the real F10 `PreviewServer`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPreviewHealth,
  createHttpReadinessProbe,
  type ReadinessProbe,
  type PreviewReadiness,
} from '../../src/fullstack/preview-health.js';
import { createPreviewServer, type PreviewSession, type PreviewSessionDiagnostic } from '../../src/fullstack/preview-server.js';
import type { PreviewProject } from '../../src/fullstack/preview-workspace.js';

// ── unit-level fixtures: hand-built sessions, a controllable fake probe ────────────────────────

function fakeSession(overrides: Partial<PreviewSession> = {}): PreviewSession {
  const diagnostics: PreviewSessionDiagnostic[] = overrides.diagnostics ? [...overrides.diagnostics] : [];
  return Object.freeze({
    id: 'session-1',
    client: 'fixture-client',
    track: 'website',
    projectPath: '/fake/path',
    framework: 'nextjs',
    port: 5000,
    state: 'STARTING',
    startedAt: new Date().toISOString(),
    diagnostics: Object.freeze(diagnostics),
    ...overrides,
  });
}

/** A fully controllable, real `ReadinessProbe` implementation — swap `reachable` between calls. */
function controllableProbe(initial: { reachable: boolean; failureReason?: string }): ReadinessProbe & { set(v: { reachable: boolean; failureReason?: string }): void } {
  let state = initial;
  return {
    set(v) {
      state = v;
    },
    async probe(_endpoint) {
      return state.reachable
        ? { reachable: true, responseTimeMs: 12, failureReason: undefined }
        : { reachable: false, responseTimeMs: undefined, failureReason: state.failureReason ?? 'connection refused' };
    },
  };
}

describe('F11 — PreviewHealth — state derivation (unit, fake probe)', () => {
  it('STOPPED session → readiness STOPPED, no probe performed', async () => {
    let probed = false;
    const probe: ReadinessProbe = { async probe() { probed = true; return { reachable: true, responseTimeMs: 1, failureReason: undefined }; } };
    const health = createPreviewHealth(probe);
    const snap = await health.check(fakeSession({ state: 'STOPPED' }));
    expect(snap.readiness).toBe('STOPPED');
    expect(probed).toBe(false);
  });

  it('FAILED session → readiness UNHEALTHY, failureReason from the session\'s own diagnostics, no probe performed', async () => {
    let probed = false;
    const probe: ReadinessProbe = { async probe() { probed = true; return { reachable: true, responseTimeMs: 1, failureReason: undefined }; } };
    const health = createPreviewHealth(probe);
    const session = fakeSession({
      state: 'FAILED',
      diagnostics: [{ level: 'info', message: 'launching' }, { level: 'error', message: 'process exited before becoming ready (code 1). stderr: boom' }],
    });
    const snap = await health.check(session);
    expect(snap.readiness).toBe('UNHEALTHY');
    expect(probed).toBe(false);
    expect(snap.failureReason).toMatch(/boom/);
  });

  it('STARTING session, unreachable, within the readiness timeout → STARTING (process running is not enough)', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: false }), 20000);
    const snap = await health.check(fakeSession({ state: 'STARTING', startedAt: new Date().toISOString() }));
    expect(snap.readiness).toBe('STARTING');
  });

  it('RUNNING session (process-level ready), but the app is unreachable → still STARTING, not READY', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: false }), 20000);
    const snap = await health.check(fakeSession({ state: 'RUNNING', startedAt: new Date().toISOString() }));
    expect(snap.readiness).toBe('STARTING');
  });

  it('reachable → READY, regardless of underlying STARTING or RUNNING process state', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: true }));
    const a = await health.check(fakeSession({ id: 'a', state: 'STARTING' }));
    const b = await health.check(fakeSession({ id: 'b', state: 'RUNNING' }));
    expect(a.readiness).toBe('READY');
    expect(b.readiness).toBe('READY');
  });

  it('unreachable past the readiness timeout → UNHEALTHY, with a timeout-naming failureReason', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: false }), 50);
    const oldStart = new Date(Date.now() - 5000).toISOString();
    const snap = await health.check(fakeSession({ state: 'RUNNING', startedAt: oldStart }));
    expect(snap.readiness).toBe('UNHEALTHY');
    expect(snap.failureReason).toMatch(/timed out/i);
  });

  it('regression: previously READY, now unreachable → UNHEALTHY immediately, even within the timeout window', async () => {
    const probe = controllableProbe({ reachable: true });
    const health = createPreviewHealth(probe, 60000);
    const session = fakeSession({ state: 'RUNNING' });
    const first = await health.check(session);
    expect(first.readiness).toBe('READY');
    probe.set({ reachable: false, failureReason: 'connection reset' });
    const second = await health.check(session);
    expect(second.readiness).toBe('UNHEALTHY');
    expect(second.failureReason).toMatch(/reset|unreachable/i);
  });

  it('publishes a HealthSnapshot with all required fields', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: true }));
    const snap = await health.check(fakeSession({ id: 'session-42', port: 5050, state: 'RUNNING' }));
    expect(snap.sessionId).toBe('session-42');
    expect(typeof snap.lastProbeAt).toBe('string');
    expect(() => new Date(snap.lastProbeAt).toISOString()).not.toThrow();
    expect(snap.endpoint).toContain('5050');
    expect(snap.responseTimeMs).toBe(12);
    expect(snap.failureReason).toBeUndefined();
  });

  it('getSnapshot() returns undefined before any check(), and the last snapshot after', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: true }));
    expect(health.getSnapshot('session-1')).toBeUndefined();
    const snap = await health.check(fakeSession({ id: 'session-1' }));
    expect(health.getSnapshot('session-1')).toEqual(snap);
  });

  it('returns a frozen HealthSnapshot', async () => {
    const health = createPreviewHealth(controllableProbe({ reachable: true }));
    const snap = await health.check(fakeSession());
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('repeated probes reflect the live state as it changes — STARTING then READY', async () => {
    const probe = controllableProbe({ reachable: false });
    const health = createPreviewHealth(probe, 60000);
    const session = fakeSession({ state: 'RUNNING' });
    const first = await health.check(session);
    const second = await health.check(session);
    expect(first.readiness).toBe('STARTING');
    expect(second.readiness).toBe('STARTING');
    probe.set({ reachable: true });
    const third = await health.check(session);
    expect(third.readiness).toBe('READY');
  });
});

// ── integration-level: real processes, real HTTP servers, real F10 PreviewServer ───────────────

function fixtureProject(dir: string, scriptFile: string, scriptContent: string): PreviewProject {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, scriptFile), scriptContent, 'utf8');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { dev: `node ${scriptFile}` } }), 'utf8');
  return {
    client: 'fixture-client', track: 'website', framework: 'nextjs',
    generatedAt: new Date(0).toISOString(), digest: 'fixture-digest', path: dir, status: 'ready',
    diagnostics: [], artifactSummary: { fileCount: 2, directoryCount: 0 },
  };
}

const READY_HTTP_SERVER = `
const http = require('node:http');
http.createServer((req, res) => res.end('ok')).listen(Number(process.env.PORT), () => {
  console.log('ready - started server');
});
`;

/** Prints the F10 readiness stdout signal IMMEDIATELY, but only opens the HTTP port after a
 *  delay — the exact "process running is not application ready" scenario this sprint exists for. */
const SLOW_HTTP_SERVER = `
console.log('ready - started server');
const http = require('node:http');
setTimeout(() => {
  http.createServer((req, res) => res.end('ok')).listen(Number(process.env.PORT));
}, 600);
`;

const HANG_NO_HTTP = `setInterval(() => {}, 1000);`;

async function waitFor(predicate: () => boolean, timeoutMs = 6000, intervalMs = 30): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

let root: string;
let cleanup: (() => void)[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-f11-'));
  cleanup = [];
});
afterEach(async () => {
  for (const fn of cleanup) fn();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(root, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  rmSync(root, { recursive: true, force: true });
});

describe('F11 — createHttpReadinessProbe — real network probing', () => {
  it('healthy startup: a real listening HTTP server is reported READY', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'ready'), 'ready-server.js', READY_HTTP_SERVER);
    const session = server.start(project, { startTimeoutMs: 6000 });
    cleanup.push(() => server.stop(session.id));
    await waitFor(() => server.getSession(session.id).state === 'RUNNING');

    const health = createPreviewHealth(createHttpReadinessProbe());
    const snap = await health.check(server.getSession(session.id));
    expect(snap.readiness).toBe('READY');
    expect(snap.responseTimeMs).toBeGreaterThanOrEqual(0);
  }, 15000);

  it('process running but application not yet reachable → STARTING, not READY', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'slow'), 'slow-server.js', SLOW_HTTP_SERVER);
    const session = server.start(project, { startTimeoutMs: 6000 });
    cleanup.push(() => server.stop(session.id));
    await waitFor(() => server.getSession(session.id).state === 'RUNNING'); // F10 says RUNNING almost immediately

    const health = createPreviewHealth(createHttpReadinessProbe(), 10000);
    const immediateSnap = await health.check(server.getSession(session.id));
    expect(immediateSnap.readiness).toBe('STARTING'); // the app itself isn't listening yet

    const readySnap = await health.waitUntilReady(() => server.getSession(session.id), { timeoutMs: 5000, intervalMs: 100 });
    expect(readySnap.readiness).toBe('READY');
  }, 15000);

  it('startup timeout: a process with no HTTP server ever becomes UNHEALTHY, not READY', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'hang'), 'hang-server.js', HANG_NO_HTTP);
    const session = server.start(project, { startTimeoutMs: 30000 }); // F10's own timeout stays out of the way
    cleanup.push(() => server.stop(session.id));

    const health = createPreviewHealth(createHttpReadinessProbe(), 400);
    const snap = await health.waitUntilReady(() => server.getSession(session.id), { timeoutMs: 3000, intervalMs: 100 });
    expect(snap.readiness).toBe('UNHEALTHY');
    expect(snap.failureReason).toMatch(/timed out/i);
  }, 15000);

  it('stopped session: after server.stop(), health reports STOPPED', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'stop'), 'ready-server.js', READY_HTTP_SERVER);
    const session = server.start(project, { startTimeoutMs: 6000 });
    await waitFor(() => server.getSession(session.id).state === 'RUNNING');
    const health = createPreviewHealth(createHttpReadinessProbe());
    await health.check(server.getSession(session.id));
    server.stop(session.id);
    const snap = await health.check(server.getSession(session.id));
    expect(snap.readiness).toBe('STOPPED');
  }, 15000);
});
