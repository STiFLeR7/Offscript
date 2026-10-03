/**
 * F10 — Preview Server (RED-first).
 *
 * Launches, tracks, and stops local preview sessions for a `PreviewProject` (F9). Uses REAL child
 * processes (small on-disk fixture scripts run via `node <file>.js`, invoked through the exact
 * same `npm run dev` path production uses) — no mocking of `node:child_process`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPreviewServer,
  createPreviewSessionManager,
  type PreviewSession,
  type PreviewSessionState,
} from '../../src/fullstack/preview-server.js';
import type { PreviewProject } from '../../src/fullstack/preview-workspace.js';

function fixtureProject(dir: string, scriptFile: string, scriptContent: string, devScript?: string): PreviewProject {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, scriptFile), scriptContent, 'utf8');
  const pkg = { name: 'fixture', scripts: { dev: devScript ?? `node ${scriptFile}` }, dependencies: { next: '^15.0.0' } };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return {
    client: 'fixture-client',
    track: 'website',
    framework: 'nextjs',
    generatedAt: new Date(0).toISOString(),
    digest: 'fixture-digest',
    path: dir,
    status: 'ready',
    diagnostics: [],
    artifactSummary: { fileCount: 2, directoryCount: 0 },
  };
}

const READY_SCRIPT = `console.log('ready - started server'); setInterval(() => {}, 1000);`;
const FAIL_SCRIPT = `console.error('boom: dependency missing'); process.exit(1);`;
const HANG_SCRIPT = `setInterval(() => {}, 1000);`;

async function waitFor(predicate: () => boolean, timeoutMs = 4000, intervalMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

let root: string;
let liveSessionIds: { server: ReturnType<typeof createPreviewServer>; id: string }[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-f10-'));
  liveSessionIds = [];
});
afterEach(async () => {
  for (const { server, id } of liveSessionIds) {
    try {
      server.stop(id);
    } catch {
      /* already gone */
    }
  }
  // Windows releases a killed process's CWD handle slightly after taskkill returns — retry the
  // cleanup instead of racing it.
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

function track(server: ReturnType<typeof createPreviewServer>, session: PreviewSession): PreviewSession {
  liveSessionIds.push({ server, id: session.id });
  return session;
}

describe('F10 — PreviewSessionManager — deterministic bookkeeping (no process spawning)', () => {
  it('assigns sequential, deterministic session ids', () => {
    const manager = createPreviewSessionManager();
    const a = manager.register({ client: 'a', track: 'website', projectPath: '/x', framework: 'nextjs' });
    const b = manager.register({ client: 'b', track: 'website', projectPath: '/y', framework: 'nextjs' });
    expect(a.id).toBe('session-1');
    expect(b.id).toBe('session-2');
  });

  it('allocates unique, increasing ports across registrations', () => {
    const manager = createPreviewSessionManager();
    const a = manager.register({ client: 'a', track: 'website', projectPath: '/x', framework: 'nextjs' });
    const b = manager.register({ client: 'b', track: 'website', projectPath: '/y', framework: 'nextjs' });
    expect(b.port).not.toBe(a.port);
  });

  it('list() is sorted by session id, independent of registration order side effects', () => {
    const manager = createPreviewSessionManager();
    manager.register({ client: 'a', track: 'website', projectPath: '/x', framework: 'nextjs' });
    manager.register({ client: 'b', track: 'website', projectPath: '/y', framework: 'nextjs' });
    manager.register({ client: 'c', track: 'website', projectPath: '/z', framework: 'nextjs' });
    expect(manager.list().map((s) => s.id)).toEqual(['session-1', 'session-2', 'session-3']);
  });

  it('new sessions start in STARTING state with an ISO startedAt', () => {
    const manager = createPreviewSessionManager();
    const s = manager.register({ client: 'a', track: 'website', projectPath: '/x', framework: 'nextjs' });
    expect(s.state).toBe('STARTING');
    expect(() => new Date(s.startedAt).toISOString()).not.toThrow();
  });

  it('get()/transition()/addDiagnostic() throw for an unknown session id', () => {
    const manager = createPreviewSessionManager();
    expect(() => manager.get('session-999')).toThrow(/unknown session/i);
    expect(() => manager.transition('session-999', 'RUNNING')).toThrow(/unknown session/i);
    expect(() => manager.addDiagnostic('session-999', { level: 'info', message: 'x' })).toThrow(/unknown session/i);
  });

  it('returns frozen snapshots', () => {
    const manager = createPreviewSessionManager();
    const s = manager.register({ client: 'a', track: 'website', projectPath: '/x', framework: 'nextjs' });
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.diagnostics)).toBe(true);
  });
});

