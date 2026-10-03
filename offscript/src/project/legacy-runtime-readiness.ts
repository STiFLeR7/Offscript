/**
 * G4-S1 — Legacy Runtime Readiness: a READ-ONLY predicate over a fleet assessment (G3-S3) that answers
 * whether the CLI's legacy execution branch can now retire.
 *
 * The branch in question is `resolveGenerationEntry`'s `readiness === null` fallback
 * (generation-orchestration.ts): any project without a persisted `readiness.json` generates on the legacy
 * compatibility path. G2-S4 retained it with one precise blocker — "every supported production project
 * must produce `readiness.json`". G3 built the backfill (migration + fleet execution) that can produce it;
 * this predicate measures whether the fleet has actually reached that state.
 *
 * `retirable` is true iff the fleet is non-empty AND every project is ALREADY_MIGRATED (possesses
 * readiness → resolves NATIVE, never reaching the legacy branch). Otherwise it reports the blockers:
 * projects still to migrate (a fleet-execution run away), and NOT_MIGRATABLE projects (a brief/workflow
 * defect — the hard blocker, since they can never be native until fixed or desupported).
 *
 * Read-only: it reuses the assessment unchanged, changes no evaluation rule, and persists nothing. It is
 * inventory tooling for the retirement decision — the measurable gate the runtime-deletion sprint consumes.
 */
import type { FleetAssessment } from './fleet-assessment.js';

/** The evidence-backed retirement verdict for the legacy execution branch, derived from a fleet assessment. */
export interface LegacyRetirementReadiness {
  readonly total: number;
  /** Projects that possess readiness.json → resolve NATIVE, never reach the legacy branch. */
  readonly alreadyMigrated: string[];
  /** Migratable projects not yet migrated (READY + OPERATOR) — a fleet-execution run clears these. */
  readonly pendingMigration: string[];
  /** NOT_MIGRATABLE projects — the hard blocker: a brief/workflow defect that must be fixed or desupported. */
  readonly notMigratable: string[];
  /** True iff the fleet is non-empty and every project is ALREADY_MIGRATED — the branch can retire. */
  readonly retirable: boolean;
  /** Human-readable reasons the branch cannot retire yet (empty when `retirable`). */
  readonly blockers: string[];
}

/**
 * Assess whether the legacy execution branch can retire, from a fleet assessment. Pure, read-only. The
 * assessment's `byState` groups are already alphabetical, so the reported lists are deterministic.
 */
export function assessLegacyRetirement(assessment: FleetAssessment): LegacyRetirementReadiness {
  const alreadyMigrated = assessment.byState.ALREADY_MIGRATED.map((p) => p.client);
  const pendingMigration = [
    ...assessment.byState.READY_TO_MIGRATE,
    ...assessment.byState.OPERATOR_INPUT_REQUIRED,
  ].map((p) => p.client);
  const notMigratable = assessment.byState.NOT_MIGRATABLE.map((p) => p.client);

  const blockers: string[] = [];
  if (assessment.total === 0) {
    blockers.push('no projects discovered — nothing to attest; the legacy branch must be retained.');
  }
  if (pendingMigration.length > 0) {
    blockers.push(
      `${pendingMigration.length} project(s) are migratable but not yet migrated — run fleet execution first: ${pendingMigration.join(', ')}.`,
    );
  }
  if (notMigratable.length > 0) {
    blockers.push(
      `${notMigratable.length} project(s) are NOT_MIGRATABLE (brief/workflow defect) — fix + migrate or formally desupport before the legacy branch can retire: ${notMigratable.join(', ')}.`,
    );
  }

  return {
    total: assessment.total,
    alreadyMigrated,
    pendingMigration,
    notMigratable,
    retirable: assessment.total > 0 && alreadyMigrated.length === assessment.total,
    blockers,
  };
}
