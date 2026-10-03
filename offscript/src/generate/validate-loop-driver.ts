/**
 * P03 — Platform Harness Consumption: the Validate + Metrics + Report driver.
 *
 * A MECHANICAL extraction of scripts/generate.ts's former inline `runValidateLoop`
 * (Stage 4 — CR-validate). No validation ALGORITHM changed: this is the exact same
 * body — runReauthorLoop, composeRunHealth, formatRunHeadline, the readiness/critic
 * signal wiring — moved verbatim into an importable, independently-testable module.
 * Two deliberate differences from the inline version, both orchestration-only:
 *
 *   1. Free variables the inline function closed over (`outDir`, `useSubagent`, and
 *      the Stage-3 `author` default-fallback closure) are now explicit, REQUIRED
 *      options — no hidden module-scope reads, no implicit default author. The
 *      caller (scripts/generate.ts) now always passes its own author closure at
 *      both call sites (website AND collateral) — previously only the website call
 *      site did; the collateral call site relied on an internal `opts.author ??
 *      (...)` fallback. Passing the same closure explicitly is behaviourally
 *      identical (same function, same closed-over `authoringPlan`/`context`) —
 *      only now visible at the call site instead of hidden inside this function.
 *
 *   2. It RETURNS a `HarnessReportResult` ({status, formatted}) — the Report-stage
 *      transport type P02's platform-harness.ts already defined but nothing
 *      consumed — instead of discarding the computed RunHeadline. This is the value
 *      scripts/generate.ts needs to populate the final HarnessRunResult's
 *      `headlineStatus` field; before P03 this information was printed to the
 *      console and then thrown away.
 *
 * This module reuses ONLY existing engine functions (runReauthorLoop, validate,
 * composeRunHealth, fidelitySignals, evaluateReadiness, intentReadinessSignals,
 * intentCriticSignals, formatRunHeadline, signalsFromPerRail) — it authors no new
 * validation, metrics, or reporting logic.
 *
 * P05 — DESIGNER DOCTOR CONSUMPTION: this is the "lowest common consumer" seam
 * (P05 investigation) — the ONE place both tracks (website AND collateral) already
 * funnel through after Validate+Metrics complete, so it is where Doctor is wired
 * rather than at scripts/generate.ts's two separate call sites. After composing
 * `health` (unchanged — the SAME composeRunHealth call this module has run since
 * P03), `buildDoctorReport` (src/doctor/doctor-report.ts, UNMODIFIED since P04)
 * consumes it VERBATIM alongside the SAME `result.finalOutcome.perRail` this
 * function already had, and the durable overlay state read back via
 * `readOverlay` (overlay.ts's own reader — the entries were already written by
 * `freezeEscalatedFindings` inside `validate()` above; this reads them back
 * rather than adapting the narrower `WroteOverlay[]` `validate()` returns, which
 * lacks `pass`/`decidedAt`/`decidedBy`). Zero recomputation: no rail runs again,
 * no score is rebuilt. The resulting DoctorReport is persisted to
 * `<outDir>/doctor-report.json` — additive only; it changes no returned value,
 * no HTML byte, and no score.json byte.
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runReauthorLoop } from './reauthor-loop.js';
import type { ReauthorLoopEvent, ValidateOutcome } from './reauthor-loop.js';
import { validate } from './validate.js';
import { formatScoreReport } from '../score.js';
import { formatRunHeadline, signalsFromPerRail } from '../run-headline.js';
import { fidelitySignals, composeRunHealth } from './source-fidelity.js';
import { evaluateReadiness, loadFormTerms } from './intent-readiness.js';
import { intentReadinessSignals } from './intent-signal.js';
import { intentCriticSignals, defaultScriptedCritic } from './intent-critic.js';
import { formTermsPath } from '../paths.js';
import { readOverlay } from '../overlay.js';
import { buildDoctorReport } from '../doctor/doctor-report.js';
import { writeDoctorReport } from '../doctor/doctor-report-io.js';
import { buildReviewReport, renderReviewReport } from '../doctor/review-report.js';
import { writeReviewReport, writeReviewReportMarkdown } from '../doctor/review-report-io.js';
import type { ReviewPackageInput, ReviewPackage } from '../doctor/review-package.js';
import { writeReviewPackage, writeValidationSummary } from '../doctor/review-package-io.js';
import { readWorldABuildIdentity } from '../doctor/world-a-identity.js';
import type { Finding } from '../operator.js';
import type { AuthoringPlan, DesignContext } from './types.js';
import type { HarnessReportResult } from '../platform-harness.js';

/** Provisional target ratio — see the module-level note this carried in scripts/generate.ts
 *  before extraction: empirical stand-in, NOT met on the scripted path (~0.57 measured);
 *  the no-progress guard terminates the loop there, not this target. */
