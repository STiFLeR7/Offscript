/**
 * P19 — persistence for the already-built WorkspacePackage. Pure IO, no
 * judgment — mirrors overlay-approval-io.ts's (P14) / designer-feedback-io.ts's
 * (P18) exact stable-JSON, idempotent-write pattern.
 *
 * Deliberately writes to whatever `filePath` the caller supplies — never a
 * hardcoded path, and never the live overlay store. This module NEVER
 * imports overlay.ts and NEVER calls writeOverlay/readOverlay — see the
 * falsification test in designer-workspace-io.test.ts, which writes a real
 * Frozen entry via the real writeOverlay, then proves it is byte-identical
 * after a WorkspacePackage is written elsewhere.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspacePackage } from './designer-workspace-package.js';

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
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

/** Write a WorkspacePackage as stable JSON to exactly the path given. */
export function writeWorkspacePackage(filePath: string, pkg: WorkspacePackage): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(pkg));
}

/** Read a WorkspacePackage back from disk. Never throws: undefined on missing/malformed file. */
export function readWorkspacePackage(filePath: string): WorkspacePackage | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as WorkspacePackage;
  } catch {
    return undefined;
  }
}
