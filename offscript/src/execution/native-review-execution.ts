/**
 * E3 — Native Review Execution: the first native execution engine for Program E. It executes the
 * Review Execution Pipeline (E2) — deliberately performing NO regeneration — and materializes the
 * canonical `ExecutionResult` artifact that future regeneration, browser editing, and AI will
 * consume. No new planning, no new adaptation, no new orchestration — every field is either a
 * reference to something R8/E1/E2 already built or a direct derivation from already-computed data.
 * No AI, no browser, no HTML, no persistence.
 *
 * Ownership (`docs/execution/E3-NATIVE-REVIEW-EXECUTION.md` §2 for the full grounding):
 *   1. **How G1-S2 separated orchestration from execution:** `beginGeneration` is the ENGINE — it
 *      composes the ONE existing orchestrator (`orchestrateGeneration`) and then MATERIALIZES the
 *      legacy execution identity exactly once, so every downstream consumer reads that single
 *      projection instead of re-deriving it. Orchestration (P58) builds the contract; the engine
 *      (G1-S2) is the layer that takes an orchestration's result and turns it into the durable,
 *      consumer-facing artifact. This module draws the identical line one layer up the Review
 *      stack: E2 is the orchestration (composes R8 + E1 into one `ExecutionPipelineResult`); E3 is
 *      the engine — it takes that ALREADY-ORCHESTRATED result as its one input (never re-running
 *      `orchestrateExecution` itself) and materializes `ExecutionResult`, the artifact a future
 *      regeneration/browser/AI consumer will read.
 *   2. **Which execution identity already exists:** `ExecutionIdentity` (E1), carried through
 *      `ExecutionPipelineResult.identity` (E2) by reference. This module introduces no second
 *      identity — `ExecutionResult.identity` is literally `pipelineResult.identity`, the same
 *      object, assigned once. Exactly G1-S2's own discipline: "one materialized identity, N
 *      consumers," never a per-consumer re-projection.
 *   3. **What a native execution result should own:** only what the brief's EXECUTION section
 *      lists — identity, stages completed, diagnostics, status, and the contract/request
 *      references — each either a bare reference (`identity`, `contract`, `request`) or a direct,
 *      non-fabricated derivation from fields R8/E2 already computed (`stepsCompleted` from
 *      `stagesExecuted`; `status`/`diagnostics` from `contract.scope.readinessState` and
 *      `contract.references.readiness.summary`). Nothing here re-evaluates readiness, re-derives
 *      scope, or invents a narrative — "Never fabricate execution outputs" (RULES) means every
 *      field must trace to a real, already-computed fact.
 *
 * **Status is derived, never guessed:** `ExecutionStatus` maps R6's `RegenerationReadiness` onto
 * execution-engine terms (`READY → COMPLETED`, `BLOCKED`/`WAITING_FOR_WORKSPACE`/
 * `WAITING_FOR_PROJECT → BLOCKED`, `INVALID → INVALID`, `UNKNOWN → UNKNOWN`), collapsing R6's two
 * "waiting" states into `BLOCKED` because — from THIS engine's perspective — both mean the same
 * actionable thing: execution cannot proceed yet. `FAILED` is reserved for a genuinely different,
 * real, computable fact this module DOES check: whether the given `ExecutionPipelineResult` is
 * internally consistent (every expected stage present in `stagesExecuted`; `request.context
 * .contract` and `identity` are the SAME objects `contract`/`request.identity` point to) — never a
 * caught exception, since this module calls no R/E function that could throw; it only reads
 * already-frozen fields.
 */
import { createExecutionPipeline, type ExecutionPipelineResult, type ExecutionPipelineStageName } from './review-execution-orchestration.js';
import type { ExecutionIdentity, ReviewExecutionRequest } from './review-execution-adapter.js';
import type { ReviewExecutionContract } from '../review/review-execution-contract.js';
import type { RegenerationReadiness } from '../review/regeneration-readiness.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const NATIVE_REVIEW_EXECUTION_VERSION_TAG = 'e3-native-review-execution@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, NATIVE_REVIEW_EXECUTION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** Explicit states — never a boolean (RULES). `COMPLETED` means the execution pipeline resolved
 *  fully ready; it does NOT mean regeneration ran (this engine never regenerates). */
export type ExecutionStatus = 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'INVALID' | 'UNKNOWN';

/** One record per stage this module KNOWS completed — because it appears in the pipeline result's
 *  own `stagesExecuted` (E2), never because this module re-ran or guessed at it. */
