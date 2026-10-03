/**
 * Offscript collateral harden — intake a finished A4 brochure, self-contain, gate
 * against the collateral rail set. Geometric A4 rails run behind OFFSCRIPT_PLAYWRIGHT=1.
 * Usage: npx tsx scripts/harden-collateral.ts <artifact.html> [--force]
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { trackDir, DEFAULT_CLIENT } from '../src/paths.js';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import type { Finding, Operator } from '../src/operator.js';
import { buildOperatorContext } from '../src/operator-context.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { collateralRegistry } from '../src/operators/collateral/index.js';
import { intakeCollateral, isCollateral } from '../src/collateral/intake.js';
import { scoreFindingsByRail, writeScore, formatScoreReport } from '../src/score.js';
import { freezeEscalatedFindings } from '../src/freeze-wiring.js';
import { RenderRuntime, A4_VIEWPORT, canLaunchRuntime } from '../src/render-runtime.js';
import { detectA4BoundsAsync } from '../src/operators/collateral/render/a4-bounds.js';
import { detectTextOverlapAsync } from '../src/operators/collateral/render/text-overlap.js';
import { detectPageWrapAsync } from '../src/operators/collateral/render/page-wrap.js';
import { detectPageFillAsync } from '../src/operators/collateral/render/page-fill.js';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.log('Usage: npx tsx scripts/harden-collateral.ts <artifact.html> [--force]');
  process.exit(0);
}
const artifactPath = resolve(target);
if (!existsSync(artifactPath)) {
  console.log(`No artifact at ${artifactPath}`);
  process.exit(0);
}

const raw = readFileSync(artifactPath, 'utf8');
if (!isCollateral(raw)) {
  console.log(`Not a collateral artifact (no .cr-doc) — ${artifactPath}`);
  process.exit(0);
}

const name = basename(artifactPath).replace(/\.html?$/i, '');
// v2: collateral hardens into the agency client's collateral track dir,
// one subdir per artifact: projects/<client>/collateral/<name>/.
const outDir = join(trackDir(DEFAULT_CLIENT, 'collateral'), name);
mkdirSync(outDir, { recursive: true });

const { selfContained, pageCount } = intakeCollateral(raw, dirname(artifactPath));
const refPath = join(outDir, 'reference.html');
const idxPath = join(outDir, 'index.html');
writeFileSync(refPath, selfContained, 'utf8');
const force = args.includes('--force');
if (!existsSync(idxPath) || force) writeFileSync(idxPath, selfContained, 'utf8');
console.log(
  `Offscript collateral harden — ${name}\n  pages: ${pageCount}\n  reference: ${refPath}\n  index: ${idxPath}\n`,
);

// buildOperatorContext requires a TokenModel (not optional) — loadTokensFromCss('')
// yields a valid empty model, so we always pass a concrete TokenModel rather than
// `undefined` (this is the one place the call differs from the plan snippet).
const tokensMatch = selfContained.match(/:root\s*\{[\s\S]*?\}/);
const tokens = loadTokensFromCss(tokensMatch ? tokensMatch[0] : '');
const ctx = buildOperatorContext({ tokens });

const tree = parseHtml(selfContained);
const registry = collateralRegistry();
const perRail: Array<{ operator: Operator; findings: Finding[] }> = [];
for (const [name2, op] of registry) {
  const findings = runGate(tree, ctx, [op]);
  perRail.push({ operator: op, findings });
  console.log(
    `  ${name2} [tier ${op.tier}]: ${findings.length === 0 ? 'clear' : findings.length + ' finding(s)'}`,
  );
}

if (await canLaunchRuntime()) {
  console.log(`\nA4 render rails (Playwright @ ${A4_VIEWPORT.width}x${A4_VIEWPORT.height}):`);
  const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
  try {
    const rc = await rt.loadHtml(selfContained);
    const renderResults: Array<{ name: string; findings: Finding[] }> = [
      { name: 'a4-bounds', findings: await detectA4BoundsAsync(rc, tree) },
      { name: 'text-overlap', findings: await detectTextOverlapAsync(rc, tree) },
      { name: 'page-wrap', findings: await detectPageWrapAsync(rt, selfContained) },
      { name: 'page-fill', findings: await detectPageFillAsync(rc, tree) },
    ];
    for (const { name: rn, findings } of renderResults) {
      const op = registry.get(rn);
      const entry: { operator: Operator; findings: Finding[] } = op
        ? { operator: op, findings }
        : {
            operator: {
              name: rn,
              tier: 1 as const,
              detect: () => [],
              apply: () => [],
            },
            findings,
          };
      const i = perRail.findIndex((e) => e.operator.name === rn);
      if (i >= 0) perRail[i] = entry;
      else perRail.push(entry);
      console.log(
        `  ${rn}: ${findings.length === 0 ? 'clear' : findings.length + ' finding(s)'}`,
      );
    }
  } finally {
    await rt.close();
  }
} else {
  console.log(
    `\nA4 render rails: skipped (set OFFSCRIPT_PLAYWRIGHT=1 + 'npx playwright install chromium').`,
  );
}

const score = scoreFindingsByRail({ subject: artifactPath, applied: [], perRail });
writeScore(join(outDir, 'score.json'), score);
console.log('\n' + formatScoreReport(score));

const wrote = freezeEscalatedFindings({
  overlayDir: join(outDir, 'overlay'),
  perRail,
  decidedBy: 'offscript-harden-collateral:v1',
  snapshotHtml: selfContained,
});
console.log(
  `\nFrozen ${wrote.length} region(s)${wrote.length ? ' → ' + join(outDir, 'overlay') : ''}`,
);
