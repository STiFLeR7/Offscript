/**
 * F8 — Filesystem Writer: `GeneratedProject → real files on disk`. The first Program-F module
 * that touches `node:fs` for WRITING — every prior module (F5/F6) deliberately proved it never
 * needed to (import-scan purity tests). This module writes EXACTLY what it is given, unconditionally
 * overwriting whatever already exists at the target — no diffing, no incremental regeneration, no
 * user-code merging (all explicitly out of scope, STOP).
 *
 * Ownership (`docs/fullstack/F8-FILESYSTEM-WRITER.md` §2 for the full grounding):
 *   1. `GeneratedArtifact`s are represented exactly as F5/F6 produced them (`path`/`kind`/`content`
 *      /`digest`) — this module reads those fields, never recomputes or reinterprets them.
 *   2. Artifact ORDERING is an INHERITED guarantee from `GeneratedProject.files`/`.directories`
 *      (already deterministically path-sorted by F5/F6) — this module's only obligation is to not
 *      break it: writes are sequential, never re-sorted, never parallelized in a way that could
 *      make `WriteResult.writtenFiles` diverge from `project.files`'s own order.
 *   3. Diagnostics are surfaced as a flat, ordered `WriteDiagnostics` list, reusing F5's own
 *      `DiagnosticLevel` vocabulary (`'info' | 'warning'`) — real WRITE FAILURES are never folded
 *      into diagnostics, they throw (measured, not claimed — the same fail-loud posture every
 *      Program-F module already holds).
 *   4. Write failures are reported by throwing immediately, naming the specific artifact/directory
 *      path and the underlying `node:fs` error message — never silently skipped, never partially
 *      recovered from.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GeneratedProject, DiagnosticLevel } from './project-generator.js';

export interface WriteDiagnosticEntry {
  readonly level: DiagnosticLevel;
  readonly message: string;
}

export type WriteDiagnostics = readonly WriteDiagnosticEntry[];

export interface WriteResult {
  readonly targetDir: string;
  /** `GeneratedArtifact.path` strings, in the EXACT order `GeneratedProject.files` gave them. */
  readonly writtenFiles: readonly string[];
  /** In the EXACT order `GeneratedProject.directories` gave them. */
  readonly createdDirectories: readonly string[];
  readonly diagnostics: WriteDiagnostics;
  /** = `GeneratedProject.digest` — traces this write back to what was generated. */
  readonly sourceDigest: string;
}

export interface FilesystemWriter {
  readonly name: string;
  write(project: GeneratedProject, targetDir: string): WriteResult;
}

/** Trust-boundary check: every `GeneratedProject` today comes from Program F's own generators
 *  (F5/F6), but this module accepts one as an argument from any caller — refuse an artifact path
 *  that would escape `targetDir` (absolute, or containing a `..` segment) rather than trusting it
 *  silently. */
function assertSafeRelativePath(writerName: string, path: string): void {
  const isAbsolute = path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(path);
  const escapes = path.split(/[\\/]/).includes('..');
  if (isAbsolute || escapes) {
    throw new Error(`${writerName}: refusing to write an unsafe artifact path outside the target directory: ${path}`);
  }
}

export function createFilesystemWriter(name = 'fs-writer'): FilesystemWriter {
  return {
    name,
    write(project, targetDir) {
      const diagnostics: WriteDiagnosticEntry[] = [];

      // ── Create directories ────────────────────────────────────────────────
      const targetExisted = existsSync(targetDir);
      try {
        mkdirSync(targetDir, { recursive: true });
      } catch (err) {
        throw new Error(`${name}: failed to create target directory ${targetDir} — ${(err as Error).message}`);
      }
      diagnostics.push(
        targetExisted
          ? { level: 'warning', message: `Target directory already existed: ${targetDir} — existing files will be overwritten.` }
          : { level: 'info', message: `Created target directory: ${targetDir}` },
      );

      const createdDirectories: string[] = [];
      for (const dir of project.directories) {
        assertSafeRelativePath(name, dir);
        const fullDir = join(targetDir, dir);
        try {
          mkdirSync(fullDir, { recursive: true });
        } catch (err) {
          throw new Error(`${name}: failed to create directory ${dir} (${fullDir}) — ${(err as Error).message}`);
        }
        createdDirectories.push(dir);
      }

      // ── Write artifacts — exactly as produced, in the order given, content never touched ────
      const writtenFiles: string[] = [];
      for (const artifact of project.files) {
        assertSafeRelativePath(name, artifact.path);
        const fullPath = join(targetDir, artifact.path);
        try {
          writeFileSync(fullPath, artifact.content, 'utf8');
        } catch (err) {
          throw new Error(`${name}: failed to write ${artifact.path} (${fullPath}) — ${(err as Error).message}`);
        }
        writtenFiles.push(artifact.path);
      }

      if (project.files.length === 0) {
        diagnostics.push({ level: 'warning', message: 'GeneratedProject has zero files — nothing was written.' });
      }

      return Object.freeze({
        targetDir,
        writtenFiles: Object.freeze(writtenFiles),
        createdDirectories: Object.freeze(createdDirectories),
        diagnostics: Object.freeze(diagnostics),
        sourceDigest: project.digest,
      });
    },
  };
}
