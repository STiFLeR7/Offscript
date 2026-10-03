/**
 * F12 — Preview Regeneration Manager (RED-first).
 *
 * Pure orchestration over F7 (generation)/F8 (writing)/F9 (discovery)/F10 (process)/F11
 * (readiness). `loadProject`/`regenerateProject` are injected with fixtures pointing at a real
 * temp directory (F9's own `loadPreviewProject` is hard-coupled to the real repo root, so it is
 * swapped out for isolated testing — the same seam every prior sprint's tests use). `PreviewServer`
 * and `PreviewHealth` are REAL — real child processes, real HTTP probing — proving the actual
 * launch/stop/readiness machinery, not a simulation of it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPreviewRegenerationManager,
  type RegenerationPolicy,
} from '../../src/fullstack/preview-regeneration.js';
import { createPreviewServer, type PreviewServer } from '../../src/fullstack/preview-server.js';
import { createPreviewHealth, createHttpReadinessProbe } from '../../src/fullstack/preview-health.js';
import type { PreviewProject } from '../../src/fullstack/preview-workspace.js';
import type { GeneratedProject } from '../../src/fullstack/project-generator.js';

const READY_HTTP_SERVER = (body: string) => `
const http = require('node:http');
http.createServer((req, res) => res.end(${JSON.stringify(body)})).listen(Number(process.env.PORT), () => {
  console.log('ready - started server');
});
`;

const NEVER_LISTENS = `console.log('ready - started server'); setInterval(() => {}, 1000);`;

function writeFixture(dir: string, scriptContent: string, devScript = 'node server.js'): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'server.js'), scriptContent, 'utf8');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { dev: devScript } }), 'utf8');
}

function fixtureProject(dir: string): PreviewProject {
  return {
    client: 'fixture-client', track: 'website', framework: 'nextjs',
    generatedAt: new Date(0).toISOString(), digest: 'fixture-digest', path: dir, status: 'ready',
    diagnostics: [], artifactSummary: { fileCount: 2, directoryCount: 0 },
  };
}

/** A minimal, real-shaped `GeneratedProject` — the "regeneration" fake returns this. */
function generatedProject(scriptContent: string, devScript = 'node server.js'): GeneratedProject {
  const files = [
    { path: 'server.js', kind: 'component' as const, content: scriptContent, digest: 'd1' },
    { path: 'package.json', kind: 'config' as const, content: JSON.stringify({ name: 'fixture', scripts: { dev: devScript } }), digest: 'd2' },
  ];
  return {
    files, directories: [], diagnostics: [],
    manifest: { generator: 'fake', sourceModelDigest: 'm', fileCount: 2, directoryCount: 0, diagnosticCount: 0 },
    digest: `generated-${Math.random().toString(36).slice(2)}`,
  };
}

// Vitest runs test FILES in parallel worker processes; F10/F11's own suites default to
// PreviewServer's built-in port auto-allocation (starting at 4100), so running alongside them can
// collide at the OS level when two processes both try to bind the same port. Using an explicit,
// disjoint high range here (5500+) for every session this file creates avoids that regardless of
// what any other concurrently-running test file's own default allocation picks.
let portCounter = 5500;
function nextPort(): number {
  return portCounter++;
}

async function waitFor(predicate: () => boolean, timeoutMs = 15000, intervalMs = 30): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

