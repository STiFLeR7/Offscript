/**
 * E4 — Execution Session: the first long-lived, persistent state in Program E. `ExecutionSession`
 * is the canonical state holder that wraps one immutable `ExecutionResult` (E3) — the object a
 * future browser-editing, regeneration, collaboration, or AI feature attaches to instead of
 * reaching directly into `ExecutionResult`. This sprint introduces no execution, no regeneration,
 * no browser logic, no AI — it only gives a review execution lifecycle a durable, addressable home.
 *
 * Ownership (`docs/execution/E4-EXECUTION-SESSION.md` §2 for the full grounding):
 *   1. **What `ExecutionResult` owns (E3, re-confirmed by re-reading the source):** `identity`,
 *      `status`, `stepsCompleted`, `diagnostics`, `contract`, `request`, `digest` — a fully immutable,
 *      deep-frozen-where-owned artifact. Nothing in this module reaches into or re-derives any of
 *      that; `ExecutionResult` is treated as a single opaque, already-correct value.
 *   2. **What must remain immutable:** the wrapped `ExecutionResult` itself, and everything R8/E1
 *      built underneath it (`contract`/`request`/`identity`). OWNERSHIP is explicit: "Never
 *      duplicate: ExecutionContract, ExecutionRequest, ExecutionIdentity, ExecutionResult. Store
 *      references only." `ExecutionSession` therefore has exactly ONE field pointing at the
 *      execution (`execution: ExecutionResult`) — never separate top-level `contract`/`request`/
 *      `identity` fields that would duplicate what `execution` already carries.
 *   3. **Which information belongs only to a session:** everything the OWNERSHIP section's own
 *      examples name — `sessionId`, `createdAt`, `updatedAt`, `currentState`, `history`,
 *      `diagnosticsSnapshots` — none of which exists anywhere in R8/E1/E2/E3's own artifacts. This
 *      is genuinely NEW data this sprint introduces, not a projection of anything upstream.
 *      `sessionId` is the one exception worth naming: rather than invent a new synthetic id, it
 *      REUSES `execution.identity.sessionId` (the underlying `ReviewSession.id`, R1) as the
 *      session's own natural key — reusing a value, not duplicating a structure, the same
 *      distinction R8/E1 already drew for their own identity projections.
 *
 * **Persistence follows F13's shape, not R1's** (`docs/fullstack/F13-WORKSPACE-STATE.md`): a raw
 * logical `ExecutionSession` (no self-carried digest) wrapped by a separate `ExecutionSessionSnapshot`
 * `{session, digest, savedAt}` computed fresh at save time — never R1's self-digesting
 * `ReviewSession` shape, which is exactly the pattern that caused R1's own stale-digest bug
 * (spreading a previously-loaded, digest-carrying object before rehashing it). Persisted to
 * `projects/<client>/<track>/execution-sessions/<sessionId>.json` — a new directory, sibling to
 * (never inside) R1's own `reviews/` and F13's `workspace-state.json`, addressed by `(client,
 * track)` derived from `execution.identity` (never a second, independently-stored copy of it).
 *
 * **History and diagnostics snapshots are lightweight, never full duplicates:** `history` entries
 * reference a PAST execution only by its `digest` (a string), never by re-embedding the whole
 * `ExecutionResult` object a second time. `diagnosticsSnapshots` collects the actual
 * `ExecutionDiagnostics` object REFERENCES from each attached execution (small, already-frozen
 * plain data — not one of the four forbidden-to-duplicate types), so no cloning happens there
 * either.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { trackDir, type Track } from '../paths.js';
import type { ExecutionResult, ExecutionStatus, ExecutionDiagnostics } from './native-review-execution.js';
import { canonicalizeStructural, versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const EXECUTION_SESSION_VERSION_TAG = 'e4-execution-session@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, EXECUTION_SESSION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** Explicit states — never a boolean (RULES). `CREATED`/`ARCHIVED` are session-lifecycle facts
 *  (has this session ever been touched since birth? has it been explicitly closed out?) — distinct
 *  from `ACTIVE`/`BLOCKED`/`COMPLETED`/`FAILED`, which mirror the wrapped execution's OWN `status`
 *  once the session has been updated at least once (§5 of the report for the full derivation). */
export type ExecutionSessionState = 'CREATED' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

/** A past execution, referenced only by its digest — never the full `ExecutionResult` re-embedded
 *  (OWNERSHIP: "Never duplicate ... ExecutionResult"). */
export interface ExecutionSessionHistoryEntry {
  readonly state: ExecutionSessionState;
  readonly executionDigest: string;
  readonly recordedAt: string;
}

export interface ExecutionSession {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currentState: ExecutionSessionState;
  /** The CURRENT `ExecutionResult`, by reference — the only place this session ever holds one. */
  readonly execution: ExecutionResult;
  readonly diagnosticsSnapshots: readonly ExecutionDiagnostics[];
  readonly history: readonly ExecutionSessionHistoryEntry[];
}

/** The persisted envelope — mirrors F13's `WorkspaceSnapshot` shape exactly: the logical state
 *  (`session`) never self-carries a digest; the wrapper computes one fresh at save time. */
export interface ExecutionSessionSnapshot {
  readonly session: ExecutionSession;
  readonly digest: string;
  readonly savedAt: string;
}

