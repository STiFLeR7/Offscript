/**
 * Sprint W8 — the Communication Consumption verification harness.
 *
 * Verifies the planner's consumption of the World-A Communication Model obeys its invariants. It runs
 * the enrichment on a deep copy (never mutating the caller's plan) and emits a structured report.
 * Mirrors the W5 / W6 / W7 harnesses — never throws on a finding; records a failed check.
 *
 * Dimensions:
 *   selection     — the section SET + COUNT are identical and the ORDER is unchanged (W6 owns ordering)
 *   evidence      — every retained section's communicationObjective is enriched (the HOW)
 *   immutability  — the enriched reasoning is deep-frozen
 *   scope         — role / orderingRationale / transition are NEVER written by W8
 *   replay        — deterministic: a second run of a fresh copy reproduces the reasoning
 */
import type { AuthoringPlan, PlanItem } from '../types.js';
import type { GovernedModel } from '../../knowledge/derivation/models.js';
import { applyCommunication, buildCommunicationEvidence, type CommunicationConsumptionOpts } from './communication-consumption.js';

export const COMMUNICATION_CONSUMPTION_HARNESS_VERSION = '0.1.0';

const DIMENSIONS = ['selection', 'evidence', 'immutability', 'scope', 'replay'] as const;
export type CommunicationConsumptionCategory = (typeof DIMENSIONS)[number];

export interface CommunicationConsumptionCheck {
  readonly category: CommunicationConsumptionCategory;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface CommunicationConsumptionReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly itemsEnriched: number;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<CommunicationConsumptionCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly CommunicationConsumptionCheck[];
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = CommunicationConsumptionCheck[];
function check(out: Checks, category: CommunicationConsumptionCategory, name: string, passed: boolean, detail = ''): void {
  out.push({ category, name, passed, detail });
}

function clonePlan(plan: AuthoringPlan): AuthoringPlan {
  return { ...plan, items: plan.items.map((i) => ({ ...i })) as PlanItem[] };
}

/**
 * Verify one communication-consumption run and produce a report. Enriches a copy, checks selection /
 * evidence / immutability / scope, and re-runs a second copy to prove determinism. Never throws on a
 * finding; a run that fails the lifecycle (mismatch, malformed, …) is recorded as a failed
 * `selection` check.
 */
export async function verifyCommunicationConsumption(
  plan: AuthoringPlan,
  communicationModel: GovernedModel<'communication'>,
  opts: CommunicationConsumptionOpts,
): Promise<CommunicationConsumptionReport> {
  const out: Checks = [];
  const originalIds = plan.items.map((i) => i.anchor.id);

  let expected: { communicationObjective?: string };
  const work = clonePlan(plan);
  try {
    expected = buildCommunicationEvidence(communicationModel);
    applyCommunication(work, communicationModel, opts);
  } catch (e) {
    check(out, 'selection', 'consumption completes the lifecycle', false, e instanceof Error ? e.message : String(e));
    return finalize(out, 0);
  }

  const ids = work.items.map((i) => i.anchor.id);

  // selection — same SET, same COUNT, same ORDER (W8 never changes selection or ordering)
  check(out, 'selection', 'section set is identical (no add / remove / rename)', [...ids].sort().join(',') === [...originalIds].sort().join(','));
  check(out, 'selection', 'section count is unchanged', work.items.length === plan.items.length);
  check(out, 'selection', 'section order is unchanged (ordering belongs to W6)', ids.join(',') === originalIds.join(','));

  // evidence + immutability + scope, per item
  let itemsEnriched = 0;
  for (const it of work.items) {
    const r = it.reasoning;
    const enriched = !!r && r.communicationObjective !== undefined;
    if (enriched) itemsEnriched++;
    check(out, 'evidence', `item ${it.anchor.id} communicationObjective is enriched (the HOW)`, enriched);
    if (expected.communicationObjective) check(out, 'evidence', `item ${it.anchor.id} carries the expected communication HOW`, !!r && r.communicationObjective === expected.communicationObjective);
    check(out, 'immutability', `item ${it.anchor.id} reasoning is deep-frozen`, !r || deepFrozen(r));
    check(out, 'scope', `item ${it.anchor.id} leaves role / orderingRationale / transition untouched`, !r || (r.role === undefined && r.orderingRationale === undefined && r.transition === undefined));
  }

  // replay — deterministic
  const again = clonePlan(plan);
  try {
    applyCommunication(again, communicationModel, opts);
    const sameReasoning = JSON.stringify(again.items.map((i) => i.reasoning)) === JSON.stringify(work.items.map((i) => i.reasoning));
    const sameOrder = again.items.map((i) => i.anchor.id).join(',') === ids.join(',');
    check(out, 'replay', 'enrichment is deterministic (reasoning + order reproduce)', sameReasoning && sameOrder);
  } catch (e) {
    check(out, 'replay', 'enrichment is deterministic (reasoning + order reproduce)', false, e instanceof Error ? e.message : String(e));
  }

  return finalize(out, itemsEnriched);
}

function finalize(out: Checks, itemsEnriched: number): CommunicationConsumptionReport {
  const byCategory = Object.fromEntries(DIMENSIONS.map((c) => [c, { passed: 0, failed: 0 }])) as Record<CommunicationConsumptionCategory, { passed: number; failed: number }>;
  let passed = 0;
  for (const c of out) {
    if (c.passed) {
      passed++;
      byCategory[c.category].passed++;
    } else {
      byCategory[c.category].failed++;
    }
  }
  return {
    ok: passed === out.length && out.length > 0,
    harnessVersion: COMMUNICATION_CONSUMPTION_HARNESS_VERSION,
    itemsEnriched,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}
