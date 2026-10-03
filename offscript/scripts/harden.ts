/**
 * Offscript WP1.C Phase-1 mechanical harden over a real Claude Design website kit.
 *
 * Writes three artifacts under output/website/<brand>/ :
 *   - reference.html        — immutable flatten ground truth (always rewritten).
 *   - index.mechanical.html — fresh mechanical baseline (always rewritten).
 *   - index.html            — the live deliverable. Created on first run; on
 *                              subsequent runs PRESERVED if it already exists
 *                              (so Phase-2 actuator edits aren't clobbered).
 *                              Pass `--force` to overwrite anyway. Delete the
 *                              file to start over.
 *
 * Then print a per-operator change report and a RESIDUAL detect-only gate — the
 * judgment gaps that remain for the Phase-2 actuator (contrast / responsive-need /
 * brand-fidelity / off-brand fonts).
 *
 * Usage:  npx tsx scripts/harden.ts [kit-dir] [--force]
 *   kit-dir defaults to projects/website/example-brand (gitignored input).
 */
import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { hardenKitMechanical } from '../src/flatten/harden.js';
import { defaultRegistry } from '../src/operators/index.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { loadBrandContract } from '../src/brand-contract.js';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import type { Finding, Operator } from '../src/operator.js';
import { scoreFindingsByRail, writeScore, formatScoreReport } from '../src/score.js';
import { buildOperatorContext } from '../src/operator-context.js';
import { freezeEscalatedFindings } from '../src/freeze-wiring.js';
import { readRecipe, applyRecipe } from '../src/actuator-recipe.js';
import { judgmentPasses } from '../src/passes.js';
import {
  measureOverflowsAsync,
  isRenderedGateEnabled,
} from '../src/operators/responsive-need-rendered.js';
// M2 Task 10 — render-aware rail tier wiring.
import { RenderRuntime, canLaunchRuntime } from '../src/render-runtime.js';
import {
  detectShorthandFailuresAsync,
} from '../src/operators/render/render-shorthand-sanity.js';
import { detectOverflowBoundsAsync } from '../src/operators/render/render-overflow-bounds.js';
import { detectVisibilityFloorAsync } from '../src/operators/render/render-visibility-floor.js';
import { detectKitVsLiveAsync } from '../src/operators/render/kit-vs-live.js';
import { fetchLiveHtml } from '../src/live-comparator.js';
import {
  runTier2AdvisoryPass,
  type AdvisoryDispatcher,
  type AdvisoryProposalDraft,
  type AdvisoryRequest,
} from '../src/tier-2-advisory.js';
import { readOverlay } from '../src/overlay.js';
import type { ComposePaths } from '../src/instruction.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const advisoryMode = args.includes('--advisory');
// `--live-url <url>` — kit-vs-live oracle runs only when this is set (or the
// kit carries a .kit-vs-live.json with `url` / `cachedHtmlPath`). Off by default.
const liveUrlIdx = args.indexOf('--live-url');
const liveUrlArg = liveUrlIdx >= 0 ? args[liveUrlIdx + 1] : undefined;
const consumedFlagIdx = new Set<number>();
if (liveUrlIdx >= 0) {
  consumedFlagIdx.add(liveUrlIdx);
  consumedFlagIdx.add(liveUrlIdx + 1);
}
const targetArg = args.find((a, i) => !consumedFlagIdx.has(i) && !a.startsWith('--'));
const dir = resolve(targetArg ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));

