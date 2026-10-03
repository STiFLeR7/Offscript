/**
 * F13 — Workspace State: a persistent, single-source-of-truth record per (client, track)
 * workspace, derived purely from the already-real outputs of F7 (`GeneratedProject`)/F8
 * (`WriteResult`)/F10 (`PreviewSession`)/F11 (`HealthSnapshot`)/F12 (`RegenerationResult`). It owns
 * METADATA ONLY — it never generates, never launches a process, never edits a project. The first
 * Program-F module to persist metadata to disk (F8 was the first to persist PROJECT ARTIFACTS;
 * this is a distinct, adjacent concern).
 *
 * Ownership (`docs/fullstack/F13-WORKSPACE-STATE.md` §2 for the full grounding):
 *   1. Current boundaries (unchanged, all reused verbatim as read-only INPUT types — never
 *      called): Generation → `GeneratedProject` (F7); materialization → `WriteResult` (F8);
 *      preview lifecycle → `PreviewSession` (F10); liveness → `HealthSnapshot` (F11); regeneration
 *      → `RegenerationResult` (F12). This module never imports F7's `runFullstackCommand`, F8's
 *      `FilesystemWriter`, F10's `PreviewServer`, F11's `PreviewHealth`, or F12's
 *      `PreviewRegenerationManager` — only their TYPES. Every `record*` method is a passive
 *      recorder of a value the caller already produced by driving those subsystems itself.
 *   2. Generation identity already exists as `GeneratedProject.digest` (F5/F6) — and `WriteResult
 *      .sourceDigest` (F8) is that EXACT SAME value, passed through unchanged (`sourceDigest:
 *      project.digest` in `filesystem-writer.ts`) — so `digests.generationDigest` and
 *      `.materializationDigest` are directly comparable when both come from the same generate+write
 *      call. F9's `PreviewProject.digest` is a DIFFERENT digest domain (a read-time content-hash of
 *      the on-disk file tree, not the model digest) and is deliberately never compared against
 *      these two — comparing digests from different hash domains would silently always disagree.
 *   3. Preview identity already exists as `PreviewSession`/`HealthSnapshot` (F10/F11) — both
 *      IN-MEMORY ONLY, by F9's own explicit design ("No runtime state... no dev server",
 *      `preview-workspace.ts` header) and held unchanged through F10–F12. This sprint is the first
 *      to persist a durable RECORD derived from them — never the live session/process itself.
 *   4. Metadata duplicated across modules: `client`/`track` independently on `PreviewProject` (F9),
 *      `PreviewSession` (F10), and `RegenerationPlan` (F12) — each module's own local identity,
 *      never collapsed (STOP forbids touching any of them). `WorkspaceState.project` is the ONE
 *      place these get unified into a single durable record per workspace.
 *
 * **A named, honestly-documented gap, not worked around:** `RegenerationResult` (F12) does not
 * expose the `GeneratedProject`/`WriteResult` it produces internally as structured data — only a
 * truncated 12-character digest PREFIX embedded inside a diagnostic string
 * (`` `...digest ${generated.digest.slice(0, 12)}…` ``). STOP forbids modifying Preview
 * Regeneration. `recordRegeneration` therefore does NOT attempt to update `digests` (regex-parsing
 * a log string for a truncated hash is unreliable and not this program's style) — it updates
 * `preview`/`health`/`status` only, from real structured fields. A caller wanting full digest
 * fidelity through a regeneration should independently call `recordGeneration`/
 * `recordMaterialization` if they have direct access to the underlying `GeneratedProject`/
 * `WriteResult` — a future F12 enhancement adding a structured digest field is the real fix.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { trackDir, type Track } from '../paths.js';
import type { GeneratedProject } from './project-generator.js';
import type { WriteResult } from './filesystem-writer.js';
import type { PreviewSession, PreviewSessionState } from './preview-server.js';
import type { HealthSnapshot, PreviewReadiness } from './preview-health.js';
import type { RegenerationResult } from './preview-regeneration.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const WORKSPACE_STATE_VERSION_TAG = 'f13-workspace-state@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, WORKSPACE_STATE_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type WorkspaceStatus = 'GENERATED' | 'MATERIALIZED' | 'PREVIEW_RUNNING' | 'READY' | 'STALE' | 'FAILED';

export interface WorkspaceProjectRef {
  readonly client: string;
  readonly track: Track;
}

export interface WorkspaceGenerationInfo {
  readonly fileCount: number | undefined;
  readonly directoryCount: number | undefined;
  /** Set once `recordMaterialization` (or a successful `recordRegeneration`) has run. */
  readonly targetDir: string | undefined;
}

