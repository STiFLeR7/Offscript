/**
 * Offscript deck harden — intake a finished 16:9 pitch deck, self-contain, gate
 * against the deck rail set. Geometric slide rails run behind OFFSCRIPT_PLAYWRIGHT=1
 * at the 1920×1080 slide canvas.
 * Usage: npx tsx scripts/harden-deck.ts <artifact.html> [--force]
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import type { Finding, Operator } from '../src/operator.js';
import { buildOperatorContext } from '../src/operator-context.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { deckRegistry } from '../src/operators/deck/index.js';
import { intakeDeck, isDeck } from '../src/deck/intake.js';
import { scoreFindingsByRail, writeScore, formatScoreReport } from '../src/score.js';
import { freezeEscalatedFindings } from '../src/freeze-wiring.js';
import { RenderRuntime, DECK_VIEWPORT, canLaunchRuntime } from '../src/render-runtime.js';
import { detectSlideOverflowAsync } from '../src/operators/deck/render/slide-bounds.js';
import { detectBodyTextFloorAsync } from '../src/operators/deck/render/body-text-floor.js';
import { detectDeckTextOverlapAsync } from '../src/operators/deck/render/text-overlap.js';
import { trackDir, DEFAULT_CLIENT } from '../src/paths.js';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.log('Usage: npx tsx scripts/harden-deck.ts <artifact.html> [--force]');
  process.exit(0);
}
const artifactPath = resolve(target);
if (!existsSync(artifactPath)) {
  console.log(`No artifact at ${artifactPath}`);
  process.exit(0);
}

const raw = readFileSync(artifactPath, 'utf8');
if (!isDeck(raw)) {
  console.log(`Not a deck artifact (no .slide / slide-deck marker) — ${artifactPath}`);
  process.exit(0);
}

const name = basename(artifactPath).replace(/\.html?$/i, '');
// v2: decks harden into the agency client's deck track dir, one subdir per deck.
const outDir = join(trackDir(DEFAULT_CLIENT, 'deck'), name);
mkdirSync(outDir, { recursive: true });

const { selfContained, slideCount } = intakeDeck(raw, dirname(artifactPath));
const refPath = join(outDir, 'reference.html');
const idxPath = join(outDir, 'index.html');
writeFileSync(refPath, selfContained, 'utf8');
const force = args.includes('--force');
if (!existsSync(idxPath) || force) writeFileSync(idxPath, selfContained, 'utf8');
console.log(
  `Offscript deck harden — ${name}\n  slides: ${slideCount}\n  reference: ${refPath}\n  index: ${idxPath}\n`,
);

// loadTokensFromCss('') yields a valid empty model, so we always pass a concrete
// TokenModel rather than undefined.
const tokensMatch = selfContained.match(/:root\s*\{[\s\S]*?\}/);
const tokens = loadTokensFromCss(tokensMatch ? tokensMatch[0] : '');
const ctx = buildOperatorContext({ tokens });

const tree = parseHtml(selfContained);
const registry = deckRegistry();
const perRail: Array<{ operator: Operator; findings: Finding[] }> = [];
for (const [name2, op] of registry) {
  const findings = runGate(tree, ctx, [op]);
  perRail.push({ operator: op, findings });
  console.log(
    `  ${name2} [tier ${op.tier}]: ${findings.length === 0 ? 'clear' : findings.length + ' finding(s)'}`,
  );
}

if (await canLaunchRuntime()) {
  console.log(`\nSlide render rails (Playwright @ ${DECK_VIEWPORT.width}x${DECK_VIEWPORT.height}):`);
  const rt = await RenderRuntime.launch({ viewport: DECK_VIEWPORT });
  try {
    const rc = await rt.loadHtml(selfContained);
    const renderResults: Array<{ name: string; findings: Finding[] }> = [
      { name: 'slide-no-overflow', findings: await detectSlideOverflowAsync(rc, tree) },
      { name: 'body-text-floor', findings: await detectBodyTextFloorAsync(rc, tree) },
      { name: 'no-text-overlap', findings: await detectDeckTextOverlapAsync(rc, tree) },
    ];
    for (const { name: rn, findings } of renderResults) {
      const op = registry.get(rn);
      const entry: { operator: Operator; findings: Finding[] } = op
        ? { operator: op, findings }
        : { operator: { name: rn, tier: 1 as const, detect: () => [], apply: () => [] }, findings };
      const i = perRail.findIndex((e) => e.operator.name === rn);
      if (i >= 0) perRail[i] = entry;
      else perRail.push(entry);
      console.log(`  ${rn}: ${findings.length === 0 ? 'clear' : findings.length + ' finding(s)'}`);
    }
  } finally {
    await rt.close();
  }
} else {
  console.log(
    `\nSlide render rails: skipped (set OFFSCRIPT_PLAYWRIGHT=1 + 'npx playwright install chromium').`,
  );
}

const score = scoreFindingsByRail({ subject: artifactPath, applied: [], perRail });
writeScore(join(outDir, 'score.json'), score);
console.log('\n' + formatScoreReport(score));

const wrote = freezeEscalatedFindings({
  overlayDir: join(outDir, 'overlay'),
  perRail,
  decidedBy: 'offscript-harden-deck:v1',
  snapshotHtml: selfContained,
});
console.log(`\nFrozen ${wrote.length} region(s)${wrote.length ? ' → ' + join(outDir, 'overlay') : ''}`);
