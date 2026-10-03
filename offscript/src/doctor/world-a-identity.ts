/**
 * P08 — World A build identity reader.
 *
 * Reads `<root>/repository/.knowledge-build/manifest.json`'s `build_identity`
 * field — the SAME value `npm run knowledge:build` (src/knowledge/manifest.ts
 * #buildManifest) already publishes to disk. Pure IO, no judgment, no
 * recomputation: this module never touches the knowledge-build pipeline, never
 * re-derives a digest, and never mutates the file. Never throws — absence or
 * malformation returns `undefined`, since the knowledge-build manifest is a
 * build-time artifact that may legitimately be absent (e.g. a fresh checkout
 * before `npm run knowledge:build` has ever run).
 */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../paths.js';

/** `root` defaults to the real repository root; tests may override it. */
export function readWorldABuildIdentity(root: string = repoRoot): string | undefined {
  const manifestPath = join(root, 'repository', '.knowledge-build', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).build_identity === 'string'
    ) {
      return (parsed as Record<string, unknown>).build_identity as string;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
