/**
 * R1 — Review Session: the Design Review subsystem. Owns human review only — it never generates,
 * never launches a process, never regenerates, never inspects HTML or browser coordinates. A
 * sibling subsystem to Program F, not part of it: this module imports Program F's TYPES for
 * naming consistency (`Track`) but never its functions — Program F is never called.
 *
 * Ownership (`docs/review/R1-REVIEW-SESSION.md` §2 for the full grounding):
 *   1. Where review belongs: a NEW, independent subsystem (`src/review/`), sibling to Program F
 *      (`src/fullstack/`), not nested inside it — the same "lives outside on purpose" isolation
 *      discipline F2's own header already established for Program F relative to Generation.
 *   2. Current ownership boundaries (Program F, unchanged, never called): discovery (F9),
 *      execution (F10), health (F11), regeneration (F12), and durable workspace metadata (F13).
 *      None of them know anything about human review notes, and this module adds nothing to any
 *      of them.
 *   3. What existing metadata can identify a review target: `ProjectModel`'s (F4) own stable
 *      semantic vocabulary — `ProjectPage.id`/`.role`, `ViewNode.id`/`.kind`
 *      ('section'|'slot')/`.componentRef` — is reused as `ReviewTarget`'s vocabulary
 *      (`targetType`: 'page'|'section'|'component'|'slot', `targetId`: the stable id string). No
 *      browser coordinate, DOM selector, or HTML byte offset is ever part of a `ReviewTarget` —
 *      structurally impossible, since this module never imports anything HTML-shaped.
 *   4. Whether review belongs to Preview or Workspace: **neither.** Per this sprint's own
 *      PERSISTENCE requirement ("Persist review sessions separately from Workspace State.
 *      Workspace State references Review Sessions. Neither owns the other's data."), review is a
 *      PEER subsystem. `ReviewSession` carries enough identity (`client`/`track`) that a FUTURE
 *      `WorkspaceState` enhancement could reference a review session by id — but STOP forbids
 *      modifying Program F this sprint, so that reference is NOT wired here; it is a named,
 *      one-directional future connection (§6/§8 of the report), not built.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { trackDir, type Track } from '../paths.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_SESSION_VERSION_TAG = 'r1-review-session@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_SESSION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type ReviewState = 'OPEN' | 'RESOLVED' | 'DISMISSED';

/** Not dictated by the brief's own REVIEW MODEL section (only `ReviewState`'s three values were
 *  named there) — a minimal, standard design-review severity vocabulary, chosen deliberately. */
export type ReviewSeverity = 'blocker' | 'major' | 'minor' | 'nit';

export type ReviewTargetType = 'page' | 'section' | 'component' | 'slot';

/** Stable semantic identity only — reuses `ProjectModel`'s (F4) own vocabulary
 *  (`ProjectPage.id`/`.role`, `ViewNode.id`/`.kind`/`.componentRef`). Never a browser coordinate,
 *  DOM selector, or HTML byte offset. */
export interface ReviewTarget {
  readonly client: string;
  readonly track: Track;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  /** Which page this target lives within — `undefined` when `targetType === 'page'` itself. */
  readonly pageId: string | undefined;
}

export interface ReviewNote {
  readonly id: string;
  readonly target: ReviewTarget;
  readonly timestamp: string;
  readonly author: string;
  readonly text: string;
  readonly severity: ReviewSeverity;
  readonly state: ReviewState;
  readonly category: string | undefined;
}

export interface ReviewSession {
  readonly id: string;
  readonly client: string;
  readonly track: Track;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly notes: readonly ReviewNote[];
  /** Content digest of everything above — verified on every load, not just claimed. */
  readonly digest: string;
}

// ── ReviewStore — persistence, real fs, digest-verified on load ────────────────────────────────

export interface ReviewStore {
  save(session: ReviewSession): void;
  load(client: string, track: Track, sessionId: string): ReviewSession | undefined;
  listByWorkspace(client: string, track: Track): readonly ReviewSession[];
}

function defaultReviewsDir(client: string, track: Track): string {
  return join(trackDir(client, track), 'reviews');
}

function digestOfSession(session: Omit<ReviewSession, 'digest'>): string {
  return digestOf(session);
}

function freezeSession(session: ReviewSession): ReviewSession {
  return Object.freeze({
    ...session,
    notes: Object.freeze(session.notes.map((n) => Object.freeze({ ...n, target: Object.freeze({ ...n.target }) }))),
  });
}

