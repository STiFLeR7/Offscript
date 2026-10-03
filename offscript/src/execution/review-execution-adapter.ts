/**
 * E1 — Review Execution Adapter: the first execution boundary over the immutable Review Execution
 * Contract (R8). Pure adaptation of a `ReviewExecutionContract` into a framework-neutral
 * `ReviewExecutionRequest` — nothing executes, nothing new is planned or evaluated, nothing is
 * persisted. No AI, no browser, no HTML.
 *
 * Ownership (`docs/execution/E1-REVIEW-EXECUTION-ADAPTER.md` §2 for the full grounding):
 *   1. **How P56/P57 separate contract ownership from consumer ownership:** both adapters project a
 *      `{client, deliverables}` boundary view OUT of the immutable P55 plan/contract for their
 *      consumer's identity/scope, then pass every consumer-owned field (Doctor's diagnostics,
 *      Author's authoring substance) through UNTOUCHED — never recomputed, never re-derived. This
 *      module follows the identical shape: `ExecutionIdentity` is projected OUT of R8's own
 *      `manifest`/`contractId` (never recomputed), and the rest of the contract is carried through
 *      by REFERENCE, not copied or restructured.
 *   2. **Execution identity belongs to the Review Execution Contract:** `client`, `track`,
 *      `sessionId` (R8's `manifest`) and `contractId` — the same fields P56/P57 source from the P55
 *      contract's own `identity`. This module only PROJECTS them into `ExecutionIdentity`; it never
 *      re-derives them from `references.session` independently (that would duplicate R8's own
 *      manifest construction).
 *   3. **Execution data belonging only to future consumers:** unlike P56 (Doctor's `health`/
 *      `perRail`/`plan`/`score`) and P57 (Author's `kind`/`designerIntent`/`evidence`), no execution
 *      consumer exists yet in this program — there is no browser runner, no regeneration executor.
 *      P55's pattern is to omit fields with no analog rather than fabricate them (R8 itself omitted
 *      `objective`/`brandContext`/`assumptions`/`supersedes` on the same principle). This sprint
 *      follows suit: `ExecutionContext` carries the referenced contract itself — the one thing every
 *      future consumer will need — and invents no speculative consumer-specific fields (no
 *      timestamps, no framework markers, no execution mode). A future execution sprint adds those
 *      when a real consumer exists to define them.
 */
import type { ReviewExecutionContract } from '../review/review-execution-contract.js';
import type { ReviewSession } from '../review/review-session.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_EXECUTION_ADAPTER_VERSION_TAG = 'e1-review-execution-adapter@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_EXECUTION_ADAPTER_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** Projected out of the contract's own `manifest` + `contractId` — never recomputed (header note 2). */
export interface ExecutionIdentity {
  readonly client: string;
  readonly track: ReviewSession['track'];
  readonly sessionId: string;
  readonly contractId: string;
}

/** The consumer context. Holds the referenced contract itself — no copy, no restructuring — so a
 *  future execution consumer reaches scope/constraints/references through the one contract it
 *  already trusts (header note 3). */
export interface ExecutionContext {
  readonly contract: ReviewExecutionContract;
}

export interface ReviewExecutionRequest {
  readonly identity: ExecutionIdentity;
  readonly context: ExecutionContext;
  readonly digest: string;
}

export interface ExecutionAdapter {
  adapt(contract: ReviewExecutionContract): ReviewExecutionRequest;
}

export interface ExecutionAdapterResult {
  readonly valid: boolean;
  readonly identityPreserved: boolean;
  readonly scopePreserved: boolean;
  readonly constraintsPreserved: boolean;
  readonly referencesPreserved: boolean;
  readonly issues: readonly string[];
}

function identityFromContract(contract: ReviewExecutionContract): ExecutionIdentity {
  return {
    client: contract.manifest.client,
    track: contract.manifest.track,
    sessionId: contract.manifest.sessionId,
    contractId: contract.contractId,
  };
}

export function createExecutionAdapter(): ExecutionAdapter {
  return {
    adapt(contract) {
      const identity: ExecutionIdentity = Object.freeze(identityFromContract(contract));
      const context: ExecutionContext = Object.freeze({ contract });
      const core = { identity, context };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2–R8's own convenience-function idiom. */
export function adaptReviewExecution(
  contract: ReviewExecutionContract,
  adapter: ExecutionAdapter = createExecutionAdapter(),
): ReviewExecutionRequest {
  return adapter.adapt(contract);
}

/** Validates that adaptation preserved identity and carried scope/constraints/references through by
 *  reference — never by re-deriving them, only by comparing what the request actually holds against
 *  the source contract (VALIDATION). */
export function verifyExecutionAdaptation(contract: ReviewExecutionContract, request: ReviewExecutionRequest): ExecutionAdapterResult {
  const issues: string[] = [];

  const identityPreserved =
    request.identity.client === contract.manifest.client &&
    request.identity.track === contract.manifest.track &&
    request.identity.sessionId === contract.manifest.sessionId &&
    request.identity.contractId === contract.contractId;
  if (!identityPreserved) issues.push('identity does not match the source contract.');

  const referencesPreserved = request.context.contract.references === contract.references;
  if (!referencesPreserved) issues.push('references were not carried through by reference.');

  const scopePreserved = request.context.contract.scope === contract.scope;
  if (!scopePreserved) issues.push('scope was not carried through by reference.');

  const constraintsPreserved = request.context.contract.constraints === contract.constraints;
  if (!constraintsPreserved) issues.push('constraints were not carried through by reference.');

  return Object.freeze({
    valid: identityPreserved && referencesPreserved && scopePreserved && constraintsPreserved,
    identityPreserved,
    scopePreserved,
    constraintsPreserved,
    referencesPreserved,
    issues: Object.freeze(issues),
  });
}
