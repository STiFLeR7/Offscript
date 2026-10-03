#!/usr/bin/env node
/**
 * CLI: sync [--source dir] [--target dir] [--dry-run] [--validate] [--report]
 *
 * Defaults are anchored to this file's location (not cwd), so `npm run sync` works the same
 * whether invoked from the package dir, the repo root, or CI:
 *   --source    <repo root>/design/website
 *   --target    offscript/resources/design_processes/website
 *
 * --validate runs the engine's own parser test suite (composition/compose/inheritance/
 * projection — the exact governance-parsing surface this sync feeds) against the resulting
 * tree, via `vitest run` in offscript/. Fails loud: a validate failure exits non-zero.
 * --report prints the full written/overwritten/preserved/unaccounted file lists, not just counts.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSync } from './sync.js';
import { parseCliArgs } from './cli-args.js';

const packageDir = dirname(fileURLToPath(import.meta.url)); // .../offscript/website-governance-sync/src
const offscriptRoot = resolve(packageDir, '..', '..'); // .../offscript
const repoRoot = resolve(offscriptRoot, '..'); // offscript root

const { sourceRoot, targetRoot, dryRun, validate, report } = parseCliArgs(process.argv.slice(2), {
  sourceRoot: join(repoRoot, 'design', 'website'),
  targetRoot: join(offscriptRoot, 'resources', 'design_processes', 'website'),
});

const result = runSync({ sourceRoot, targetRoot, dryRun });

console.log(`${dryRun ? '[dry-run] ' : ''}website-governance-sync: ${sourceRoot} -> ${targetRoot}`);
console.log(`  written:      ${result.written.length} (${result.transformed.length} transformed)`);
console.log(`  overwritten:  ${result.overwritten.length}`);
console.log(`  preserved:    ${result.preserved.length}`);
console.log(`  excluded:     ${result.excludedSource.length} (by design, from design/website)`);
if (result.unaccounted.length > 0) {
  console.log(`  UNACCOUNTED (carried forward, needs review — ${result.unaccounted.length}):`);
  for (const p of result.unaccounted) console.log(`    - ${p}`);
}

if (report) {
  const section = (label: string, items: readonly string[]) => {
    console.log(`\n  ${label} (${items.length}):`);
    for (const p of items) console.log(`    - ${p}`);
  };
  section('written', result.written);
  section('overwritten', result.overwritten);
  section('preserved', result.preserved);
  section('excluded (from design/website)', result.excludedSource);
}

if (validate) {
  console.log('\n[validate] running the engine parser suite against the synced tree...');
  const PARSER_TESTS = [
    'test/generate/composition-md.test.ts',
    'test/generate/composition-selection.test.ts',
    'test/generate/compose-md.test.ts',
    'test/knowledge/inheritance.test.ts',
    'test/knowledge/projection.test.ts',
  ];
  const proc = spawnSync(`npx vitest run ${PARSER_TESTS.join(' ')}`, {
    cwd: offscriptRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (proc.status !== 0) {
    console.error('\n[validate] FAILED — the synced content broke a governance parser. See output above.');
    process.exit(proc.status ?? 1);
  }
  console.log('[validate] PASSED — composition/compose/inheritance/projection all load cleanly.');
}