const TARGET_SYSTEMATIC_RATIO = 0.8;

/** Max regenerate loop passes — see the same provisional note. */
const MAX_PASSES = 2;

/**
 * G2-S1 — the review-package builder the ORCHESTRATION layer injects. It owns EXECUTION IDENTITY: a
 * native run sources `client`/`track` from the GenerationContract (`nativeReviewPackage`); a legacy run
 * sources them from the compatibility bridge. This driver assembles only the run-owned inputs (the
 * `Omit<ReviewPackageInput, 'client' | 'track'>` surface) and DELEGATES — it no longer originates
 * execution identity (that boundary moved to the contract). World-B purity: the native driver is a
 * closure passed in from `scripts/generate.ts`; this module imports nothing from `src/project`.
 */
export type ReviewPackageBuilder = (runtime: Omit<ReviewPackageInput, 'client' | 'track'>) => ReviewPackage;

export interface ValidateLoopDriverOptions {
  outDir: string;
  /** true when the in-session subagent author is active (E2 provenance stamp, website only). */
  useSubagent: boolean;
  /** the re-author callback — REQUIRED (P03 removed the implicit collateral-path default). */
  author: (findingsByItem?: Map<string, Finding[]>) => Promise<{ html: string; warnings: string[] }>;
  /** the review-package builder — REQUIRED (G2-S1: identity comes from here, not from `context`). */
  reviewPackageBuilder: ReviewPackageBuilder;
  /** fold the WS7 curation gate into each validate pass (website only; default → no gate). */
  gateFold?: (html: string, base: ValidateOutcome) => ValidateOutcome;
  /** transform the accepted page before the final write (website → WS8 flatten; default → identity). */
  postProcess?: (html: string) => { html: string; warnings: string[] };
  /**
   * Deliverable Naming — the deployable's own filename, resolved ONCE per run by
   * `resolveDeliverableFilename` (brand-slug, auto-versioned). Defaults to `'index.html'` so any
   * caller that hasn't opted in stays byte-identical to before this option existed.
   */
  deliverableFilename?: string;
}

/**
 * Stage 4: CR-validate (live — generate never skips the rails), plus the W2-S4 run-health
 * composition and headline report. Verbatim body from scripts/generate.ts's former
 * runValidateLoop — see the module header for what changed (nothing algorithmic).
 */
