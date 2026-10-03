/**
 * Runtime reader for the per-track imagery.md governance manifest (Fix A).
 *
 * The design team authors imagery.md's role→file→mode table to be machine-read, so the repo —
 * not a TS constant — chooses which photo the cover carries and which images the website author
 * may request (Offscript stateless-generation doctrine: the system is the source of truth, not code).
 *
 * Modeled on composition-md.ts / website-numerics.ts: tolerant header-NAME mapping (column order
 * does not matter), FAIL-LOUD loader (a present-but-broken manifest must surface at generate time).
 * No engine-internal deps beyond paths.ts + node fs → safe to import from the generate stage.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir, type Track } from '../paths.js';
import type { BrandKit } from '../brand-kit.js';

export interface ImageryRow {
  role: string;
  file: string;
  mode: string;
  scrim: string;
  notes: string;
}

function splitRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function isHeader(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitRow(line).map((c) => c.toLowerCase());
  return cells.includes('role') && cells.includes('file') && cells.includes('mode');
}

/** Parse the role/file/mode/scrim/notes table. Returns [] if no table is found. */
export function parseImageryManifest(md: string): ImageryRow[] {
  const lines = md.split(/\r?\n/);
  let bound = false;
  let ci: Record<string, number> = {};
  const rows: ImageryRow[] = [];
  for (const line of lines) {
    if (isHeader(line)) {
      const cells = splitRow(line).map((c) => c.toLowerCase());
      const col = (n: string) => cells.indexOf(n);
      ci = { role: col('role'), file: col('file'), mode: col('mode'), scrim: col('scrim'), notes: col('notes') };
      bound = true;
      continue;
    }
    if (!bound) continue;
    if (!line.includes('|')) continue;
    if (isDivider(line)) continue;
    const cells = splitRow(line).map((c) => c.replace(/`/g, '').trim());
    const at = (idx: number) => (idx >= 0 ? cells[idx] ?? '' : '');
    const role = at(ci.role);
    if (role === '') continue;
    rows.push({
      role,
      file: at(ci.file),
      mode: at(ci.mode).toLowerCase(),
      scrim: at(ci.scrim).toLowerCase(),
      notes: at(ci.notes),
    });
  }
  return rows;
}

/** Return the single row serving `role`, or null. */
export function imageryRole(rows: ImageryRow[], role: string): ImageryRow | null {
  return rows.find((r) => r.role === role) ?? null;
}

/** Absolute path to a track's imagery manifest. */
export function imageryMdPath(track: Track): string {
  return join(designProcessesDir(track), 'imagery.md');
}

/** Load + parse the real manifest. FAIL-LOUD: throws on missing file or zero rows. */
export function loadImageryManifest(track: Track): ImageryRow[] {
  const path = imageryMdPath(track);
  if (!existsSync(path)) {
    throw new Error(`loadImageryManifest: imagery.md not found at ${path}.`);
  }
  const rows = parseImageryManifest(readFileSync(path, 'utf8'));
  if (rows.length === 0) {
    throw new Error(
      `loadImageryManifest: parsed 0 rows from ${path}. The role/file/mode table likely changed shape — ` +
        `fix the table or the parser (imagery-manifest.ts).`,
    );
  }
  return rows;
}

/** A Brand Kit-resolved imagery row, with `file` pre-joined to an absolute path. */
export interface ResolvedImageryRow {
  readonly row: ImageryRow;
  readonly absPath: string;
}

/**
 * Sprint W79 — resolve a single role's imagery row from a Brand Kit's client-owned
 * `imageryManifest` pointer, when one exists. Reuses `parseImageryManifest`/`imageryRole`
 * VERBATIM — the client table is the exact same role|mode|file|scrim|notes shape `imagery.md`
 * already uses; no second format is invented (W75 §2.1's "reuses, unchanged" principle, same
 * discipline `resolveLogoMark` (brand-kit.ts, W78) already applied to the logo fields).
 *
 * `kitDir` is the client's own references directory — both the `imageryManifest` pointer AND each
 * resolved row's `file` are joined against it, mirroring `resolveLogoMark`'s exact convention (a
 * Brand Kit's paths are always relative to the client's own kit, never to a fixed subdirectory
 * convention the house happens to use).
 *
 * Fail-soft throughout, mirroring `loadBrandKitIfPresent`'s absence-vs-malformed split: a missing
 * Brand Kit, an absent `imageryManifest` field, a manifest file that does not exist on disk, a
 * table with no row for `role`, or a row with an empty `file` all return `undefined` — this
 * function NEVER throws. Callers fall back to today's exact house behaviour (`loadImageryManifest`
 * + `imageryRole`) on `undefined`, exactly as `resolveLogoMark`'s `??` fallback pattern does.
 */
export function resolveBrandKitImageryRole(
  brandKit: BrandKit | undefined,
  role: string,
  kitDir: string,
): ResolvedImageryRow | undefined {
  if (!brandKit?.imageryManifest) return undefined;
  const manifestPath = join(kitDir, brandKit.imageryManifest);
  if (!existsSync(manifestPath)) return undefined;
  const rows = parseImageryManifest(readFileSync(manifestPath, 'utf8'));
  const row = imageryRole(rows, role);
  if (!row || row.file.trim() === '') return undefined;
  return { row, absPath: join(kitDir, row.file) };
}
