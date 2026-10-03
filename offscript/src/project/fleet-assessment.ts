/**
 * G3-S3 — Fleet Migration Assessment: a READ-ONLY aggregation of individual migration plans across an
 * entire workspace, so operators can see repository-wide migration readiness without touching anything.
 *
 * G3-S2 gave per-project planning; this aggregates it. The core is a pure fold over `planMigration` (G3-S2)
 * — it changes NO evaluation rule, NO migration rule, and persists nothing. Because it reuses
 * `planMigration` UNCHANGED, every project's fleet result is byte-for-byte the standalone planner's result
 * (prediction equality by construction). Discovery of candidate projects (fs) and project-type resolution
 * belong to the CLI; the pure `selectProjects` helper here defines the deterministic discovery SELECTION so
 * it is testable without a filesystem.
 *
 * Boundary: Fleet Assessment owns AGGREGATION only. The Migration Planner owns single-project analysis; the
 * Migration CLI owns execution; the Project Platform owns readiness evaluation. This module imports the
 * planner and nothing that writes.
 */
import { planMigration, type MigrationPlan, type MigrationPlanInput, type MigrationState } from './migration-planner.js';

/** Suggested migration order (per the brief): done first, then actionable, then blocked. */
const STATE_PRECEDENCE: Record<MigrationState, number> = {
  ALREADY_MIGRATED: 0,
  READY_TO_MIGRATE: 1,
  OPERATOR_INPUT_REQUIRED: 2,
  NOT_MIGRATABLE: 3,
};

const ALL_STATES: readonly MigrationState[] = ['ALREADY_MIGRATED', 'READY_TO_MIGRATE', 'OPERATOR_INPUT_REQUIRED', 'NOT_MIGRATABLE'];

/** The repository-wide migration inventory — deterministic, read-only. */
export interface FleetAssessment {
  readonly total: number;
  /** Count per state (every state present, 0 when none). */
  readonly totals: Record<MigrationState, number>;
  /** Every project's plan, in the suggested migration order (state precedence, then client alphabetical). */
  readonly plans: MigrationPlan[];
  /** The same plans grouped by state (each group alphabetical by client). */
  readonly byState: Record<MigrationState, MigrationPlan[]>;
  /** Client ids in the suggested migration order (== `plans.map(p => p.client)`). */
  readonly order: string[];
}

/**
 * The deterministic discovery SELECTION: keep only candidates that are projects (have a `references/`
 * dir), collapse duplicates, sort by name. Pure — the CLI supplies `candidates` from the filesystem.
 */
export function selectProjects(candidates: readonly { name: string; hasReferences: boolean }[]): string[] {
  return [...new Set(candidates.filter((c) => c.hasReferences).map((c) => c.name))].sort();
}

/**
 * Assess a fleet: run the UNCHANGED `planMigration` per project, then aggregate + order deterministically.
 * Input order is irrelevant — the result is sorted by (state precedence, client), so it is stable and
 * idempotent. No fs, no persistence.
 */
export function assessFleet(inputs: readonly MigrationPlanInput[]): FleetAssessment {
  const plans = inputs
    .map((input) => planMigration(input))
    .sort((a, b) => STATE_PRECEDENCE[a.state] - STATE_PRECEDENCE[b.state] || (a.client < b.client ? -1 : a.client > b.client ? 1 : 0));

  const totals = Object.fromEntries(ALL_STATES.map((s) => [s, 0])) as Record<MigrationState, number>;
  const byState = Object.fromEntries(ALL_STATES.map((s) => [s, [] as MigrationPlan[]])) as Record<MigrationState, MigrationPlan[]>;
  for (const p of plans) {
    totals[p.state] += 1;
    byState[p.state].push(p);
  }

  return { total: plans.length, totals, plans, byState, order: plans.map((p) => p.client) };
}
