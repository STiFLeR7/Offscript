/**
 * G3-S4 — Fleet Migration Planner: transforms a READ-ONLY `FleetAssessment` (G3-S3) into a deterministic,
 * executable `FleetMigrationPlan` — WITHOUT any writes. It is a PURE derivation of the assessment: it
 * changes no evaluation rule, runs no migration, and persists nothing. Because every step is derived from
 * the assessment's own per-project `MigrationPlan`, "planning must exactly reflect assessment results"
 * holds by construction.
 *
 * Scheduling (per the brief): READY_TO_MIGRATE first (an immediate phase, no operator input), then
 * OPERATOR_INPUT_REQUIRED grouped into explicit operator checkpoints by required-evidence signature;
 * NOT_MIGRATABLE excluded with reasons; ALREADY_MIGRATED reported separately.
 *
 * Blocking model (honest): migrations are INDEPENDENT — each reconstructs from its own brief and reads no
 * other project — so there is NO inter-project execution dependency. `blockingDependencies` is therefore
 * always intra-project: the evidence gate an OPERATOR step needs, or the non-supplyable blockers a
 * NOT_MIGRATABLE step must have fixed in its brief/workflow first.
 *
 * Deterministic resume: this plan is a pure function of the assessment, and the assessment reads live
 * on-disk `readinessPresent`. Since `migrate-project` is idempotent, a project migrated mid-run reappears
 * as ALREADY_MIGRATED and drops out of the executable phases — so re-planning yields exactly the remaining
 * work, in the same order. The filesystem is the resume state; no checkpoint file exists or is needed.
 *
 * Boundary: the Fleet Migration Planner owns PLANNING only. Fleet Assessment owns discovery; the Migration
 * CLI owns execution; the Project Platform owns readiness evaluation. This module imports only types + the
 * assessment; it is not wired into any runtime.
 */
import type { FleetAssessment } from './fleet-assessment.js';
import type { MigrationPlan, MigrationState } from './migration-planner.js';

type Evidence = { readonly assets: string[]; readonly approvals: string[] };

/** Whether a step can execute now, only after operator evidence, is excluded, or is already done. */
export type Eligibility = 'ELIGIBLE_NOW' | 'ELIGIBLE_AFTER_EVIDENCE' | 'EXCLUDED' | 'COMPLETE';

/** One planned migration step — mirrors a single project's assessment plan, framed for execution. */
export interface MigrationStep {
  readonly client: string;
  /** The project's assessed migration state (the transition source). */
  readonly currentState: MigrationState;
  /** The state migration would reach: ALREADY_MIGRATED for executable steps; unchanged when excluded/done. */
  readonly targetState: MigrationState;
  /** The exact operator evidence migration would need (empty for immediate/excluded/done steps). */
  readonly requiredEvidence: Evidence;
  /** What migration would persist — `['readiness.json']` only when it would be admitted, else `[]`. */
  readonly expectedArtifacts: string[];
  readonly eligibility: Eligibility;
  /** Intra-project gates that block THIS step now: `asset:`/`approval:` for operator steps; surviving
   * blocker ids for excluded steps. Never a cross-project "migrate X first" — migrations are independent. */
  readonly blockingDependencies: string[];
  /** The assessment's full explanation, verbatim (carries the "excluded with reasons" detail). */
  readonly reason: string;
}

/** An explicit operator gate: the shared evidence a group of OPERATOR steps needs before it can execute. */
export interface OperatorCheckpoint {
  readonly id: string;
  readonly requiredEvidence: Evidence;
  readonly steps: MigrationStep[];
}

/** A batch the executor runs together: the immediate READY batch, or one operator-checkpoint batch. */
export interface MigrationPhase {
  readonly order: number;
  readonly kind: 'IMMEDIATE' | 'OPERATOR_CHECKPOINT';
  /** The checkpoint gating this phase (null for the immediate phase). */
  readonly checkpointId: string | null;
  readonly steps: MigrationStep[];
}

/** The deterministic, executable fleet migration plan — read-only, derived entirely from the assessment. */
export interface FleetMigrationPlan {
  /** Executable batches in execution order: immediate first, then operator checkpoints. */
  readonly phases: MigrationPhase[];
  /** The operator gates, in phase order (== the OPERATOR_CHECKPOINT phases' checkpoints). */
  readonly checkpoints: OperatorCheckpoint[];
  /** The flat execution order of executable steps (== phases.flatMap(steps).map(client)). */
  readonly order: string[];
  /** ALREADY_MIGRATED — reported separately; no-op, not executed. */
  readonly skipped: MigrationStep[];
  /** NOT_MIGRATABLE — excluded with reasons; fix the brief/workflow, then re-assess. */
  readonly blocked: MigrationStep[];
}

