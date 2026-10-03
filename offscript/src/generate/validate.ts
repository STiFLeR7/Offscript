/**
 * Stage 4 — CR-validate: validate(html, context, opts) → ValidateResult
 *
 * A thin wrapper over the harden-tail machinery (see scripts/harden.ts §164–372)
 * applied to a GENERATED (not pasted) artifact. The rails never author; generate
 * never skips the rails — this stage enforces the "generate within rails" invariant.
 *
 * CIRCULAR-PROOF NOTE (carry forward — do not erase):
 *   When driven by defaultScriptedAuthor(), the authored body is var()-only, which is
 *   systematic by construction. However, the full-document score is NOT ≈1.0 — the
 *   house CSS introduces warnings (brand-fidelity-scan, accent-saturation-budget) that
 *   land in the denominator, and residual token-normalize/font-fidelity auto-remediated
 *   findings count as tier0 detect-residual. Measured: ~0.57 on the scripted path.
 *   That is a pipeline smoke-test, NOT proof the engine generates on-brand work. The
 *   non-circular ratio proof must come from the in-session LLM-authored artifact,
 *   which can make off-brand choices the governance rails actually catch.
 *
 * Architecture:
 *   - Builds an OperatorContext from context.tokens + context.brandContract.
 *   - Runs every operator's detect via runGate — same residual loop as harden.ts.
 *   - Folds render-rail async results when OFFSCRIPT_PLAYWRIGHT=1 + canLaunchRuntime().
 *     Track-branched: website → shorthand-sanity/overflow-bounds/visibility-floor
 *     (kit-vs-live excluded — no live URL); collateral → a4-bounds/text-overlap/page-wrap
 *     at A4_VIEWPORT. The gate-off path prints one skip note — no findings, no impact.
 *   - Scores via scoreFindingsByRail (applied: [] — generation authored directly,
 *     no mechanical apply step ran; the numerator comes from residual auto-remediated).
 *   - Freezes escalated findings to overlay/.
 *   - Writes score.json to outDir.
 *   - Returns ValidateResult { score, frozen, perRail }.
 */

import { join, relative } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { repoRoot } from '../paths.js';
import { loadGovernanceVersion, writeManifest } from './governance-version.js';
import { registryForTrack } from '../operators/index.js';
import { renderOperators } from '../operators/render/index.js';
import { a4Bounds } from '../operators/collateral/render/a4-bounds.js';
import { textOverlap } from '../operators/collateral/render/text-overlap.js';
import { pageFill } from '../operators/collateral/render/page-fill.js';
import { buildOperatorContext } from '../operator-context.js';
import { parseHtml } from '../working-rep.js';
import { runGate } from '../gate.js';
import { scoreFindingsByRail, writeScore } from '../score.js';
import { freezeEscalatedFindings } from '../freeze-wiring.js';
import { canLaunchRuntime, RenderRuntime, A4_VIEWPORT } from '../render-runtime.js';
import { collectRail } from '../render-probe.js';
import type { Finding, Operator, OperatorContext } from '../operator.js';
import type { RunScore } from '../score.js';
import type { WroteOverlay } from '../freeze-wiring.js';
import type { AuthoringPlan, DesignContext } from './types.js';

// ── Render-rail name to exclude on the generate path ─────────────────────────
// kit-vs-live needs a live URL to compare against; the generate path has none.
const KIT_VS_LIVE_NAME = 'kit-vs-live';

/**
 * Render rails validate folds in — derived from the canonical `renderOperators`
 * source (NOT a hand-maintained literal list), minus kit-vs-live. Deriving from
 * the registry means an operator `.name` rename can't silently drop a rail from
 * scoring (a string-literal duplicate would, and tsc can't catch that drift).
 */
const VALIDATE_RENDER_RAIL_NAMES = new Set(
  renderOperators.map((op) => op.name).filter((n) => n !== KIT_VS_LIVE_NAME),
);

/**
 * Collateral render-rail names that gate the A4 render tier — derived from
 * the canonical operator objects (a4Bounds, textOverlap) so a `.name` rename
 * can't silently drop a rail. `page-wrap` has no operator object in the
 * collateral registry (it takes RenderRuntime, not RenderContext) and is
 * always run alongside; it uses the literal string only in the invocation list
 * below, not as a gate-set member.
 */
