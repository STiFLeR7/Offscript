/**
 * Sprint 5 — Conditioning Engine.
 *
 * Conditioning transforms a replayable Composition Plan into an IMMUTABLE Authoring Context.
 * It PREPARES — it never authors, generates, constructs prompts, invokes an LLM, or resolves
 * lawful plurality. It consumes only the Composition Plan + the repository (for evidence and
 * identity verification) + a runtime execution context, and produces a deeply-frozen context
 * that is a pure function of its inputs.
 *
 * Six responsibilities, each deterministic:
 *   1 execution binding      bind runtime info (request id, runtime options) — never model
 *                            params, prompts, or HTML (non-scalar option values fail loud)
 *   2 context assembly       gather the authoring inputs; the plan stays authoritative and
 *                            is carried verbatim (intent/order/groups never transformed)
 *   3 evidence preservation  carry repository evidence forward unchanged (full traceability)
 *   4 plurality preservation carry unresolved plurality exactly as received (no resolution)
 *   5 deterministic identity stamp a conditioning identity = f(plan, repo identity, execution)
 *   6 immutable context      deep-freeze the result (mutable outputs fail loud)
 *
 * Fail-loud: an invalid plan, a repository-identity mismatch, missing evidence, or incomplete
 * conditioning throw a ConditioningError. The Authoring Context is the sole input to Authoring.
 */
import { digest } from './digest.js';
import {
  compositionDigest,
  repositoryIdentity as computeRepositoryIdentity,
  type CompositionGroup,
  type CompositionPlan,
  type CompositionRepository,
} from './composition.js';
import type { ResolvedObligation } from './discovery.js';
import { MODEL_KINDS, replayModelSet, type DerivedModelSet } from './derivation/models.js';

export const CONDITIONING_VERSION = '0.1.0';

/** Runtime execution context — runtime options only (no model params / prompts / HTML). */
export interface ExecutionContext {
  readonly requestId: string;
  readonly options?: Readonly<Record<string, string | number | boolean>>;
}

export interface ExecutionBindings {
  readonly requestId: string;
  readonly options: Readonly<Record<string, string | number | boolean>>;
}

/** Repository evidence carried forward unchanged — full traceability to repository facts. */
export interface RepositoryEvidence {
  readonly repositoryIdentity: string;
  readonly assetCount: number;
  readonly candidateCount: number;
  /** token → satisfier asset ids (the authored facts behind every candidate). */
  readonly obligations: readonly ResolvedObligation[];
}

/** The immutable Authoring Context — the sole input to Authoring. */
export interface AuthoringContext {
  readonly conditioningIdentity: string;
  readonly repositoryIdentity: string;
  readonly plan: CompositionPlan;
  readonly obligations: readonly ResolvedObligation[];
  readonly unresolvedPlurality: readonly CompositionGroup[];
  readonly evidence: RepositoryEvidence;
  readonly execution: ExecutionBindings;
  readonly metadata: {
    readonly conditioningVersion: string;
    readonly unitCount: number;
    readonly groupCount: number;
    readonly unresolvedPluralityCount: number;
    readonly obligationCount: number;
  };
  /**
   * Phase B — the seven Governance Models, CARRIED read-only. Present ONLY when a validated
   * ModelSet is supplied to `condition()`; absent by default (so the default context is
   * byte-identical to pre-Phase-B runs). Conditioning verifies + transports it but NEVER
   * interprets, projects, flattens, or transforms it. Authoring receives it untouched; no engine
   * consumes it yet (Phase C introduces controlled interpretation inside Authoring).
   */
  readonly models?: DerivedModelSet;
}

/** Fail-loud Conditioning error. */
export class ConditioningError extends Error {
  readonly code:
    | 'INVALID_PLAN'
    | 'REPOSITORY_IDENTITY_MISMATCH'
    | 'MISSING_EVIDENCE'
    | 'INCOMPLETE_CONDITIONING'
    // Phase B — model carrier fail-loud codes (never repair, never infer).
    | 'MODELSET_MALFORMED'
    | 'MODELSET_MUTABLE'
    | 'MODELSET_IDENTITY_MISMATCH'
    | 'MODELSET_MISSING_GOVERNANCE'
    | 'MODELSET_INVALID_EVIDENCE'
    | 'MODELSET_REPOSITORY_MISMATCH'
    | 'MODELSET_REPLAY_MISMATCH';
  constructor(code: ConditioningError['code'], message: string) {
    super(message);
    this.name = 'ConditioningError';
    this.code = code;
  }
}

