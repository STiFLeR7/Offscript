/**
 * P58 — Generation-Engine Contract Orchestration: the seam that makes the Generation Engine an
 * ORCHESTRATOR over one immutable execution contract, completing the P55→P56→P57 migration.
 *
 * Before P58 the two post-readiness consumers each held their own contract projection
 * (doctorContractFromPlan / authorContractFromPlan) and a caller wiring them from scattered project
 * state could reconstruct identity twice. This module removes that possibility: it builds the P55
 * Generation Contract EXACTLY ONCE (`orchestrateGeneration`) and derives BOTH boundary views — Doctor's
 * (P56) and Author's (P57) — from that single frozen instance. Every downstream component consumes the
 * same immutable contract; none reconstructs execution identity or scope independently.
 *
 * It changes only ORCHESTRATION, never behaviour: it reuses the UNMODIFIED planner
 * (`planGeneration` — the admission gate that throws for a non-READY project), the UNMODIFIED contract
 * verifier (`verifyContract`), and the UNMODIFIED P56/P57 adapters (which call the UNMODIFIED Doctor /
 * Author). Driving Doctor/Author through the orchestrated contract is byte-identical to the direct
 * (pre-adoption) path. It is additive: the legacy render driver (`validate-loop-driver`) keeps working
 * unchanged; this is the native orchestration path a caller adopts when it holds a READY project.
 *
 * Boundaries: this module imports ONLY the Project-Platform composers (planner, readiness evaluator,
 * contract verifier) and the two sanctioned adapters — never `src/doctor/*` or `src/designer-author/*`
 * directly — so it introduces no new consumer of either protected subsystem.
 */
import type { Track } from '../paths.js';
import type { ProjectReadiness, ReadinessAssessment } from './readiness.js';
import type { ReadinessPolicy } from './readiness-policy.js';
import { evaluateReadiness } from './readiness-evaluator.js';
import { planGeneration } from './generation-planner.js';
import { verifyContract } from './generation-contract.js';
import type { GenerationPlan } from './generation-plan.js';
import {
  doctorContractFromPlan,
  buildDoctorReportFromContract,
  buildReviewPackageFromContract,
  type DoctorGenerationContract,
  type DoctorRuntimeInputs,
  type ReviewPackageRuntimeInputs,
} from './doctor-contract-adapter.js';
import {
  authorContractFromPlan,
  generateProposalFromContract,
  type AuthorGenerationContract,
  type ProposalRuntimeInputs,
} from './author-contract-adapter.js';
import {
  renderContractFromPlan,
  legacyExecutionIdentityFromContract,
  legacyExecutionIdentityFromLegacy,
  type RenderGenerationContract,
  type LegacyExecutionIdentity,
} from './legacy-execution-adapter.js';

export interface GenerationOrchestrationInput {
  readonly client: string;
  readonly readiness: ProjectReadiness;
  /** Optional readiness-policy seam (mirrors planGenerationFor) — a future AI policy drops in here. */
  readonly policy?: ReadinessPolicy;
  /** The prior contract this one supersedes, if this is a re-orchestration (a change ⇒ a new contract). */
  readonly supersedes?: string;
}

/** The result of one orchestration: the SINGLE contract plus the two boundary views derived from it. */
export interface GenerationOrchestration {
  /** The one immutable Generation Contract — built exactly once; every consumer reads THIS instance. */
  readonly contract: GenerationPlan;
  /** The readiness assessment that admitted the project (the gate that let generation begin). */
  readonly assessment: ReadinessAssessment;
  /** Doctor's boundary view — a projection of `contract`, NOT a second contract. */
  readonly doctorContract: DoctorGenerationContract;
  /** Author's boundary view — a projection of the SAME `contract`. */
  readonly authorContract: AuthorGenerationContract;
  /**
   * G1-S1 — the render tier's boundary view — a projection of the SAME `contract`. The legacy
   * DesignContext {client, track} execution identity is now derived from HERE, not reconstructed.
   */
  readonly renderContract: RenderGenerationContract;
  /** The contract's content-hash id — the shared identity every consumer agrees on. */
  readonly contractId: string;
}

/**
 * Orchestrate generation: verify readiness → build the contract ONCE → derive both boundary views from
 * it. `planGeneration` is the admission gate — it THROWS if the project was not READY, so no contract
 * exists without readiness. The contract is frozen and self-verifying (`verifyContract`).
 */