const COLLATERAL_RENDER_RAIL_NAMES = new Set([a4Bounds.name, textOverlap.name, pageFill.name]);

export interface ValidateOptions {
  /** absolute path to the working dir for this client+track (receives score.json + overlay/) */
  outDir: string;
  /** E2 — execution provenance (which author contract produced the artifact); passed
   *  through to the RunScore (score.json). Observability only; never in ratio math. */
  authorMode?: string;
}

export interface ValidateResult {
  score: RunScore;
  frozen: WroteOverlay[];
  perRail: Array<{ operator: Operator; findings: Finding[] }>;
}

/**
 * E1 — project the authoritative planner model onto the operator-context shape the
 * rails already know how to read. Each PlanItem carries its SectionAnchor (for
 * generated sections `anchor === id`, so resolveAnchor matches the stamped element id)
 * and its archetype. archetype-tag reads `sections` (anchor resolution + ordering) and
 * `params.declared` (id → archetype, declared-wins-inference) when present, else it
 * DOM-walks and infers. Supplying this IS the reconnected planning→validation edge:
 * validation judges the stamped model instead of re-inferring it.
 */
/**
 * W50 Track 4 — the geometry-unvalidated finding. When render rails were expected but did not run,
 * a clean score must never be read as "geometry verified". If geometry was REQUIRED (the operator
 * set `OFFSCRIPT_PLAYWRIGHT=1` — a production run) but could not be validated, this is an ESCALATION
 * (production gate: the run cannot certify geometry). If geometry was NOT required (flag unset —
 * the dev/test default), it stays a WARNING, so the default no-Playwright flow is byte-identical.
 */
export function geometryUnvalidatedFinding(geometryRequired: boolean): Finding {
  return {
    id: 'geometry-unvalidated:render-skipped',
    description: geometryRequired
      ? 'Geometry validation was REQUIRED (OFFSCRIPT_PLAYWRIGHT=1) but the render rails (a4-bounds / ' +
        'text-overlap / page-wrap / responsive overflow) could not run — overflow, overlap and ' +
        'page-count are UNVALIDATED. This run cannot certify geometry (install chromium: ' +
        "'npx playwright install chromium')."
      : 'Render rails (a4-bounds / text-overlap / page-wrap) did not run — overflow, overlap and ' +
        'page-count are UNVALIDATED. A clean score does not certify geometry; enable ' +
        'OFFSCRIPT_PLAYWRIGHT=1 to validate.',
    outcome: geometryRequired ? 'escalated' : 'warning',
  };
}

export function planOperatorModel(plan: AuthoringPlan): Partial<OperatorContext> {
  const sections = plan.items.map((item) => item.anchor);
  const declared: Record<string, string> = {};
  for (const item of plan.items) declared[item.anchor.id] = String(item.archetype);
  return {
    sections: { sections, byId: new Map(sections.map((s) => [s.id, s] as const)) },
    params: { declared },
  };
}

/**
 * Run the governance rail set against the generated HTML artifact.
 *
 * `applied` is always [] on the generate path — no mechanical apply step ran;
 * the systematic-ratio numerator here comes from residual auto-remediated findings.
 * On the scripted path this scores ~0.57 (measured), NOT ≈1.0 — the scripted author
 * leaves real rail gaps (see circular-proof note in the module header); the smoke
 * path is not the on-brand proof. A meaningful ratio requires the LLM-authored artifact.
 */
