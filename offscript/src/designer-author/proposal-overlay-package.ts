/**
 * P13 — proposal→overlay package. Mirrors proposal-package.ts's (P09) exact
 * shape and discipline: one artifact indexing the already-built
 * OverlayTranslationReport, hashed directly over the in-memory object (no
 * disk I/O here — persistence lives in proposal-overlay-io.ts).
 */
import { createHash } from 'node:crypto';
import type { OverlayTranslationReport } from './proposal-overlay.js';

export interface OverlayCandidateArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface OverlayCandidateManifest {
  readonly candidateId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly OverlayCandidateArtifact[];
}

export interface OverlayCandidatePackage {
  readonly manifest: OverlayCandidateManifest;
  readonly translation: OverlayTranslationReport;
}

export interface OverlayCandidatePackageInput {
  readonly translation: OverlayTranslationReport;
}

export interface BuildOverlayCandidatePackageOptions {
  readonly now?: () => string;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacerKeys(value), 2) + '\n';
}

function sortedReplacerKeys(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

/** Build an immutable OverlayCandidatePackage. Pure — hashes the in-memory translation, touches no disk. */
export function buildOverlayCandidatePackage(
  input: OverlayCandidatePackageInput,
  opts: BuildOverlayCandidatePackageOptions = {},
): OverlayCandidatePackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const translationHash = createHash('sha256').update(stableStringify(input.translation)).digest('hex');
  const pkg: OverlayCandidatePackage = {
    manifest: {
      candidateId: input.translation.candidate.id,
      packagedAt: now(),
      artifacts: [{ name: 'overlay-candidate.json', path: 'overlay-candidate.json', sha256: translationHash }],
    },
    translation: input.translation,
  };
  return deepFreeze(pkg);
}