export function orchestrateGeneration(input: GenerationOrchestrationInput): GenerationOrchestration {
  const assessment = evaluateReadiness(input.readiness, input.policy ? { policy: input.policy } : {});
  const contract = planGeneration({
    client: input.client,
    readiness: input.readiness,
    assessment,
    ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
  });
  if (!verifyContract(contract)) {
    throw new Error(`generation orchestration: the built contract failed integrity verification (planId ${contract.planId}).`);
  }
  return {
    contract,
    assessment,
    doctorContract: doctorContractFromPlan(contract),
    authorContract: authorContractFromPlan(contract),
    renderContract: renderContractFromPlan(contract),
    contractId: contract.planId,
  };
}

/** Drive Designer Doctor from the orchestrated contract — the ONE contract's identity, run diagnostics verbatim. */
export function runDoctorFromOrchestration(orch: GenerationOrchestration, track: Track, diagnostics: DoctorRuntimeInputs) {
  return buildDoctorReportFromContract(orch.doctorContract, track, diagnostics);
}

/** Drive Designer Author from the orchestrated contract — the SAME contract's identity, authoring inputs verbatim. */
export function runAuthorFromOrchestration(
  orch: GenerationOrchestration,
  track: Track,
  authoring: ProposalRuntimeInputs,
  opts: { readonly now?: () => string } = {},
) {
  return generateProposalFromContract(orch.authorContract, track, authoring, opts);
}

/**
 * G1-S1 — the render tier's execution identity, sourced from the orchestrated contract. This is what
 * replaces the legacy reconstruction from a DesignContext's `client`/`track`: one frozen contract, one
 * identity, for the render boundary too.
 */
export function renderIdentityFromOrchestration(orch: GenerationOrchestration, track: Track): LegacyExecutionIdentity {
  return legacyExecutionIdentityFromContract(orch.renderContract, track);
}

/**
 * G1-S1 — drive the render tier's terminal handoff artifact (the Designer Review Package) from the
 * orchestrated contract: client/track sourced from the ONE contract, every run-owned diagnostic passed
 * verbatim. Byte-identical to the direct `buildReviewPackage({ client, track, ... })` the legacy render
 * path calls today — the "→ Generation" boundary at the terminal artifact, with no behavioural change.
 */
export function runReviewPackageFromOrchestration(orch: GenerationOrchestration, track: Track, runtime: ReviewPackageRuntimeInputs) {
  return buildReviewPackageFromContract(orch.doctorContract, track, runtime);
}

// ── G1-S2: the native generation entrypoint ──────────────────────────────────────────────────────────
// `beginGeneration` is the native starting point for a caller that holds a READY project. It runs the ONE
// engine (`orchestrateGeneration`) and materializes the legacy execution identity EXACTLY ONCE per
// admitted deliverable — the single compatibility projection. Every downstream legacy consumer (Doctor,
// Author, ReviewPackage) is driven from THAT one materialized identity, never re-derived from scattered
// project state, so execution identity has a single source of truth. This is the migrated entrypoint —
// Generation Contract → Engine → (single) Compatibility Projection → Legacy Consumers — NOT a new engine
// or a parallel orchestrator: it composes the one existing orchestrator and the unmodified adapters. The
// native path constructs NO DesignContext; the live CLI's DesignContext remains a legacy compatibility
// seam (it holds no ProjectReadiness, so it cannot build a contract — see G1-S2 report §7/§8).

/** The native generation entry: the one engine result + the single materialized legacy execution identity. */
export interface NativeGeneration {
  readonly orchestration: GenerationOrchestration;
  /** The ONE legacy execution identity per admitted deliverable — derived once, shared by every consumer. */
  readonly legacyIdentity: ReadonlyMap<Track, LegacyExecutionIdentity>;
}

/**
 * Begin generation natively from a READY project: run the single engine, then materialize the legacy
 * execution identity EXACTLY ONCE for each admitted deliverable. The returned `legacyIdentity` map is the
 * single source of truth every downstream consumer reads.
 */
export function beginGeneration(input: GenerationOrchestrationInput): NativeGeneration {
  const orchestration = orchestrateGeneration(input);
  const legacyIdentity = new Map<Track, LegacyExecutionIdentity>();
  for (const track of orchestration.contract.scope.included) {
    legacyIdentity.set(track, legacyExecutionIdentityFromContract(orchestration.renderContract, track));
  }
  return { orchestration, legacyIdentity };
}