export async function validate(
  html: string,
  context: DesignContext,
  opts: ValidateOptions,
  plan?: AuthoringPlan,
): Promise<ValidateResult> {
  const { outDir } = opts;

  // ── Build operator context ───────────────────────────────────────────────────
  // E1: when the planner model is supplied, project it onto the context so the rails
  // consume the stamped sections + archetypes (declared-wins-inference) instead of
  // re-inferring them. Absent plan → unchanged behaviour (DOM-walk + infer).
  // W77 — this IS the colors/typography/spacing/motion Brand Kit consumption site (W75 §2.1):
  // context.tokens/context.brandContract are populated once by resolveBrandContract's client-first
  // override precedence (buildContext, generate/context.ts) — the single existing mechanism W75
  // proved already exists for this domain. context.brandKit (W76) deliberately carries none of this
  // data (logo/imagery/icon/voice only) — there is no separate "Brand Kit" field for this line to
  // read instead. See docs/internals/SPRINT-W77-BRAND-KIT-CONSUMPTION.md §1.
  const registry = registryForTrack(context.track);
  const ctx = buildOperatorContext({
    tokens: context.tokens,
    brandContract: context.brandContract ?? undefined,
    ...(plan ? { extra: planOperatorModel(plan) } : {}),
  });
  const tree = parseHtml(html);

  // ── Residual detect gate (mirrors harden.ts §164–192) ────────────────────────
  // Run every operator's detect; collect per-rail findings. This is the same
  // "residual judgment gaps" loop harden uses after mechanical apply.
  const perRail: Array<{ operator: Operator; findings: Finding[] }> = [];
  for (const [, op] of registry) {
    const findings = runGate(tree, ctx, [op]);
    perRail.push({ operator: op, findings });
  }

  // ── Render-aware rails (gated — track-branched) ──────────────────────────────
  // Gate: OFFSCRIPT_PLAYWRIGHT=1 env + canLaunchRuntime() (imports playwright).
  // Track switch: website → render-shorthand-sanity / render-overflow-bounds /
  //   render-visibility-floor (kit-vs-live excluded — no live URL on generate path).
  //   collateral → a4-bounds / text-overlap / page-wrap at A4_VIEWPORT.
  //
  // CIRCULAR-PROOF NOTE: even with render rails, the scripted artifact scores clean
  // by construction. Meaningful render-rail results require the LLM-authored path.
  const isWebsite = context.track === 'website';
  const hasWebsiteRenderRail = isWebsite && [...registry.keys()].some((n) => VALIDATE_RENDER_RAIL_NAMES.has(n));
  const hasCollateralRenderRail = !isWebsite && context.track === 'collateral' && [...registry.keys()].some((n) => COLLATERAL_RENDER_RAIL_NAMES.has(n));
  const hasRenderRail = hasWebsiteRenderRail || hasCollateralRenderRail;
  let renderRuntime: RenderRuntime | undefined;

  if (hasRenderRail && (await canLaunchRuntime())) {
    try {
      if (hasWebsiteRenderRail) {
        renderRuntime = await RenderRuntime.launch();
        await runWebsiteRenderRails(renderRuntime, html, tree, registry, perRail);
      } else {
        renderRuntime = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
        await runCollateralRenderRails(renderRuntime, html, tree, registry, perRail);
      }
    } catch (err) {
      console.log(
        `  [Stage 4] Render rails skipped — runtime failure: ${(err as Error).message.split('\n')[0]}`,
      );
    } finally {
      if (renderRuntime) {
        await renderRuntime.close();
        renderRuntime = undefined;
      }
    }
  } else if (hasRenderRail) {
    console.log(
      `  [Stage 4] ⚠ GEOMETRY UNVALIDATED — render rails skipped (no Playwright runtime).`,
    );
    console.log(
      `             a4-bounds / text-overlap / page-wrap did NOT run; overflow, overlap & page-count are UNCHECKED.`,
    );
    // W50 Track 4 — if geometry was REQUIRED (the operator asked via OFFSCRIPT_PLAYWRIGHT=1) but the
    // runtime could not launch, this ESCALATES — a production score can never imply geometry was
    // verified when it was not. Flag unset (dev/test default) ⇒ warning ⇒ byte-identical.
    const geometryRequired = process.env.OFFSCRIPT_PLAYWRIGHT === '1';
    console.log(
      geometryRequired
        ? `             Geometry was REQUIRED (OFFSCRIPT_PLAYWRIGHT=1) but could not run — this run FAILS geometry certification.`
        : `             A clean score here does NOT certify geometry. Set OFFSCRIPT_PLAYWRIGHT=1 + 'npx playwright install chromium'.`,
    );
    // Record the blind spot in the score itself so a static 1.0 is never read as
    // geometrically clean. Escalates under the production gate; warns otherwise.
    perRail.push({
      operator: {
        name: 'geometry-unvalidated',
        // tier 2 so an escalation counts as a true architectural/quality defect under W29's bucketing.
        tier: geometryRequired ? 2 : 0,
        detect: () => [],
        apply: () => [],
      } as Operator,
      findings: [geometryUnvalidatedFinding(geometryRequired)],
    });
  }

  // ── Score ────────────────────────────────────────────────────────────────────
  // applied: [] — generation authored directly; no mechanical apply step ran.
  // The systematic-ratio here is computed from residual auto-remediated findings
  // only. On the scripted path this measures ~0.57 (NOT ≈1.0 — see circular-proof
  // note above), dragged by house-CSS warnings in the denominator. It is a
  // smoke-test, NOT the headline ratio proof.
  // ── Fix D — record which house-governance version this run authored against ──
  // FAIL-SOFT (never throws): a missing/garbled marker degrades to "unversioned"
  // + a warning. Reads the SAME file the author reads (resolveBrandContract +
  // colors_and_type.css). Pure observability — never enters ratio math, never
  // touches markup.
  const gv = loadGovernanceVersion(context.client, context.track);
  if (gv.warning) console.log('  [Stage 4] ' + gv.warning);

  const score = scoreFindingsByRail({
    subject: outDir,
    applied: [],
    perRail,
    governanceVersion: gv.version,
    authorMode: opts.authorMode,
  });
  const scorePath = join(outDir, 'score.json');
  mkdirSync(outDir, { recursive: true });
  writeScore(scorePath, score);

  // Per-run provenance manifest, written beside score.json. Shares score.generatedAt
  // so manifest + score carry one timestamp. governanceCssPath is repo-relative.
  writeManifest(outDir, {
    client: context.client,
    track: context.track,
    generatedAt: score.generatedAt,
    governanceVersion: gv.version,
    governanceCssPath: relative(repoRoot, gv.cssPath).replace(/\\/g, '/'), // POSIX-normalized so the manifest is cross-platform deterministic
    warnings: gv.warning ? [gv.warning] : [],
    // Opaque upstream provenance from the brief (audit-only; never interpreted).
    // Conditionally spread so a brief without provenance yields a byte-identical manifest.
    ...(context.brief.provenance ? { provenance: context.brief.provenance } : {}),
  });

  // ── Freeze escalations ───────────────────────────────────────────────────────
  const overlayDir = join(outDir, 'overlay');
  const frozen = freezeEscalatedFindings({
    overlayDir,
    perRail,
    decidedBy: 'offscript-generate:v1',
    snapshotHtml: html,
  });

  return { score, frozen, perRail };
}

