/**
 * G1-S1 — Legacy Execution Adapter: the compatibility seam that projects the immutable P55 Generation
 * Contract DOWN to the execution identity the LEGACY render tier consumes — a DesignContext's
 * {client, track}, resolved to the `<client>/<track>` run subject.
 *
 * This is the direction Program G1 mandates: "Native Contract → Compatibility Adapter → Legacy Consumer"
 * (NOT "Legacy State → Native Adapter → Contract"). The Generation Contract is upstream and
 * authoritative; the legacy DesignContext identity becomes a DERIVED projection of it, not an
 * independent source — so the render tier stops reconstructing execution identity on its own. It is the
 * exact mirror of P56 (Doctor) and P57 (Author): the contract owns identity/scope; the RUN owns its
 * payload (brief, tokens, plan) and its IO subject (the `outDir` working-dir path `validate.ts` scores
 * against — deliberately NOT the contract's business).
 *
 * Boundary-only, additive: the live render path (`scripts/generate.ts` → `validate-loop-driver.ts`) is
 * byte-unchanged. A caller holding a READY contract sources its execution identity from HERE instead of
 * from a DesignContext; a caller still holding only a legacy `{client, track}` lifts into the SAME view
 * via `legacyExecutionIdentityFromLegacy` — proven identical to the native path (no duplicate identity).
 */
import type { Track } from '../paths.js';
import { contractDeliverables } from './generation-contract.js';
import type { GenerationPlan } from './generation-plan.js';

/**
 * The exact projection of the Generation Contract the render boundary needs — identity + admitted scope.
 * Same shape as P56's `DoctorGenerationContract` / P57's `AuthorGenerationContract`: the contract owns
 * identity/scope for every consumer.
 */
export interface RenderGenerationContract {
  readonly client: string;
  readonly deliverables: Track[];
}

/**
 * The legacy render tier's execution identity — exactly the fields the run keys on: the DesignContext
 * `client` + `track`, resolved to the canonical `<client>/<track>` subject. (The render RUN's own IO
 * subject — the `outDir` path — is run-owned and stays with the run; this is the identity, not the path.)
 */
export interface LegacyExecutionIdentity {
  readonly client: string;
  readonly track: Track;
  readonly subject: string;
}

/** Native path — project a frozen P55 GenerationPlan to the render boundary view. */
export function renderContractFromPlan(plan: GenerationPlan): RenderGenerationContract {
  return { client: plan.identity.client, deliverables: contractDeliverables(plan) };
}

// G2-S3 — `renderContractFromLegacy` (the render tier's legacy-lift bridge) was RETIRED here: the
// consumer inventory proved it had zero consumers (no production caller, not even a test), no
// architectural ownership, and no future-migration dependency (the render/ReviewPackage identity
// migration completed in G2-S1/S2 — the legacy path lifts identity via `legacyExecutionIdentityFromLegacy`
// and its ReviewPackage via `doctorContractFromLegacy`, never this render-lift). Its live sibling
// `renderContractFromPlan` (built by `orchestrateGeneration`) remains. See G2-S3 report.

function assertInScope(contract: RenderGenerationContract, track: Track): void {
  if (!contract.deliverables.includes(track)) {
    throw new Error(
      `track "${track}" is not in the generation contract's scope [${contract.deliverables.join(', ')}] — ` +
        `the render tier generates only deliverables the contract admitted; it does not decide scope itself.`,
    );
  }
}

/** The render tier's execution identity, sourced FROM the contract — client/track/subject as one view. */
export function legacyExecutionIdentityFromContract(contract: RenderGenerationContract, track: Track): LegacyExecutionIdentity {
  assertInScope(contract, track);
  return { client: contract.client, track, subject: `${contract.client}/${track}` };
}

/**
 * The compatibility bridge — the SAME execution identity built from a legacy DesignContext's
 * {client, track}. Lets a legacy render caller adopt the contract identity shape with no behavioural
 * change; proven byte-identical to `legacyExecutionIdentityFromContract` for the same identity.
 */
export function legacyExecutionIdentityFromLegacy(inputs: { client: string; track: Track }): LegacyExecutionIdentity {
  return { client: inputs.client, track: inputs.track, subject: `${inputs.client}/${inputs.track}` };
}
