#!/usr/bin/env -S npx tsx
/**
 * Documentation-hardening sprint (2026-08-20) — a tiny, mechanical guard mirroring
 * `check-package-isolation.ts` / `check-capability-closure.ts`'s own "grep the real source,
 * compare against the declared/documented set" shape. No manifest needed here: the comparison is
 * source (grep) vs. the canonical doc's own §6 table, not source vs. a separately declared file.
 *
 * Checks two things against `docs/OFFSCRIPT-RUNTIME-ARCHITECTURE.md`:
 *   1. Every `process.env.OFFSCRIPT_*` read site in `offscript/src` + `offscript/scripts` is documented in §6.
 *   2. Every flag documented in §6 is still actually read somewhere (no stale/removed flag left
 *      in the doc).
 * Does not check flag semantics (default/behavior) — that is a judgment call for a human/agent
 * documentation pass, not a mechanical one.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_DIR_NAMES = new Set(['node_modules', 'dist', 'output', '.git', '.experiments', 'coverage']);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIR_NAMES.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
}

/** Every `OFFSCRIPT_*` flag actually read via `process.env.OFFSCRIPT_*` under the given directories. */
export function collectSourceFlags(dirs: string[]): Set<string> {
  const flags = new Set<string>();
  const files: string[] = [];
  for (const dir of dirs) {
    if (existsSync(dir)) walk(dir, files);
  }
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const m of content.matchAll(/process\.env\.(OFFSCRIPT_[A-Z0-9_]+)/g)) {
      flags.add(m[1]);
    }
  }
  return flags;
}

/** Every `OFFSCRIPT_*` flag named as a §6 table row (a line starting with `` | `OFFSCRIPT_...` ``) in the
 * canonical runtime-architecture doc. */
export function collectDocumentedFlags(docContent: string): Set<string> {
  const flags = new Set<string>();
  for (const m of docContent.matchAll(/^\|\s*`(OFFSCRIPT_[A-Z0-9_]+)`/gm)) {
    flags.add(m[1]);
  }
  return flags;
}

export interface FlagDocCheckResult {
  missingFromDocs: string[];
  staleInDocs: string[];
  conventionSectionPresent: boolean;
}

export function checkRuntimeFlagDocs(opts: { repoRoot: string; docPath: string }): FlagDocCheckResult {
  const sourceFlags = collectSourceFlags([join(opts.repoRoot, 'src'), join(opts.repoRoot, 'scripts')]);
  const docContent = readFileSync(opts.docPath, 'utf8');
  const documentedFlags = collectDocumentedFlags(docContent);

  const missingFromDocs = [...sourceFlags].filter((f) => !documentedFlags.has(f)).sort();
  const staleInDocs = [...documentedFlags].filter((f) => !sourceFlags.has(f)).sort();
  const conventionSectionPresent = /^## 8\. Convention: scripted double before real executor/m.test(docContent);

  return { missingFromDocs, staleInDocs, conventionSectionPresent };
}

export function main(): number {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..');
  const docPath = resolve(repoRoot, '..', 'docs/OFFSCRIPT-RUNTIME-ARCHITECTURE.md');

  const result = checkRuntimeFlagDocs({ repoRoot, docPath });
  const relDoc = relative(repoRoot, docPath);

  let ok = true;
  if (result.missingFromDocs.length > 0) {
    ok = false;
    console.error(`[check-runtime-flag-docs] flags read in source but missing from ${relDoc} §6: ${result.missingFromDocs.join(', ')}`);
  }
  if (result.staleInDocs.length > 0) {
    ok = false;
    console.error(`[check-runtime-flag-docs] flags documented in ${relDoc} §6 but not read anywhere: ${result.staleInDocs.join(', ')}`);
  }
  if (!result.conventionSectionPresent) {
    ok = false;
    console.error(`[check-runtime-flag-docs] ${relDoc} is missing its §8 scripted-double-before-real-executor convention section.`);
  }

  if (ok) {
    console.log(`[check-runtime-flag-docs] OK — runtime flag docs match source; convention section present.`);
    return 0;
  }
  return 1;
}

const invokedDirectly = typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('/check-runtime-flag-docs.ts');
if (invokedDirectly) {
  process.exitCode = main();
}