function parseAndVerify(path: string): ReviewSession {
  const raw = readFileSync(path, 'utf8');
  let parsed: ReviewSession;
  try {
    parsed = JSON.parse(raw) as ReviewSession;
  } catch (err) {
    throw new Error(`ReviewStore: ${path} is not valid JSON — ${(err as Error).message}`);
  }
  const { digest, ...rest } = parsed;
  const recomputed = digestOfSession(rest);
  if (recomputed !== digest) {
    throw new Error(`ReviewStore: ${path} failed integrity check — digest mismatch (tampered or corrupted).`);
  }
  return freezeSession(parsed);
}

export function createReviewStore(
  resolveDir: (client: string, track: Track) => string = defaultReviewsDir,
): ReviewStore {
  return {
    save(session) {
      const dir = resolveDir(session.client, session.track);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${session.id}.json`), JSON.stringify(session, null, 2), 'utf8');
    },
    load(client, track, sessionId) {
      const path = join(resolveDir(client, track), `${sessionId}.json`);
      if (!existsSync(path)) return undefined;
      return parseAndVerify(path);
    },
    listByWorkspace(client, track) {
      const dir = resolveDir(client, track);
      if (!existsSync(dir)) return Object.freeze([]);
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort();
      return Object.freeze(files.map((f) => parseAndVerify(join(dir, f))));
    },
  };
}

// ── ReviewManager — mutation + query, all persistence delegated to ReviewStore ─────────────────

export interface CreateNoteInput {
  readonly target: ReviewTarget;
  readonly author: string;
  readonly text: string;
  readonly severity: ReviewSeverity;
  readonly category?: string;
}

export interface ReviewManager {
  createSession(client: string, track: Track): ReviewSession;
  addNote(client: string, track: Track, sessionId: string, input: CreateNoteInput): ReviewSession;
  resolveNote(client: string, track: Track, sessionId: string, noteId: string): ReviewSession;
  dismissNote(client: string, track: Track, sessionId: string, noteId: string): ReviewSession;
  get(client: string, track: Track, sessionId: string): ReviewSession | undefined;
  listByWorkspace(client: string, track: Track): readonly ReviewSession[];
}

export function createReviewManager(store: ReviewStore = createReviewStore()): ReviewManager {
  function must(client: string, track: Track, sessionId: string): ReviewSession {
    const s = store.load(client, track, sessionId);
    if (!s) throw new Error(`ReviewManager: unknown review session ${sessionId} for ${client}/${track}`);
    return s;
  }

  function persist(session: Omit<ReviewSession, 'digest'>): ReviewSession {
    // Whitelist-reconstruct rather than spread the caller's object directly: a caller building
    // this from `{...previouslyLoadedSession, ...patch}` still physically carries the OLD
    // `digest` property at runtime (TS's `Omit<>` only erases it at the type level) — hashing
    // that object as-is would fold the stale digest into the new one and desync save/load.
    const clean: Omit<ReviewSession, 'digest'> = {
      id: session.id,
      client: session.client,
      track: session.track,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      notes: session.notes,
    };
    const full: ReviewSession = { ...clean, digest: digestOfSession(clean) };
    const frozen = freezeSession(full);
    store.save(frozen);
    return frozen;
  }

  function transitionNote(client: string, track: Track, sessionId: string, noteId: string, state: ReviewState): ReviewSession {
    const s = must(client, track, sessionId);
    const idx = s.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) throw new Error(`ReviewManager: unknown note ${noteId} in review session ${sessionId}`);
    const notes = s.notes.map((n, i) => (i === idx ? { ...n, state } : n));
    return persist({ ...s, updatedAt: new Date().toISOString(), notes });
  }

  return {
    createSession(client, track) {
      const now = new Date().toISOString();
      return persist({ id: randomUUID(), client, track, createdAt: now, updatedAt: now, notes: [] });
    },

    addNote(client, track, sessionId, input) {
      const s = must(client, track, sessionId);
      if (input.target.client !== client || input.target.track !== track) {
        throw new Error(
          `ReviewManager: note target (client=${input.target.client}, track=${input.target.track}) does not match this review session's own workspace (client=${client}, track=${track}).`,
        );
      }
      const now = new Date().toISOString();
      const note: ReviewNote = {
        id: randomUUID(),
        target: input.target,
        timestamp: now,
        author: input.author,
        text: input.text,
        severity: input.severity,
        state: 'OPEN',
        category: input.category,
      };
      return persist({ ...s, updatedAt: now, notes: [...s.notes, note] });
    },

    resolveNote(client, track, sessionId, noteId) {
      return transitionNote(client, track, sessionId, noteId, 'RESOLVED');
    },

    dismissNote(client, track, sessionId, noteId) {
      return transitionNote(client, track, sessionId, noteId, 'DISMISSED');
    },

    get(client, track, sessionId) {
      return store.load(client, track, sessionId);
    },

    listByWorkspace(client, track) {
      return store.listByWorkspace(client, track);
    },
  };
}