/** Render the evidence gate labels an operator step is blocked on. */
const evidenceGates = (e: Evidence): string[] => [
  ...e.assets.map((a) => `asset:${a}`),
  ...e.approvals.map((a) => `approval:${a}`),
];

/** A canonical, order-independent signature for grouping steps that need the same evidence bundle. */
const signature = (e: Evidence): string => JSON.stringify([[...e.assets].sort(), [...e.approvals].sort()]);

function stepFor(plan: MigrationPlan): MigrationStep {
  switch (plan.state) {
    case 'READY_TO_MIGRATE':
      return {
        client: plan.client, currentState: plan.state, targetState: 'ALREADY_MIGRATED',
        requiredEvidence: plan.requiredEvidence, expectedArtifacts: plan.predictedArtifacts,
        eligibility: 'ELIGIBLE_NOW', blockingDependencies: [], reason: plan.reason,
      };
    case 'OPERATOR_INPUT_REQUIRED':
      return {
        client: plan.client, currentState: plan.state, targetState: 'ALREADY_MIGRATED',
        requiredEvidence: plan.requiredEvidence, expectedArtifacts: plan.predictedArtifacts,
        eligibility: 'ELIGIBLE_AFTER_EVIDENCE', blockingDependencies: evidenceGates(plan.requiredEvidence),
        reason: plan.reason,
      };
    case 'ALREADY_MIGRATED':
      return {
        client: plan.client, currentState: plan.state, targetState: 'ALREADY_MIGRATED',
        requiredEvidence: plan.requiredEvidence, expectedArtifacts: plan.predictedArtifacts,
        eligibility: 'COMPLETE', blockingDependencies: [], reason: plan.reason,
      };
    case 'NOT_MIGRATABLE':
      return {
        client: plan.client, currentState: plan.state, targetState: 'NOT_MIGRATABLE',
        requiredEvidence: plan.requiredEvidence, expectedArtifacts: plan.predictedArtifacts,
        eligibility: 'EXCLUDED', blockingDependencies: plan.blockers.filter((b) => !b.supplyable).map((b) => b.id),
        reason: plan.reason,
      };
  }
}

/**
 * Build the executable migration plan from a fleet assessment. Pure, deterministic, no writes. The
 * assessment's `byState` groups are already alphabetical, so ordering is stable without re-sorting.
 */
export function buildFleetMigrationPlan(assessment: FleetAssessment): FleetMigrationPlan {
  const skipped = assessment.byState.ALREADY_MIGRATED.map(stepFor);
  const blocked = assessment.byState.NOT_MIGRATABLE.map(stepFor);
  const readySteps = assessment.byState.READY_TO_MIGRATE.map(stepFor);

  // Group OPERATOR steps into checkpoints by required-evidence signature; order checkpoints by signature.
  const groups = new Map<string, MigrationStep[]>();
  for (const plan of assessment.byState.OPERATOR_INPUT_REQUIRED) {
    const step = stepFor(plan);
    const key = signature(plan.requiredEvidence);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(step);
  }
  const checkpoints: OperatorCheckpoint[] = [...groups.entries()]
    // Order checkpoints by their alphabetically-first client — deterministic, and consistent with the
    // program's alphabetical flow (checkpoint-1 holds the earliest projects).
    .sort(([, a], [, b]) => (a[0].client < b[0].client ? -1 : a[0].client > b[0].client ? 1 : 0))
    .map(([key, steps], i) => {
      const [assets, approvals] = JSON.parse(key) as [string[], string[]];
      return { id: `checkpoint-${i + 1}`, requiredEvidence: { assets, approvals }, steps };
    });

  const phases: MigrationPhase[] = [];
  if (readySteps.length > 0) phases.push({ order: 1, kind: 'IMMEDIATE', checkpointId: null, steps: readySteps });
  for (const cp of checkpoints) {
    phases.push({ order: phases.length + 1, kind: 'OPERATOR_CHECKPOINT', checkpointId: cp.id, steps: cp.steps });
  }

  const order = phases.flatMap((ph) => ph.steps).map((s) => s.client);
  return { phases, checkpoints, order, skipped, blocked };
}
