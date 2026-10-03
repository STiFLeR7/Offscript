/**
 * G3-S5 — Fleet Migration Executor: executes an existing `FleetMigrationPlan` (G3-S4). It CONSUMES the
 * plan and never reinterprets it — no replanning, no reordering, no change to migration semantics. The
 * `FleetMigrationPlan` is the contract.
 *
 * Execution model (per the brief): auto-execute the IMMEDIATE (READY) phase, then TERMINATE at the first
 * operator checkpoint with explicit instructions. Excluded (NOT_MIGRATABLE) projects are never migrated;
 * checkpoints are never bypassed. Resume is achieved by rebuilding the plan from the filesystem — migrated
 * projects become ALREADY_MIGRATED and drop out, so a fresh plan contains exactly the remaining work.
 * There is no execution journal and no checkpoint file; `readiness.json` presence is the source of truth.
 *
 * Failure handling: the immediate steps are independent, so execution continues past a failed step
 * (isolation) — a failure writes nothing, completed projects stay migrated, remaining stay pending, and the
 * result reports each step's outcome. Resume retries a failed step (it is still READY).
 *
 * This module is PURE with respect to an injected `Migrator` (the side-effecting single-project migration);
 * it performs no filesystem work itself. Boundary: the Executor owns EXECUTION only. Fleet Assessment owns
 * discovery, the Fleet Migration Planner owns planning, the Migration CLI owns single-project migration,
 * the Project Platform owns readiness evaluation. It is not wired into any generation runtime.
 */
import type { FleetMigrationPlan, MigrationStep, OperatorCheckpoint } from './fleet-migration-planner.js';

/** The side-effecting migration of one READY step (reconstruct with no evidence → persist readiness.json). */
export type Migrator = (step: MigrationStep) => { ok: boolean; error?: string };

/** What a single invocation will do, read straight off the plan — no reordering, no re-derivation. */
export interface ExecutionSchedule {
  /** The IMMEDIATE (READY) steps to auto-execute, in plan order (empty when nothing is READY). */
  readonly toExecute: MigrationStep[];
  /** The first operator checkpoint to stop at (null when no operator input is pending). */
  readonly pauseAt: OperatorCheckpoint | null;
  /** NOT_MIGRATABLE steps — never executed. */
  readonly excluded: MigrationStep[];
  /** ALREADY_MIGRATED steps — no-op. */
  readonly alreadyMigrated: MigrationStep[];
}

/** The outcome of a single execution pass. */
export interface StepOutcome {
  readonly client: string;
  readonly ok: boolean;
  readonly error?: string;
}

export interface FleetExecutionResult {
  /** Every immediate step attempted this pass, in plan order. */
  readonly executed: StepOutcome[];
  /** Clients migrated successfully this pass. */
  readonly succeeded: string[];
  /** Clients whose migration failed this pass (isolated; the rest still ran). */
  readonly failed: StepOutcome[];
  /** The operator checkpoint execution stopped at (null when the executable fleet is complete). */
  readonly pausedAt: OperatorCheckpoint | null;
  /** NOT_MIGRATABLE clients — excluded with reasons on the plan. */
  readonly excluded: string[];
  /** ALREADY_MIGRATED clients — skipped. */
  readonly alreadyMigrated: string[];
  /** True when no operator checkpoint remains — the executable fleet is done (only excluded may remain). */
  readonly done: boolean;
}

/**
 * Read the execution schedule off the plan. Pure consumption: the immediate phase's steps (in plan order)
 * and the first operator checkpoint. Nothing is re-derived or re-ordered.
 */
export function planExecution(plan: FleetMigrationPlan): ExecutionSchedule {
  const immediate = plan.phases.find((p) => p.kind === 'IMMEDIATE');
  return {
    toExecute: immediate ? immediate.steps : [],
    pauseAt: plan.checkpoints[0] ?? null,
    excluded: plan.blocked,
    alreadyMigrated: plan.skipped,
  };
}

/**
 * Execute one pass of a fleet migration plan: run the READY steps in plan order (continue-on-failure for
 * isolation), then stop at the first operator checkpoint. Deterministic — the order is the plan's, verbatim.
 */
export function executeFleetPlan(plan: FleetMigrationPlan, migrate: Migrator): FleetExecutionResult {
  const sched = planExecution(plan);
  const executed: StepOutcome[] = [];
  for (const step of sched.toExecute) {
    let outcome: StepOutcome;
    try {
      const r = migrate(step);
      outcome = r.error !== undefined ? { client: step.client, ok: r.ok, error: r.error } : { client: step.client, ok: r.ok };
    } catch (e) {
      outcome = { client: step.client, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    executed.push(outcome);
  }
  return {
    executed,
    succeeded: executed.filter((o) => o.ok).map((o) => o.client),
    failed: executed.filter((o) => !o.ok),
    pausedAt: sched.pauseAt,
    excluded: sched.excluded.map((s) => s.client),
    alreadyMigrated: sched.alreadyMigrated.map((s) => s.client),
    done: sched.pauseAt === null,
  };
}
