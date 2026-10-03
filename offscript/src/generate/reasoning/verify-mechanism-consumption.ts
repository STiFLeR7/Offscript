/**
 * Sprint W7 — the Mechanism Consumption verification harness.
 *
 * Verifies the planner's consumption of the World-A Mechanism Model obeys its invariants. It runs the
 * justification on a deep copy (never mutating the caller's plan) and emits a structured report.
 * Mirrors the W5 / W6 harnesses — never throws on a finding; records a failed check.
 *
 * Dimensions:
 *   selection     — the section SET + COUNT are identical and the ORDER is unchanged (W6 owns ordering)
 *   evidence      — every retained section carries mechanism evidence (justification of WHY it exists)
 *   immutability  — the enriched reasoning is deep-frozen
 *   scope         — ONLY role / selectionRationale / relationships / communicationObjective are written;
 *                   orderingRationale / transition (W6-owned) are NEVER touched
 *   replay        — deterministic: a second run of a fresh copy reproduces the reasoning
 */
import type { AuthoringPlan, PlanItem } from '../types.js';
import type { GovernedModel } from '../../knowledge/derivation/models.js';
import { applyMechanism, type MechanismConsumptionOpts } from './mechanism-consumption.js';

export const MECHANISM_CONSUMPTION_HARNESS_VERSION = '0.1.0';

const DIMENSIONS = ['selection', 'evidence', 'immutability', 'scope', 'replay'] as const;
export type MechanismConsumptionCategory = (typeof DIMENSIONS)[number];

export interface MechanismConsumptionCheck {
  readonly category: MechanismConsumptionCategory;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface MechanismConsumptionReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly itemsJustified: number;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<MechanismConsumptionCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly MechanismConsumptionCheck[];
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = MechanismConsumptionCheck[];
function check(out: Checks, category: MechanismConsumptionCategory, name: string, passed: boolean, detail = ''): void {
  out.push({ category, name, passed, detail });
}

function clonePlan(plan: AuthoringPlan): AuthoringPlan {
  return { ...plan, items: plan.items.map((i) => ({ ...i })) as PlanItem[] };
}

/**
 * Verify one mechanism-consumption run and produce a report. Justifies a copy, checks selection /
 * evidence / immutability / scope, and re-runs a second copy to prove determinism. Never throws on a
 * finding; a run that fails the lifecycle (mismatch, incomplete coverage, …) is recorded as a failed
 * `selection` check.
 */
export async function verifyMechanismConsumption(
  plan: AuthoringPlan,
  mechanismModel: GovernedModel<'mechanism'>,
  opts: MechanismConsumptionOpts,
): Promise<MechanismConsumptionReport> {
  const out: Checks = [];
  const originalIds = plan.items.map((i) => i.anchor.id);

  const work = clonePlan(plan);
  try {
    applyMechanism(work, mechanismModel, opts);
  } catch (e) {
    check(out, 'selection', 'consumption completes the lifecycle', false, e instanceof Error ? e.message : String(e));
    return finalize(out, 0);
  }

  const ids = work.items.map((i) => i.anchor.id);

  // selection — same SET, same COUNT, same ORDER (W7 never changes selection or ordering)
  check(out, 'selection', 'section set is identical (no add / remove / rename)', [...ids].sort().join(',') === [...originalIds].sort().join(','));
  check(out, 'selection', 'section count is unchanged', work.items.length === plan.items.length);
  check(out, 'selection', 'section order is unchanged (ordering belongs to W6)', ids.join(',') === originalIds.join(','));

  // evidence + immutability + scope, per item
  let itemsJustified = 0;
  for (const it of work.items) {
    const r = it.reasoning;
    const justified = !!r && (r.role !== undefined || r.selectionRationale !== undefined || r.relationships !== undefined || r.communicationObjective !== undefined);
    if (justified) itemsJustified++;
    check(out, 'evidence', `item ${it.anchor.id} carries mechanism evidence (why it exists)`, justified);
    check(out, 'immutability', `item ${it.anchor.id} reasoning is deep-frozen`, !r || deepFrozen(r));
    check(out, 'scope', `item ${it.anchor.id} leaves orderingRationale / transition untouched (W6-owned)`, !r || (r.orderingRationale === undefined && r.transition === undefined));
  }

  // replay — deterministic
  const again = clonePlan(plan);
  try {
    applyMechanism(again, mechanismModel, opts);
    const sameReasoning = JSON.stringify(again.items.map((i) => i.reasoning)) === JSON.stringify(work.items.map((i) => i.reasoning));
    const sameOrder = again.items.map((i) => i.anchor.id).join(',') === ids.join(',');
    check(out, 'replay', 'justification is deterministic (reasoning + order reproduce)', sameReasoning && sameOrder);
  } catch (e) {
    check(out, 'replay', 'justification is deterministic (reasoning + order reproduce)', false, e instanceof Error ? e.message : String(e));
  }

  return finalize(out, itemsJustified);
}

function finalize(out: Checks, itemsJustified: number): MechanismConsumptionReport {
  const byCategory = Object.fromEntries(DIMENSIONS.map((c) => [c, { passed: 0, failed: 0 }])) as Record<MechanismConsumptionCategory, { passed: number; failed: number }>;
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
    harnessVersion: MECHANISM_CONSUMPTION_HARNESS_VERSION,
    itemsJustified,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}