export interface WorkspacePreviewInfo {
  readonly sessionId: string;
  readonly port: number;
  readonly state: PreviewSessionState;
}

export interface WorkspaceHealthInfo {
  readonly readiness: PreviewReadiness;
  readonly endpoint: string;
  readonly failureReason: string | undefined;
}

export interface WorkspaceTimestamps {
  readonly generatedAt: string | undefined;
  readonly materializedAt: string | undefined;
  readonly previewStartedAt: string | undefined;
  readonly healthCheckedAt: string | undefined;
  readonly updatedAt: string;
}

export interface WorkspaceDigests {
  readonly generationDigest: string | undefined;
  readonly materializationDigest: string | undefined;
}

export interface WorkspaceState {
  readonly project: WorkspaceProjectRef;
  readonly generation: WorkspaceGenerationInfo | undefined;
  readonly preview: WorkspacePreviewInfo | undefined;
  readonly health: WorkspaceHealthInfo | undefined;
  readonly timestamps: WorkspaceTimestamps;
  readonly digests: WorkspaceDigests;
  readonly status: WorkspaceStatus;
}

export interface WorkspaceSnapshot {
  readonly state: WorkspaceState;
  /** Content digest of `state` itself — verified on every `load()`, not just claimed. */
  readonly digest: string;
  readonly savedAt: string;
}

// ── status derivation — pure, no I/O ────────────────────────────────────────────────────────────

function deriveStatus(state: Omit<WorkspaceState, 'status'>): WorkspaceStatus {
  const { generation, preview, health, digests } = state;

  if (preview?.state === 'FAILED' || health?.readiness === 'UNHEALTHY') return 'FAILED';

  if (
    digests.generationDigest !== undefined &&
    digests.materializationDigest !== undefined &&
    digests.generationDigest !== digests.materializationDigest
  ) {
    return 'STALE';
  }

  if (health?.readiness === 'READY') return 'READY';
  if (preview?.state === 'STARTING' || preview?.state === 'RUNNING') return 'PREVIEW_RUNNING';
  if (generation?.targetDir !== undefined) return 'MATERIALIZED';
  return 'GENERATED';
}

// ── WorkspaceStateStore — persistence, real fs, digest-verified on load ────────────────────────

export interface WorkspaceStateStore {
  load(client: string, track: Track): WorkspaceSnapshot | undefined;
  save(client: string, track: Track, snapshot: WorkspaceSnapshot): void;
}

const STATE_FILENAME = 'workspace-state.json';

function defaultStatePath(client: string, track: Track): string {
  return join(trackDir(client, track), STATE_FILENAME);
}

export function createWorkspaceStateStore(
  resolvePath: (client: string, track: Track) => string = defaultStatePath,
): WorkspaceStateStore {
  return {
    load(client, track) {
      const path = resolvePath(client, track);
      if (!existsSync(path)) return undefined;
      const raw = readFileSync(path, 'utf8');
      let parsed: WorkspaceSnapshot;
      try {
        parsed = JSON.parse(raw) as WorkspaceSnapshot;
      } catch (err) {
        throw new Error(`WorkspaceStateStore: ${path} is not valid JSON — ${(err as Error).message}`);
      }
      const recomputed = digestOf(parsed.state);
      if (recomputed !== parsed.digest) {
        throw new Error(`WorkspaceStateStore: ${path} failed integrity check — digest mismatch (tampered or corrupted).`);
      }
      return Object.freeze({ ...parsed, state: Object.freeze(parsed.state) });
    },
    save(client, track, snapshot) {
      const path = resolvePath(client, track);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf8');
    },
  };
}

// ── WorkspaceStateManager — recording only, no generation/process/edit logic ───────────────────

export interface WorkspaceStateManager {
  recordGeneration(client: string, track: Track, generated: GeneratedProject): WorkspaceSnapshot;
  recordMaterialization(client: string, track: Track, write: WriteResult): WorkspaceSnapshot;
  recordPreview(client: string, track: Track, session: PreviewSession): WorkspaceSnapshot;
  recordHealth(client: string, track: Track, health: HealthSnapshot): WorkspaceSnapshot;
  recordRegeneration(client: string, track: Track, result: RegenerationResult): WorkspaceSnapshot;
  get(client: string, track: Track): WorkspaceSnapshot | undefined;
}