/** The single materialized identity for an admitted track — throws (scope) if the contract did not admit it. */
function nativeIdentity(gen: NativeGeneration, track: Track): LegacyExecutionIdentity {
  const id = gen.legacyIdentity.get(track);
  if (!id) {
    throw new Error(
      `track "${track}" is not in the generation contract's scope [${[...gen.legacyIdentity.keys()].join(', ')}] — ` +
        `the native entrypoint drives only the deliverables the contract admitted.`,
    );
  }
  return id;
}

/** Drive Designer Doctor from the native entrypoint — identity FROM the single materialized projection. */
export function nativeDoctorReport(gen: NativeGeneration, track: Track, diagnostics: DoctorRuntimeInputs) {
  const id = nativeIdentity(gen, track);
  return buildDoctorReportFromContract({ client: id.client, deliverables: [id.track] }, id.track, diagnostics);
}

/** Drive Designer Author from the native entrypoint — identity FROM the single materialized projection. */
export function nativeAuthorProposal(
  gen: NativeGeneration,
  track: Track,
  authoring: ProposalRuntimeInputs,
  opts: { readonly now?: () => string } = {},
) {
  const id = nativeIdentity(gen, track);
  return generateProposalFromContract({ client: id.client, deliverables: [id.track] }, id.track, authoring, opts);
}

/** Drive the render tier's terminal ReviewPackage from the native entrypoint — identity FROM the single projection. */
export function nativeReviewPackage(gen: NativeGeneration, track: Track, runtime: ReviewPackageRuntimeInputs) {
  const id = nativeIdentity(gen, track);
  return buildReviewPackageFromContract({ client: id.client, deliverables: [id.track] }, id.track, runtime);
}

// ── G1-S4: the CLI's native-vs-legacy generation entry ───────────────────────────────────────────────
// The generation CLI OWNS artifact loading (it reads the persisted ProjectReadiness — G1-S3); this owns
// the orchestration DECISION. Given a possibly-absent persisted readiness, it resolves how generation
// begins: NATIVE (build the contract EXACTLY ONCE from persisted readiness via `beginGeneration`, governed
// by the readiness gate + the contract scope) or LEGACY (no readiness → the existing compatibility path).
// It NEVER synthesizes readiness: a valid-but-not-READY readiness makes `beginGeneration` throw (the P54
// admission gate), and a track outside the contract's admitted scope makes the identity projection throw —
// both are fail-closed conditions the CLI surfaces, never worked around.

// G2-S2 — BOTH modes carry `identity`: the execution-identity projection DesignContext transports. On the
// native path it is sourced FROM the frozen GenerationContract (`renderIdentityFromOrchestration`); on the
// legacy path it is the compatibility bridge (`legacyExecutionIdentityFromLegacy`) over the caller's
// {client, track}. The two are byte-identical for the same identity, so `entry.identity` is the ONE source
// the CLI uses for the run's execution identity — never re-originated from a DesignContext.
export type GenerationEntry =
  | { readonly mode: 'native'; readonly generation: NativeGeneration; readonly identity: LegacyExecutionIdentity }
  | { readonly mode: 'legacy'; readonly reason: string; readonly identity: LegacyExecutionIdentity };

/**
 * Resolve the generation entry from a possibly-absent persisted ProjectReadiness. Null ⇒ legacy fallback,
 * whose `identity` is the compatibility bridge over {client, track}. Present ⇒ native: build the contract
 * once and derive the single execution identity for `track` FROM it — both throw (fail closed) if the
 * project is not READY or the track is not admitted. Never synthesizes readiness. Either way, `entry.identity`
 * is the sole execution-identity projection the caller threads into the DesignContext.
 */
export function resolveGenerationEntry(input: {
  readonly client: string;
  readonly track: Track;
  readonly readiness: ProjectReadiness | null;
}): GenerationEntry {
  if (input.readiness === null) {
    return {
      mode: 'legacy',
      reason: 'no persisted readiness (projects/<client>/readiness.json absent)',
      identity: legacyExecutionIdentityFromLegacy({ client: input.client, track: input.track }),
    };
  }
  const generation = beginGeneration({ client: input.client, readiness: input.readiness });
  const identity = renderIdentityFromOrchestration(generation.orchestration, input.track);
  return { mode: 'native', generation, identity };
}