export interface ExecutionSessionStore {
  load(client: string, track: Track, sessionId: string): ExecutionSessionSnapshot | undefined;
  save(client: string, track: Track, snapshot: ExecutionSessionSnapshot): void;
  listByWorkspace(client: string, track: Track): readonly ExecutionSessionSnapshot[];
}

export interface ExecutionSessionManager {
  /** Wraps a FRESH `ExecutionResult` in a brand-new session (`CREATED`). */
  createSession(executionResult: ExecutionResult): ExecutionSession;
  /** Attaches a NEW `ExecutionResult` to an EXISTING session — the prior state moves into
   *  `history`, `currentState` is re-derived from the new execution's own status. */
  recordExecution(executionResult: ExecutionResult): ExecutionSession;
  /** Explicit terminal close-out — never derived from an execution's status. */
  archive(client: string, track: Track, sessionId: string): ExecutionSession;
  get(client: string, track: Track, sessionId: string): ExecutionSession | undefined;
  listByWorkspace(client: string, track: Track): readonly ExecutionSession[];
}

function defaultExecutionSessionsDir(client: string, track: Track): string {
  return join(trackDir(client, track), 'execution-sessions');
}

function freezeSession(session: ExecutionSession): ExecutionSession {
  Object.freeze(session.diagnosticsSnapshots);
  Object.freeze(session.history);
  session.history.forEach(Object.freeze);
  return Object.freeze(session);
}

function parseAndVerify(path: string): ExecutionSessionSnapshot {
  const raw = readFileSync(path, 'utf8');
  let parsed: ExecutionSessionSnapshot;
  try {
    parsed = JSON.parse(raw) as ExecutionSessionSnapshot;
  } catch (err) {
    throw new Error(`ExecutionSessionStore: ${path} is not valid JSON — ${(err as Error).message}`);
  }
  const recomputed = digestOf(parsed.session);
  if (recomputed !== parsed.digest) {
    throw new Error(`ExecutionSessionStore: ${path} failed integrity check — digest mismatch`);
  }
  return Object.freeze({ session: freezeSession(parsed.session), digest: parsed.digest, savedAt: parsed.savedAt });
}

export function createExecutionSessionStore(resolveDir: (client: string, track: Track) => string = defaultExecutionSessionsDir): ExecutionSessionStore {
  return {
    save(client, track, snapshot) {
      const dir = resolveDir(client, track);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${snapshot.session.sessionId}.json`), JSON.stringify(canonicalizeStructural(snapshot), null, 2), 'utf8');
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

/** `CREATED`/`ARCHIVED` are never produced here — they are session-only facts assigned directly by
 *  `createSession`/`archive`. Everything else mirrors the wrapped execution's own `status`: an
 *  `INVALID` execution is a failure from the session's perspective (never silently "fine"); an
 *  `UNKNOWN` execution leaves the session `ACTIVE` — indeterminate, not yet resolved either way. */
function deriveSessionStateFromStatus(status: ExecutionStatus): ExecutionSessionState {
  switch (status) {
    case 'COMPLETED':
      return 'COMPLETED';
    case 'BLOCKED':
      return 'BLOCKED';
    case 'FAILED':
    case 'INVALID':
      return 'FAILED';
    case 'UNKNOWN':
      return 'ACTIVE';
  }
}

export function createExecutionSessionManager(store: ExecutionSessionStore = createExecutionSessionStore()): ExecutionSessionManager {
  function must(client: string, track: Track, sessionId: string): ExecutionSession {
    const s = store.load(client, track, sessionId);
    if (!s) throw new Error(`ExecutionSessionManager: unknown execution session ${sessionId} for ${client}/${track}`);
    return s.session;
  }

  function persist(client: string, track: Track, session: ExecutionSession): ExecutionSession {
    const frozen = freezeSession(session);
    const snapshot: ExecutionSessionSnapshot = Object.freeze({
      session: frozen,
      digest: digestOf(frozen),
      savedAt: new Date().toISOString(),
    });
    store.save(client, track, snapshot);
    return frozen;
  }

  return {
    createSession(executionResult) {
      const { client, track, sessionId } = executionResult.identity;
      const now = new Date().toISOString();
      return persist(client, track, {
        sessionId,
        createdAt: now,
        updatedAt: now,
        currentState: 'CREATED',
        execution: executionResult,
        diagnosticsSnapshots: [executionResult.diagnostics],
        history: [],
      });
    },

    recordExecution(executionResult) {
      const { client, track, sessionId } = executionResult.identity;
      const existing = must(client, track, sessionId);
      const historyEntry: ExecutionSessionHistoryEntry = {
        state: existing.currentState,
        executionDigest: existing.execution.digest,
        recordedAt: new Date().toISOString(),
      };
      return persist(client, track, {
        sessionId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        currentState: deriveSessionStateFromStatus(executionResult.status),
        execution: executionResult,
        diagnosticsSnapshots: [...existing.diagnosticsSnapshots, executionResult.diagnostics],
        history: [...existing.history, historyEntry],
      });
    },

    archive(client, track, sessionId) {
      const existing = must(client, track, sessionId);
      return persist(client, track, { ...existing, currentState: 'ARCHIVED', updatedAt: new Date().toISOString() });
    },

    get(client, track, sessionId) {
      return store.load(client, track, sessionId)?.session;
    },

    listByWorkspace(client, track) {
      return store.listByWorkspace(client, track).map((s) => s.session);
    },
  };
}
