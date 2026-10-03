/**
 * Program Y, Sprint Y2 — the cross-track governance loader.
 *
 * Mirrors `references.ts`'s `loadReference`/`tryLoadReference` exactly, pointed at
 * `design_principles/` (the cross-track directory) instead of `design_processes/<track>/`
 * (a per-track directory). Per Y1: cross-track governance is a REFERENCE — static, versioned,
 * loaded whole — never a Governed Model (MODEL_SCHEMA's derivation apparatus exists to
 * re-interpret governance per brief; this content is already-synthesized and inherit-only).
 *
 * This module is infrastructure only (Y2). Nothing in `offscript/src/generate` or
 * `offscript/src/knowledge/derivation` imports it — reasoning/generation consumption is
 * explicitly out of scope until a future sprint.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { designPrinciplesDir } from './paths.js';
import { digest } from './knowledge/digest.js';
import { resolveSourceAltitude } from './knowledge/altitudes.js';

/** Read a cross-track governance markdown file (`design_principles/<name>.md`) whole. */
export function loadCrossTrackGovernance(name: string): string {
  return readFileSync(join(designPrinciplesDir(), `${name}.md`), 'utf8');
}

/** Graceful variant of {@link loadCrossTrackGovernance}: the doc, or `undefined` when absent
 *  (presence-based enablement — a caller degrades instead of crashing). */
export function tryCrossTrackGovernance(name: string): string | undefined {
  const p = join(designPrinciplesDir(), `${name}.md`);
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
}

/** Section floor — fewer than this from a real cross-track constitution means the document
 *  is truncated, empty, or the wrong file. Generic (not tied to any one document's exact
 *  section count), mirroring composition-md.ts's MIN_CATALOG_ROWS floor. */
export const MIN_CROSS_TRACK_SECTIONS = 3;

/**
 * Light structural sanity check — never a content-correctness check (that is a design-team
 * judgment call, not this layer's to automate; see CREATIVE_DIRECTION.md §8's own "deliberately
 * not a checklist"). Returns problem descriptions; empty array = valid.
 */
export function validateCrossTrackGovernanceShape(content: string): string[] {
  const problems: string[] = [];
  if (content.trim() === '') {
    problems.push('document is empty');
    return problems;
  }
  const sectionCount = (content.match(/^## §/gm) ?? []).length;
  if (sectionCount < MIN_CROSS_TRACK_SECTIONS) {
    problems.push(
      `only ${sectionCount} "## §" section(s) found (expected ≥ ${MIN_CROSS_TRACK_SECTIONS}) — ` +
        `the document is likely truncated or malformed`,
    );
  }
  return problems;
}

export interface CrossTrackGovernanceManifestFile {
  readonly name: string;
  readonly digest: string;
}

export interface CrossTrackGovernanceManifest {
  readonly files: readonly CrossTrackGovernanceManifestFile[];
  /** Digest over the sorted per-file digests. Present iff files.length > 0. */
  readonly combined?: string;
}

/**
 * Enumerate every constitutional-altitude file under design_principles/ and digest it —
 * growth-safe (a future third cross-track document is picked up automatically once
 * altitudes.ts's ownership rules recognize it; nothing here is hardcoded to these two names).
 * Presence-based: an empty design_principles/ (or one with no constitutional-altitude file)
 * yields `{ files: [] }`, never a throw.
 */
export function crossTrackGovernanceManifest(): CrossTrackGovernanceManifest {
  const dir = designPrinciplesDir();
  const entries = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
  const files: CrossTrackGovernanceManifestFile[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    if (resolveSourceAltitude(join(dir, e.name)) !== 'constitutional') continue;
    const content = readFileSync(join(dir, e.name), 'utf8');
    files.push({ name: e.name, digest: digest(content) });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  if (files.length === 0) return { files };
  return { files, combined: digest(files) };
}
