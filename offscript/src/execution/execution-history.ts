/**
 * E5 — Execution History: the canonical, append-only chronological timeline for one
 * `ExecutionSession` (E4). It never executes, never regenerates, never changes execution — it only
 * DERIVES a typed event sequence from facts already present on a session, and persists that
 * derivation. No AI, no browser, no HTML.
 *
 * Ownership (`docs/execution/E5-EXECUTION-HISTORY.md` §2 for the full grounding):
 *   1. **What belongs permanently to `ExecutionResult` (E3):** `identity`, `status`,
 *      `stepsCompleted`, `diagnostics`, `contract`, `request`, `digest` — one immutable snapshot of
 *      one execution run. This module never reaches into it beyond its own `.digest` (a string) and
 *      `.identity.client`/`.track` (read once, for addressing — never stored a second time).
 *   2. **What belongs permanently to `ExecutionSession` (E4):** `sessionId`, `createdAt`,
 *      `updatedAt`, the CURRENT `currentState`/`execution`, `diagnosticsSnapshots`, and its own
 *      lightweight `history` trail (`{state, executionDigest, recordedAt}` per transition). E4 owns
 *      the CURRENT lifecycle; this module never mutates or extends any of it.
 *   3. **What should exist only as historical events:** the FULL, TYPED, ordered sequence of
 *      chronological facts a session's lifetime implies — `ExecutionEvent`s, each tagged with one
 *      of the six suggested `ExecutionEventType`s, append-only and replayable. This is genuinely new
 *      structure this sprint introduces: E4's own `history` field is a minimal internal bookkeeping
 *      trail (its purpose is letting `recordExecution` compute `currentState` and preserve
 *      `createdAt`); `ExecutionHistory` is the DEDICATED subsystem "future browser editing,
 *      regeneration, collaboration, audit, replay, and AI" are meant to consume (OBJECTIVE) — richer,
 *      independently persisted, and carrying an explicit `sequence` ordinal per entry so append-only
 *      order is a directly verifiable fact, not an implicit array-order assumption.
 *
 * **Pure derivation, not manual bookkeeping.** `record(session)` does not diff against a previously
 * persisted history and append a delta — it re-derives the COMPLETE event sequence FRESH from the
 * given session's own already-append-only data (`createdAt`, `history`, `currentState`,
 * `execution.digest`, `updatedAt`) every time, via `timelineOf`/`eventsFromSession` below. Because
 * E4's own `history` array is itself append-only and monotonic (an OLDER session snapshot's derived
 * events are always a strict PREFIX of a NEWER snapshot's), re-deriving fresh is provably equivalent
 * to true incremental appending — and is immune to hand-written diff bugs. `record()` still checks
 * the derived sequence against whatever is already persisted (`assertExtendsPrior`) before saving,
 * so a caller handing this module a REGRESSED (stale/tampered) session snapshot is rejected rather
 * than silently deleting or rewriting already-persisted events (RULES: "No event rewriting. No
 * event deletion.").
 *
 * **Persistence follows F13/E4's shape:** a raw `ExecutionHistory` never self-carries a digest;
 * `ExecutionHistorySnapshot` wraps it. `client`/`track` are never stored on `ExecutionHistory`
 * itself (would duplicate `ExecutionIdentity`, E1) — `ExecutionHistoryStore`'s `save`/`load`/
 * `listByWorkspace` take them as explicit parameters, exactly E4's own §2.1 reasoning.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { trackDir, type Track } from '../paths.js';
import type { ExecutionSession, ExecutionSessionState, ExecutionSessionHistoryEntry } from './execution-session.js';
import { canonicalizeStructural, versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const EXECUTION_HISTORY_VERSION_TAG = 'e5-execution-history@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, EXECUTION_HISTORY_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** Exactly the six suggested names — no browser events, no regeneration events invented (RULES). */
export type ExecutionEventType =
  | 'SESSION_CREATED'
  | 'SESSION_ACTIVATED'
  | 'STATUS_CHANGED'
  | 'EXECUTION_COMPLETED'
  | 'SESSION_BLOCKED'
  | 'SESSION_ARCHIVED';

/** A chronological fact. `executionDigest` REFERENCES the execution in effect at this event — a
 *  string, never the full `ExecutionResult` re-embedded (OWNERSHIP: "Never duplicate ...
 *  ExecutionResult"). */
