/**
 * Offscript WP1.0 detect-only dry run over a real Claude Design website kit.
 *
 * This is the payoff of the Intake + Flatten front-stage: flatten the actual
 * Example Brand kit, run every rail's detector over the flattened document, and
 * print a readable per-rail report — answering "what do the rails actually find
 * on real flattened output?". Detect-only: no actuator, no apply, no gate-loop.
 *
 * Usage:  npx tsx scripts/dry-run.ts [kit-dir]
 *   kit-dir defaults to projects/website/example-brand (gitignored input).
 */
import { existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { gateKit } from '../src/flatten/index.js';
import { defaultRegistry } from '../src/operators/index.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import type { OperatorContext } from '../src/operator.js';

const targetArg = process.argv[2];
const dir = resolve(targetArg ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));

function isKit(d: string): boolean {
  if (!existsSync(d) || !statSync(d).isDirectory()) return false;
  // a website kit carries colors_and_type.css + ui_kits/website/index.html
  return (
    existsSync(join(d, 'colors_and_type.css')) &&
    existsSync(join(d, 'ui_kits', 'website', 'index.html'))
  );
}

if (!isKit(dir)) {
  console.log(
    `No kit at ${dir} — skipping (input is gitignored; drop a Claude Design website kit there to run).`,
  );
  process.exit(0);
}

const brand = basename(dir);
console.log(`Offscript detect-only dry run`);
console.log(`  kit:   ${dir}`);
console.log(`  brand: ${brand}\n`);

// Run the canonical bounded-LLM detect path (this is what the engine wires up).
const { html, warnings, findings } = gateKit(dir, defaultRegistry());

// Write the flattened HTML as a local inspection artifact (gitignored),
// co-located in the track working dir (v2: no separate output/ tree).
const outDir = dir;
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'flattened.html');
writeFileSync(outPath, html, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(`Flattened HTML written:`);
console.log(`  ${outPath}  (${bytes.toLocaleString()} bytes)\n`);

// Re-run each rail separately so we can attribute findings to their rail.
// The union here equals gateKit's `findings` (runGate flat-maps the same rails).
const registry = defaultRegistry();
const tree = parseHtml(html);
// Same TokenModel gateKit used, so per-rail attribution matches its findings.
const tokens = loadTokensFromCss(detectKitLayout(dir).tokensCss);
const ctx: OperatorContext = { params: {}, tokens };

console.log(`Findings: ${findings.length} total across ${registry.size} rails\n`);

let attributed = 0;
for (const [name, op] of registry) {
  const railFindings = runGate(tree, ctx, [op]);
  attributed += railFindings.length;
  const tag = `[tier ${op.tier}]`;
  if (railFindings.length === 0) {
    console.log(`  ${name} ${tag}: 0 findings — clear`);
    continue;
  }
  console.log(`  ${name} ${tag}: ${railFindings.length} finding(s)`);
  for (const f of railFindings) {
    console.log(`      - (${f.outcome}) ${f.description}`);
    console.log(`        id: ${f.id}`);
  }
}

// Sanity: the per-rail union should match the canonical gateKit count.
if (attributed !== findings.length) {
  console.log(
    `\n  note: per-rail union (${attributed}) != gateKit findings (${findings.length}); ` +
      `gate context may differ — investigate.`,
  );
}

console.log(`\nFlatten warnings: ${warnings.length}`);
if (warnings.length === 0) {
  console.log(`  (none)`);
} else {
  for (const w of warnings) console.log(`  - ${w}`);
}

// Quick outcome tally for the systematic/bespoke ratio framing.
const tally = { 'auto-remediated': 0, escalated: 0, warning: 0 } as Record<string, number>;
for (const f of findings) tally[f.outcome] = (tally[f.outcome] ?? 0) + 1;
console.log(
  `\nOutcome tally: auto-remediated=${tally['auto-remediated']} ` +
    `escalated=${tally.escalated} warning=${tally.warning}`,
);