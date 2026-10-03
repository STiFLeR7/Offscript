/**
 * P20 — designer review session package. Mirrors
 * designer-workspace-package.ts's (P19) exact shape and discipline: one
 * artifact indexing the already-built DesignerReviewSession, hashed
 * directly over the in-memory object (no disk I/O here — persistence lives
 * in designer-review-session-io.ts).
 */
import { createHash } from 'node:crypto';
import type { DesignerReviewSession } from './designer-review-session.js';

export interface SessionArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface SessionManifest {
  readonly sessionId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly SessionArtifact[];
}

export interface SessionPackage {
  readonly manifest: SessionManifest;
  readonly session: DesignerReviewSession;
}

export interface SessionPackageInput {
  readonly session: DesignerReviewSession;
}

export interface BuildSessionPackageOptions {
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

/** Build an immutable SessionPackage. Pure — hashes the in-memory session, touches no disk. */
export function buildSessionPackage(
  input: SessionPackageInput,
  opts: BuildSessionPackageOptions = {},
): SessionPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const sessionHash = createHash('sha256').update(stableStringify(input.session)).digest('hex');
  const pkg: SessionPackage = {
    manifest: {
      sessionId: input.session.id,
      packagedAt: now(),
      artifacts: [{ name: 'designer-review-session.json', path: 'designer-review-session.json', sha256: sessionHash }],
    },
    session: input.session,
  };
  return deepFreeze(pkg);
}
