/**
 * P14 — overlay approval package. Mirrors proposal-package.ts (P09) and
 * proposal-overlay-package.ts's (P13) exact shape and discipline: one
 * artifact indexing the already-built OverlayApproval, hashed directly over
 * the in-memory object (no disk I/O here — persistence lives in
 * overlay-approval-io.ts).
 */
import { createHash } from 'node:crypto';
import type { OverlayApproval } from './overlay-approval.js';

export interface ApprovalArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface ApprovalManifest {
  readonly approvalId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly ApprovalArtifact[];
}

export interface ApprovalPackage {
  readonly manifest: ApprovalManifest;
  readonly approval: OverlayApproval;
}

export interface ApprovalPackageInput {
  readonly approval: OverlayApproval;
}

export interface BuildApprovalPackageOptions {
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

/** Build an immutable ApprovalPackage. Pure — hashes the in-memory approval, touches no disk. */
export function buildApprovalPackage(
  input: ApprovalPackageInput,
  opts: BuildApprovalPackageOptions = {},
): ApprovalPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const approvalHash = createHash('sha256').update(stableStringify(input.approval)).digest('hex');
  const pkg: ApprovalPackage = {
    manifest: {
      approvalId: input.approval.id,
      packagedAt: now(),
      artifacts: [{ name: 'overlay-approval.json', path: 'overlay-approval.json', sha256: approvalHash }],
    },
    approval: input.approval,
  };
  return deepFreeze(pkg);
}
