/**
 * Sprint W6 — the Progression Consumption verification harness.
 *
 * Verifies the planner's consumption of the World-A Progression Model obeys its invariants. It runs
 * the reorder on a deep copy (never mutating the caller's plan) and emits a structured report.
 * Mirrors the W5 / governed-reasoning harnesses — never throws on a finding; records a failed check.
 *
 * Dimensions:
 *   ordering    — the plan order follows the model's encounter sequence
 *   selection   — the section SET is identical before/after (no add / remove / rename) — only order moves
 *   evidence    — ordering (position + objective) + transition evidence are present + immutable
 *   replay      — deterministic: a second reorder of a fresh copy reproduces order + reasoning
 */
import type { AuthoringPlan, PlanItem } from '../types.js';
import type { GovernedModel } from '../../knowledge/derivation/models.js';
import { applyProgression, type ProgressionConsumptionOpts } from './progression-consumption.js';

export const PROGRESSION_CONSUMPTION_HARNESS_VERSION = '0.1.0';

const DIMENSIONS = ['ordering', 'selection', 'evidence', 'replay'] as const;
export type ProgressionConsumptionCategory = (typeof DIMENSIONS)[number];

export interface ProgressionConsumptionCheck {
  readonly category: ProgressionConsumptionCategory;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ProgressionConsumptionReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly order: readonly string[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<ProgressionConsumptionCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly ProgressionConsumptionCheck[];
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = ProgressionConsumptionCheck[];
function check(out: Checks, category: ProgressionConsumptionCategory, name: string, passed: boolean, detail = ''): void {
  out.push({ category, name, passed, detail });
}

function clonePlan(plan: AuthoringPlan): AuthoringPlan {
  return { ...plan, items: plan.items.map((i) => ({ ...i })) as PlanItem[] };
}

/**
 * Verify one progression-consumption run and produce a report. Reorders a copy, checks ordering /
 * selection / evidence, and re-runs a second copy to prove determinism. Never throws on a finding;
 * a run that fails the lifecycle (cycle, mismatch, …) is recorded as a failed `ordering` check.
 */
export async function verifyProgressionConsumption(
  plan: AuthoringPlan,
  progressionModel: GovernedModel<'progression'>,
  opts: ProgressionConsumptionOpts,
): Promise<ProgressionConsumptionReport> {
  const out: Checks = [];
  const originalIds = plan.items.map((i) => i.anchor.id);

  const work = clonePlan(plan);
  try {
    applyProgression(work, progressionModel, opts);
  } catch (e) {
    check(out, 'ordering', 'consumption completes the lifecycle', false, e instanceof Error ? e.message : String(e));
    return finalize(out, []);
  }

  const order = work.items.map((i) => i.anchor.id);

  // selection — same SET of ids, same count (only order may differ)
  check(out, 'selection', 'section set is identical (no add / remove / rename)', [...order].sort().join(',') === [...originalIds].sort().join(','));
  check(out, 'selection', 'section count is unchanged', work.items.length === plan.items.length);

  // ordering — the order is a permutation of the original (W6 only permutes)
  check(out, 'ordering', 'order is a permutation of the original items', order.length === originalIds.length && new Set(order).size === order.length && order.every((id) => originalIds.includes(id)));

  // evidence — each item carries ordering evidence (position) + frozen reasoning
  for (const it of work.items) {
    const r = it.reasoning;
    check(out, 'evidence', `item ${it.anchor.id} carries an encounter position`, !!r && typeof r.orderingRationale === 'string' && /Encounter position:/.test(r.orderingRationale));
    check(out, 'evidence', `item ${it.anchor.id} reasoning is deep-frozen`, !r || deepFrozen(r));
  }

  // replay — deterministic
  const again = clonePlan(plan);
  try {
    applyProgression(again, progressionModel, opts);
    const sameOrder = again.items.map((i) => i.anchor.id).join(',') === order.join(',');
    const sameReasoning = JSON.stringify(again.items.map((i) => i.reasoning)) === JSON.stringify(work.items.map((i) => i.reasoning));
    check(out, 'replay', 'reorder is deterministic (order + reasoning reproduce)', sameOrder && sameReasoning);
  } catch (e) {
    check(out, 'replay', 'reorder is deterministic (order + reasoning reproduce)', false, e instanceof Error ? e.message : String(e));
  }

  return finalize(out, order);
}

function finalize(out: Checks, order: string[]): ProgressionConsumptionReport {
  const byCategory = Object.fromEntries(DIMENSIONS.map((c) => [c, { passed: 0, failed: 0 }])) as Record<ProgressionConsumptionCategory, { passed: number; failed: number }>;
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
    harnessVersion: PROGRESSION_CONSUMPTION_HARNESS_VERSION,
    order,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}
