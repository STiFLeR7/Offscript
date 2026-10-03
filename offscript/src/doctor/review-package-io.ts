/**
 * P08 — Designer Doctor Review Package: persistence for the already-built
 * ReviewPackage / validation summary text. Pure IO, no judgment — mirrors
 * doctor-report-io.ts / review-report-io.ts's own stable-JSON and
 * idempotent-plain-text patterns.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReviewPackage } from './review-package.js';

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

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

/** Write a ReviewPackage as stable JSON — the package's own manifest file. */
export function writeReviewPackage(filePath: string, pkg: ReviewPackage): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(pkg));
}

/** Read a ReviewPackage back from disk. Never throws: undefined on missing/malformed file. */
export function readReviewPackage(filePath: string): ReviewPackage | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ReviewPackage;
  } catch {
    return undefined;
  }
}

/** Write the already-computed validation-summary text verbatim, idempotently. */
export function writeValidationSummary(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, text);
}
