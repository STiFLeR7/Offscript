/**
 * F11 — Preview Readiness & Health: a read-only observational layer over a `PreviewSession`
 * (F10). "The process is running" (F10's `RUNNING` state, derived from stdout text-matching) is
 * NOT the same fact as "the application is reachable" — this module distinguishes them by
 * actually probing the session's own port over HTTP.
 *
 * Ownership (`docs/fullstack/F11-PREVIEW-READINESS.md` §2 for the full grounding):
 *   1. Current `PreviewSession` lifecycle (F10, unchanged): `STARTING → RUNNING/FAILED`, then
 *      `RUNNING → FAILED` (unexpected exit) or `→ STOPPED` (explicit stop). This module NEVER
 *      calls `PreviewServer.start`/`.stop`/`.transition` — it only reads a `PreviewSession`
 *      snapshot a caller already obtained from `PreviewServer.getSession()`.
 *   2. `RUNNING` today is a STDOUT TEXT MATCH (`READY_PATTERN` in `preview-server.ts`) — a proxy
 *      signal, not a live check. This sprint adds the live check on top, never replacing or
 *      modifying F10's own signal.
 *   3. Readiness signals used: a successful HTTP response (the strongest live signal — the port is
 *      not just open, something answered a real request) and elapsed time since `startedAt`
 *      (F10's own real, already-available anchor — no new timer state invented). Framework
 *      internals and log content beyond F10's own existing stdout match are never inspected.
 *   4. Readiness belongs to NEITHER the server nor the session — it is a separate, additive
 *      overlay (`PreviewHealth`) that OBSERVES a `PreviewSession` from outside. `PreviewServer`
 *      remains responsible only for execution (STOP; this sprint's own success criteria);
 *      `PreviewSession` itself is not widened with a new field — `HealthSnapshot` is its own type,
 *      keyed by `sessionId`, tracked in a separate in-memory map this module owns.
 */
import type { PreviewSession } from './preview-server.js';

export type PreviewReadiness = 'STARTING' | 'READY' | 'UNHEALTHY' | 'STOPPED';

export interface HealthSnapshot {
  readonly sessionId: string;
  readonly readiness: PreviewReadiness;
  readonly lastProbeAt: string;
  readonly endpoint: string;
  readonly responseTimeMs: number | undefined;
  readonly failureReason: string | undefined;
}

export interface ProbeResult {
  readonly reachable: boolean;
  readonly responseTimeMs: number | undefined;
  readonly failureReason: string | undefined;
}

/** Observation only — a probe answers "can I reach this endpoint right now, and how", nothing
 *  about WHY in framework terms. `createHttpReadinessProbe` is the one implementation this sprint
 *  ships; the interface is the seam a future TCP-only or protocol-specific probe would implement. */
export interface ReadinessProbe {
  probe(endpoint: string): Promise<ProbeResult>;
}

const HTTP_PROBE_TIMEOUT_MS = 2000;

/** "successful HTTP response" (brief) — ANY response received (any status code) proves the
 *  application's own server is up and answering; this module never inspects the response body or
 *  status beyond "did one arrive," per "do not inspect framework internals." */