const SHA = /^sha256:[0-9a-f]{64}$/;

/** Recursively freeze an object graph (immutable output guarantee). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** Read-only deep-frozen check (used to verify a carried ModelSet's immutability). */
function isDeepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isDeepFrozen);
}

/**
 * Phase B carrier validation — fail-loud, read-only, never repair, never infer. Proves the
 * supplied ModelSet is well-formed, immutable, identity- + replay-valid, governance- +
 * evidence-preserving, and bound to THIS plan's repository. Conditioning performs zero
 * interpretation, projection, or transformation of the Models.
 */
function validateModelSet(models: DerivedModelSet, plan: CompositionPlan): void {
  // malformed structure
  const malformed =
    !models ||
    typeof models !== 'object' ||
    typeof models.derivationIdentity !== 'string' ||
    !models.inputs ||
    typeof models.inputs.repositoryIdentity !== 'string' ||
    !models.models ||
    !models.metadata;
  if (malformed) {
    throw new ConditioningError('MODELSET_MALFORMED', 'conditioning: model set is malformed.');
  }
  for (const k of MODEL_KINDS) {
    const m = models.models[k];
    if (!m || m.kind !== k || !m.result || typeof m.identity !== 'string') {
      throw new ConditioningError('MODELSET_MALFORMED', `conditioning: model set missing/mismatched Model '${k}'.`);
    }
  }

  // immutability
  if (!isDeepFrozen(models)) {
    throw new ConditioningError('MODELSET_MUTABLE', 'conditioning: model set is not deep-frozen (mutable Model detected).');
  }

  // identities are content hashes
  if (!SHA.test(models.derivationIdentity)) {
    throw new ConditioningError('MODELSET_IDENTITY_MISMATCH', 'conditioning: set derivation identity is not a content hash.');
  }
  for (const k of MODEL_KINDS) {
    if (!SHA.test(models.models[k].identity)) {
      throw new ConditioningError('MODELSET_IDENTITY_MISMATCH', `conditioning: '${k}' identity is not a content hash.`);
    }
  }

  // governance references preserved (model- + category-level)
  for (const k of MODEL_KINDS) {
    const m = models.models[k];
    if (!m.governanceReferences?.model?.document) {
      throw new ConditioningError('MODELSET_MISSING_GOVERNANCE', `conditioning: '${k}' missing model governance reference.`);
    }
    for (const cat of Object.keys(m.result)) {
      if (!m.result[cat]?.governanceRef?.document) {
        throw new ConditioningError('MODELSET_MISSING_GOVERNANCE', `conditioning: '${k}.${cat}' missing category governance reference.`);
      }
    }
  }

  // evidence binds the set inputs
  for (const k of MODEL_KINDS) {
    const ev = models.models[k].evidence;
    if (!ev || ev.repositoryIdentity !== models.inputs.repositoryIdentity || ev.briefIdentity !== models.inputs.briefIdentity) {
      throw new ConditioningError('MODELSET_INVALID_EVIDENCE', `conditioning: '${k}' evidence does not bind the set inputs.`);
    }
  }

  // the set was derived against THIS repository
  if (models.inputs.repositoryIdentity !== plan.repositoryIdentity) {
    throw new ConditioningError(
      'MODELSET_REPOSITORY_MISMATCH',
      `conditioning: model set repository ${models.inputs.repositoryIdentity} ≠ plan ${plan.repositoryIdentity}.`,
    );
  }

  // replay — re-assembly from the set's own contents must reproduce every identity
  const replayed = replayModelSet(models);
  if (replayed.derivationIdentity !== models.derivationIdentity) {
    throw new ConditioningError('MODELSET_REPLAY_MISMATCH', 'conditioning: model set does not replay to its derivation identity.');
  }
  for (const k of MODEL_KINDS) {
    if (replayed.models[k].identity !== models.models[k].identity) {
      throw new ConditioningError('MODELSET_REPLAY_MISMATCH', `conditioning: '${k}' does not replay to its identity.`);
    }
  }
}

