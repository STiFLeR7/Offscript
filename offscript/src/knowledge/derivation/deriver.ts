/**
 * Sprint X — the derivation lifecycle + the injected ModelDeriver seam.
 *
 * `deriveModels` is the layer's single entry point. It validates the Raw Brief and the Repository
 * handle, computes the inputs provenance, invokes the injected `ModelDeriver` (the SOLE reasoning
 * point), then deterministically assembles + validates + freezes the seven Models. The lifecycle
 * itself is deterministic; the only non-deterministic element is the deriver's reasoning, which is
 * recorded and made replayable inside the result.
 *
 * Provider independence: the lifecycle depends only on the abstract `ModelDeriver` interface — a
 * deterministic scripted double (CI/verification) and an in-session subagent seam implement it
 * (scripted-deriver.ts). The layer NEVER calls a provider directly. Mirrors authoring.ts.
 *
 * Phase A boundary: the returned Models are NEVER consumed downstream.
 */
import {
  MODEL_SCHEMA,
  MODEL_KINDS,
  assembleModelSet,
  briefIdentity,
  DerivationError,
  type RawBrief,
  type ModelDraft,
  type DerivationInputs,
  type DerivedModelSet,
} from './models.js';

const SHA = /^sha256:[0-9a-f]{64}$/;

/** The Repository handle the layer consumes — bound by its content identity, not its contents. */
export interface DerivationRepository {
  /** The canonical repository identity (caller computes it; the layer binds evidence to it). */
  readonly repositoryIdentity: string;
  readonly assetCount: number;
  /** Optional override of the governance documents consulted; defaults to the seven constitutions. */
  readonly governanceDocuments?: readonly string[];
}

/** What the injected deriver receives — the brief + the bound repository facts. */
export interface DerivationRequest {
  readonly brief: RawBrief;
  readonly repositoryIdentity: string;
  readonly assetCount: number;
}

/** The abstract derivation seam. The scripted double + the subagent seam implement this. */
export interface ModelDeriver {
  readonly name: string;
  derive(request: DerivationRequest): readonly ModelDraft[] | Promise<readonly ModelDraft[]>;
}

/** The seven constitutions consulted, derived once from the schema (unique, sorted). */
export const GOVERNANCE_DOCUMENTS: readonly string[] = [
  ...new Set(MODEL_KINDS.map((k) => MODEL_SCHEMA[k].model.document)),
].sort();

function validateBrief(brief: RawBrief): void {
  const ok =
    !!brief &&
    typeof brief === 'object' &&
    typeof brief.brand === 'string' &&
    brief.brand.trim().length > 0 &&
    typeof brief.oneLiner === 'string' &&
    brief.oneLiner.trim().length > 0;
  if (!ok) {
    throw new DerivationError('INVALID_BRIEF', 'derivation: raw brief must carry at least a brand and a one-liner.');
  }
}

function validateRepository(repo: DerivationRepository): void {
  const ok =
    !!repo &&
    typeof repo === 'object' &&
    typeof repo.repositoryIdentity === 'string' &&
    SHA.test(repo.repositoryIdentity) &&
    Number.isInteger(repo.assetCount) &&
    repo.assetCount >= 0;
  if (!ok) {
    throw new DerivationError('INVALID_INPUTS', 'derivation: repository handle is invalid (identity must be a content hash).');
  }
}

/**
 * Derive the seven Governance Models from a Raw Brief + Repository through an injected deriver.
 * Deterministic lifecycle: validate → invoke deriver → assemble + validate + freeze. Replayable:
 * the same brief + repository + deriver reproduce the same identities.
 */
export async function deriveModels(
  brief: RawBrief,
  repo: DerivationRepository,
  deriver: ModelDeriver,
): Promise<DerivedModelSet> {
  validateBrief(brief);
  validateRepository(repo);
  if (!deriver || typeof deriver.derive !== 'function' || typeof deriver.name !== 'string') {
    throw new DerivationError('INVALID_INPUTS', 'derivation: a ModelDeriver with a name + derive() is required.');
  }

  const inputs: DerivationInputs = {
    briefIdentity: briefIdentity(brief),
    repositoryIdentity: repo.repositoryIdentity,
    assetCount: repo.assetCount,
    governanceDocuments: repo.governanceDocuments ? [...repo.governanceDocuments] : GOVERNANCE_DOCUMENTS,
  };

  const request: DerivationRequest = {
    brief,
    repositoryIdentity: repo.repositoryIdentity,
    assetCount: repo.assetCount,
  };
  const drafts = await deriver.derive(request);
  if (!Array.isArray(drafts)) {
    throw new DerivationError('INVALID_DRAFT', 'derivation: deriver must return an array of model drafts.');
  }

  return assembleModelSet(drafts, inputs, deriver.name);
}