function initialState(client: string, track: Track): WorkspaceState {
  const now = new Date().toISOString();
  return {
    project: { client, track },
    generation: undefined,
    preview: undefined,
    health: undefined,
    timestamps: { generatedAt: undefined, materializedAt: undefined, previewStartedAt: undefined, healthCheckedAt: undefined, updatedAt: now },
    digests: { generationDigest: undefined, materializationDigest: undefined },
    status: 'GENERATED',
  };
}

export function createWorkspaceStateManager(store: WorkspaceStateStore = createWorkspaceStateStore()): WorkspaceStateManager {
  function currentState(client: string, track: Track): WorkspaceState {
    return store.load(client, track)?.state ?? initialState(client, track);
  }

  function persist(client: string, track: Track, next: Omit<WorkspaceState, 'status'>): WorkspaceSnapshot {
    const finalized: WorkspaceState = { ...next, status: deriveStatus(next) };
    const snapshot: WorkspaceSnapshot = Object.freeze({
      state: Object.freeze(finalized),
      digest: digestOf(finalized),
      savedAt: new Date().toISOString(),
    });
    store.save(client, track, snapshot);
    return snapshot;
  }

  return {
    recordGeneration(client, track, generated) {
      const s = currentState(client, track);
      const now = new Date().toISOString();
      return persist(client, track, {
        ...s,
        generation: { fileCount: generated.files.length, directoryCount: generated.directories.length, targetDir: s.generation?.targetDir },
        digests: { ...s.digests, generationDigest: generated.digest },
        timestamps: { ...s.timestamps, generatedAt: now, updatedAt: now },
      });
    },

    recordMaterialization(client, track, write) {
      const s = currentState(client, track);
      const now = new Date().toISOString();
      return persist(client, track, {
        ...s,
        generation: { fileCount: write.writtenFiles.length, directoryCount: write.createdDirectories.length, targetDir: write.targetDir },
        digests: { ...s.digests, materializationDigest: write.sourceDigest },
        timestamps: { ...s.timestamps, materializedAt: now, updatedAt: now },
      });
    },

    recordPreview(client, track, session) {
      const s = currentState(client, track);
      const now = new Date().toISOString();
      return persist(client, track, {
        ...s,
        preview: { sessionId: session.id, port: session.port, state: session.state },
        timestamps: { ...s.timestamps, previewStartedAt: session.startedAt, updatedAt: now },
      });
    },

    recordHealth(client, track, health) {
      const s = currentState(client, track);
      const now = new Date().toISOString();
      return persist(client, track, {
        ...s,
        health: { readiness: health.readiness, endpoint: health.endpoint, failureReason: health.failureReason },
        timestamps: { ...s.timestamps, healthCheckedAt: health.lastProbeAt, updatedAt: now },
      });
    },

    recordRegeneration(client, track, result) {
      const s = currentState(client, track);
      const now = new Date().toISOString();

      const generation = result.plan
        ? { fileCount: s.generation?.fileCount, directoryCount: s.generation?.directoryCount, targetDir: result.plan.targetDir }
        : s.generation;
      const preview = result.session
        ? { sessionId: result.session.id, port: result.session.port, state: result.session.state }
        : s.preview;
      // A failed regeneration must never be silently invisible — if F12 gave no HealthSnapshot
      // (a PLANNING/STOPPING/GENERATING/STARTING failure), synthesize an UNHEALTHY entry from the
      // result's own real diagnostics rather than leaving stale, misleadingly-good health behind.
      const health = result.health
        ? { readiness: result.health.readiness, endpoint: result.health.endpoint, failureReason: result.health.failureReason }
        : result.phase === 'FAILED'
          ? { readiness: 'UNHEALTHY' as const, endpoint: s.health?.endpoint ?? '', failureReason: result.diagnostics.join('; ') }
          : s.health;

      return persist(client, track, {
        ...s,
        generation,
        preview,
        health,
        timestamps: {
          ...s.timestamps,
          materializedAt: result.plan ? now : s.timestamps.materializedAt,
          previewStartedAt: result.session?.startedAt ?? s.timestamps.previewStartedAt,
          healthCheckedAt: result.health?.lastProbeAt ?? s.timestamps.healthCheckedAt,
          updatedAt: now,
        },
      });
    },

    get(client, track) {
      return store.load(client, track);
    },
  };
}