export interface ExecutionEvent {
  readonly type: ExecutionEventType;
  readonly state: ExecutionSessionState;
  readonly executionDigest: string;
  readonly occurredAt: string;
}

/** The event AS STORED in the append-only log — `sequence` is an explicit ordinal, never
 *  reassigned, making "append-only" and "replay reconstructs the same sequence" directly checkable
 *  facts rather than an implicit array-order assumption (VALIDATION). */
export interface ExecutionHistoryEntry {
  readonly sequence: number;
  readonly event: ExecutionEvent;
}

export interface ExecutionHistory {
  readonly sessionId: string;
  readonly entries: readonly ExecutionHistoryEntry[];
}

/** Mirrors `ExecutionSessionSnapshot`/`WorkspaceSnapshot` exactly: the logical history never
 *  self-carries a digest; the wrapper computes one fresh at save time. */
export interface ExecutionHistorySnapshot {
  readonly history: ExecutionHistory;
  readonly digest: string;
  readonly savedAt: string;
}

export interface ExecutionHistoryStore {
  load(client: string, track: Track, sessionId: string): ExecutionHistorySnapshot | undefined;
  save(client: string, track: Track, snapshot: ExecutionHistorySnapshot): void;
  listByWorkspace(client: string, track: Track): readonly ExecutionHistorySnapshot[];
}

export interface ExecutionHistoryManager {
  /** Derives the complete event sequence from the given session and persists it — append-only,
   *  rejecting any session whose derived sequence would rewrite or delete already-persisted
   *  events. */
  record(session: ExecutionSession): ExecutionHistory;
  get(client: string, track: Track, sessionId: string): ExecutionHistory | undefined;
  listByWorkspace(client: string, track: Track): readonly ExecutionHistory[];
}

function defaultExecutionHistoryDir(client: string, track: Track): string {
  return join(trackDir(client, track), 'execution-history');
}

// ── derivation — pure, never mutates or re-derives anything E4 already computed ─────────────────

interface TimelinePoint {
  readonly state: ExecutionSessionState;
  readonly executionDigest: string;
  readonly occurredAt: string;
}

/** Reconstructs the full (state, executionDigest, began-at) sequence purely from fields already on
 *  the session — nothing fabricated (header note 3). Each point's `occurredAt` is when that state
 *  BEGAN, not when it ended: `history[k].recordedAt` is the timestamp `recordExecution` captured
 *  for the OUTGOING state (§3 of the report walks through the off-by-one reasoning in full). */
function timelineOf(session: ExecutionSession): readonly TimelinePoint[] {
  const n = session.history.length;
  const points: TimelinePoint[] = [];

  if (n === 0) {
    // No `recordExecution` has ever run. If the session is still `CREATED`, this one point IS the
    // whole story. If it's something else (e.g. `archive()` was called with zero prior
    // `recordExecution` calls — E4's `archive()` never appends to `history`), the creation fact
    // must still be recovered explicitly, or it would be lost entirely.
    points.push({ state: 'CREATED', executionDigest: session.execution.digest, occurredAt: session.createdAt });
    if (session.currentState !== 'CREATED') {
      points.push({ state: session.currentState, executionDigest: session.execution.digest, occurredAt: session.updatedAt });
    }
    return points;
  }

  // k = 0: the creation-time (state, execution) — session.createdAt is the true origin timestamp,
  // never `history[0].recordedAt` (which is when it was LATER retired, not when it began).
  const h0: ExecutionSessionHistoryEntry = session.history[0];
  points.push({ state: h0.state, executionDigest: h0.executionDigest, occurredAt: session.createdAt });

  // k = 1..n-1: each retired state BEGAN the instant the PRIOR one was retired — history[k-1]'s own
  // recordedAt.
  for (let k = 1; k < n; k++) {
    const hk: ExecutionSessionHistoryEntry = session.history[k];
    points.push({ state: hk.state, executionDigest: hk.executionDigest, occurredAt: session.history[k - 1].recordedAt });
  }

  // k = n: the CURRENT state began at the last recorded transition.
  points.push({ state: session.currentState, executionDigest: session.execution.digest, occurredAt: session.updatedAt });

  return points;
}

/** `FAILED` has no dedicated suggested event name — `STATUS_CHANGED` is its honest fallback
 *  (RULES: "Do not invent ... events" — reuse one of the six suggested names, never a new one). */
