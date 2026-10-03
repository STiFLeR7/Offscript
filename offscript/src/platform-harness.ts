/**
 * P02 — Platform Harness Foundation (Types → Execution Context → Contract → Transport;
 * STOPS at Transport). Mirrors the W18 (`knowledge/semantic-body.ts`) / W20
 * (`generate/semantic-author-context.ts`) / W52 (`generate/presentation-intent.ts`) / W70
 * (`generate/website-visual-discovery.ts`) Foundation pattern exactly: this sprint defines
 * one immutable model and stops — nothing consumes it yet (see the "foundation isolation"
 * test in `test/platform-harness.test.ts`).
 *
 * WHAT THIS IS: the thin orchestration vocabulary a future sprint will use to thread
 * `scripts/generate.ts` (and, later, Designer Doctor / Designer Author / a regression
 * runner / a benchmark runner / internal QA — P01 Draft v2 §13) through ONE shared,
 * fixed six-stage-plus-boundary shape: Input → Context → Generate → Validate → Review →
 * Metrics → Report → Exit. Every transport type below REUSES an existing engine type
 * rather than redefining one (`DesignContext`, `AuthoringPlan`, `RunScore`, `Frozen`,
 * `RunHealth`, `HeadlineStatus`) — the harness carries data the engine already produces;
 * it invents none of its own.
 *
 * WHAT THIS IS NOT: an orchestrator, a workflow engine, or a second engine. The stage
 * vocabulary (`HARNESS_STAGES`) is closed and frozen — never a user-extensible DSL
 * (Constitution anti-framework guardrail: "operators are a fixed library, not a DSL").
 * No stage IMPLEMENTATION is provided or wired here; `HarnessStage<In, Out>` is a
 * contract type only. No existing file is modified by this sprint — `scripts/generate.ts`
 * and `scripts/harden.ts` are byte-for-byte unchanged.
 *
 * EXIT-STATUS MODEL — grounded verbatim in `scripts/generate.ts`'s three real exit paths
 * (traced this session, not assumed):
 *   - no project directory found              → `process.exit(0)`  ("skipped")
 *   - Stage 1 `buildContext()` throws          → `process.exit(1)`  ("context-failed")
 *   - the pipeline runs to completion          → `process.exit(0)`  ("completed"),
 *     UNCONDITIONALLY — even when the run's own `RunHeadline.status` is `'failed'`
 *     (LOUD-MARK, `run-headline.ts`: "a FAILED headline is a statement about a completed
 *     run, not an action on it"). The harness's `exitCodeFor` reproduces this mapping
 *     exactly; it does not invent a stricter or different one.
 */

import type { Track } from './paths.js';
import type { DesignContext } from './generate/types.js';
import type { AuthoringPlan } from './generate/types.js';
import type { RunScore } from './score.js';
import type { Frozen } from './overlay.js';
import type { RunHealth } from './generate/source-fidelity.js';
import type { HeadlineStatus } from './run-headline.js';
import type { ProposalPackage } from './designer-author/proposal-package.js';
import type { PerRailEntry } from './generate/reauthor-loop.js';

/** Bump when the stage vocabulary or transport shapes change. */
export const PLATFORM_HARNESS_VERSION = 'p03-platform-harness@2';

// ─────────────────────────────────────────────────────────────────────────────
// Stage vocabulary — closed, fixed, never extensible.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The eight fixed harness stages, in pipeline order. This is the harness's entire
 * surface — a fixed sequence of named slots, each of which DELEGATES to an existing
 * engine capability (Context → `generate/context.ts#buildContext`; Generate →
 * `generate/author.ts` / `generate/website-composition.ts`; Validate →
 * `generate/validate.ts` + `generate/reauthor-loop.ts`; Metrics →
 * `generate/source-fidelity.ts#composeRunHealth`; Report → `run-headline.ts`). The
 * harness itself never re-implements what a slot delegates to — see the module header.
 */
export type HarnessStageName =
  | 'input'
  | 'context'
  | 'generate'
  | 'validate'
  | 'review'
  | 'metrics'
  | 'report'
  | 'exit';

/** Frozen — the vocabulary is closed; a future sprint adds a slot only by extending
 *  this literal list deliberately, never by making it runtime-configurable. */
