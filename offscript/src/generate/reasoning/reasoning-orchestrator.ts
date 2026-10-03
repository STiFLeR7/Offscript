/**
 * Sprint W13 — Production Wiring & Pipeline Unification: the single governed-reasoning path.
 *
 * This module is the ONE production entry point for reasoning enrichment, resolving the two High
 * findings of the W12 audit:
 *   H1 (unwired) — the seven W5–W11 consumers now have a production caller (wired in scripts/generate.ts).
 *   H2 (dual populators) — the per-section W3/W4 reasoning-producer loop is removed from production;
 *     this orchestrator (Governed Producer's models → seven consumers) is the only populator of
 *     PlanItem.reasoning on the production path. (The W3/W4 producer modules remain as tested
 *     infrastructure; they are simply no longer the production reasoning path. Rationale: Progression
 *     reorders the WHOLE plan, structurally incompatible with a per-section producer loop, and the seven
 *     model consumers are the governance-grounded mechanism the architecture chose.)
 *
 * The pipeline, conceptually:
 *   Raw Brief → Governed Producer (World-A deriveModels) → the seven Governance Models → THIS
 *   orchestrator (the seven consumers, in the canonical descent) → PlanItem.reasoning → Author request
 *   (W2 transport) → Author → HTML.
 *
 * THE MERGE CONTRACT (deterministic, replayable). The consumers run in the canonical AUTHORED
 * GOVERNANCE DESCENT — the dependency chain recorded in WORLD-B-EVOLUTION-ARCHITECTURE.md §6 and
 * resolved in GOVERNANCE-GATES-G1-G2-G3-RESOLUTION.md (this supersedes the order literally listed in the
 * W13 implementation prompt; decided 2026-06-30, recorded in SPRINT-W13-PRODUCTION-WIRING-REPORT.md):
 *
 *   Communication → Information → Progression → Spatial → Mechanism → Visual → Experience Character
 *
 * Every field-contributing consumer APPENDS its prefixed clause (W5/W7 were converted from fill-if-empty
 * to append in W13 so no contribution is dropped under this order — fixes W12 M1/M2). Single-owner
 * fields are untouched by anyone but their owner: Progression owns ordering / transition; Mechanism owns
 * role. Because each consumer no-ops on an empty model, an inert / absent model set is byte-identical.
 *
 * Read-only World-A consumption: imports the model TYPES only; the consumers read the frozen models and
 * never mutate World A.
 */
import type { AuthoringPlan } from '../types.js';
import type { DerivedModelSet, ModelKind } from '../../knowledge/derivation/models.js';
import { dedupeReasoningClauses } from '../section-reasoning.js';
import { enrichPlanWithInformation } from './information-consumption.js';
import { applyProgression } from './progression-consumption.js';
import { applyMechanism } from './mechanism-consumption.js';
import { applyCommunication } from './communication-consumption.js';
import { applySpatial } from './spatial-consumption.js';
import { applyVisual } from './visual-consumption.js';
import { applyExperience } from './experience-consumption.js';

/**
 * The canonical governance descent — the fixed, replayable apply/merge order. This is the single
 * source of truth for the order in which the seven Models enrich reasoning.
 */
export const GOVERNED_REASONING_ORDER = [
  'communication',
  'information',
  'progression',
  'spatial',
  'mechanism',
  'visual',
  'experienceCharacter',
] as const;

/** Dependencies of the single governed-reasoning path. */
export interface GovernedReasoningDeps {
  /**
   * The seven Governance Models (the Governed Producer's output — World-A `deriveModels`).
   * ABSENT ⇒ governed reasoning is disabled ⇒ the plan is untouched ⇒ byte-identical (the default).
   */
  readonly models?: DerivedModelSet;
}

/** The outcome of one orchestration pass — observability, not a side channel. */
export interface GovernedReasoningResult {
  /** true iff a model set was supplied and the pipeline ran (consumers may still each no-op). */
  readonly enabled: boolean;
  /** the consumers invoked, in canonical order (empty when disabled). */
  readonly applied: readonly ModelKind[];
}

/**
 * Enrich a plan with governed reasoning — THE single production path. Validates + applies the seven
 * consumers in the canonical descent, each AUGMENT/APPEND-only, fail-loud (a malformed model throws
 * through here — never silently mis-enriches). Mutates the plan in place (Progression reorders; the
 * field-contributors append reasoning). When no model set is supplied, it is a no-op: the plan, the
 * rulebook, the author requests, and the HTML are byte-identical to the pre-W13 default.
 *
 * `repositoryIdentity` is taken from the model set's own inputs, so the per-consumer repository check
 * always validates against the identity the models were derived against.
 */
export function enrichPlanWithGovernedReasoning(
  plan: AuthoringPlan,
  deps: GovernedReasoningDeps,
): GovernedReasoningResult {
  const set = deps.models;
  if (!set) {
    return { enabled: false, applied: [] };
  }
  const opts = { repositoryIdentity: set.inputs.repositoryIdentity };
  const m = set.models;

  // The canonical descent. Order is load-bearing (the deterministic merge contract); do not reorder.
  applyCommunication(plan, m.communication, opts);
  enrichPlanWithInformation(plan, m.information, opts);
  applyProgression(plan, m.progression, opts);
  applySpatial(plan, m.spatial, opts);
  applyMechanism(plan, m.mechanism, opts);
  applyVisual(plan, m.visual, opts);
  applyExperience(plan, m.experienceCharacter, opts);

  // W13 merge-contract guarantee: no duplicate clauses. Two Models may author the same fragment; collapse
  // repeats once, after the full descent (the only clause-removing step — every consumer is append-only).
  for (const item of plan.items) {
    if (item.reasoning) item.reasoning = dedupeReasoningClauses(item.reasoning);
  }

  return { enabled: true, applied: [...GOVERNED_REASONING_ORDER] };
}
