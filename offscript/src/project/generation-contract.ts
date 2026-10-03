/**
 * P55 — Generation Contract: the stable, read-only surface over an immutable Generation Plan.
 *
 * Designer Doctor and Designer Author consume the Generation Plan through THESE accessors — so they
 * read the execution contract without ever reaching into Project state directly, and without any way
 * to modify it (the plan is frozen; `verifyContract` proves it is untampered). This is the same
 * read-seam discipline as P52's HistoryReader. Pure reads; no mutation, no I/O.
 *
 * NOTE: this sprint SHIPS the contract; it does not rewire Designer Doctor/Author (their logic is
 * frozen). They are structured to consume this seam next, with no change required here.
 */
import type { Track } from '../paths.js';
import { verifyPlanIntegrity, type GenerationPlan, type GenerationConstraint, type ConstraintKind, type ExecutionAssumption, type GenerationPlanReferences } from './generation-plan.js';

export function contractObjective(plan: GenerationPlan): string {
  return plan.objective;
}

/** The deliverables the plan admits to generation (deck, being design-team-gated, is excluded). */
export function contractDeliverables(plan: GenerationPlan): Track[] {
  return [...plan.scope.included];
}

export function contractCapabilities(plan: GenerationPlan): string[] {
  return [...plan.scope.capabilities];
}

/** Required validations — for one track, or the flat de-duped union across all deliverables. */
export function contractValidations(plan: GenerationPlan, track?: Track): string[] {
  if (track) return [...(plan.requiredValidations.find((v) => v.track === track)?.validations ?? [])];
  return [...new Set(plan.requiredValidations.flatMap((v) => v.validations))];
}

/** Constraints — all, or filtered by kind. */
export function contractConstraints(plan: GenerationPlan, kind?: ConstraintKind): GenerationConstraint[] {
  return plan.constraints.filter((c) => !kind || c.kind === kind);
}

export function contractAssumptions(plan: GenerationPlan): ExecutionAssumption[] {
  return [...plan.assumptions];
}

export function contractRequiredAssets(plan: GenerationPlan): string[] {
  return [...plan.requiredAssets];
}

export function contractReferences(plan: GenerationPlan): GenerationPlanReferences {
  return plan.references;
}

/**
 * The consumer's admission check: a plan is a valid contract iff it is frozen (cannot be mutated) AND
 * self-consistent (its content hash matches its id — it was not tampered with). Doctor/Author call
 * this before consuming.
 */
export function verifyContract(plan: GenerationPlan): boolean {
  return Object.isFrozen(plan) && verifyPlanIntegrity(plan);
}