export const HARNESS_STAGES: readonly HarnessStageName[] = Object.freeze([
  'input',
  'context',
  'generate',
  'validate',
  'review',
  'metrics',
  'report',
  'exit',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Immutable Execution Context — threaded through every stage, never mutated.
// ─────────────────────────────────────────────────────────────────────────────

/** The Input-stage output: the immutable request that starts a harness run. */
export interface HarnessInput {
  readonly client: string;
  readonly track: Track;
  readonly outDir: string;
}

/**
 * Immutable execution context, built once per run and threaded unchanged through every
 * stage. Deep-frozen (including `input`) so no stage can accidentally mutate shared
 * state — the same discipline `AuthoringPlan`/`DesignContext` already follow.
 */
export interface HarnessExecutionContext {
  readonly input: HarnessInput;
  /** ISO-8601, stamped once at construction — mirrors `score.ts`'s own `generatedAt`
   *  convention (`new Date().toISOString()`), not a new timestamp format. */
  readonly startedAt: string;
}

/** Build the immutable execution context for one harness run. Pure aside from the
 *  timestamp read; never mutates the caller's `input`. */
export function createHarnessExecutionContext(input: HarnessInput): HarnessExecutionContext {
  const frozenInput: HarnessInput = Object.freeze({ ...input });
  return Object.freeze({
    input: frozenInput,
    startedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Contract — the shape a future stage implementation must satisfy.
// No implementation is provided or wired in this sprint.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A harness stage is a pure(-ish, I/O aside) async transform from the shared,
 * frozen execution context plus the prior stage's output, to this stage's output.
 * Stages never receive a mutable context and never return a mutated one — the
 * context is read-only input, not a place to accumulate state.
 */
export type HarnessStage<In, Out> = (ctx: HarnessExecutionContext, input: In) => Promise<Out>;

// ─────────────────────────────────────────────────────────────────────────────
// Stage sequencer — P03's one genuine addition to the Foundation.
//
// P02 defined the stage VOCABULARY (HARNESS_STAGES) and the stage CONTRACT
// (HarnessStage<In, Out>) but no runner — there was nothing to consume it yet. P03
// (Platform Harness Consumption) wires scripts/generate.ts through the harness and
// needs a minimal, generic way to prove stages fire in the declared order. This is
// NOT a workflow engine: it does not invoke stages, retry them, or hold any stage's
// input/output — it only records the ORDER stages were reached and rejects a
// regression (an earlier stage recorded after a later one) or an exact repeat.
// Gaps are allowed (a consumer may legitimately skip a stage — e.g. scripts/
// generate.ts never reaches 'review', since it has no human-in-the-loop step today;
// only harden-review.ts does), because HARNESS_STAGES is a closed vocabulary of
// POSSIBLE checkpoints, not a mandatory checklist every consumer must exhaust.
// ─────────────────────────────────────────────────────────────────────────────

export interface HarnessStageSequencer {
  /** Record that `stage` was reached. Throws on a regression or an exact repeat. */
  record(stage: HarnessStageName): void;
  /** The stages recorded so far, in the order recorded (frozen snapshot). */
  readonly order: readonly HarnessStageName[];
}

/** Create a fresh, per-run stage-order recorder. Pure aside from its own closed-over state. */
export function createHarnessStageSequencer(): HarnessStageSequencer {
  const order: HarnessStageName[] = [];
  return {
    record(stage: HarnessStageName): void {
      const idx = HARNESS_STAGES.indexOf(stage);
      const prevStage = order[order.length - 1];
      const prevIdx = prevStage === undefined ? -1 : HARNESS_STAGES.indexOf(prevStage);
      if (idx <= prevIdx) {
        throw new Error(
          `Platform Harness stage-order violation: "${stage}" recorded after "${prevStage ?? '(none)'}" — ` +
            `stages must be recorded in HARNESS_STAGES order (gaps allowed; regressions and repeats are not). ` +
            `Recorded so far: ${order.join(' → ') || '(none)'}.`,
        );
      }
      order.push(stage);
    },
    get order(): readonly HarnessStageName[] {
      return Object.freeze([...order]);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport objects — one per stage boundary. Every shape below reuses an
// existing engine type; none is redefined.
// ─────────────────────────────────────────────────────────────────────────────

/** Context-stage output. Reuses `DesignContext` (Stage 1, `generate/context.ts`) verbatim. */
export interface HarnessContextResult {
  readonly designContext: DesignContext;
}

/** Generate-stage output. Reuses `AuthoringPlan` (Stage 2) verbatim; `html`/`warnings`
 *  mirror `authorDocument`'s existing return shape (`generate/author.ts`). */
export interface HarnessGenerateResult {
  readonly plan: AuthoringPlan;
  readonly html: string;
  readonly warnings: readonly string[];
}

/**
 * Validate-stage output. Reuses `RunScore` (`score.ts`), `Frozen` (`overlay.ts`), and
 * `PerRailEntry` (`generate/reauthor-loop.ts`) verbatim — the same shapes the real
 * `ValidateResult`/`ValidateOutcome` (`generate/validate.ts`) already carry.
 *
 * P27 — TRANSPORT COMPLETENESS. `perRail` was missing from this type since P02; P04's
 * Doctor Foundation and P05's Consumption both named the gap explicitly (Doctor's own
 * `DoctorReportInput.perRail: readonly PerRailEntry[]` is sourced directly from the
 * real `ValidateResult.perRail`, bypassing this narrower harness transport entirely,
 * because this type could not carry it losslessly). Widening closes that gap: this
 * type is now a faithful, lossless mirror of the real `ValidateResult`'s three fields
 * for the harness's own transport purposes. DEFINED, NOT WIRED: `HarnessValidateResult`
 * still has zero producers and zero consumers anywhere in `src/`/`scripts/` (unchanged
 * since P02) — this is a pure, additive shape-completeness fix, not new stage wiring.
 */
export interface HarnessValidateResult {
  readonly score: RunScore;
  readonly frozen: readonly Frozen[];
  /** the SAME per-rail residual real `ValidateResult.perRail` already carries — see
   *  `DoctorReportInput.perRail`'s own identical field for the downstream consumer
   *  this closes the gap for. */
  readonly perRail: readonly PerRailEntry[];
}

/** Review-stage output. Reuses `Frozen` (`overlay.ts`) — the same round-trip record
 *  `harden-review.ts`'s human-in-the-loop accept/reject/edit flow already produces. */
export interface HarnessReviewResult {
  readonly reviewed: readonly Frozen[];
}

/** Metrics-stage output. Reuses `RunHealth` (`generate/source-fidelity.ts`) verbatim —
 *  the single delivery-surface ledger result `composeRunHealth` already returns. */
export interface HarnessMetricsResult {
  readonly health: RunHealth;
}

/**
 * P10 — Designer Author transport shape. Reuses `ProposalPackage`
 * (`designer-author/proposal-package.ts`, P09) verbatim — the same
 * "invents none of its own" discipline every other Harness*Result above
 * follows. DEFINED, NOT WIRED: no stage implementation produces or consumes
 * this shape, `HARNESS_STAGES` is unchanged, and no existing stage's output
 * type gained this field — a future sprint that actually threads Designer
 * Author proposals through a harness run does so by wiring a producer for
 * this shape, not by inventing a new one.
 */
export interface HarnessProposalResult {
  readonly proposals: readonly ProposalPackage[];
}

/** Report-stage output. Reuses `HeadlineStatus` (`run-headline.ts`) verbatim; `formatted`
 *  mirrors `formatRunHeadline`'s existing plain-text return shape. */
export interface HarnessReportResult {
  readonly status: HeadlineStatus;
  readonly formatted: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit-status model — grounded in scripts/generate.ts's real exit paths (module header).
// ─────────────────────────────────────────────────────────────────────────────

/** The three outcomes a harness run can reach today, named after their real
 *  `scripts/generate.ts` origin, not invented independently. */
export type HarnessOutcomeKind = 'skipped' | 'context-failed' | 'completed';

/** The process exit code `scripts/generate.ts` uses for each outcome today. A
 *  'completed' outcome is ALWAYS 0 — see the module header's LOUD-MARK note. */
export function exitCodeFor(outcome: HarnessOutcomeKind): 0 | 1 {
  return outcome === 'context-failed' ? 1 : 0;
}

/** The final, immutable envelope for one harness run. */
export interface HarnessRunResult {
  readonly context: HarnessExecutionContext;
  readonly outcome: HarnessOutcomeKind;
  readonly exitCode: 0 | 1;
  /** present only when `outcome === 'completed'` — a run that never reached a
   *  headline (skipped / context-failed) carries no status. */
  readonly headlineStatus?: HeadlineStatus;
}

/** Assemble the final run result. `exitCode` is always derived from `exitCodeFor` —
 *  there is exactly one outcome→exit-code mapping in this module, never a second. */
export function buildHarnessRunResult(input: {
  context: HarnessExecutionContext;
  outcome: HarnessOutcomeKind;
  headlineStatus?: HeadlineStatus;
}): HarnessRunResult {
  return Object.freeze({
    context: input.context,
    outcome: input.outcome,
    exitCode: exitCodeFor(input.outcome),
    ...(input.headlineStatus !== undefined ? { headlineStatus: input.headlineStatus } : {}),
  });
}
