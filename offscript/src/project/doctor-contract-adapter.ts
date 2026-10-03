/**
 * P56 — Doctor Contract Adapter: the boundary that makes the immutable P55 Generation Contract
 * Designer Doctor's official input surface.
 *
 * Designer Doctor's own logic is UNTOUCHED (STOP: no Doctor changes). Doctor's real entry
 * (`buildDoctorReport` / `buildReviewPackage`, src/doctor/) already consumes a run's diagnostic
 * surface (health / perRail / frozen / plan / score) — uniquely owned by the generation RUN — plus a
 * few IDENTITY/FRAMING fields (`subject`; `client`+`track`) that the Generation Contract owns
 * (`identity.client`, `scope.included`). This adapter is the seam that SOURCES those identity fields
 * from the contract and passes the run-owned diagnostics through VERBATIM, so Doctor stops
 * reconstructing project identity/scope independently.
 *
 * It changes only the BOUNDARY, never behaviour: `Omit<DoctorReportInput, 'subject'>` /
 * `Omit<ReviewPackageInput, 'client'|'track'>` make explicit that everything except the contract-owned
 * identity flows through untouched — so a report built via the contract is byte-identical to one built
 * the pre-adoption (direct) way. It is additive: existing direct callers (e.g. the protected
 * `validate-loop-driver`) keep working unchanged; new callers adopt the contract incrementally.
 */
import type { Track } from '../paths.js';
import { buildDoctorReport, type DoctorReportInput, type DoctorReport } from '../doctor/doctor-report.js';
import { buildReviewPackage, type ReviewPackageInput, type ReviewPackage } from '../doctor/review-package.js';
import { contractDeliverables } from './generation-contract.js';
import type { GenerationPlan } from './generation-plan.js';

/**
 * The exact projection of the Generation Contract that Doctor's boundary needs — identity + scope.
 * Everything else Doctor consumes is run-owned diagnostics, not part of the contract.
 */
export interface DoctorGenerationContract {
  readonly client: string;
  readonly deliverables: Track[];
}

/** The run-owned diagnostic surface — Doctor's input MINUS the one contract-owned field (`subject`). */
export type DoctorRuntimeInputs = Omit<DoctorReportInput, 'subject'>;

/** The run-owned review-package surface — MINUS the two contract-owned fields (`client`, `track`). */
export type ReviewPackageRuntimeInputs = Omit<ReviewPackageInput, 'client' | 'track'>;

/** Native path — project a frozen P55 GenerationPlan to the Doctor boundary view. */
export function doctorContractFromPlan(plan: GenerationPlan): DoctorGenerationContract {
  return { client: plan.identity.client, deliverables: contractDeliverables(plan) };
}

/**
 * Migration bridge — lift the legacy scattered identity (client + which deliverables) into the same
 * boundary view. Lets a caller that does not yet hold a native plan adopt the contract surface with no
 * behavioural change (proven identical to the native path).
 */
export function doctorContractFromLegacy(inputs: { client: string; deliverables: Track[] }): DoctorGenerationContract {
  return { client: inputs.client, deliverables: [...inputs.deliverables] };
}

function assertInScope(contract: DoctorGenerationContract, track: Track): void {
  if (!contract.deliverables.includes(track)) {
    throw new Error(
      `track "${track}" is not in the generation contract's scope [${contract.deliverables.join(', ')}] — ` +
        `Designer Doctor diagnoses only deliverables the contract admitted; it does not decide scope itself.`,
    );
  }
}

/** The run subject Doctor echoes — `<client>/<track>`, sourced from the contract identity + scope. */
export function doctorSubjectFromContract(contract: DoctorGenerationContract, track: Track): string {
  assertInScope(contract, track);
  return `${contract.client}/${track}`;
}

/** Assemble Doctor's existing DoctorReportInput: subject FROM the contract, diagnostics VERBATIM. */
export function doctorInputFromContract(contract: DoctorGenerationContract, track: Track, runtime: DoctorRuntimeInputs): DoctorReportInput {
  return { subject: doctorSubjectFromContract(contract, track), ...runtime };
}

/** The official contract-driven Doctor entry — runs the UNMODIFIED `buildDoctorReport`. */
export function buildDoctorReportFromContract(contract: DoctorGenerationContract, track: Track, runtime: DoctorRuntimeInputs): DoctorReport {
  return buildDoctorReport(doctorInputFromContract(contract, track, runtime));
}

/** Assemble the review-package input: client/track FROM the contract, everything else VERBATIM. */
export function reviewPackageInputFromContract(contract: DoctorGenerationContract, track: Track, runtime: ReviewPackageRuntimeInputs): ReviewPackageInput {
  assertInScope(contract, track);
  return { client: contract.client, track, ...runtime };
}

/** The official contract-driven review-package entry — runs the UNMODIFIED `buildReviewPackage`. */
export function buildReviewPackageFromContract(contract: DoctorGenerationContract, track: Track, runtime: ReviewPackageRuntimeInputs): ReviewPackage {
  return buildReviewPackage(reviewPackageInputFromContract(contract, track, runtime));
}
