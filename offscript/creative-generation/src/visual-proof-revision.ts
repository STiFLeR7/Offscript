/**
 * Sprint 10Q — the Visual Proof revision contract + a deterministic scripted stub, per the
 * Sprint 10P design (`REVISION-EXECUTION-SEAM-DESIGN-REPORT.md`). Structurally the second
 * "contract-first, real-executor-later" seam in this package — the same discipline
 * `visual-proof-validation.ts`/`visual-proof-judgment-executor.ts` already established for
 * judgment is reapplied here for revision.
 *
 * This module performs NO semantic revision. `createScriptedRevisionExecutor` requires the
 * caller to supply the entire `RevisionOutcome` up front and returns it verbatim for every
 * request — it never inspects `belief`/`feature`/`camera`/`components`/`q1`-`q6` to decide
 * anything, exactly mirroring `createScriptedStubExecutor`'s own "caller supplies the answer"
 * discipline (`visual-proof-validation.ts`, Sprint 10F). A real revision executor — an LLM or
 * another reasoning mechanism, structurally parallel to `createRealJudgmentExecutor`
 * (`visual-proof-judgment-executor.ts`, Sprint 10K) — is NOT implemented here; see that design
 * report's own "Recommended Next Sprint" for why this contract-and-stub step comes first.
 *
 * No revision-target enum exists in this module. The source (`HANDOFF-v2.md` line 831) frames
 * Q1-Q4's remedy as "usually" one of three judgment-selected actions, never a rule — inventing a
 * closed vocabulary here would fabricate certainty the source does not have. `RevisionRequest`
 * therefore carries only the complete prior request and the complete prior six-question answer;
 * a future revision executor derives any target it needs from that, as its own judgment output,
 * never as a pre-computed input.
 */
import type { VisualProofValidationRequest, VisualProofValidationAnswer } from './visual-proof-validation.js';
import type { EnvironmentSlug } from './environment-library.js';

/**
 * The input to a future revision step: the exact candidate that was judged, the complete failed
 * judgment (all six answers, not just the failures — a revision reasoning about what changed
 * should see what already passed too), and a 1-based attempt counter. `attempt` is bookkeeping
 * only; this contract enforces no maximum and no retry policy — that belongs to a future
 * orchestration sprint, never to this seam.
 */
export interface RevisionRequest {
  readonly priorRequest: VisualProofValidationRequest;
  readonly priorAnswer: VisualProofValidationAnswer;
  readonly attempt: number;
  /** Sprint 10AE — the SAME eligible-candidate set the original (pre-revision) environment
   * selection computed for this creative, passed through as already-derived context — this
   * contract never recomputes eligibility. A proposed `environment` revision must be validated
   * against this exact set, never against the global seven-value vocabulary alone (mirroring
   * `EnvironmentSelectionRequest.eligibleCandidates`'s own role). Optional: a revision that never
   * touches environment (camera/components only) needs no eligible set at all. */
  readonly eligibleCandidates?: readonly EnvironmentSlug[];
}

/**
 * The judged/unavailable idiom (`VisualProofValidationOutcome`, Sprint 10J) reapplied at this
 * second seam. `'revised'` carries a complete new `VisualProofValidationRequest` — never a
 * `CreativeIntent` mutation, never a patch/changeset — plus a short rationale string.
 * `'unavailable'` means the revision mechanism itself could not honestly produce a candidate;
 * this is a mechanism-failure outcome, distinct from and never conflated with a semantic Visual
 * Proof "failed" judgment, which belongs to a different seam entirely (this module never touches
 * `CreativeArtifact.validation`).
 */
export type RevisionOutcome =
  | { readonly outcome: 'revised'; readonly candidate: VisualProofValidationRequest; readonly rationale: string }
  | { readonly outcome: 'unavailable'; readonly reason: string };

/**
 * The extension point a future revision executor (LLM, another reasoning mechanism, or a human
 * reviewer) would implement. Async — every real revision mechanism is asynchronous, mirroring
 * `VisualProofJudgmentExecutor`'s own signature.
 */
export type VisualProofRevisionExecutor = (request: RevisionRequest) => Promise<RevisionOutcome>;

/**
 * Returns a `VisualProofRevisionExecutor` that always resolves with the given, caller-supplied
 * outcome — regardless of the request it is called with. This is the SCRIPTED STUB: it proves the
 * `RevisionRequest -> executor -> RevisionOutcome` contract end to end for tests and plumbing
 * experiments, and performs no reasoning over request content whatsoever.
 */
export function createScriptedRevisionExecutor(outcome: RevisionOutcome): VisualProofRevisionExecutor {
  return async () => outcome;
}
