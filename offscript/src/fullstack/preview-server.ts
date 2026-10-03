/**
 * F10 — Preview Server: launches, tracks, and stops local preview sessions for a `PreviewProject`
 * (F9). The first Program-F module that spawns and manages a live, long-running child process —
 * every prior module (F2–F9) was either a pure transformation or a one-shot filesystem read/write.
 *
 * Ownership (`docs/fullstack/F10-PREVIEW-SERVER.md` §3 for the full grounding):
 *   1. Discovery stays with Preview Workspace (F9) — this module accepts an already-resolved
 *      `PreviewProject` as input, never calls `loadPreviewProject`/`loadPreviewWorkspace` itself,
 *      and never re-derives client/track/path/framework — all reused verbatim from the input.
 *   2. Process execution (spawn/kill) belongs to `PreviewServer` — the only export in this module
 *      that touches `node:child_process`.
 *   3. Lifecycle bookkeeping (id/port allocation, state transitions, diagnostics) belongs to
 *      `PreviewSessionManager` — a separate, pure-logic component `PreviewServer` calls into,
 *      testable in isolation without spawning any real process.
 *   4. Session state is in-memory only, owned by the `PreviewSessionManager` instance a
 *      `PreviewServer` was constructed with — never persisted to disk. This is exactly the
 *      boundary F9 named and deliberately left unbuilt ("No runtime state. No browser. No dev
 *      server.", `preview-workspace.ts` header) — this sprint is that boundary.
 *
 * `PreviewSession.startedAt` uses real wall-clock time (`new Date().toISOString()`) — a deliberate
 * departure from the deterministic/content-addressed digest discipline every F2–F9 module holds.
 * Those modules are pure, replayable transformations; this one is live infrastructure managing a
 * real OS process. There is nothing to replay — a session either is or isn't running right now.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Track } from '../paths.js';
import type { PreviewProject } from './preview-workspace.js';

export type PreviewSessionState = 'STARTING' | 'RUNNING' | 'STOPPED' | 'FAILED';

export interface PreviewSessionDiagnostic {
  readonly level: 'info' | 'warning' | 'error';
  readonly message: string;
}

export interface PreviewSession {
  readonly id: string;
  readonly client: string;
  readonly track: Track;
  readonly projectPath: string;
  readonly framework: string;
  readonly port: number;
  readonly state: PreviewSessionState;
  readonly startedAt: string;
  readonly diagnostics: readonly PreviewSessionDiagnostic[];
}

export interface PreviewStartOptions {
  readonly port?: number;
  /** Milliseconds to wait for a readiness signal before failing the session. Default 15000. */
  readonly startTimeoutMs?: number;
}

// ── PreviewSessionManager — pure bookkeeping, no process spawning ──────────────────────────────

interface SessionRecord {
  id: string;
  client: string;
  track: Track;
  projectPath: string;
  framework: string;
  port: number;
  state: PreviewSessionState;
  startedAt: string;
  diagnostics: PreviewSessionDiagnostic[];
}

export interface PreviewSessionManager {
  register(input: { client: string; track: Track; projectPath: string; framework: string; port?: number }): PreviewSession;
  transition(id: string, state: PreviewSessionState, diagnostic?: PreviewSessionDiagnostic): PreviewSession;
  addDiagnostic(id: string, diagnostic: PreviewSessionDiagnostic): PreviewSession;
  get(id: string): PreviewSession;
  list(): readonly PreviewSession[];
  allocatePort(): number;
}

const BASE_PORT = 4100;

function snapshot(record: SessionRecord): PreviewSession {
  return Object.freeze({
    id: record.id,
    client: record.client,
    track: record.track,
    projectPath: record.projectPath,
    framework: record.framework,
    port: record.port,
    state: record.state,
    startedAt: record.startedAt,
    diagnostics: Object.freeze([...record.diagnostics]),
  });
}

export function createPreviewSessionManager(): PreviewSessionManager {
  const sessions = new Map<string, SessionRecord>();
  let nextId = 1;

  function allocatePort(): number {
    const used = new Set([...sessions.values()].map((s) => s.port));
    let port = BASE_PORT;
    while (used.has(port)) port++;
    return port;
    // ponytail: in-memory collision avoidance only, no OS-level free-port probe — add a real
    // bind-test if externally-occupied ports become a real problem.
  }

  function getRecord(id: string): SessionRecord {
    const record = sessions.get(id);
    if (!record) throw new Error(`PreviewSessionManager: unknown session id ${id}`);
    return record;
  }

  return {
    register({ client, track, projectPath, framework, port }) {
      const id = `session-${nextId++}`;
      const record: SessionRecord = {
        id,
        client,
        track,
        projectPath,
        framework,
        port: port ?? allocatePort(),
        state: 'STARTING',
        startedAt: new Date().toISOString(),
        diagnostics: [],
      };
      sessions.set(id, record);
      return snapshot(record);
    },
    transition(id, state, diagnostic) {
      const record = getRecord(id);
      record.state = state;
      if (diagnostic) record.diagnostics.push(diagnostic);
      return snapshot(record);
    },
    addDiagnostic(id, diagnostic) {
      const record = getRecord(id);
      record.diagnostics.push(diagnostic);
      return snapshot(record);
    },
    get(id) {
      return snapshot(getRecord(id));
    },
    list() {
      return Object.freeze(
        [...sessions.values()].map(snapshot).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
      );
    },
    allocatePort,
  };
}

// ── PreviewServer — process execution ───────────────────────────────────────────────────────────

