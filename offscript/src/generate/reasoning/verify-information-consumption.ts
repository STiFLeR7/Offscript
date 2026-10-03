/**
 * Sprint W5 — the Information Consumption verification harness.
 *
 * Verifies the planner's consumption of the World-A Information Model obeys its invariants. It
 * VALIDATES consumption; it never participates in the generate pipeline. It runs the enrichment on a
 * deep copy of the plan (never mutating the caller's) and emits a structured report. Mirrors the
 * derivation / governed-reasoning harnesses — never throws on a finding; records a failed check.
 *
 * Dimensions:
 *   existence     — every item gains a reasoning channel carrying information evidence
 *   immutability  — the enriched reasoning is deep-frozen
 *   evidence      — priority / dependency / cluster / coverage evidence is preserved (verifiable labels)
 *   scope         — ONLY selectionRationale + relationships are written; ordering / transition /
 *                   role / communicationObjective are untouched (no sequencing change); order preserved
 *   replay        — deterministic: a second enrichment of a fresh copy reproduces the reasoning
 */
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../types.js';
import type { GovernedModel } from '../../knowledge/derivation/models.js';
import {
  enrichPlanWithInformation,
  buildInformationEvidence,
  type InformationConsumptionOpts,
} from './information-consumption.js';

export const INFORMATION_CONSUMPTION_HARNESS_VERSION = '0.1.0';

const DIMENSIONS = ['existence', 'immutability', 'evidence', 'scope', 'replay'] as const;
export type InformationConsumptionCategory = (typeof DIMENSIONS)[number];

export interface InformationConsumptionCheck {
  readonly category: InformationConsumptionCategory;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface InformationConsumptionReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly itemsEnriched: number;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<InformationConsumptionCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly InformationConsumptionCheck[];
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = InformationConsumptionCheck[];
function check(out: Checks, category: InformationConsumptionCategory, name: string, passed: boolean, detail = ''): void {
  out.push({ category, name, passed, detail });
}

/** Deep-copy a plan's items so the harness never mutates the caller's plan. */
function clonePlan(plan: AuthoringPlan): AuthoringPlan {
  return { ...plan, items: plan.items.map((i) => ({ ...i })) as PlanItem[] };
}

/**
 * Verify one information-consumption run and produce a report. Enriches a copy, checks the enriched
 * reasoning, and re-enriches a second copy to prove determinism. Never throws on a finding; a run
 * that fails the lifecycle (e.g. repository mismatch) is recorded as a failed `existence` check.
 */
export async function verifyInformationConsumption(
  plan: AuthoringPlan,
  informationModel: GovernedModel<'information'>,
  opts: InformationConsumptionOpts,
): Promise<InformationConsumptionReport> {
  const out: Checks = [];

  // What evidence SHOULD appear (also exercises the build path under the same validation).
  let expected: { selectionRationale?: string; relationships?: string };
  const work = clonePlan(plan);
  try {
    expected = buildInformationEvidence(informationModel);
    enrichPlanWithInformation(work, informationModel, opts);
  } catch (e) {
    check(out, 'existence', 'consumption completes the lifecycle', false, e instanceof Error ? e.message : String(e));
    return finalize(out, 0);
  }

  let itemsEnriched = 0;
  for (const it of work.items) {
    const r: SectionReasoning | undefined = it.reasoning;
    const has = !!r && (r.selectionRationale !== undefined || r.relationships !== undefined);
    if (has) itemsEnriched++;
    check(out, 'existence', `item ${it.anchor.id} carries information reasoning`, has);
    check(out, 'immutability', `item ${it.anchor.id} reasoning is deep-frozen`, !r || deepFrozen(r));
    // evidence preserved — the expected selection/relationship strings survive verbatim
    if (expected.selectionRationale) check(out, 'evidence', `item ${it.anchor.id} preserves selection/coverage evidence`, r?.selectionRationale === expected.selectionRationale);
    if (expected.relationships) check(out, 'evidence', `item ${it.anchor.id} preserves dependency/cluster/relationship evidence`, r?.relationships === expected.relationships);
    // scope — sequencing-adjacent + unrelated fields are NEVER written by W5
    check(
      out,
      'scope',
      `item ${it.anchor.id} leaves ordering / transition / role / communicationObjective untouched`,
      !r || (r.orderingRationale === undefined && r.transition === undefined && r.role === undefined && r.communicationObjective === undefined),
    );
  }

  // scope — order preserved
  check(out, 'scope', 'plan item order is unchanged', work.items.map((i) => i.anchor.id).join(',') === plan.items.map((i) => i.anchor.id).join(','));

  // replay — deterministic
  const again = clonePlan(plan);
  try {
    enrichPlanWithInformation(again, informationModel, opts);
    check(out, 'replay', 'enrichment is deterministic (re-run reproduces the reasoning)', JSON.stringify(again.items.map((i) => i.reasoning)) === JSON.stringify(work.items.map((i) => i.reasoning)));
  } catch (e) {
    check(out, 'replay', 'enrichment is deterministic (re-run reproduces the reasoning)', false, e instanceof Error ? e.message : String(e));
  }

  return finalize(out, itemsEnriched);
}

function finalize(out: Checks, itemsEnriched: number): InformationConsumptionReport {
  const byCategory = Object.fromEntries(DIMENSIONS.map((c) => [c, { passed: 0, failed: 0 }])) as Record<InformationConsumptionCategory, { passed: number; failed: number }>;
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
    harnessVersion: INFORMATION_CONSUMPTION_HARNESS_VERSION,
    itemsEnriched,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}