function isKit(d: string): boolean {
  if (!existsSync(d) || !statSync(d).isDirectory()) return false;
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
console.log(`Offscript mechanical harden (Phase 1 — deterministic, no LLM)`);
console.log(`  kit:   ${dir}`);
console.log(`  brand: ${brand}\n`);

const registry = defaultRegistry();
const { reference, html, applied } = hardenKitMechanical(dir, registry);

// Write artifacts (gitignored output tree). The live deliverable index.html is
// PRESERVED on subsequent runs so Phase-2 actuator edits aren't clobbered — pass
// --force to overwrite, or delete the file to start over. The fresh mechanical
// baseline is always emitted alongside as index.mechanical.html.
// v2: kit input and hardened artifacts co-locate in the track working dir
// (projects/<client>/<track>/) — there is no separate output/ tree.
const outDir = dir;
mkdirSync(outDir, { recursive: true });
const refPath = join(outDir, 'reference.html');
const mechPath = join(outDir, 'index.mechanical.html');
const idxPath = join(outDir, 'index.html');
writeFileSync(refPath, reference, 'utf8');
writeFileSync(mechPath, html, 'utf8');

const idxExisted = existsSync(idxPath);
let idxAction: 'created' | 'overwrote' | 'preserved';
if (!idxExisted) {
  writeFileSync(idxPath, html, 'utf8');
  idxAction = 'created';
} else if (force) {
  writeFileSync(idxPath, html, 'utf8');
  idxAction = 'overwrote';
} else {
  idxAction = 'preserved';
}

const refBytes = Buffer.byteLength(reference, 'utf8');
const mechBytes = Buffer.byteLength(html, 'utf8');
const liveBytes = idxAction === 'preserved' ? statSync(idxPath).size : mechBytes;

console.log(`Written:`);
console.log(`  reference (immutable ground truth):       ${refPath}  (${refBytes.toLocaleString()} bytes)`);
console.log(`  index.mechanical (fresh mechanical pass): ${mechPath}  (${mechBytes.toLocaleString()} bytes)`);
if (idxAction === 'created') {
  console.log(`  index (live deliverable, created):        ${idxPath}  (${liveBytes.toLocaleString()} bytes)`);
} else if (idxAction === 'overwrote') {
  console.log(`  index (live deliverable, --force):        ${idxPath}  (${liveBytes.toLocaleString()} bytes)`);
} else {
  console.log(`  index (live deliverable, PRESERVED):      ${idxPath}  (${liveBytes.toLocaleString()} bytes)`);
  console.log(`      → existing index.html kept untouched (Phase-2 actuator edits preserved).`);
  console.log(`      → fresh mechanical baseline is at index.mechanical.html.`);
  console.log(`      → pass --force, or delete index.html, to start over from mechanical.`);
}
console.log('');

// Per-operator attribution: what each mechanical operator changed.
console.log(`Mechanical operators applied (in order):\n`);
for (const run of applied) {
  const status = run.verified ? 'verified' : 'UNVERIFIED (residue remains)';
  if (run.findings.length === 0) {
    console.log(`  ${run.operator}: 0 findings — nothing to harden [${status}]`);
    continue;
  }
  console.log(`  ${run.operator}: ${run.findings.length} finding(s) [${status}]`);
  const sample = run.findings.slice(0, 6);
  for (const f of sample) {
    console.log(`      - (${f.outcome}) ${f.description}`);
    console.log(`        id: ${f.id}`);
  }
  if (run.findings.length > sample.length) {
    console.log(`      … and ${run.findings.length - sample.length} more`);
  }
}

// RESIDUAL detect-only gate over the HARDENED html — the "what's left for the
// actuator" report. Runs the FULL registry's detect; the mechanical ops should
// be clear (auto-remediated), leaving the judgment rails' gaps grouped by rail.
console.log(`\nResidual judgment gaps (detect-only over the hardened doc — Phase 2 actuator work):\n`);
const tokens = loadTokensFromCss(detectKitLayout(dir).tokensCss);
const brandContract = loadBrandContract(join(dir, 'brand-contract.json')) ?? undefined;
if (brandContract) {
  const mapped = Object.values(brandContract.slots).filter((s) => s !== null).length;
  const total = Object.keys(brandContract.slots).length;
  console.log(`\nBrand contract loaded: ${mapped}/${total} slots mapped (decidedBy=${brandContract.decidedBy}).`);
}
const ctx = buildOperatorContext({ tokens, brandContract });
const hardenedTree = parseHtml(html);

let residualTotal = 0;
const perRail: Array<{ operator: Operator; findings: Finding[] }> = [];
for (const [name, op] of registry) {
  const findings = runGate(hardenedTree, ctx, [op]);
  perRail.push({ operator: op, findings });
  if (findings.length === 0) {
    console.log(`  ${name} [tier ${op.tier}]: clear`);
    continue;
  }
  residualTotal += findings.length;
  console.log(`  ${name} [tier ${op.tier}]: ${findings.length} gap(s)`);
  const sample = findings.slice(0, 6);
  for (const f of sample) {
    console.log(`      - (${f.outcome}) ${f.description}`);
  }
  if (findings.length > sample.length) {
    console.log(`      … and ${findings.length - sample.length} more`);
  }
}

const tally = { 'auto-remediated': 0, escalated: 0, warning: 0 } as Record<string, number>;
for (const { findings } of perRail) {
  for (const f of findings) tally[f.outcome] = (tally[f.outcome] ?? 0) + 1;
}
console.log(
  `\nResidual tally over hardened doc: ${residualTotal} gap(s) — ` +
    `auto-remediated=${tally['auto-remediated']} escalated=${tally.escalated} warning=${tally.warning}`,
);
console.log(
  `(auto-remediated residue here = a mechanical op still has work; ideally 0. ` +
    `escalated/warning = judgment-rail gaps handed to the Phase-2 actuator.)`,
);

// ─────────── M2 Task 10 — render-aware rail tier (async, env-gated) ───────────
// The 4 render rails share one Playwright session (`RenderRuntime`) launched
// lazily here and torn down at the end of this script. Each rail's sync
// detect/apply returns [] by contract; the real work lives on the async
// helpers imported above. Findings are folded into `perRail` so the score,
// freeze wiring, and Tier-2 advisory all see one unified view.
//
// Gating: env (OFFSCRIPT_PLAYWRIGHT=1) + import (playwright) checked via
// canLaunchRuntime(). When gated off, the block prints a one-line skip note
// — no findings, no runtime, no impact on the rest of the flow.
let renderRuntime: RenderRuntime | undefined;
const renderRailNames = new Set([
  'kit-vs-live',
  'render-shorthand-sanity',
  'render-overflow-bounds',
  'render-visibility-floor',
]);
const hasRenderRail = [...registry.keys()].some((n) => renderRailNames.has(n));

if (hasRenderRail && (await canLaunchRuntime())) {
  console.log(`\nRender-aware rails (Playwright @ 1440x900):`);
  try {
    renderRuntime = await RenderRuntime.launch();
    const finalHtml = readFileSync(idxPath, 'utf8');
    const renderTree = parseHtml(finalHtml);
    const rctx = await renderRuntime.loadHtml(finalHtml);

    const liveHtml = await resolveLiveHtml(dir, liveUrlArg);
    const renderResults: Array<{ name: string; findings: Finding[] }> = [
      { name: 'kit-vs-live', findings: liveHtml ? await detectKitVsLiveAsync(renderRuntime, renderTree, liveHtml) : [] },
      { name: 'render-shorthand-sanity', findings: await detectShorthandFailuresAsync(rctx, renderTree) },
      { name: 'render-overflow-bounds', findings: await detectOverflowBoundsAsync(rctx, renderTree) },
      { name: 'render-visibility-floor', findings: await detectVisibilityFloorAsync(rctx, renderTree) },
    ];

    for (const { name, findings } of renderResults) {
      const op = registry.get(name);
      if (!op) {
        // Rail's sub-registry not yet spread into defaultRegistry() (Track B
        // Task 9 pending). Surface the count so we know the wiring works,
        // but skip score/freeze attribution — the rail isn't "live" yet.
        if (findings.length === 0) {
          console.log(`  ${name}: clear  (registry edit pending — Track B Task 9)`);
        } else {
          console.log(
            `  ${name}: ${findings.length} finding(s)  ` +
              `(registry edit pending — Track B Task 9; not folded into score/advisory yet)`,
          );
        }
        continue;
      }
      // The residual gate already pushed an empty entry for this rail (its
      // sync detect returns [] by contract). Replace that entry rather than
      // appending so per-rail attribution doesn't duplicate.
      const existingIdx = perRail.findIndex((e) => e.operator.name === name);
      if (existingIdx >= 0) {
        perRail[existingIdx] = { operator: op, findings };
      } else {
        perRail.push({ operator: op, findings });
      }
      if (findings.length === 0) {
        console.log(`  ${name} [tier ${op.tier}]: clear`);
        continue;
      }
      console.log(`  ${name} [tier ${op.tier}]: ${findings.length} finding(s)`);
      const sample = findings.slice(0, 6);
      for (const f of sample) console.log(`      - (${f.outcome}) ${f.description}`);
      if (findings.length > sample.length) {
        console.log(`      … and ${findings.length - sample.length} more`);
      }
    }
  } catch (err) {
    console.log(
      `  Render rails skipped — runtime failure: ${(err as Error).message.split('\n')[0]}`,
    );
  }
} else if (hasRenderRail) {
  console.log(
    `\nRender-aware rails: skipped (set OFFSCRIPT_PLAYWRIGHT=1 + 'npx playwright install chromium' to enable).`,
  );
}

// WP1.E.3 / WP1.7 — by-kind score: the §10 systematic/bespoke ratio. Built
// from the same residual per-rail findings above, written alongside the
// other output artifacts, and printed as the tail of the harden output.
const score = scoreFindingsByRail({ subject: dir, applied, perRail });
const scorePath = join(outDir, 'score.json');
writeScore(scorePath, score);
console.log(`\nScore written: ${scorePath}\n`);
console.log(formatScoreReport(score));

// ─────────── M2 Task 10 — Tier-2 advisory pass (opt-in via --advisory) ───────────
// Per the spec: AFTER mechanical + judgment + render rails, BEFORE freeze. Runs
// when --advisory is set AND there's at least one Tier-2 candidate (escalated
// finding in perRail OR a frozen overlay entry from a prior run). Uses a
// PLACEHOLDER dispatcher in this MVP wiring — the real LLM-dispatched advisory
// path will integrate with src/actuator.ts in a follow-up (parallel to the
// scripted-actuator pattern). The pass plumbing (composeInstruction reuse,
// proposals.json persistence, idempotency) is exercised either way; the
// `scripts/harden-review.ts` interactive CLI (Dev 2 Task 8) consumes the file.
const overlayDir = join(outDir, 'overlay');
if (advisoryMode) {
  const hasTier2Now = perRail.some(({ findings }) =>
    findings.some((f) => f.outcome === 'escalated'),
  );
  const frozenEntries = readOverlay(overlayDir);
  if (hasTier2Now || frozenEntries.length > 0) {
    const composePaths: ComposePaths = {
      reference: refPath,
      index: idxPath,
      tokens: detectKitLayout(dir).tokensCss,
    };
    const dispatcher: AdvisoryDispatcher = {
      async propose(req: AdvisoryRequest): Promise<AdvisoryProposalDraft> {
        // MVP stub. The real subagent dispatch path (parallel to actuator.ts)
        // lands as a follow-up after Dev 2's `scripts/harden-review.ts` is in
        // — that CLI is the human-in-the-loop side of the advisory loop.
        return {
          proposedEdit: { find: '', replace: '' },
          rationale:
            `placeholder draft for ${req.finding.id} from pass ${req.originPass} — ` +
            `real subagent dispatch not yet wired in scripts/harden.ts. ` +
            `Run scripts/harden-review.ts to walk + decide on proposals.`,
          confidence: 'low',
        };
      },
    };
    const proposals = await runTier2AdvisoryPass(perRail, frozenEntries, {
      brand,
      outputDir: outDir,
      html: readFileSync(idxPath, 'utf8'),
      dispatcher,
      proposedAt: new Date().toISOString(),
      composePaths,
      artifactType: 'website',
      brandContract,
      tokens,
    });
    console.log(
      `\nTier-2 advisory pass: ${proposals.length} proposal(s) at ${join(outDir, 'tier-2-proposals.json')} ` +
        `(stub dispatcher — real subagent dispatch is a follow-up).`,
    );
  } else {
    console.log(`\nTier-2 advisory pass: no candidates (no escalated findings, no frozen entries).`);
  }
}

// WP1.F.1 — freeze wiring. Convert escalated findings into overlay/ entries
// so the next harden run surfaces them as "you own this; re-decide on regen"
// (per the bounded-LLM vision §6, §8.2). Warnings and auto-remediated findings
// are deliberately NOT frozen. (`overlayDir` was declared above for the
// advisory pass; reused here.)
const wrote = freezeEscalatedFindings({
  overlayDir,
  perRail,
  decidedBy: 'offscript-harden:v1',
  snapshotHtml: html,
});
if (wrote.length === 0) {
  console.log(`\nFrozen 0 region(s) — no escalated findings`);
} else {
  console.log(`\nFrozen ${wrote.length} region(s) → ${overlayDir}/`);
  for (const w of wrote) {
    console.log(`  ${w.frozenId} (${w.findingIds.length} finding(s)) → ${w.overlayPath}`);
  }
}

// Actuator-recipe replay (WP1.G item 3 — durable bounds-replay).
// When index.html was just (re)written from mechanical (created OR --force
// overwrote), replay the persisted actuator-recipe.json — if any — over it.
// This deterministically restores the actuated state without re-dispatching
// any subagent. If `find`s no longer match, warnings flag the passes that
// need re-actuation. No recipe → silent.
if (idxAction !== 'preserved') {
  const recipePath = join(outDir, 'actuator-recipe.json');
  const recipe = readRecipe(recipePath);
  if (recipe) {
    const current = readFileSync(idxPath, 'utf8');
    const { html: replayed, warnings } = applyRecipe(current, recipe);
    if (replayed !== current) {
      writeFileSync(idxPath, replayed, 'utf8');
    }
    const passes = new Set(recipe.edits.map((e) => e.pass));
    console.log(
      `\nActuator recipe replayed: ${recipe.edits.length} edit(s) applied across ${passes.size} pass(es); ${warnings.length} warning(s).`,
    );
    for (const w of warnings) console.log(`  warn: ${w}`);

    // Task 7 — instruction-snapshot drift check.
    // For each pass with a stored snapshot, recompose the current baseline
    // instruction (from passes.ts) and diff against the snapshot. If they
    // differ, flag the pass for re-decide rather than blind replay — the
    // steering that shaped the original decision has changed.
    if (recipe.snapshots && recipe.snapshots.length > 0) {
      const passByName = new Map(judgmentPasses.map((p) => [p.name, p]));
      const drift: Array<{ pass: string; reason: string }> = [];
      for (const snap of recipe.snapshots) {
        const pass = passByName.get(snap.pass);
        if (!pass) {
          drift.push({ pass: snap.pass, reason: 'pass no longer registered in passes.ts' });
          continue;
        }
        if (pass.instruction !== snap.instructionSnapshot) {
          drift.push({
            pass: snap.pass,
            reason:
              `baseline instruction changed since decision (${snap.decidedAt}) — ` +
              `steering (playbook / rail bounds / brief) was edited`,
          });
        }
      }
      if (drift.length === 0) {
        console.log(`  instruction-snapshot drift check: clear (${recipe.snapshots.length} pass(es) match).`);
      } else {
        console.log(`  instruction-snapshot drift: ${drift.length} pass(es) need RE-DECIDE:`);
        for (const d of drift) console.log(`      - ${d.pass}: ${d.reason}`);
      }
    }
  }
}

// WP1.E.2 item 6 — env-gated rendered responsive measurement.
// Opens the FINAL index.html in headless Chromium at three viewports and
// reports overflow as `responsive-need:rendered:overflow:…` findings.
// Reporting-only — these findings do NOT participate in the score
// (static responsive-need already covers the bucketing). Silently skipped
// when OFFSCRIPT_PLAYWRIGHT !== '1'.
if (isRenderedGateEnabled()) {
  const finalHtml = readFileSync(idxPath, 'utf8');
  let renderedFindings: Finding[] = [];
  let skipped = false;
  let skipReason = '';
  try {
    renderedFindings = await measureOverflowsAsync(finalHtml);
  } catch (err) {
    skipped = true;
    skipReason = err instanceof Error ? err.message.split('\n')[0] : String(err);
  }

  console.log(`\nRendered responsive measurement (Playwright, 360 / 768 / 1440):`);
  if (skipped) {
    console.log(
      `  Skipped — rendered measurement failed: ${skipReason}. ` +
        `(If Chromium is not installed, run 'npx playwright install chromium'.)`,
    );
  } else if (renderedFindings.length === 0) {
    console.log(`  clear — no overflow at any viewport`);
  } else {
    console.log(`  ${renderedFindings.length} finding(s):`);
    const sample = renderedFindings.slice(0, 12);
    for (const f of sample) console.log(`      - (${f.outcome}) ${f.description}`);
    if (renderedFindings.length > sample.length) {
      console.log(`      … and ${renderedFindings.length - sample.length} more`);
    }
  }

  // Persist deterministically (sorted by id; idempotent content-compare write).
  const sortedForDisk = [...renderedFindings].sort((a, b) => a.id.localeCompare(b.id));
  const renderedPath = join(outDir, 'rendered-responsive.json');
  const payload = JSON.stringify(
    {
      viewports: [360, 768, 1440],
      findings: sortedForDisk,
    },
    null,
    2,
  ) + '\n';
  let shouldWrite = true;
  if (existsSync(renderedPath)) {
    try {
      const existing = readFileSync(renderedPath, 'utf8');
      if (existing === payload) shouldWrite = false;
    } catch {
      // fall through and overwrite
    }
  }
  if (shouldWrite) writeFileSync(renderedPath, payload, 'utf8');
  console.log(`  → ${renderedPath}`);
}

// M2 Task 10 — tear down the shared render runtime at exit. Safe to call when
// the runtime never launched (no-op). All async work above is awaited; nothing
// races with this close.
if (renderRuntime) {
  await renderRuntime.close();
}

/**
 * Resolve the live HTML to compare against, per Task 10 spec:
 *  - `--live-url <url>` CLI flag → fetchLiveHtml(url) (Scrapling)
 *  - `<kitDir>/.kit-vs-live.json` with `{ cachedHtmlPath?, url? }` →
 *    cachedHtmlPath wins (offline-friendly), else fetch the url.
 *  - Neither → undefined (kit-vs-live skips, emits zero findings).
 */
async function resolveLiveHtml(
  kitDir: string,
  urlArg: string | undefined,
): Promise<string | undefined> {
  if (urlArg) {
    try {
      return await fetchLiveHtml(urlArg);
    } catch (err) {
      console.log(
        `  kit-vs-live: fetch failed (${(err as Error).message.split('\n')[0]}) — skipping`,
      );
      return undefined;
    }
  }
  const cfgPath = join(kitDir, '.kit-vs-live.json');
  if (!existsSync(cfgPath)) return undefined;
  let cfg: { url?: string; cachedHtmlPath?: string };
  try {
    cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { url?: string; cachedHtmlPath?: string };
  } catch {
    return undefined;
  }
  if (cfg.cachedHtmlPath) {
    const p = resolve(kitDir, cfg.cachedHtmlPath);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  if (cfg.url) {
    try {
      return await fetchLiveHtml(cfg.url);
    } catch (err) {
      console.log(
        `  kit-vs-live: fetch failed (${(err as Error).message.split('\n')[0]}) — skipping`,
      );
    }
  }
  return undefined;
}
