/**
 * P57 — Author Contract Adapter: the boundary that makes the immutable P55 Generation Contract
 * Designer Author's official input surface, exactly as P56 did for Designer Doctor.
 *
 * Designer Author's own logic is UNTOUCHED (STOP: no Author changes). Author's real generation entry
 * (`generateProposal` / `generateProposalPackage`, src/designer-author/) already consumes the
 * author-owned surface (kind / semanticFamily / parentComponent / designerIntent / evidence / status
 * plus the `producer`+`authoredBy` attribution) — its authoring decisions — plus two IDENTITY/SCOPE
 * fields carried inside `origin` (`client`; `track`) that the Generation Contract owns
 * (`identity.client`, `scope.included`). This adapter is the seam that SOURCES those two fields from
 * the contract and passes every author-owned field through VERBATIM, so Author stops reconstructing
 * project identity/scope independently.
 *
 * It changes only the BOUNDARY, never behaviour: `ProposalRuntimeInputs` (the request MINUS the two
 * contract-owned `origin` fields) makes explicit that everything except identity/scope flows through
 * untouched — so a proposal built via the contract is byte-identical to one built the pre-adoption
 * (direct) way. It is additive: existing direct callers keep working unchanged; new callers adopt the
 * contract incrementally. The scope gate means Author no longer decides which deliverable it targets —
 * the contract admitted the scope.
 */
import type { Track } from '../paths.js';
import { type ProposalOrigin } from '../designer-author/proposal.js';
import {
  generateProposal,
  generateProposalPackage,
  type ProposalGenerationRequest,
  type GenerateProposalOptions,
} from '../designer-author/proposal-generator.js';
import type { AuthorProposal } from '../designer-author/proposal.js';
import type { ProposalPackage } from '../designer-author/proposal-package.js';
import { contractDeliverables } from './generation-contract.js';
import type { GenerationPlan } from './generation-plan.js';

/**
 * The exact projection of the Generation Contract that Author's boundary needs — identity + scope.
 * Everything else Author consumes is author-owned authoring decisions, not part of the contract.
 * (Same shape as P56's DoctorGenerationContract — the contract owns identity/scope for both.)
 */
export interface AuthorGenerationContract {
  readonly client: string;
  readonly deliverables: Track[];
}

/** The author-owned `origin` — the full origin MINUS the two contract-owned fields (client, track). */
export type AuthorRuntimeOrigin = Omit<ProposalOrigin, 'client' | 'track'>;

/** The author-owned request surface — the generation request with its `origin` stripped of identity/scope. */
export type ProposalRuntimeInputs = Omit<ProposalGenerationRequest, 'origin'> & { readonly origin: AuthorRuntimeOrigin };

/** Native path — project a frozen P55 GenerationPlan to the Author boundary view. */
export function authorContractFromPlan(plan: GenerationPlan): AuthorGenerationContract {
  return { client: plan.identity.client, deliverables: contractDeliverables(plan) };
}

// G4-S2 — `authorContractFromLegacy` (the legacy scattered-identity lift bridge) was REMOVED here: G4-S1
// proved it had zero production consumers (Author's native entry sources its contract from
// `authorContractFromPlan` via the orchestrator). The retained helpers below drive the contract-sourced
// Author boundary unchanged; a `{ client, deliverables }` literal builds an AuthorGenerationContract
// directly where a bare boundary view is needed.

function assertInScope(contract: AuthorGenerationContract, track: Track): void {
  if (!contract.deliverables.includes(track)) {
    throw new Error(
      `track "${track}" is not in the generation contract's scope [${contract.deliverables.join(', ')}] — ` +
        `Designer Author authors only deliverables the contract admitted; it does not decide scope itself.`,
    );
  }
}

/** The proposal origin — client/track sourced from the contract, producer/authoredBy VERBATIM. */
export function authorOriginFromContract(contract: AuthorGenerationContract, track: Track, runtimeOrigin: AuthorRuntimeOrigin): ProposalOrigin {
  assertInScope(contract, track);
  return { ...runtimeOrigin, client: contract.client, track };
}

/** Assemble Author's existing ProposalGenerationRequest: origin identity FROM the contract, everything else VERBATIM. */
export function proposalRequestFromContract(contract: AuthorGenerationContract, track: Track, runtime: ProposalRuntimeInputs): ProposalGenerationRequest {
  const { origin, ...rest } = runtime;
  return { ...rest, origin: authorOriginFromContract(contract, track, origin) };
}

/** The official contract-driven Author entry — runs the UNMODIFIED `generateProposal`. */
export function generateProposalFromContract(
  contract: AuthorGenerationContract,
  track: Track,
  runtime: ProposalRuntimeInputs,
  opts: GenerateProposalOptions = {},
): AuthorProposal {
  return generateProposal(proposalRequestFromContract(contract, track, runtime), opts);
}

/** The official contract-driven package entry — runs the UNMODIFIED `generateProposalPackage`. */
export function generateProposalPackageFromContract(
  contract: AuthorGenerationContract,
  track: Track,
  runtime: ProposalRuntimeInputs,
  opts: GenerateProposalOptions = {},
): ProposalPackage {
  return generateProposalPackage(proposalRequestFromContract(contract, track, runtime), opts);
}