export async function runValidateAndReport(
  initialHtml: string,
  authoringPlan: AuthoringPlan,
  context: DesignContext,
  opts: ValidateLoopDriverOptions,
): Promise<HarnessReportResult> {
  const { outDir, useSubagent, author } = opts;
  const scorePath = join(outDir, 'score.json');
  const idxPath = join(outDir, opts.deliverableFilename ?? 'index.html');

  const onEvent = (e: ReauthorLoopEvent): void => {
    switch (e.kind) {
      case 'pass-start':
        console.log(`\n[Stage 4] CR-validate — pass ${e.pass}/${e.maxPasses}`);
        break;
      case 'validated':
        console.log(`\nScore written: ${scorePath}\n`);
        console.log(formatScoreReport(e.score));
        if (e.frozen.length === 0) {
          console.log(`\nFrozen 0 region(s) — no escalated findings`);
        } else {
          console.log(`\nFrozen ${e.frozen.length} region(s) → ${join(outDir, 'overlay')}/`);
          for (const w of e.frozen) {
            console.log(`  ${w.frozenId} (${w.findingIds.length} finding(s)) → ${w.overlayPath}`);
          }
        }
        break;
      case 'goal-met':
        console.log(
          `\n[Stage 4] Goal met — ratio ${e.ratio.toFixed(4)} ≥ ${TARGET_SYSTEMATIC_RATIO}, 0 frozen regions.`,
        );
        break;
      case 'max-passes':
        console.log(
          `\n[Stage 4] Max passes (${MAX_PASSES}) reached — ratio=${e.ratio.toFixed(4)}, frozen=${e.frozen}.`,
        );
        break;
      case 'reauthoring':
        console.log(
          `\n[Stage 4] Re-authoring (pass ${e.pass}) — goal not yet met. ` +
            `${e.offenderIds.length} offending item(s), ${e.itemFindingCount} section-attributed ` +
            `finding(s) fed back as priorFindings` +
            (e.offenderIds.length > 0 ? `: ${e.offenderIds.join(', ')}` : '') +
            `. (Document-global brand findings are not item-targeted — deferred to the ` +
            `in-session LLM contract; the scripted author ignores priorFindings, so the ` +
            `no-progress guard will stop it.)`,
        );
        break;
      case 'no-progress':
        console.log(
          `\n[Stage 4] No-progress guard: re-authored html is identical — stopping loop. ` +
            `(Scripted author is deterministic; real progress requires the LLM-authored path.)`,
        );
        break;
      case 'guard-rejected':
        console.log(
          `\n[Stage 4] Governance guard rejected the re-author — slop=${e.slop}, drift=${e.drift}. ` +
            `Keeping the prior-pass document (a "fix" must not trade a finding for new slop or ` +
            `drop a section — better, not different).`,
        );
        break;
      case 'advanced':
        // The accepted candidate is held in-memory by the loop core and persisted
        // once after the loop returns (result.html). Intermediate validate passes
        // operate on that in-memory html — no per-pass disk write is needed.
        for (const w of e.warnings) console.warn(`  [Stage 4] re-author warning: ${w}`);
        console.log(
          `\n[Stage 4] Candidate accepted (pass ${e.pass}, ${e.bytes.toLocaleString()} bytes) — re-validating.`,
        );
        break;
    }
  };

  // ── Stage 4 validate callback ────────────────────────────────────────────────
  // Collateral: plain rail validate. Website (WS9b): the same rails PLUS the WS7 in-process
  // curation gate folded in (gateFold), so a constitution-by-selection page is held to the
  // anti-slop / provenance axis (the gate verdict feeds goalMet via outcome.gate.pass).
  const validateFor = async (html: string): Promise<ValidateOutcome> => {
    // E1: feed the authoritative planner model so the rails consume the stamped
    // sections + archetypes instead of re-inferring them. Website-only — archetype-tag
    // (the sole consumer of sections/declared) is website-registry-only; gating keeps
    // the collateral context byte-identical (track isolation).
    const planModel = context.track === 'website' ? authoringPlan : undefined;
    // E2: stamp execution provenance (which author contract produced the artifact) into
    // the score. Website-gated like E1 — keeps the collateral score byte-identical.
    const authorMode = context.track === 'website' ? (useSubagent ? 'subagent' : 'scripted') : undefined;
    const base = await validate(html, context, { outDir, authorMode }, planModel);
    return opts.gateFold ? opts.gateFold(html, base) : base;
  };

  const result = await runReauthorLoop({
    initialHtml,
    plan: authoringPlan,
    context,
    author,
    validate: validateFor,
    targetRatio: TARGET_SYSTEMATIC_RATIO,
    maxPasses: MAX_PASSES,
    onEvent,
  });

  // WS9b: website → WS8 flatten the accepted multi-file page into the self-contained
  // deployable before the final write; collateral → identity (already self-contained).
  const finalArtifact = opts.postProcess
    ? opts.postProcess(result.html)
    : { html: result.html, warnings: [] as string[] };
  for (const w of finalArtifact.warnings) console.warn(`  [Stage 4] post-process warning: ${w}`);

  // Persist the final accepted (post-processed) html (idempotent if unchanged).
  writeFileSync(idxPath, finalArtifact.html, 'utf8');
  console.log(
    `\n[Stage 4] Loop stopped: ${result.stoppedBy} after ${result.passes} pass(es). ` +
      `Final: ${idxPath} (${Buffer.byteLength(finalArtifact.html, 'utf8').toLocaleString()} bytes).`,
  );

  // ── W2-S4: live run health — fidelity signals + W1 composition (observability) ──
  // The first live producer of Source Fidelity signals, composed through the W1
  // substrate. fidelitySignals turns the plan's W2-S3 accounting into objective
  // signals (G1–G4 Failures + the two approved Warnings); signalsFromPerRail routes
  // the rails' findings through the same outcome→authority bridge. composeRunHealth
  // emits BOTH through ONE ledger (the single delivery surface — no perRail bypass),
  // runs the severed-path meta-check LIVE, and builds the headline from the delivered
  // set. This closes the W1-closure-audit seam: status now comes from the ledger.
  // goalMet + systematicRatio stay SEPARATE axes, carried verbatim. LOUD-MARK: a
  // FAILED headline never terminates — the run has already completed cleanly here.
  const fidelity = authoringPlan.accounting
    ? fidelitySignals(authoringPlan.accounting, {
        // GAP-1: engine-default floor-padding → Warning (not G4 Failure), per doctrine.
        enginePaddingConsumerIds: authoringPlan.enginePaddingConsumerIds,
      })
    : [];
  const rail = signalsFromPerRail(result.finalOutcome.perRail);

  // ── W3-S3: surface Intent Brief readiness through the SAME ledger (Option B). ──
  // evaluateReadiness (W3-S2, pure) → intentReadinessSignals (verdict→signal) → routed
  // via composeRunHealth's existing rail bucket. Each readiness signal carries its own
  // producer ("intent-readiness"), so attribution stays authoritative and composeRunHealth
  // is untouched — the single delivery surface is preserved, no second ledger. Absent brief
  // → ONE Information ("no Intent Brief present"), never a Failure (no discriminator — IR1);
  // present-but-not-ready → objective Failures (LOUD-MARK: qualifies the headline, never
  // terminates). form-terms governance is read ONLY for a present brief, so an absent run
  // never depends on it.
  const readiness = intentReadinessSignals(
    evaluateReadiness(
      context.intentBrief,
      context.intentBrief ? loadFormTerms(formTermsPath()) : [],
    ),
  );

  // ── W3-S5: subjective intent-critic — central-objective legibility (REVIEW REQUIRED only). ──
  // The FIRST subjective producer. Runs only when a brief is present; routed via the SAME ledger
  // (Option B, alongside readiness). The DEFAULT scripted critic is inert (legible → no signal), so
  // real runs stay byte-identical — the real subjective judgment arrives only via an in-session
  // createSubagentCritic. A critical-warning qualifies the headline as REVIEW REQUIRED; it never
  // gates, scores, or freezes (formatRunHeadline already line-items criticals).
  const criticSignals = context.intentBrief
    ? intentCriticSignals(await defaultScriptedCritic().critique(context.intentBrief))
    : [];

  const health = composeRunHealth({
    fidelity,
    rail: [...rail, ...readiness, ...criticSignals],
    goalMet: result.stoppedBy === 'goal-met',
    systematicRatio: result.finalOutcome.score.systematicRatio,
  });
  const { headline, severed } = health;
  const formatted = formatRunHeadline(headline);
  console.log('\n' + formatted);

  // W3-S3 visibility: formatRunHeadline line-items Failures/Criticals/Warnings but NOT
  // Information (run-headline.ts). Surface the readiness Information explicitly so an
  // absent/ready brief is reported, not silent. Readiness Failures already print above.
  for (const s of readiness) {
    if (s.level === 'information') console.log(`  [intent] ${s.what}.`);
  }
  if (!severed.ok) {
    console.warn(
      `\n[observability] severed signal path(s) detected: ${severed.failures.length} ` +
        `signal(s) emitted but never delivered (surfaced as Failures, run not gated).`,
    );
  }
  if (severed.rejected.length > 0) {
    console.warn(
      `[observability] ${severed.rejected.length} signal(s) rejected at the ledger ` +
        `chokepoint (malformed/anonymous): ${severed.rejected.map((r) => r.reason).join('; ')}`,
    );
  }

  // ── GAP-3: surface the plan's own warnings (close the severed plan-warnings channel) ──
  // Plain diagnostics, NOT authority signals — surfaced (not reclassified, not minted into
  // the ledger). This is the only path that carries the declared-but-missing source-doc
  // notice (plan.ts), which no fidelity signal covers (an IO/config fact, not a unit fact).
  if (authoringPlan.warnings.length > 0) {
    for (const w of authoringPlan.warnings) console.warn(`  [plan] ${w}`);
  }

  // Collateral is self-contained at authorDocument time (tokens + fonts inlined, no JS) — its
  // single index.html is the deployable, no post-loop step. Website (WS9b) is constitution-by-
  // selection: the gate runs inside the loop (gateFold) and WS8 flatten runs in postProcess
  // above, producing the self-contained deployable from the multi-file assembled page.

  // ── P05 — Designer Doctor consumption: the canonical review artifact ────────────
  // Built entirely from values THIS driver already computed above — health (unchanged),
  // result.finalOutcome.perRail (unchanged), and the durable overlay state read back via
  // readOverlay (see the module header). buildDoctorReport performs no detect/apply/score
  // of its own — see src/doctor/doctor-report.ts's module header for the full reuse map.
  const doctorReport = buildDoctorReport({
    subject: result.finalOutcome.score.subject,
    generatedAt: result.finalOutcome.score.generatedAt,
    health,
    perRail: result.finalOutcome.perRail,
    frozen: readOverlay(join(outDir, 'overlay')),
    plan: authoringPlan,
  });
  const doctorReportPath = join(outDir, 'doctor-report.json');
  writeDoctorReport(doctorReportPath, doctorReport);
  console.log(
    `\nDoctor report written: ${doctorReportPath} ` +
      `(${doctorReport.findingCount} finding(s), headline ${doctorReport.headlineStatus}).`,
  );

  // ── P07 — Designer Review Report: a human-first Markdown reorganization of the ──
  // SAME doctorReport built above. buildReviewReport/renderReviewReport are pure
  // filters/groupings over doctorReport.findings — no new signal, no new detect,
  // no LLM. See src/doctor/review-report.ts's module header for the grouping
  // rationale (severity partitions the narrative sections; reviewArea/component
  // groups are cross-reference indexes only).
  const reviewReport = buildReviewReport(doctorReport);
  const reviewReportMarkdown = renderReviewReport(reviewReport);
  const reviewReportPath = join(outDir, 'review-report.md');
  writeReviewReportMarkdown(reviewReportPath, reviewReportMarkdown);
  writeReviewReport(join(outDir, 'review-report.json'), reviewReport);
  console.log(`Review report written: ${reviewReportPath}`);

  // ── P08 — Designer Review Package: the canonical handoff artifact ───────────────
  // Persists the already-computed `formatted` headline text (never recomputed) and
  // assembles a deterministic manifest indexing the three artifacts already written
  // above by hash — no new diagnostic, no re-detection. World A build identity is
  // read (never rebuilt) from the knowledge-build manifest already on disk, when
  // present. See src/doctor/review-package.ts's module header for the full design.
  //
  // G2-S1 — EXECUTION IDENTITY comes from the injected `reviewPackageBuilder`, NOT from
  // `context.client`/`context.track`. This driver assembles only the run-owned surface (everything
  // except client/track) and delegates; the builder is `nativeReviewPackage` (identity from the
  // GenerationContract) on the native path or the compat bridge on the legacy path. Byte-identical:
  // on both paths the injected identity equals the DesignContext's {client, track}.
  writeValidationSummary(join(outDir, 'validation-summary.txt'), formatted);
  const worldABuildIdentity = readWorldABuildIdentity();
  const reviewPackage = opts.reviewPackageBuilder({
    doctorReport,
    score: result.finalOutcome.score,
    reviewReport,
    reviewReportMarkdown,
    validationSummary: formatted,
    ...(worldABuildIdentity !== undefined ? { worldABuildIdentity } : {}),
  });
  const reviewPackagePath = join(outDir, 'review-package.json');
  writeReviewPackage(reviewPackagePath, reviewPackage);
  console.log(
    `Review package written: ${reviewPackagePath} (replay identity ${reviewPackage.metadata.replayIdentity.slice(0, 12)}…).`,
  );

  return { status: headline.status, formatted };
}
