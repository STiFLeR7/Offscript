/**
 * Runtime reader for the website numerics governance file (audit §9-D).
 *
 * Externalizes the few quantitative thresholds the escalating render rails read, so the repo —
 * not a TS constant — is the source of truth (Offscript stateless-generation doctrine). Modeled on
 * composition-md.ts: tolerant header-NAME mapping, FAIL-LOUD loader. Website-only; no
 * engine-internal deps beyond paths.ts + node fs (safe to import from operators or generate).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from '../paths.js';

export interface WebsiteNumerics {
  minFillPct: number;
  minFocalRatio: number;
  minBandsForRhythm: number;
}

const REQUIRED_KEYS: ReadonlyArray<keyof WebsiteNumerics> = [
  'minFillPct',
  'minFocalRatio',
  'minBandsForRhythm',
];

function splitRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

/** Parse the `| key | value |` table into a validated WebsiteNumerics. FAIL-LOUD. */
export function parseWebsiteNumerics(md: string): WebsiteNumerics {
  const raw = new Map<string, string>();
  let keyCol = -1;
  let valCol = -1;
  for (const line of md.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const cells = splitRow(line).map((c) => c.replace(/`/g, ''));
    const lower = cells.map((c) => c.toLowerCase());
    if (keyCol === -1 && lower.includes('key') && lower.includes('value')) {
      keyCol = lower.indexOf('key');
      valCol = lower.indexOf('value');
      continue;
    }
    if (keyCol === -1) continue;
    if (isDivider(line)) continue;
    if (cells.length <= Math.max(keyCol, valCol)) continue;
    raw.set(cells[keyCol], cells[valCol]);
  }

  const out: Partial<WebsiteNumerics> = {};
  for (const k of REQUIRED_KEYS) {
    const v = raw.get(k);
    if (v === undefined) {
      throw new Error(`parseWebsiteNumerics: required key "${k}" missing from the numerics table.`);
    }
    if (v.trim() === '') {
      throw new Error(`parseWebsiteNumerics: required key "${k}" has an empty value.`);
    }
    if (!/^-?\d+(\.\d+)?$/.test(v.trim())) {
      throw new Error(`parseWebsiteNumerics: value for "${k}" is not a plain decimal number ("${v}").`);
    }
    const n = Number(v);
    out[k] = n;
  }
  return out as WebsiteNumerics;
}

/** Absolute path to the website numerics governance file. */
export function websiteNumericsPath(): string {
  return join(designProcessesDir('website'), 'rulebooks', 'numerics.md');
}

/** Load + parse the real numerics file. FAIL-LOUD: throws on missing file / key / non-finite value. */
export function loadWebsiteNumerics(): WebsiteNumerics {
  const path = websiteNumericsPath();
  if (!existsSync(path)) {
    throw new Error(`loadWebsiteNumerics: numerics.md not found at ${path}.`);
  }
  return parseWebsiteNumerics(readFileSync(path, 'utf8'));
}
