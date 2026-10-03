/**
 * F9 — Preview Workspace: read-only discovery and inspection over F8's on-disk convention
 * (`projects/<client>/<track>/fullstack/`). It becomes the single place a generated Full Stack
 * project is located and described — the future single home for opening, inspecting,
 * regenerating, and eventually serving these projects (not built here).
 *
 * Ownership (`docs/fullstack/F9-PREVIEW-WORKSPACE.md` §2 for the full grounding):
 *   - Owns ONLY: locating generated projects (`WorkspaceResolver`), reading preview metadata and
 *     exposing project information (`WorkspaceLoader` → `PreviewProject`), and listing available
 *     previews (`PreviewManifest`).
 *   - Never generates, never transforms, never writes project files — every read here is
 *     `existsSync`/`readdirSync`/`readFileSync`/`statSync` against what F5/F6/F8 already produced.
 *   - No manifest file is persisted to disk by any prior Program-F sprint (F5/F6's
 *     `GeneratorManifest` and F8's `WriteResult` are both in-memory only, never written) — so
 *     `PreviewManifest`/`PreviewProject` are SYNTHESIZED at read time from what's actually on
 *     disk, never read from a dedicated sidecar file that doesn't exist. `package.json` (already
 *     written verbatim by F6/F8) doubles as the one real per-project manifest source available —
 *     conventionally, npm already calls it "the package manifest."
 *   - `digest` is a NEW, preview-layer content digest over the discovered file tree (own
 *     `canonical`/`digestOf`, isolated per this program's doctrine) — not a reuse of
 *     `GeneratedProject.digest`, which is never persisted anywhere on disk today (a named gap,
 *     same shape as F1-S1's `rir.json` persistence gap).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, repoRoot, type Track } from '../paths.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

const TRACKS: readonly Track[] = ['website', 'collateral', 'deck'];
const FULLSTACK_DIRNAME = 'fullstack';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const PREVIEW_WORKSPACE_VERSION_TAG = 'f9-preview-workspace@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, PREVIEW_WORKSPACE_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type PreviewStatus = 'ready' | 'empty';

export interface PreviewProject {
  readonly client: string;
  readonly track: Track;
  readonly framework: string;
  /** ISO 8601 — the on-disk directory's own mtime; the last time this project was written. */
  readonly generatedAt: string;
  /** Content digest over the discovered file tree (path + content), computed at read time. */
  readonly digest: string;
  readonly path: string;
  readonly status: PreviewStatus;
  readonly diagnostics: readonly string[];
  readonly artifactSummary: {
    readonly fileCount: number;
    readonly directoryCount: number;
  };
}

export interface PreviewManifest {
  readonly projectCount: number;
  readonly readyCount: number;
  /** Sorted by client, then track — deterministic regardless of filesystem enumeration order. */
  readonly projects: readonly PreviewProject[];
}

export interface PreviewWorkspace {
  readonly manifest: PreviewManifest;
}

export interface WorkspaceCandidate {
  readonly client: string;
  readonly track: Track;
  readonly path: string;
}

export interface WorkspaceResolver {
  resolve(): readonly WorkspaceCandidate[];
}

export interface WorkspaceLoader {
  load(candidate: WorkspaceCandidate): PreviewProject;
}

/** Where F8 writes (and this workspace reads) a generated project — the one convention. */
export function resolveFullstackPath(client: string, track: Track): string {
  return join(projectDir(client), track, FULLSTACK_DIRNAME);
}

// ── discovery ────────────────────────────────────────────────────────────────────────────────

/** `root` = a "projects" directory containing `<client>/<track>/fullstack/` subtrees. Defaults to
 *  the real `projects/` root; a caller may pass a fixture root for isolated testing. */
export function createWorkspaceResolver(root: string = join(repoRoot, 'projects')): WorkspaceResolver {
  return {
    resolve() {
      if (!existsSync(root)) return [];
      const clients = readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      const candidates: WorkspaceCandidate[] = [];
      for (const client of clients) {
        for (const track of TRACKS) {
          const path = join(root, client, track, FULLSTACK_DIRNAME);
          if (existsSync(path)) candidates.push({ client, track, path });
        }
      }
      return candidates;
    },
  };
}