const EVENT_TYPE_BY_STATE: Record<ExecutionSessionState, ExecutionEventType> = {
  CREATED: 'SESSION_CREATED',
  ACTIVE: 'SESSION_ACTIVATED',
  BLOCKED: 'SESSION_BLOCKED',
  COMPLETED: 'EXECUTION_COMPLETED',
  FAILED: 'STATUS_CHANGED',
  ARCHIVED: 'SESSION_ARCHIVED',
};

function deriveHistory(session: ExecutionSession): ExecutionHistory {
  const entries: ExecutionHistoryEntry[] = timelineOf(session).map((p, sequence) => ({
    sequence,
    event: { type: EVENT_TYPE_BY_STATE[p.state], state: p.state, executionDigest: p.executionDigest, occurredAt: p.occurredAt },
  }));
  return { sessionId: session.sessionId, entries };
}

function freezeHistory(history: ExecutionHistory): ExecutionHistory {
  history.entries.forEach((e) => {
    Object.freeze(e.event);
    Object.freeze(e);
  });
  Object.freeze(history.entries);
  return Object.freeze(history);
}

/** Enforces RULES: "No event rewriting. No event deletion." — the newly derived sequence must be a
 *  strict prefix-preserving extension of whatever is already persisted. */
function assertExtendsPrior(prior: ExecutionHistory, next: ExecutionHistory): void {
  if (next.entries.length < prior.entries.length) {
    throw new Error(
      `ExecutionHistoryManager: refusing to record a REGRESSED session for ${next.sessionId} — ` +
        `it derives only ${next.entries.length} event(s), but ${prior.entries.length} are already persisted ` +
        `(append-only: no event rewriting, no event deletion).`,
    );
  }
  for (let i = 0; i < prior.entries.length; i++) {
    if (digestOf(prior.entries[i]) !== digestOf(next.entries[i])) {
      throw new Error(
        `ExecutionHistoryManager: refusing to record a session for ${next.sessionId} whose derived event #${i} ` +
          `would REWRITE an already-persisted event (append-only: no event rewriting).`,
      );
    }
  }
}

function parseAndVerify(path: string): ExecutionHistorySnapshot {
  const raw = readFileSync(path, 'utf8');
  let parsed: ExecutionHistorySnapshot;
  try {
    parsed = JSON.parse(raw) as ExecutionHistorySnapshot;
  } catch (err) {
    throw new Error(`ExecutionHistoryStore: ${path} is not valid JSON — ${(err as Error).message}`);
  }
  const recomputed = digestOf(parsed.history);
  if (recomputed !== parsed.digest) {
    throw new Error(`ExecutionHistoryStore: ${path} failed integrity check — digest mismatch`);
  }
  return Object.freeze({ history: freezeHistory(parsed.history), digest: parsed.digest, savedAt: parsed.savedAt });
}

export function createExecutionHistoryStore(resolveDir: (client: string, track: Track) => string = defaultExecutionHistoryDir): ExecutionHistoryStore {
  return {
    save(client, track, snapshot) {
      const dir = resolveDir(client, track);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${snapshot.history.sessionId}.json`), JSON.stringify(canonicalizeStructural(snapshot), null, 2), 'utf8');
    },
    load(client, track, sessionId) {
      const path = join(resolveDir(client, track), `${sessionId}.json`);
      if (!existsSync(path)) return undefined;
      return parseAndVerify(path);
    },
    listByWorkspace(client, track) {
      const dir = resolveDir(client, track);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => parseAndVerify(join(dir, f)));
    },
  };
}

export function createExecutionHistoryManager(store: ExecutionHistoryStore = createExecutionHistoryStore()): ExecutionHistoryManager {
  return {
    record(session) {
      const { client, track } = session.execution.identity;
      const derived = freezeHistory(deriveHistory(session));
      const existing = store.load(client, track, session.sessionId);
      if (existing) assertExtendsPrior(existing.history, derived);

      const snapshot: ExecutionHistorySnapshot = Object.freeze({
        history: derived,
        digest: digestOf(derived),
        savedAt: new Date().toISOString(),
      });
      store.save(client, track, snapshot);
      return derived;
    },

    get(client, track, sessionId) {
      return store.load(client, track, sessionId)?.history;
    },

    listByWorkspace(client, track) {
      return store.listByWorkspace(client, track).map((s) => s.history);
    },
  };
}