export interface PreviewServer {
  start(project: PreviewProject, opts?: PreviewStartOptions): PreviewSession;
  stop(sessionId: string): PreviewSession;
  getSession(sessionId: string): PreviewSession;
  listSessions(): readonly PreviewSession[];
}

const DEFAULT_START_TIMEOUT_MS = 15000;
/** Intentionally generic — matches common framework dev-server readiness phrasing (Next.js prints
 *  "Ready" / "started server"; other frameworks commonly print "Local: http://..."). Brief:
 *  "Do not parse framework output beyond what is necessary to report readiness." */
const READY_PATTERN = /ready|started server|local:\s*https?:\/\//i;
const STDERR_TAIL_LINES = 10;

function resolveDevCommand(projectPath: string): string | undefined {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
    return pkg.scripts?.dev;
  } catch {
    return undefined;
  }
}

/** Replicates `npm run <script>`'s one useful side effect (prepending the project's own
 *  `node_modules/.bin` to `PATH`, so a locally-installed CLI like `next` resolves as a bare
 *  command) without npm's own process-spawning indirection. */
function envWithProjectBin(projectPath: string): NodeJS.ProcessEnv {
  const binDir = join(projectPath, 'node_modules', '.bin');
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[pathKey] = `${binDir}${delimiter}${env[pathKey] ?? ''}`;
  return env;
}

/** Kills the whole process tree, not just the immediate child — `npm run dev` spawns a further
 *  child (e.g. `next`), so killing only the top PID leaves the real dev server orphaned. */
function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f']);
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }
}

export function createPreviewServer(manager: PreviewSessionManager = createPreviewSessionManager()): PreviewServer {
  const processes = new Map<string, ChildProcess>();
  const timers = new Map<string, NodeJS.Timeout>();

  function clearStartTimer(id: string): void {
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
  }

  return {
    start(project, opts = {}) {
      const devCommand = resolveDevCommand(project.path);
      const session = manager.register({
        client: project.client,
        track: project.track,
        projectPath: project.path,
        framework: project.framework,
        port: opts.port,
      });

      if (!devCommand) {
        return manager.transition(session.id, 'FAILED', {
          level: 'error',
          message: `package.json has no "dev" script in ${project.path} — cannot launch a preview.`,
        });
      }

      // Spawn the resolved dev command directly (e.g. "next dev") rather than through
      // `npm run dev` — npm's own script-runner adds an extra, unpredictably-timed async spawn
      // indirection on Windows (its real child can launch AFTER a tree-kill of the npm wrapper
      // already returned), which made `stop()` racy. Spawning the command itself keeps exactly
      // one shell layer between this process and the real dev server.
      const child = spawn(devCommand, {
        cwd: project.path,
        shell: true,
        env: { ...envWithProjectBin(project.path), PORT: String(session.port) },
        detached: process.platform !== 'win32',
      });
      processes.set(session.id, child);
      manager.addDiagnostic(session.id, {
        level: 'info',
        message: `launching "${devCommand}" in ${project.path} on port ${session.port}`,
      });

      const stderrTail: string[] = [];
      const timeoutMs = opts.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;

      const timer = setTimeout(() => {
        if (manager.get(session.id).state !== 'STARTING') return;
        manager.transition(session.id, 'FAILED', {
          level: 'error',
          message: `startup timed out after ${timeoutMs}ms — no readiness signal detected.`,
        });
        if (child.pid) killProcessTree(child.pid);
      }, timeoutMs);
      timers.set(session.id, timer);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (manager.get(session.id).state === 'STARTING' && READY_PATTERN.test(text)) {
          clearStartTimer(session.id);
          manager.transition(session.id, 'RUNNING', { level: 'info', message: 'ready signal detected.' });
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrTail.push(chunk.toString('utf8'));
        if (stderrTail.length > STDERR_TAIL_LINES) stderrTail.shift();
      });

      child.on('error', (err) => {
        if (manager.get(session.id).state !== 'STARTING') return;
        clearStartTimer(session.id);
        manager.transition(session.id, 'FAILED', { level: 'error', message: `failed to launch: ${err.message}` });
      });

      child.on('exit', (code) => {
        clearStartTimer(session.id);
        processes.delete(session.id);
        const state = manager.get(session.id).state;
        const tail = stderrTail.join('').trim().slice(-400);
        if (state === 'STARTING') {
          manager.transition(session.id, 'FAILED', {
            level: 'error',
            message: `process exited before becoming ready (code ${code}). stderr: ${tail}`,
          });
        } else if (state === 'RUNNING') {
          manager.transition(session.id, 'FAILED', {
            level: 'error',
            message: `process exited unexpectedly (code ${code}). stderr: ${tail}`,
          });
        }
        // STOPPED or already-FAILED: already finalized, this exit is expected — no-op.
      });

      return manager.get(session.id);
    },

    stop(sessionId) {
      const current = manager.get(sessionId);
      clearStartTimer(sessionId);
      const child = processes.get(sessionId);
      if (child?.pid && (current.state === 'STARTING' || current.state === 'RUNNING')) {
        killProcessTree(child.pid);
        // Killing a session mid-STARTING can race a framework CLI that is still spawning its own
        // child (e.g. npm → the real dev-server process) — one defensive follow-up kill catches a
        // grandchild that finished spawning just after the first pass.
        const pid = child.pid;
        setTimeout(() => killProcessTree(pid), 250);
      }
      processes.delete(sessionId);
      if (current.state === 'STOPPED' || current.state === 'FAILED') return current;
      return manager.transition(sessionId, 'STOPPED', { level: 'info', message: 'session stopped.' });
    },

    getSession(sessionId) {
      return manager.get(sessionId);
    },

    listSessions() {
      return manager.list();
    },
  };
}
