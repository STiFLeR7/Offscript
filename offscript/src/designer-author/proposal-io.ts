/**
 * P09 — Designer Author Foundation: persistence for the already-built
 * ProposalPackage. Pure IO, no judgment — mirrors doctor/review-package-io.ts's
 * stable-JSON, idempotent-write pattern exactly.
 *
 * Deliberately writes to whatever `filePath` the caller supplies — there is
 * no hardcoded "proposals live here" directory convention in this
 * foundation (the brief: "Only define transport," not a storage workflow).
 * Crucially, nothing in this module ever constructs or writes to a path
 * under the canonical component tree — see the isolation falsification tests in
 * test/designer-author/proposal-io.test.ts, which write a proposal that
 * NAMES a real canonical component as its parent and then prove the real
 * file is untouched.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProposalPackage } from './proposal-package.js';

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

/** Write a ProposalPackage as stable JSON to exactly the path given. */
export function writeProposalPackage(filePath: string, pkg: ProposalPackage): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(pkg));
}

/** Read a ProposalPackage back from disk. Never throws: undefined on missing/malformed file. */
export function readProposalPackage(filePath: string): ProposalPackage | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ProposalPackage;
  } catch {
    return undefined;
  }
}