describe('F10 — PreviewServer — session creation', () => {
  it('starts a session in STARTING and transitions to RUNNING once the ready signal is detected', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'ready'), 'ready-server.js', READY_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    expect(session.state).toBe('STARTING');
    await waitFor(() => server.getSession(session.id).state === 'RUNNING');
    const running = server.getSession(session.id);
    expect(running.client).toBe('fixture-client');
    expect(running.framework).toBe('nextjs');
    expect(running.diagnostics.some((d) => /ready/i.test(d.message))).toBe(true);
  }, 10000);

  it('carries client/track/projectPath/framework/port straight from the PreviewProject', () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'fields'), 'ready-server.js', READY_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    expect(session.track).toBe('website');
    expect(session.projectPath).toBe(project.path);
    expect(typeof session.port).toBe('number');
  });
});

describe('F10 — PreviewServer — failure propagation', () => {
  it('transitions to FAILED when the process exits before becoming ready, with a diagnostic naming why', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'fail'), 'fail-server.js', FAIL_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    await waitFor(() => server.getSession(session.id).state === 'FAILED');
    const failed = server.getSession(session.id);
    expect(failed.diagnostics.some((d) => d.level === 'error' && /exit|boom/i.test(d.message))).toBe(true);
  }, 10000);

  it('transitions to FAILED immediately when package.json has no "dev" script — no process spawned', () => {
    const server = createPreviewServer();
    const dir = join(root, 'no-dev-script');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }), 'utf8');
    const project: PreviewProject = {
      client: 'fixture-client', track: 'website', framework: 'nextjs',
      generatedAt: new Date(0).toISOString(), digest: 'd', path: dir, status: 'ready',
      diagnostics: [], artifactSummary: { fileCount: 1, directoryCount: 0 },
    };
    const session = track(server, server.start(project));
    expect(session.state).toBe('FAILED');
    expect(session.diagnostics.some((d) => /dev.*script/i.test(d.message))).toBe(true);
  });

  it('transitions to FAILED on startup timeout when no readiness signal ever arrives, and kills the process', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'hang'), 'hang-server.js', HANG_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 300 }));
    await waitFor(() => server.getSession(session.id).state === 'FAILED', 3000);
    const failed = server.getSession(session.id);
    expect(failed.diagnostics.some((d) => /timed out/i.test(d.message))).toBe(true);
  }, 10000);
});

describe('F10 — PreviewServer — session shutdown', () => {
  it('stop() transitions a RUNNING session to STOPPED and it stays STOPPED (no post-kill exit clobbers it)', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'stop-running'), 'ready-server.js', READY_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    await waitFor(() => server.getSession(session.id).state === 'RUNNING');
    const stopped = server.stop(session.id);
    expect(stopped.state).toBe('STOPPED');
    await new Promise((r) => setTimeout(r, 300));
    expect(server.getSession(session.id).state).toBe('STOPPED');
  }, 10000);

  it('stop() is idempotent — calling it twice does not throw and stays STOPPED', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'stop-twice'), 'ready-server.js', READY_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    await waitFor(() => server.getSession(session.id).state === 'RUNNING');
    server.stop(session.id);
    expect(() => server.stop(session.id)).not.toThrow();
    expect(server.getSession(session.id).state).toBe('STOPPED');
  }, 10000);

  it('stop() on a still-STARTING session kills it and marks it STOPPED, not FAILED', async () => {
    const server = createPreviewServer();
    const project = fixtureProject(join(root, 'stop-starting'), 'hang-server.js', HANG_SCRIPT);
    const session = track(server, server.start(project, { startTimeoutMs: 4000 }));
    expect(session.state).toBe('STARTING');
    const stopped = server.stop(session.id);
    expect(stopped.state).toBe('STOPPED');
    await new Promise((r) => setTimeout(r, 300));
    expect(server.getSession(session.id).state).toBe('STOPPED');
  }, 10000);
});

describe('F10 — PreviewServer — repeated launches', () => {
  it('supports multiple independent, concurrently-running sessions', async () => {
    const server = createPreviewServer();
    const p1 = fixtureProject(join(root, 'multi-1'), 'ready-server.js', READY_SCRIPT);
    const p2 = fixtureProject(join(root, 'multi-2'), 'ready-server.js', READY_SCRIPT);
    const s1 = track(server, server.start(p1, { startTimeoutMs: 4000 }));
    const s2 = track(server, server.start(p2, { startTimeoutMs: 4000 }));
    expect(s1.id).not.toBe(s2.id);
    expect(s1.port).not.toBe(s2.port);
    await waitFor(() => server.getSession(s1.id).state === 'RUNNING' && server.getSession(s2.id).state === 'RUNNING');
    expect(server.listSessions().map((s) => s.id)).toEqual(expect.arrayContaining([s1.id, s2.id]));
    server.stop(s1.id);
    server.stop(s2.id);
  }, 10000);
});

describe('F10 — PreviewServer — queries', () => {
  it('getSession() throws for an unknown session id', () => {
    const server = createPreviewServer();
    expect(() => server.getSession('session-does-not-exist')).toThrow(/unknown session/i);
  });

  it('listSessions() returns a frozen array', () => {
    const server = createPreviewServer();
    expect(Object.isFrozen(server.listSessions())).toBe(true);
  });
});
