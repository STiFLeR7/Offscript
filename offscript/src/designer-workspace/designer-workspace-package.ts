/**
 * P19 — designer workspace package. Mirrors overlay-approval-package.ts's
 * (P14) / designer-feedback-package.ts's (P18) exact shape and discipline:
 * one artifact indexing the already-built DesignerWorkspace, hashed
 * directly over the in-memory object (no disk I/O here — persistence lives
 * in designer-workspace-io.ts).
 */
import { createHash } from 'node:crypto';
import type { DesignerWorkspace } from './designer-workspace.js';

export interface WorkspaceArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface WorkspaceManifest {
  readonly workspaceId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly WorkspaceArtifact[];
}

export interface WorkspacePackage {
  readonly manifest: WorkspaceManifest;
  readonly workspace: DesignerWorkspace;
}

export interface WorkspacePackageInput {
  readonly workspace: DesignerWorkspace;
}

export interface BuildWorkspacePackageOptions {
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

/** Build an immutable WorkspacePackage. Pure — hashes the in-memory workspace, touches no disk. */
export function buildWorkspacePackage(
  input: WorkspacePackageInput,
  opts: BuildWorkspacePackageOptions = {},
): WorkspacePackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const workspaceHash = createHash('sha256').update(stableStringify(input.workspace)).digest('hex');
  const pkg: WorkspacePackage = {
    manifest: {
      workspaceId: input.workspace.id,
      packagedAt: now(),
      artifacts: [{ name: 'designer-workspace.json', path: 'designer-workspace.json', sha256: workspaceHash }],
    },
    workspace: input.workspace,
  };
  return deepFreeze(pkg);
}
