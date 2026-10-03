/**
 * P15 — overlay materialization package. Mirrors proposal-overlay-package.ts
 * (P13) and overlay-approval-package.ts's (P14) exact shape and discipline:
 * one artifact indexing the already-built MaterializationReport, hashed
 * directly over the in-memory object (no disk I/O here — persistence lives
 * in overlay-materialization-io.ts).
 */
import { createHash } from 'node:crypto';
import type { MaterializationReport } from './overlay-materialization.js';

export interface MaterializationArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface MaterializationManifest {
  readonly materializedId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly MaterializationArtifact[];
}

export interface MaterializationPackage {
  readonly manifest: MaterializationManifest;
  readonly materialization: MaterializationReport;
}

export interface MaterializationPackageInput {
  readonly materialization: MaterializationReport;
}

export interface BuildMaterializationPackageOptions {
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

/** Build an immutable MaterializationPackage. Pure — hashes the in-memory report, touches no disk. */
export function buildMaterializationPackage(
  input: MaterializationPackageInput,
  opts: BuildMaterializationPackageOptions = {},
): MaterializationPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const reportHash = createHash('sha256').update(stableStringify(input.materialization)).digest('hex');
  const pkg: MaterializationPackage = {
    manifest: {
      materializedId: input.materialization.materialized.id,
      packagedAt: now(),
      artifacts: [{ name: 'materialized-frozen-overlay.json', path: 'materialized-frozen-overlay.json', sha256: reportHash }],
    },
    materialization: input.materialization,
  };
  return deepFreeze(pkg);
}
