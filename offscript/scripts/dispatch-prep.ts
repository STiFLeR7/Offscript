/**
 * dispatch-prep — gather everything an actuator subagent needs for ONE pass.
 *
 * Usage:
 *   tsx scripts/dispatch-prep.ts <pass-name> [kit-dir]
 *
 * Reads the current output/website/<brand>/index.html, runs the named pass's
 * rail to get findings, composes the instruction via composeInstruction, and
 * prints everything in a form ready to hand to an Agent dispatch.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { loadBrandContract } from '../src/brand-contract.js';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import { contrastPass, brandFidelityPass, judgmentPasses } from '../src/passes.js';
import { composeInstruction } from '../src/instruction.js';
import { buildOperatorContext } from '../src/operator-context.js';

const args = process.argv.slice(2);
const passName = args[0];
const kitDir = resolve(args[1] ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));
if (!passName) {
  console.error('usage: tsx scripts/dispatch-prep.ts <pass-name> [kit-dir]');
  process.exit(2);
}

const pass = judgmentPasses.find((p) => p.name === passName);
if (!pass) {
  console.error(`unknown pass: ${passName} (known: ${judgmentPasses.map((p) => p.name).join(', ')})`);
  process.exit(2);
}

const brand = basename(kitDir);
const kit = detectKitLayout(kitDir);
const tokens = loadTokensFromCss(kit.tokensCss);
const brandContract = loadBrandContract(join(kitDir, 'brand-contract.json')) ?? undefined;
const ctx = buildOperatorContext({ tokens, brandContract });

// v2: harden output co-locates in the kit's track working dir.
const outDir = kitDir;
const indexPath = join(outDir, 'index.html');
const referencePath = join(outDir, 'reference.html');
const tokensPath = join(kitDir, 'colors_and_type.css');

if (!existsSync(indexPath)) {
  console.error(`no index.html at ${indexPath} — run harden first`);
  process.exit(2);
}

const html = readFileSync(indexPath, 'utf8');
const tree = parseHtml(html);
const findings = runGate(tree, ctx, pass.rails);

console.log(`\n========== PASS: ${pass.name} ==========`);
console.log(`Subject:  ${brand}`);
console.log(`Index:    ${indexPath}`);
console.log(`Reference:${referencePath}`);
console.log(`Tokens:   ${tokensPath}`);
console.log(`Findings: ${findings.length}\n`);

for (const f of findings) {
  console.log(`  - [${f.outcome}] id=${f.id}`);
  console.log(`    ${f.description}`);
}

const instruction = composeInstruction(
  pass,
  {
    brand,
    artifactType: 'website',
    creativeDirection: kit.creativeDirection,
    brandContract,
    tokens,
    findings,
    railBounds: pass.name === 'contrast'
      ? ['color-expansion', 'theme-orchestration']
      : ['theme-orchestration', 'anti-slop-checklist'],
  },
  { reference: referencePath, index: indexPath, tokens: tokensPath },
);

console.log(`\n========== COMPOSED INSTRUCTION (${instruction.length} chars) ==========\n`);
console.log(instruction);
