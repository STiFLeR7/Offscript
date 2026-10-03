/**
 * Offscript M3 — governed-actuator driver (spec §2/§3/§5).
 *
 * Env-gated (OFFSCRIPT_ACTUATOR=1), mirroring the OFFSCRIPT_PLAYWRIGHT pattern. Runs the
 * governed gate-loop over the judgment passes against the live deliverable,
 * using a real SubagentActuator. The actual per-pass EDIT is performed by a
 * Claude subagent in the orchestrating session — this driver writes a
 * `<pass>.request.md` brief per pass and, by default, reads the subagent's
 * answer back from `<pass>.response.html`. When a response file is absent it
 * leaves the doc unchanged for that pass (a dry run that still exercises the
 * governed loop + governance report plumbing), exactly like scripts/harden.ts's
 * Tier-2 advisory stub. Writes the GovernanceReport into score.json's
 * `governance` block and prints the formatted report.
 *
 * Usage:  OFFSCRIPT_ACTUATOR=1 npx tsx scripts/actuate.ts [kit-dir]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { loadBrandContract } from '../src/brand-contract.js';
import { buildOperatorContext } from '../src/operator-context.js';
import { judgmentPasses } from '../src/passes.js';
import { actuatePassGoverned, type GovernanceTrace } from '../src/actuation-governed.js';
import { createSubagentActuator } from '../src/actuators/subagent.js';
import { buildGovernanceReport, formatGovernanceReport } from '../src/governance-score.js';

if (process.env.OFFSCRIPT_ACTUATOR !== '1') {
  console.log(
    `Governed actuator: skipped (set OFFSCRIPT_ACTUATOR=1 to run; the per-pass edit is dispatched ` +
      `to an in-session Claude subagent — see docs/OFFSCRIPT-RUNTIME-ARCHITECTURE.md).`,
  );
  process.exit(0);
}

const args = process.argv.slice(2);
const targetArg = args.find((a) => !a.startsWith('--'));
const dir = resolve(targetArg ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));
const brand = basename(dir);
// v2: harden output co-locates in the kit's track working dir.
const outDir = dir;
const idxPath = join(outDir, 'index.html');
const refPath = join(outDir, 'reference.html');

if (!existsSync(idxPath) || !existsSync(refPath)) {
  console.log(`No harden output at ${outDir} — run 'npx tsx scripts/harden.ts ${dir}' first.`);
  process.exit(0);
}

const tokens = loadTokensFromCss(detectKitLayout(dir).tokensCss);
const brandContract = loadBrandContract(join(dir, 'brand-contract.json')) ?? undefined;
const ctx = buildOperatorContext({ tokens, brandContract });
const reference = readFileSync(refPath, 'utf8');
const dispatchDir = join(outDir, 'dispatch');

const actuator = createSubagentActuator({
  dispatchDir,
  // Default dispatch: read the subagent's edited HTML from <pass>.response.html
  // (written by the orchestrating session after it dispatches the subagent).
  // Absent ⇒ return the input unchanged (dry run).
  dispatch: async (req) => {
    const responsePath = join(dispatchDir, `${req.pass}.response.html`);
    return existsSync(responsePath) ? readFileSync(responsePath, 'utf8') : req.html;
  },
});

let current = readFileSync(idxPath, 'utf8');
const traces: GovernanceTrace[] = [];

for (const pass of judgmentPasses) {
  const out = await actuatePassGoverned({
    html: current,
    reference,
    ctx,
    pass,
    actuator,
    maxLoops: 3,
  });
  current = out.html;
  traces.push(out.governance);
  console.log(
    `pass ${pass.name}: ${out.governance.status} (loops=${out.governance.loops}, ` +
      `slop=${out.governance.slopIntroduced}, drift=${out.governance.drift})`,
  );
}

writeFileSync(idxPath, current, 'utf8');

const report = buildGovernanceReport({ subject: dir, traces });
console.log('\n' + formatGovernanceReport(report));

// Attach the governance block to score.json (preserving the existing score).
const scorePath = join(outDir, 'score.json');
if (existsSync(scorePath)) {
  const score = JSON.parse(readFileSync(scorePath, 'utf8'));
  score.governance = report;
  writeFileSync(scorePath, JSON.stringify(score, null, 2) + '\n', 'utf8');
  console.log(`\nGovernance block written into ${scorePath}`);
}
