/**
 * Runtime parser for the website COMPOSITION.md catalog (A2/B1 source of truth).
 *
 * The design team authors COMPOSITION.md's catalog table + the per-component {limits}
 * annotations to be machine-read. This parser turns that table into routable rows so the
 * composition router (website-composition.ts) and the {limits} rail
 * (operators/website-composition-limits.ts) consume governance directly — a catalog edit
 * updates routing AND limits with zero code change (single source of truth).
 *
 * Tolerant by design (header-NAME mapping, not column position) but FAIL-LOUD at the loader:
 * a broken/missing table must surface at plan time, never silently route to nothing.
 *
 * Website-only. No engine-internal deps (paths.ts + node fs only) → safe to import from both
 * the generate stage and the operators layer without a cycle.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from '../paths.js';

export interface CompositionLimits {
  maxPerPage?: number;
  avoidAdjacent?: string;
  avoidAdjacentSurface?: string;
  minBands?: number;
}

export interface CompositionRow {
  /** Display name, e.g. "Feature trio". */
  name: string;
  /** Bare slug, e.g. "feature-trio" (from the File cell, else slugified name). */
  slug: string;
  cat: 'section' | 'atom';
  layout: string[];
  surface: string;
  interaction: string[];
  serves: string[];
  blocks: string[];
  /** Direction prose with any {…} limit annotations stripped out. */
  direction: string;
  limits: CompositionLimits;
}

/** Section floor — fewer than this from the real catalog means the table broke. */
export const MIN_CATALOG_ROWS = 30;

/** Split one markdown table row into trimmed cells (drops the leading/trailing empties). */
function splitRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/** A `---|---` divider row (only dashes / colons / pipes / spaces). */
function isDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function commaList(cell: string): string[] {
  return cell
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugFromFile(fileCell: string, name: string): string {
  const m = fileCell.match(/component-([a-z0-9-]+)\.html/i);
  if (m) return m[1].toLowerCase();
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extract {key:val; key:val} annotations from a Direction cell. */
export function parseLimits(direction: string): CompositionLimits {
  const limits: CompositionLimits = {};
  for (const m of direction.matchAll(/\{([^}]*)\}/g)) {
    for (const part of m[1].split(';')) {
      const [rawKey, rawVal] = part.split(':');
      if (!rawKey || rawVal === undefined) continue;
      const key = rawKey.trim();
      const val = rawVal.trim();
      if (key === 'maxPerPage') {
        const n = Number(val);
        if (Number.isFinite(n)) limits.maxPerPage = n;
      } else if (key === 'minBands') {
        const n = Number(val);
        if (Number.isFinite(n)) limits.minBands = n;
      } else if (key === 'avoidAdjacent') limits.avoidAdjacent = val;
      else if (key === 'avoidAdjacentSurface') limits.avoidAdjacentSurface = val;
    }
  }
  return limits;
}

/** Is this line a catalog header row (names Component + Serves + Blocks)? */
function isCatalogHeader(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitRow(line).map((c) => c.toLowerCase());
  return cells.includes('component') && cells.includes('serves') && cells.includes('blocks');
}

/**
 * Parse the catalog table into section rows (atoms skipped). Returns [] if no table found.
 *
 * The real COMPOSITION.md splits the catalog into several intent-grouped sub-tables
 * (Heroes, Features, Stats, …), each re-emitting the same header + divider with prose /
 * markdown headings between them. We scan the WHOLE document: every header row (re)binds
 * the column map, dividers and non-table lines are skipped (never end parsing), and every
 * `section`-category data row from any sub-table is collected.
 */
export function parseCompositionCatalog(md: string): CompositionRow[] {
  const lines = md.split(/\r?\n/);

  let headerCount = 0; // > 0 once we're inside a catalog table
  let ci: Record<string, number> = {};
  const bindHeaders = (line: string) => {
    const cells = splitRow(line).map((c) => c.toLowerCase());
    headerCount = cells.length;
    const col = (name: string) => cells.indexOf(name);
    ci = {
      component: col('component'),
      file: col('file'),
      cat: col('cat'),
      layout: col('layout'),
      surface: col('surface'),
      interaction: col('interaction'),
      serves: col('serves'),
      blocks: col('blocks'),
      direction: col('direction'),
    };
  };

  const rows: CompositionRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCatalogHeader(line)) {
      bindHeaders(line); // (re)bind on each sub-table header
      continue;
    }
    if (headerCount === 0) continue; // not inside a catalog table yet
    if (!line.includes('|')) continue; // prose / heading between sub-tables — skip, don't stop
    if (isDivider(line)) continue;
    const cells = splitRow(line);
    if (cells.length < headerCount) continue; // malformed row — skip
    const at = (idx: number) => (idx >= 0 ? cells[idx] ?? '' : '');
    const cat = at(ci.cat).toLowerCase();
    if (cat !== 'section') continue; // skip atoms / unknown
    const name = at(ci.component).replace(/`/g, '').trim();
    const fileCell = at(ci.file).replace(/`/g, '').trim();
    const direction = at(ci.direction);
    rows.push({
      name,
      slug: slugFromFile(fileCell, name),
      cat: 'section',
      layout: commaList(at(ci.layout)),
      surface: (commaList(at(ci.surface))[0] ?? '').toLowerCase(),
      interaction: commaList(at(ci.interaction)),
      serves: commaList(at(ci.serves)),
      blocks: commaList(at(ci.blocks)),
      direction: direction.replace(/\{[^}]*\}/g, '').trim(),
      limits: parseLimits(direction),
    });
  }
  return rows;
}