export function createHttpReadinessProbe(): ReadinessProbe {
  return {
    async probe(endpoint) {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_PROBE_TIMEOUT_MS);
      try {
        await fetch(endpoint, { signal: controller.signal });
        return { reachable: true, responseTimeMs: Date.now() - start, failureReason: undefined };
      } catch (err) {
        return { reachable: false, responseTimeMs: undefined, failureReason: (err as Error).message };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export interface PreviewHealth {
  /** Perform one probe (if the session's own process state warrants it) and publish the
   *  resulting `HealthSnapshot`, keyed by `session.id`. */
  check(session: PreviewSession): Promise<HealthSnapshot>;
  /** The last published snapshot for a session id, or `undefined` if `check()` was never called
   *  for it. Never triggers a new probe. */
  getSnapshot(sessionId: string): HealthSnapshot | undefined;
  /** Polls `check(getSession())` until READY/UNHEALTHY/STOPPED or `opts.timeoutMs` elapses.
   *  `getSession` is a callback (not a static snapshot) so each poll observes the session's
   *  CURRENT state — a `PreviewSession` value is frozen at the moment it was read. */
  waitUntilReady(
    getSession: () => PreviewSession,
    opts?: { readonly timeoutMs?: number; readonly intervalMs?: number },
  ): Promise<HealthSnapshot>;
}

const DEFAULT_READINESS_TIMEOUT_MS = 20000;
const DEFAULT_POLL_INTERVAL_MS = 200;

function endpointFor(session: PreviewSession): string {
  return `http://localhost:${session.port}/`;
}

function freeze(snapshot: HealthSnapshot): HealthSnapshot {
  return Object.freeze(snapshot);
}

export function createPreviewHealth(
  probe: ReadinessProbe = createHttpReadinessProbe(),
  readinessTimeoutMs: number = DEFAULT_READINESS_TIMEOUT_MS,
): PreviewHealth {
  const snapshots = new Map<string, HealthSnapshot>();

  async function check(session: PreviewSession): Promise<HealthSnapshot> {
    const lastProbeAt = new Date().toISOString();
    const endpoint = endpointFor(session);
    const previous = snapshots.get(session.id);

    // A stopped/failed process has nothing left to observe over the network — derive readiness
    // directly from F10's own state rather than probing a dead port.
    if (session.state === 'STOPPED') {
      const snap = freeze({ sessionId: session.id, readiness: 'STOPPED', lastProbeAt, endpoint, responseTimeMs: undefined, failureReason: undefined });
      snapshots.set(session.id, snap);
      return snap;
    }
    if (session.state === 'FAILED') {
      const lastError = [...session.diagnostics].reverse().find((d) => d.level === 'error');
      const snap = freeze({
        sessionId: session.id,
        readiness: 'UNHEALTHY',
        lastProbeAt,
        endpoint,
        responseTimeMs: undefined,
        failureReason: lastError?.message ?? 'the underlying preview session failed.',
      });
      snapshots.set(session.id, snap);
      return snap;
    }

    // session.state is STARTING or RUNNING — a process existing is not sufficient for READY.
    const result = await probe.probe(endpoint);
    let readiness: PreviewReadiness;
    let failureReason: string | undefined;

    if (result.reachable) {
      readiness = 'READY';
      failureReason = undefined;
    } else if (previous?.readiness === 'READY') {
      // A regression — it was reachable a moment ago and now isn't. Report this immediately,
      // never silently step back to STARTING.
      readiness = 'UNHEALTHY';
      failureReason = `was ready, now unreachable — ${result.failureReason ?? 'no response'}`;
    } else if (Date.now() - new Date(session.startedAt).getTime() > readinessTimeoutMs) {
      readiness = 'UNHEALTHY';
      failureReason = `readiness timed out after ${readinessTimeoutMs}ms — ${result.failureReason ?? 'no response'}`;
    } else {
      readiness = 'STARTING';
      failureReason = result.failureReason;
    }

    const snap = freeze({ sessionId: session.id, readiness, lastProbeAt, endpoint, responseTimeMs: result.responseTimeMs, failureReason });
    snapshots.set(session.id, snap);
    return snap;
  }

  return {
    check,
    getSnapshot(sessionId) {
      return snapshots.get(sessionId);
    },
    async waitUntilReady(getSession, opts = {}) {
      const timeoutMs = opts.timeoutMs ?? readinessTimeoutMs;
      const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const deadline = Date.now() + timeoutMs;
      let last = await check(getSession());
      while (last.readiness === 'STARTING' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, intervalMs));
        last = await check(getSession());
      }
      return last;
    },
  };
}