// ── Internal: run website render rails over the generated html ───────────────
// Separated to keep the main `validate` function readable. Mutates `perRail`
// in place (replaces the empty sync-detect entry, as harden.ts §258–264 does).
async function runWebsiteRenderRails(
  runtime: RenderRuntime,
  html: string,
  tree: import('hast').Root,
  registry: import('../operators/index.js').OperatorRegistry,
  perRail: Array<{ operator: Operator; findings: Finding[] }>,
): Promise<void> {
  // Lazy-import the three async render-rail detectors (same as harden.ts §43–46)
  // alongside their operator objects, so the rail name keys off each operator's
  // canonical `.name` rather than a hand-typed literal (no string-literal drift).
  // kit-vs-live is intentionally excluded (no live URL on the generate path).
  const [shorthand, overflow, visibility, fillFocal, respRendered] = await Promise.all([
    import('../operators/render/render-shorthand-sanity.js'),
    import('../operators/render/render-overflow-bounds.js'),
    import('../operators/render/render-visibility-floor.js'),
    import('../operators/render/website-fill-focal.js'),
    import('../operators/responsive-need-rendered.js'),
  ]);

  const rctx = await runtime.loadHtml(html);

  // Each rail runs in isolation (collectRail) so one rail's probe failure degrades
  // only that rail to a probe-error warning — it never discards a sibling rail's
  // already-computed findings (I-3). Sequential: one shared page, ordered access.
  const renderResults: Array<{ name: string; findings: Finding[] }> = [];
  renderResults.push(
    await collectRail(shorthand.renderShorthandSanity.name, () =>
      shorthand.detectShorthandFailuresAsync(rctx, tree),
    ),
  );
  renderResults.push(
    await collectRail(overflow.renderOverflowBounds.name, () =>
      overflow.detectOverflowBoundsAsync(rctx, tree),
    ),
  );
  renderResults.push(
    await collectRail(visibility.renderVisibilityFloor.name, () =>
      visibility.detectVisibilityFloorAsync(rctx, tree),
    ),
  );
  renderResults.push(
    await collectRail(fillFocal.websiteFillFocal.name, () =>
      fillFocal.detectWebsiteFillFocalAsync(rctx, tree),
    ),
  );
  // W50 Track 4 — rendered horizontal-overflow at mobile/tablet/desktop (360/768/1440). Previously
  // available only via a standalone script, so website mobile overflow (fixed-width bands) shipped
  // UNVALIDATED even under Playwright (the other rails run desktop-only). Self-launches its own
  // multi-viewport probe and self-gates (returns [] when the rendered gate is off).
  renderResults.push(
    await collectRail(respRendered.responsiveNeedRendered.name, () =>
      respRendered.measureOverflowsAsync(html),
    ),
  );

  for (const { name, findings } of renderResults) {
    const op = registry.get(name);
    if (!op) {
      // Rail not yet registered — surface count but skip score attribution
      // (mirrors harden.ts §248–256).
      if (findings.length > 0) {
        console.log(
          `  [Stage 4] ${name}: ${findings.length} finding(s) (registry edit pending — not folded into score)`,
        );
      }
      continue;
    }
    // Replace the sync-detect (empty) entry so per-rail attribution isn't doubled
    // (mirrors harden.ts §261–264).
    const existingIdx = perRail.findIndex((e) => e.operator.name === name);
    if (existingIdx >= 0) {
      perRail[existingIdx] = { operator: op, findings };
    } else {
      perRail.push({ operator: op, findings });
    }
  }
}