let root: string;
let server: PreviewServer;
let cleanup: (() => void)[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-f12-'));
  server = createPreviewServer();
  cleanup = [];
});
afterEach(async () => {
  for (const s of server.listSessions()) {
    try {
      server.stop(s.id);
    } catch {
      /* already gone */
    }
  }
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

describe('F12 — PreviewRegenerationManager — successful regeneration', () => {
  it('takes an old RUNNING session through PLANNING -> STOPPING -> GENERATING -> STARTING -> READY, publishing a new session', async () => {
    const dir = join(root, 'proj');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const oldSession = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(oldSession.id).state === 'RUNNING');

    const manager = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => generatedProject(READY_HTTP_SERVER('v2')),
      health: createPreviewHealth(createHttpReadinessProbe(), 15000),
    });

    const result = await manager.regenerate(oldSession.id, { startTimeoutMs: 15000, readinessTimeoutMs: 15000, port: nextPort() });

    expect(result.phase).toBe('READY');
    expect(result.failedPhase).toBeUndefined();
    expect(result.session).toBeDefined();
    expect(result.session!.id).not.toBe(oldSession.id);
    expect(result.health?.readiness).toBe('READY');
    expect(server.getSession(oldSession.id).state).toBe('STOPPED');
    expect(readFileSync(join(dir, 'server.js'), 'utf8')).toContain('v2');
    expect(result.diagnostics.some((d) => d.startsWith('PLANNING'))).toBe(true);
    expect(result.diagnostics.some((d) => d.startsWith('STOPPING'))).toBe(true);
    expect(result.diagnostics.some((d) => d.startsWith('GENERATING'))).toBe(true);
    expect(result.diagnostics.some((d) => d.startsWith('STARTING'))).toBe(true);
    expect(result.diagnostics.some((d) => d.startsWith('READY'))).toBe(true);
  }, 20000);

  it('returns a frozen RegenerationResult with a frozen RegenerationPlan', async () => {
    const dir = join(root, 'frozen');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const oldSession = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(oldSession.id).state === 'RUNNING');
    const manager = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => generatedProject(READY_HTTP_SERVER('v2')),
    });
    const result = await manager.regenerate(oldSession.id, { readinessTimeoutMs: 15000, port: nextPort() });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
  }, 20000);
});

describe('F12 — PreviewRegenerationManager — generation failure', () => {
  it('reports FAILED at GENERATING and does not restart a preview', async () => {
    const dir = join(root, 'genfail');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const oldSession = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(oldSession.id).state === 'RUNNING');

    const manager = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => {
        throw new Error('boom: generation exploded');
      },
    });

    const result = await manager.regenerate(oldSession.id);
    expect(result.phase).toBe('FAILED');
    expect(result.failedPhase).toBe('GENERATING');
    expect(result.session).toBeUndefined();
    expect(result.diagnostics.some((d) => /boom/.test(d))).toBe(true);
    // no new session was started — only the original (now stopped) session exists
    expect(server.listSessions().map((s) => s.id)).toEqual([oldSession.id]);
    expect(server.getSession(oldSession.id).state).toBe('STOPPED');
  }, 20000);
});

describe('F12 — PreviewRegenerationManager — launch failure', () => {
  it('reports FAILED at STARTING with diagnostics when the regenerated project has no dev script', async () => {
    const dir = join(root, 'launchfail');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const oldSession = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(oldSession.id).state === 'RUNNING');

    // The regenerated project has NO "dev" script at all.
    const noDevGenerated: GeneratedProject = {
      files: [{ path: 'package.json', kind: 'config', content: JSON.stringify({ name: 'x', scripts: {} }), digest: 'd' }],
      directories: [], diagnostics: [],
      manifest: { generator: 'fake', sourceModelDigest: 'm', fileCount: 1, directoryCount: 0, diagnosticCount: 0 },
      digest: 'no-dev-digest',
    };
    const manager2 = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => noDevGenerated,
    });

    const result = await manager2.regenerate(oldSession.id);
    expect(result.phase).toBe('FAILED');
    expect(result.failedPhase).toBe('STARTING');
    expect(result.session?.state).toBe('FAILED');
    expect(result.diagnostics.some((d) => /dev.*script/i.test(d))).toBe(true);
  }, 20000);
});

