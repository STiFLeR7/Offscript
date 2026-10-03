/**
 * P07 — Designer Doctor Review Report: persistence for the already-built
 * ReviewReport / rendered Markdown. Pure IO, no judgment — mirrors
 * doctor-report-io.ts's own stable-JSON / idempotent-write pattern (itself
 * mirroring score.ts's writeScore), so `review-report.md` and
 * `review-report.json` become real, durable artifacts alongside
 * `doctor-report.json` and `score.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReviewReport } from './review-report.js';

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Write the rendered Markdown verbatim — no transformation, idempotent write. */
export function writeReviewReportMarkdown(filePath: string, markdown: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, markdown);
}

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer(value), 2) + '\n';
}

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

/** Write a ReviewReport as stable JSON — the machine-readable companion to the Markdown. */
export function writeReviewReport(filePath: string, review: ReviewReport): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(review));
}

/** Read a ReviewReport back from disk. Never throws: undefined on missing/malformed file. */
export function readReviewReport(filePath: string): ReviewReport | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ReviewReport;
  } catch {
    return undefined;
  }
}