// ── Internal: run collateral A4 render rails (a4-bounds / text-overlap / page-wrap)
// Mirrors scripts/harden-collateral.ts §75–112. Runtime must be launched at
// A4_VIEWPORT. page-wrap takes the runtime directly (not a RenderContext) because
// it needs loadHtmlForPrint. When page-wrap is not in the collateral registry (it
// has no Operator object), a synthetic tier-1 stub is used for score attribution —
// exactly as harden-collateral.ts does for unregistered rails.
async function runCollateralRenderRails(
  runtime: RenderRuntime,
  html: string,
  tree: import('hast').Root,
  registry: import('../operators/index.js').OperatorRegistry,
  perRail: Array<{ operator: Operator; findings: Finding[] }>,
): Promise<void> {
  const [{ detectA4BoundsAsync }, { detectTextOverlapAsync }, { detectPageWrapAsync }, { detectPageFillAsync }] =
    await Promise.all([
      import('../operators/collateral/render/a4-bounds.js'),
      import('../operators/collateral/render/text-overlap.js'),
      import('../operators/collateral/render/page-wrap.js'),
      import('../operators/collateral/render/page-fill.js'),
    ]);

  const rctx = await runtime.loadHtml(html);

  // Per-rail isolation (I-3): a probe failure in one rail degrades only that rail.
  const renderResults: Array<{ name: string; findings: Finding[] }> = [];
  renderResults.push(await collectRail('a4-bounds', () => detectA4BoundsAsync(rctx, tree)));
  renderResults.push(await collectRail('text-overlap', () => detectTextOverlapAsync(rctx, tree)));
  renderResults.push(await collectRail('page-wrap', () => detectPageWrapAsync(runtime, html)));
  renderResults.push(await collectRail('page-fill', () => detectPageFillAsync(rctx, tree)));

  for (const { name, findings } of renderResults) {
    const op = registry.get(name);
    // page-wrap has no registered Operator object — synthesize a tier-1 stub so
    // findings are attributed (mirrors harden-collateral.ts §87–97).
    const entry: { operator: Operator; findings: Finding[] } = op
      ? { operator: op, findings }
      : {
          operator: { name, tier: 1 as const, detect: () => [], apply: () => [] },
          findings,
        };
    if (!op && findings.length > 0) {
      console.log(
        `  [Stage 4] ${name}: ${findings.length} finding(s) (no registry entry — attributed via synthetic stub)`,
      );
    }
    const existingIdx = perRail.findIndex((e) => e.operator.name === name);
    if (existingIdx >= 0) {
      perRail[existingIdx] = entry;
    } else {
      perRail.push(entry);
    }
  }
}
