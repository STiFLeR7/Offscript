/**
 * P16 — overlay activation package. Mirrors overlay-approval-package.ts
 * (P14) and overlay-materialization-package.ts's (P15) exact shape and
 * discipline: one artifact indexing the already-built OverlayActivation,
 * hashed directly over the in-memory object (no disk I/O here —
 * persistence lives in overlay-activation-io.ts).
 */
import { createHash } from 'node:crypto';
import type { OverlayActivation } from './overlay-activation.js';

export interface ActivationArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface ActivationManifest {
  readonly activationId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly ActivationArtifact[];
}

export interface ActivationPackage {
  readonly manifest: ActivationManifest;
  readonly activation: OverlayActivation;
}

export interface ActivationPackageInput {
  readonly activation: OverlayActivation;
}

export interface BuildActivationPackageOptions {
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

/** Build an immutable ActivationPackage. Pure — hashes the in-memory activation, touches no disk. */
export function buildActivationPackage(
  input: ActivationPackageInput,
  opts: BuildActivationPackageOptions = {},
): ActivationPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const activationHash = createHash('sha256').update(stableStringify(input.activation)).digest('hex');
  const pkg: ActivationPackage = {
    manifest: {
      activationId: input.activation.id,
      packagedAt: now(),
      artifacts: [{ name: 'overlay-activation.json', path: 'overlay-activation.json', sha256: activationHash }],
    },
    activation: input.activation,
  };
  return deepFreeze(pkg);
}
