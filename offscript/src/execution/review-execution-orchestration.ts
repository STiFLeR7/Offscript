/**
 * E2 — Execution Orchestration: pure composition of the existing Review Execution Contract (R8)
 * and Execution Adapter (E1) into one deterministic entrypoint
 * (`ReviewPipelineResult → ReviewExecutionContract → ReviewExecutionRequest →
 * ExecutionPipelineResult`). No new planning, no new adaptation, no execution, no regeneration —
 * every stage reuses the existing R8/E1 entry point verbatim, called exactly once, in order.
 *
 * Ownership (`docs/execution/E2-EXECUTION-ORCHESTRATION.md` §3 for the full grounding):
 *   1. **How P58 composes existing adapters:** `orchestrateGeneration` builds the P55 Generation
 *      Contract EXACTLY ONCE, then hands that SAME frozen instance to both `doctorContractFromPlan`
 *      and `authorContractFromPlan` — it never reconstructs identity, never builds a second
 *      contract, and imports only the existing composers (`planGeneration`/`evaluateReadiness`/
 *      `verifyContract`) plus the two existing adapters. This module follows the identical shape
 *      for a straight-line (not fan-out) pipeline: `planReviewExecution` (R8) is called exactly
 *      once to build the contract, and that SAME contract instance is the one argument passed to
 *      `adaptReviewExecution` (E1) — never a second construction, never a re-derivation.
 *   2. **How many identity sources exist today:** one. `ReviewSession` (R1) is the sole origin;
 *      R8's `manifest` is a direct projection of it (never independently reconstructed), and E1's
 *      `ExecutionIdentity` is a direct projection of R8's `manifest` (same discipline). This module
 *      adds no fourth identity source — `ExecutionPipelineResult.identity` is literally
 *      `request.identity`, the exact object E1 already produced, carried through by reference.
 *   3. **Whether any data is reconstructed:** no. Every field on `ExecutionPipelineResult` is a
 *      reference to something R8 or E1 already built (`contract`, `request`, `request.identity`).
 *      Nothing here re-derives scope, constraints, or identity from `pipelineResult` directly — the
 *      orchestrator's only job is sequencing the two existing calls and bundling their results by
 *      reference, exactly the boundary R7 already drew around R2–R6 (no stage duplicates a prior
 *      stage's own cross-check or computation) and P58 drew around P55/P56/P57.
 */
import { planReviewExecution, type ReviewExecutionContract } from '../review/review-execution-contract.js';
import { adaptReviewExecution, type ReviewExecutionRequest, type ExecutionIdentity } from './review-execution-adapter.js';
import type { ReviewPipelineResult } from '../review/review-orchestration.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const EXECUTION_ORCHESTRATION_VERSION_TAG = 'e2-execution-orchestration@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, EXECUTION_ORCHESTRATION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type ExecutionPipelineStageName = 'PLANNING' | 'ADAPTATION';

/** A plain, declarative description of the stage sequence — not itself executable. Same purpose as
 *  R7's `ReviewPipeline`: `stagesExecuted` is genuinely SOURCED from a real value, and "each stage
 *  invoked exactly once" (VALIDATION) is checkable against a concrete, inspectable list. */
export interface ExecutionPipeline {
  readonly stages: readonly ExecutionPipelineStageName[];
}

export function createExecutionPipeline(): ExecutionPipeline {
  return { stages: Object.freeze(['PLANNING', 'ADAPTATION']) };
}

/** References only — the contract R8 built, the request E1 adapted from it, and the identity E1
 *  already projected onto that request (OUTPUT MODEL: "Nothing copied. Nothing recomputed."). */
export interface ExecutionPipelineResult {
  readonly contract: ReviewExecutionContract;
  readonly request: ReviewExecutionRequest;
  readonly identity: ExecutionIdentity;
  readonly stagesExecuted: readonly ExecutionPipelineStageName[];
  readonly digest: string;
}

/** Injectable seam swapping WHICH function runs each stage (testability, matching R7's own
 *  default-parameter pattern) — never a business-rule policy. Defaults to the real R8/E1 entry
 *  points. */
export interface ExecutionOrchestratorFns {
  readonly planExecution: typeof planReviewExecution;
  readonly adaptExecution: typeof adaptReviewExecution;
}

const DEFAULT_STAGE_FNS: ExecutionOrchestratorFns = {
  planExecution: planReviewExecution,
  adaptExecution: adaptReviewExecution,
};

export interface ExecutionOrchestrator {
  run(pipelineResult: ReviewPipelineResult): ExecutionPipelineResult;
}

export function createExecutionOrchestrator(
  pipeline: ExecutionPipeline = createExecutionPipeline(),
  fns: ExecutionOrchestratorFns = DEFAULT_STAGE_FNS,
): ExecutionOrchestrator {
  return {
    run(pipelineResult) {
      // Built EXACTLY ONCE (P58's own discipline); `contract` is the SAME instance passed into
      // adaptExecution below — never reconstructed, never a second planning call.
      const contract = fns.planExecution(pipelineResult);
      const request = fns.adaptExecution(contract);

      const core = {
        contract,
        request,
        identity: request.identity,
        stagesExecuted: Object.freeze([...pipeline.stages]),
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R7/R8/E1's own convenience-function idiom. */
export function orchestrateExecution(
  pipelineResult: ReviewPipelineResult,
  orchestrator: ExecutionOrchestrator = createExecutionOrchestrator(),
): ExecutionPipelineResult {
  return orchestrator.run(pipelineResult);
}