// ── loading ──────────────────────────────────────────────────────────────────────────────────

function listFilesRecursive(dir: string, base: string = dir): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, base));
    } else {
      const rel = full.slice(base.length + 1).split('\\').join('/');
      out.push({ path: rel, content: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

function parentDir(path: string): string | undefined {
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : undefined;
}

function derivedDirectoryCount(paths: readonly string[]): number {
  const dirs = new Set<string>();
  for (const p of paths) {
    const d = parentDir(p);
    if (d) dirs.add(d);
  }
  return dirs.size;
}

function detectFramework(files: readonly { path: string; content: string }[], diagnostics: string[]): string {
  const pkg = files.find((f) => f.path === 'package.json');
  if (!pkg) {
    diagnostics.push('package.json not found — framework could not be determined.');
    return 'unknown';
  }
  try {
    const parsed = JSON.parse(pkg.content) as { dependencies?: Record<string, string> };
    return parsed.dependencies?.next ? 'nextjs' : 'unknown';
  } catch (err) {
    diagnostics.push(`package.json is not valid JSON — ${(err as Error).message}`);
    return 'unknown';
  }
}

export function createWorkspaceLoader(): WorkspaceLoader {
  return {
    load({ client, track, path }) {
      const files = listFilesRecursive(path).sort((a, b) => a.path.localeCompare(b.path));
      const diagnostics: string[] = [];
      const generatedAt = statSync(path).mtime.toISOString();
      const digest = digestOf(files);

      if (files.length === 0) {
        diagnostics.push(`no files found in ${path} — nothing to preview.`);
        return Object.freeze({
          client,
          track,
          framework: 'unknown',
          generatedAt,
          digest,
          path,
          status: 'empty' as const,
          diagnostics: Object.freeze(diagnostics),
          artifactSummary: Object.freeze({ fileCount: 0, directoryCount: 0 }),
        });
      }

      const framework = detectFramework(files, diagnostics);
      return Object.freeze({
        client,
        track,
        framework,
        generatedAt,
        digest,
        path,
        status: 'ready' as const,
        diagnostics: Object.freeze(diagnostics),
        artifactSummary: Object.freeze({
          fileCount: files.length,
          directoryCount: derivedDirectoryCount(files.map((f) => f.path)),
        }),
      });
    },
  };
}

// ── entry points (mirrors F2/F7's low-level/high-level split) ──────────────────────────────────

/** The direct single-project entry — fails loud (throws) if nothing was ever written to disk for
 *  `(client, track)`, mirroring F2's `loadTransformationProjectFromFile` precedent exactly. */
export function loadPreviewProject(client: string, track: Track): PreviewProject {
  const path = resolveFullstackPath(client, track);
  if (!existsSync(path)) {
    throw new Error(
      `loadPreviewProject: no generated Full Stack project found at ${path} for ${client}/${track} — ` +
        `write one to disk first (see docs/fullstack/F8-FILESYSTEM-WRITER.md).`,
    );
  }
  return createWorkspaceLoader().load({ client, track, path });
}

/** The real entry point: discover every generated project under `root`, load each one, and return
 *  a deterministically-ordered `PreviewWorkspace`. Never throws for an empty/missing root — an
 *  empty manifest is a valid, honest result (nothing has been generated yet). */
export function loadPreviewWorkspace(root?: string): PreviewWorkspace {
  const resolver = createWorkspaceResolver(root);
  const loader = createWorkspaceLoader();
  const projects = resolver
    .resolve()
    .map((candidate) => loader.load(candidate))
    .sort((a, b) => a.client.localeCompare(b.client) || a.track.localeCompare(b.track));
  const manifest: PreviewManifest = Object.freeze({
    projectCount: projects.length,
    readyCount: projects.filter((p) => p.status === 'ready').length,
    projects: Object.freeze(projects),
  });
  return Object.freeze({ manifest });
}