/** Validate + normalize the execution context (scalar options only; sorted keys). */
function bindExecution(execution: ExecutionContext): ExecutionBindings {
  if (typeof execution.requestId !== 'string' || execution.requestId.trim() === '') {
    throw new ConditioningError('INCOMPLETE_CONDITIONING', 'conditioning: execution.requestId is required.');
  }
  const options: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(execution.options ?? {}).sort()) {
    const v = (execution.options as Record<string, unknown>)[key];
    const t = typeof v;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      throw new ConditioningError(
        'INCOMPLETE_CONDITIONING',
        `conditioning: option '${key}' must be a scalar (string/number/boolean); ` +
          `prompts, HTML, and model parameters may never be bound.`,
      );
    }
    options[key] = v as string | number | boolean;
  }
  return { requestId: execution.requestId, options };
}

/** Validate the plan is structurally complete + carries evidence. */
function validatePlan(plan: CompositionPlan): void {
  const ok =
    !!plan &&
    Array.isArray(plan.order) &&
    Array.isArray(plan.units) &&
    Array.isArray(plan.groups) &&
    plan.order.length > 0 &&
    plan.units.length === plan.order.length &&
    plan.groups.length > 0 &&
    typeof plan.repositoryIdentity === 'string' &&
    SHA.test(plan.repositoryIdentity);
  if (!ok) {
    throw new ConditioningError('INVALID_PLAN', 'conditioning: composition plan is structurally invalid.');
  }
  if (!Array.isArray(plan.obligations) || plan.obligations.length === 0) {
    throw new ConditioningError('MISSING_EVIDENCE', 'conditioning: plan carries no obligations — no traceable evidence.');
  }
}

/**
 * Condition a Composition Plan into an immutable Authoring Context.
 * Throws ConditioningError on an invalid plan, repository-identity mismatch, missing
 * evidence, or incomplete conditioning.
 */
export function condition(
  plan: CompositionPlan,
  repo: CompositionRepository,
  execution: ExecutionContext,
  models?: DerivedModelSet,
): AuthoringContext {
  validatePlan(plan); // INVALID_PLAN / MISSING_EVIDENCE

  // Repository identity: the plan must have been composed against THIS repository.
  const actual = computeRepositoryIdentity(repo);
  if (actual !== plan.repositoryIdentity) {
    throw new ConditioningError(
      'REPOSITORY_IDENTITY_MISMATCH',
      `conditioning: plan repository identity ${plan.repositoryIdentity} ≠ repository ${actual}.`,
    );
  }

  // Phase B — validate the optional carried ModelSet (read-only; fail-loud). Absent ⇒ no-op.
  if (models !== undefined) validateModelSet(models, plan);

  const bindings = bindExecution(execution); // INCOMPLETE_CONDITIONING

  const evidence: RepositoryEvidence = {
    repositoryIdentity: plan.repositoryIdentity,
    assetCount: repo.assets.length,
    candidateCount: plan.evidence.candidateCount,
    obligations: plan.obligations, // carried forward unchanged
  };

  const metadata = {
    conditioningVersion: CONDITIONING_VERSION,
    unitCount: plan.units.length,
    groupCount: plan.groups.length,
    unresolvedPluralityCount: plan.unresolvedPlurality.length,
    obligationCount: plan.obligations.length,
  };

  const conditioningIdentity = digest({
    conditioningVersion: CONDITIONING_VERSION,
    plan: compositionDigest(plan),
    repositoryIdentity: plan.repositoryIdentity,
    execution: { requestId: bindings.requestId, options: bindings.options },
    // Fold the carried set identity in ONLY when present — keeps the default identity byte-identical.
    ...(models ? { modelSet: models.derivationIdentity } : {}),
  });

  const context: AuthoringContext = {
    conditioningIdentity,
    repositoryIdentity: plan.repositoryIdentity,
    plan, // authoritative, unchanged
    obligations: plan.obligations,
    unresolvedPlurality: plan.unresolvedPlurality, // preserved exactly
    evidence,
    execution: bindings,
    metadata,
    // Carry the ModelSet verbatim ONLY when supplied — absent by default (byte-identical context).
    ...(models ? { models } : {}),
  };

  return deepFreeze(context); // immutable output
}

/** Deterministic digest over the authoring context — for replay verification. */
export function conditioningDigest(ctx: AuthoringContext): string {
  return ctx.conditioningIdentity;
}