describe('F12 — PreviewRegenerationManager — readiness timeout', () => {
  it('reports FAILED at READY when the new session never becomes reachable, and preserves the regenerated project on disk', async () => {
    const dir = join(root, 'readytimeout');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const oldSession = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(oldSession.id).state === 'RUNNING');

    const manager = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => generatedProject(NEVER_LISTENS),
      health: createPreviewHealth(createHttpReadinessProbe(), 400),
    });

    const result = await manager.regenerate(oldSession.id, { startTimeoutMs: 15000, readinessTimeoutMs: 800, port: nextPort() });
    expect(result.phase).toBe('FAILED');
    expect(result.failedPhase).toBe('READY');
    expect(result.diagnostics.some((d) => /preserved/i.test(d))).toBe(true);
    // the regenerated file really is on disk, unrevered
    expect(readFileSync(join(dir, 'server.js'), 'utf8')).toContain('setInterval');
    // no zombie process left running
    await new Promise((r) => setTimeout(r, 300));
    expect(server.getSession(result.session!.id).state === 'STOPPED' || server.getSession(result.session!.id).state === 'FAILED').toBe(true);
  }, 20000);
});

describe('F12 — PreviewRegenerationManager — repeated regenerations', () => {
  it('supports regenerating twice in a row, chaining each new session id into the next call', async () => {
    const dir = join(root, 'repeated');
    writeFixture(dir, READY_HTTP_SERVER('v1'));
    const session0 = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
    await waitFor(() => server.getSession(session0.id).state === 'RUNNING');

    let version = 1;
    const manager = createPreviewRegenerationManager(server, {
      loadProject: () => fixtureProject(dir),
      regenerateProject: () => generatedProject(READY_HTTP_SERVER(`v${++version}`)),
      health: createPreviewHealth(createHttpReadinessProbe(), 15000),
    });

    const first = await manager.regenerate(session0.id, { readinessTimeoutMs: 15000, port: nextPort() });
    expect(first.phase).toBe('READY');
    const second = await manager.regenerate(first.session!.id, { readinessTimeoutMs: 15000, port: nextPort() });
    expect(second.phase).toBe('READY');

    expect(new Set([session0.id, first.session!.id, second.session!.id]).size).toBe(3);
    expect(readFileSync(join(dir, 'server.js'), 'utf8')).toContain('v3');
  }, 45000);
});

describe('F12 — PreviewRegenerationManager — deterministic orchestration', () => {
  it('produces the same ordered phase sequence across independent runs', async () => {
    async function runOnce(name: string) {
      const dir = join(root, name);
      writeFixture(dir, READY_HTTP_SERVER('v1'));
      const s = server.start(fixtureProject(dir), { startTimeoutMs: 15000, port: nextPort() });
      await waitFor(() => server.getSession(s.id).state === 'RUNNING');
      const manager = createPreviewRegenerationManager(server, {
        loadProject: () => fixtureProject(dir),
        regenerateProject: () => generatedProject(READY_HTTP_SERVER('v2')),
        health: createPreviewHealth(createHttpReadinessProbe(), 15000),
      });
      const result = await manager.regenerate(s.id, { readinessTimeoutMs: 15000, port: nextPort() });
      return result.diagnostics.map((d) => d.split(':')[0]);
    }
    const a = await runOnce('det-a');
    const b = await runOnce('det-b');
    expect(a).toEqual(['PLANNING', 'STOPPING', 'GENERATING', 'STARTING', 'READY']);
    expect(b).toEqual(['PLANNING', 'STOPPING', 'GENERATING', 'STARTING', 'READY']);
  }, 45000);
});

describe('F12 — PreviewRegenerationManager — planning failure', () => {
  it('reports FAILED at PLANNING for an unknown session id, touching nothing', async () => {
    const manager = createPreviewRegenerationManager(server);
    const result = await manager.regenerate('session-does-not-exist');
    expect(result.phase).toBe('FAILED');
    expect(result.failedPhase).toBe('PLANNING');
    expect(result.plan).toBeUndefined();
  });
});