/**
 * One authored selection row (Sprint 2.1 / Stage 1) — sections AND atoms, surface kept as
 * the FULL authored list. Distinct from CompositionRow (router universe = sections only,
 * surface collapsed to one): this is the repository-enrichment view of the same table.
 */
export interface SelectionRow {
  slug: string;
  cat: 'section' | 'atom';
  serves: string[];
  surface: string[];
  limits: CompositionLimits;
}

/**
 * Parse the catalog into selection rows for EVERY component (section + atom). Reuses the
 * same tolerant scan as parseCompositionCatalog; does not alter that section-only parser.
 */
export function parseCompositionSelection(md: string): SelectionRow[] {
  const lines = md.split(/\r?\n/);
  let headerCount = 0;
  let ci: Record<string, number> = {};
  const bind = (line: string) => {
    const cells = splitRow(line).map((c) => c.toLowerCase());
    headerCount = cells.length;
    const col = (n: string) => cells.indexOf(n);
    ci = {
      component: col('component'),
      file: col('file'),
      cat: col('cat'),
      surface: col('surface'),
      serves: col('serves'),
      direction: col('direction'),
    };
  };

  const rows: SelectionRow[] = [];
  for (const line of lines) {
    if (isCatalogHeader(line)) {
      bind(line);
      continue;
    }
    if (headerCount === 0) continue;
    if (!line.includes('|')) continue;
    if (isDivider(line)) continue;
    const cells = splitRow(line);
    if (cells.length < headerCount) continue;
    const at = (idx: number) => (idx >= 0 ? cells[idx] ?? '' : '');
    const cat = at(ci.cat).toLowerCase();
    if (cat !== 'section' && cat !== 'atom') continue;
    const name = at(ci.component).replace(/`/g, '').trim();
    const fileCell = at(ci.file).replace(/`/g, '').trim();
    rows.push({
      slug: slugFromFile(fileCell, name),
      cat,
      serves: commaList(at(ci.serves)),
      surface: commaList(at(ci.surface)),
      limits: parseLimits(at(ci.direction)),
    });
  }
  return rows;
}

/** Absolute path to the website catalog. */
export function compositionMdPath(): string {
  return join(designProcessesDir('website'), 'component-governance', 'COMPOSITION.md');
}

/**
 * Load + parse every authored selection row (sections + atoms). FAIL-LOUD on a missing
 * file or a table that collapsed below the section floor — the selection facts are the
 * Stage-1 authored source and their absence must surface, never silently yield nothing.
 */
export function loadCompositionSelection(): SelectionRow[] {
  const path = compositionMdPath();
  if (!existsSync(path)) {
    throw new Error(`loadCompositionSelection: COMPOSITION.md not found at ${path}.`);
  }
  const rows = parseCompositionSelection(readFileSync(path, 'utf8'));
  if (rows.length < MIN_CATALOG_ROWS) {
    throw new Error(
      `loadCompositionSelection: parsed only ${rows.length} rows from ${path} ` +
        `(expected ≥ ${MIN_CATALOG_ROWS}). The catalog table header or rows likely changed shape.`,
    );
  }
  return rows;
}

/**
 * Load + parse the real website COMPOSITION.md. FAIL-LOUD: throws on a missing file, an
 * unparseable table, or fewer than MIN_CATALOG_ROWS section rows — a broken catalog must
 * surface at plan time, not silently route to nothing.
 */
export function loadCompositionCatalog(): CompositionRow[] {
  const path = compositionMdPath();
  if (!existsSync(path)) {
    throw new Error(`loadCompositionCatalog: COMPOSITION.md not found at ${path}.`);
  }
  const rows = parseCompositionCatalog(readFileSync(path, 'utf8'));
  if (rows.length < MIN_CATALOG_ROWS) {
    throw new Error(
      `loadCompositionCatalog: parsed only ${rows.length} section rows from ${path} ` +
        `(expected ≥ ${MIN_CATALOG_ROWS}). The catalog table header or rows likely changed shape — ` +
        `fix the table or the parser (composition-md.ts).`,
    );
  }
  return rows;
}
