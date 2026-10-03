/**
 * P05 — Designer Doctor Consumption: persistence for the already-built DoctorReport.
 *
 * Pure IO, no judgment. Mirrors score.ts's stable-JSON / idempotent-write pattern
 * (`writeScore`) exactly, so `doctor-report.json` is a first-class artifact
 * alongside `score.json` and `overlay/` — a real, durable "canonical review
 * artifact" a future Doctor CLI/UI can read, not just an in-memory value that
 * disappears when the process exits.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DoctorReport } from './doctor-report.js';

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer(value), 2) + '\n';
}

/** Pre-compute the sorted key union once so JSON.stringify uses it for every nested object. */
function sortedReplacer(root: unknown): string[] {
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

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Write a DoctorReport as stable JSON (sorted keys, 2-space indent, trailing
 * newline). Idempotent: if the target file's content is already identical, the
 * file is left untouched (mtime is not bumped) — matching writeScore/writeOverlay.
 */
export function writeDoctorReport(filePath: string, report: DoctorReport): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(report));
}

/**
 * Read a DoctorReport back from disk. Never throws: a missing file or malformed
 * JSON both return `undefined` (the caller decides what "no report yet" means).
 */
export function readDoctorReport(filePath: string): DoctorReport | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as DoctorReport;
  } catch {
    return undefined;
  }
}
