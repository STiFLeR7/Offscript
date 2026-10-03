/**
 * F7 — `/offscript fullstack` CLI entry: the first public entry point into Program F.
 *
 * Thin, by design: arg-parse → `runFullstackCommand` (Program F's own orchestration,
 * `src/fullstack/fullstack-command.ts`) → print a summary. No filesystem writes, no `npm`
 * invocation, no Next.js execution — this script only READS the client's already-persisted
 * `rendering-ir.json` (via the Transformation Loader, F2) and prints the resulting
 * `GeneratedProject` to stdout. Errors from any reused Program-F stage propagate uncaught —
 * this script adds no error-handling logic of its own.
 *
 * Usage: npx tsx scripts/fullstack.ts <client> [--track website|collateral|deck]
 */
import { DEFAULT_CLIENT } from '../src/paths.js';
import { resolveTrack } from '../src/track-resolve.js';
import { runFullstackCommand } from '../src/fullstack/fullstack-command.js';

const args = process.argv.slice(2);
const clientArg = args.find((a) => !a.startsWith('--'));
const client = clientArg ?? DEFAULT_CLIENT;
const track = resolveTrack(args);

console.log(`[fullstack] client=${client} track=${track}`);
console.log(`[fullstack] loading rendering-ir.json + running the Program F pipeline (in-memory only)…\n`);

const generated = runFullstackCommand(client, track);

console.log(`GeneratedProject — nothing written to disk:`);
console.log(`  generator:   ${generated.manifest.generator}`);
console.log(`  files:       ${generated.manifest.fileCount}`);
console.log(`  directories: ${generated.manifest.directoryCount}`);
console.log(`  diagnostics: ${generated.manifest.diagnosticCount}`);
console.log(`  digest:      ${generated.digest}\n`);
for (const f of generated.files) {
  console.log(`  ${f.path}  (${f.kind}, ${f.content.length} chars, ${f.digest.slice(0, 12)}…)`);
}
if (generated.diagnostics.length > 0) {
  console.log();
  for (const d of generated.diagnostics) console.log(`  [${d.level}] ${d.message}`);
}