export interface ExecutionStep {
  readonly name: ExecutionPipelineStageName;
  readonly status: 'COMPLETED';
}

/** A compact, construction-consistent index over already-computed contract data (mirrors R8's own
 *  `ExecutionManifest` posture) — never an independent recomputation. */
export interface ExecutionDiagnostics {
  readonly readinessState: RegenerationReadiness;
  readonly blockingBlockerCount: number;
  readonly warningBlockerCount: number;
  readonly constraintCount: number;
  readonly executableTaskCount: number;
  readonly blockedTaskCount: number;
  readonly stagesComplete: boolean;
  readonly referencesConsistent: boolean;
}

export interface ExecutionResult {
  readonly identity: ExecutionIdentity;
  readonly status: ExecutionStatus;
  readonly stepsCompleted: readonly ExecutionStep[];
  readonly diagnostics: ExecutionDiagnostics;
  readonly contract: ReviewExecutionContract;
  readonly request: ReviewExecutionRequest;
  readonly digest: string;
}

export interface ReviewExecutionEngine {
  execute(pipelineResult: ExecutionPipelineResult): ExecutionResult;
}

const EXPECTED_STAGES: readonly ExecutionPipelineStageName[] = createExecutionPipeline().stages;

const READINESS_TO_STATUS: Record<RegenerationReadiness, ExecutionStatus> = {
  READY: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  WAITING_FOR_WORKSPACE: 'BLOCKED',
  WAITING_FOR_PROJECT: 'BLOCKED',
  INVALID: 'INVALID',
  UNKNOWN: 'UNKNOWN',
};

function stepsFrom(pipelineResult: ExecutionPipelineResult): readonly ExecutionStep[] {
  return Object.freeze(pipelineResult.stagesExecuted.map((name): ExecutionStep => Object.freeze({ name, status: 'COMPLETED' })));
}

/** The one real integrity check this module performs — over fields it already has, never a call
 *  into R8/E1/E2's own logic (VALIDATION: "Reference identity preserved... Contract unchanged...
 *  Request unchanged"). */
function integrityOf(pipelineResult: ExecutionPipelineResult): { stagesComplete: boolean; referencesConsistent: boolean } {
  const stagesComplete = EXPECTED_STAGES.every((s) => pipelineResult.stagesExecuted.includes(s));
  const referencesConsistent =
    pipelineResult.request.context.contract === pipelineResult.contract && pipelineResult.identity === pipelineResult.request.identity;
  return { stagesComplete, referencesConsistent };
}

function statusFrom(pipelineResult: ExecutionPipelineResult, stagesComplete: boolean, referencesConsistent: boolean): ExecutionStatus {
  if (!stagesComplete || !referencesConsistent) return 'FAILED';
  return READINESS_TO_STATUS[pipelineResult.contract.scope.readinessState];
}

function diagnosticsFrom(pipelineResult: ExecutionPipelineResult, stagesComplete: boolean, referencesConsistent: boolean): ExecutionDiagnostics {
  const readiness = pipelineResult.contract.references.readiness;
  return Object.freeze({
    readinessState: readiness.state,
    blockingBlockerCount: readiness.summary.blockingBlockerCount,
    warningBlockerCount: readiness.summary.warningBlockerCount,
    constraintCount: pipelineResult.contract.constraints.length,
    executableTaskCount: pipelineResult.contract.scope.executableTaskIds.length,
    blockedTaskCount: pipelineResult.contract.scope.blockedTaskIds.length,
    stagesComplete,
    referencesConsistent,
  });
}

export function createReviewExecutionEngine(): ReviewExecutionEngine {
  return {
    execute(pipelineResult) {
      const { stagesComplete, referencesConsistent } = integrityOf(pipelineResult);
      const core = {
        identity: pipelineResult.identity,
        status: statusFrom(pipelineResult, stagesComplete, referencesConsistent),
        stepsCompleted: stepsFrom(pipelineResult),
        diagnostics: diagnosticsFrom(pipelineResult, stagesComplete, referencesConsistent),
        contract: pipelineResult.contract,
        request: pipelineResult.request,
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R7/R8/E1/E2's own convenience-function idiom. */
export function executeReviewPipeline(
  pipelineResult: ExecutionPipelineResult,
  engine: ReviewExecutionEngine = createReviewExecutionEngine(),
): ExecutionResult {
  return engine.execute(pipelineResult);
}
