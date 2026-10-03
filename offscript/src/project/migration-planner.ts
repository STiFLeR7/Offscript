/**
 * G3-S2 — Migration Planner: a READ-ONLY analysis layer that answers, per project, "should migration
 * occur, and what would it produce?" — BEFORE any imperative migration runs.
 *
 * G3-S1 made migration deterministic but imperative; operators had no visibility into which projects are
 * migratable, why a project is NOT_READY, what evidence is missing, or what migration would produce. This
 * module closes that gap. It classifies a project into exactly one migration state and predicts the
 * migration outcome — with NO writes and NO persistence.
 *
 * **Planning does not evaluate differently from migration:** it reuses G3-S1's exact
 * `reconstructLegacyReadiness` (the shared evaluation) with the shared `MIGRATION_TIMESTAMP`, then derives
 * the classification purely from the resulting blockers + admission. Prediction is therefore accurate BY
 * CONSTRUCTION — the "with evidence" reconstruction the planner runs to predict is byte-identical to what
 * migration runs when handed that evidence. The readiness STATE / admission are timestamp-independent, so
 * the classification is fully deterministic.
 *
 * Boundary: the Migration Planner owns ANALYSIS only. It imports the shared evaluation; it persists
 * nothing, mutates nothing, and is NOT wired into any runtime (generation never imports it). Deciding to
 * execute + persisting `readiness.json` remains the migration CLI's job (G3-S1).
 */
import type { AcquisitionPlan } from './acquisition-plan.js';
import type { ReadinessState, Blocker, BlockerCategory } from './readiness.js';
import type { ReadinessPolicy } from './readiness-policy.js';
import { reconstructLegacyReadiness, MIGRATION_TIMESTAMP, type MigrationEvidence } from './project-migration.js';

/** Exactly one of these describes every inspected project. */
export type MigrationState = 'READY_TO_MIGRATE' | 'OPERATOR_INPUT_REQUIRED' | 'NOT_MIGRATABLE' | 'ALREADY_MIGRATED';

/** A blocker as the planner reports it — with whether operator evidence (asset/approval) can clear it. */
export interface PlannedBlocker {
  readonly id: string;
  readonly category: BlockerCategory;
  readonly severity: string;
  readonly reason: string;
  /** True iff this blocker is clearable through migration's operator-input surface (`--asset`/`--approve`). */
  readonly supplyable: boolean;
}

/** The read-only migration prediction for one project. */
export interface MigrationPlan {
  readonly client: string;
  readonly state: MigrationState;
  readonly reason: string;
  /** The exact operator evidence migration would need (empty when none is required or none would help). */
  readonly requiredEvidence: { readonly assets: string[]; readonly approvals: string[] };
  /** The readiness STATE migration would reach (with the required evidence); null when not reconstructed. */
  readonly predictedReadinessState: ReadinessState | null;
  /** The admission decision migration would reach. */
  readonly predictedAdmission: boolean;
  /** The artifacts migration would persist — `['readiness.json']` only when it would be admitted; else `[]`. */
  readonly predictedArtifacts: string[];
  /** Full transparency: every blocker the evaluation found, each tagged supplyable/not. */
  readonly blockers: PlannedBlocker[];
}

export interface MigrationPlanInput {
  readonly client: string;
  /** Whether `projects/<client>/readiness.json` already exists (read by the CLI). */
  readonly readinessPresent: boolean;
  /** The legacy brief.md text; undefined ⇒ no brief on disk. */
  readonly briefText?: string;
  /** The acquisition plan (needs `--type`); undefined ⇒ project type unresolved. */
  readonly acquisition?: AcquisitionPlan;
  readonly policy?: ReadinessPolicy;
}

/** Operator evidence clears only asset + approval requirements (the migration `--asset`/`--approve` surface). */
const OPERATOR_CATEGORIES: ReadonlySet<BlockerCategory> = new Set<BlockerCategory>(['asset', 'approval']);

const isSupplyable = (b: Blocker): boolean => OPERATOR_CATEGORIES.has(b.category);

/** Derive the maximal operator evidence the supplyable blockers imply (asset patterns + approval labels). */
function supplyableEvidence(blockers: readonly Blocker[]): { assets: string[]; approvals: string[] } {
  const assets = new Set<string>();
  const approvals = new Set<string>();
  for (const b of blockers) {
    if (b.category === 'asset') assets.add(b.id.slice('asset:'.length)); // e.g. 'logo'
    else if (b.category === 'approval') approvals.add(b.reason.replace(/^required approval not granted: /, ''));
  }
  return { assets: [...assets], approvals: [...approvals] };
}

const planned = (blockers: readonly Blocker[]): PlannedBlocker[] =>
  blockers.map((b) => ({ id: b.id, category: b.category, severity: b.severity, reason: b.reason, supplyable: isSupplyable(b) }));

/**
 * Classify a project's migration state and predict the outcome — read-only. Reuses the shared evaluation;
 * persists nothing. Precedence: already-migrated ▸ no-brief ▸ type-unresolved ▸ reconstruct-based.
 */
export function planMigration(input: MigrationPlanInput): MigrationPlan {
  const base = {
    client: input.client,
    requiredEvidence: { assets: [] as string[], approvals: [] as string[] },
    predictedReadinessState: null as ReadinessState | null,
    predictedAdmission: false,
    predictedArtifacts: [] as string[],
    blockers: [] as PlannedBlocker[],
  };

  if (input.readinessPresent) {
    return { ...base, state: 'ALREADY_MIGRATED', predictedAdmission: true, reason: 'readiness.json already present — the project is native-eligible; migration is a no-op.' };
  }
  if (input.briefText === undefined) {
    return { ...base, state: 'NOT_MIGRATABLE', reason: 'no references/brief.md — there is nothing to migrate.' };
  }
  if (input.acquisition === undefined) {
    return { ...base, state: 'NOT_MIGRATABLE', reason: 'project type unresolved — supply --type to plan this project.' };
  }

  const opts = input.policy ? { policy: input.policy } : {};
  const baseline = reconstructLegacyReadiness({ client: input.client, acquisition: input.acquisition, briefText: input.briefText, now: MIGRATION_TIMESTAMP, ...opts });
  const evidence = supplyableEvidence(baseline.assessment.blockers);

  // Already admitted with no operator input → migration would persist immediately.
  if (baseline.admitted) {
    return {
      ...base, state: 'READY_TO_MIGRATE', predictedReadinessState: baseline.assessment.state, predictedAdmission: true,
      predictedArtifacts: ['readiness.json'], blockers: planned(baseline.assessment.blockers),
      reason: 'reconstructs READY with no operator input — migration would persist readiness.json.',
    };
  }

  // Predict WITH the maximal supplyable evidence — exactly what migration runs when handed it.
  const supplied: MigrationEvidence = { assets: evidence.assets, approvals: evidence.approvals };
  const withEvidence = reconstructLegacyReadiness({ client: input.client, acquisition: input.acquisition, briefText: input.briefText, evidence: supplied, now: MIGRATION_TIMESTAMP, ...opts });

  if (withEvidence.admitted) {
    return {
      ...base, state: 'OPERATOR_INPUT_REQUIRED', requiredEvidence: evidence,
      predictedReadinessState: withEvidence.assessment.state, predictedAdmission: true, predictedArtifacts: ['readiness.json'],
      blockers: planned(baseline.assessment.blockers),
      reason: `supplying the required asset(s)/approval(s) yields READY — migration would then persist readiness.json.`,
    };
  }

  // Even maximal operator evidence leaves non-supplyable blockers → migration would refuse to persist.
  const surviving = withEvidence.assessment.blockers.filter((b) => !isSupplyable(b));
  return {
    ...base, state: 'NOT_MIGRATABLE', requiredEvidence: evidence,
    predictedReadinessState: withEvidence.assessment.state, predictedAdmission: false, predictedArtifacts: [],
    blockers: planned(withEvidence.assessment.blockers),
    reason: `unrecoverable blocker(s) remain even with operator evidence (${surviving.map((b) => b.id).join(', ')}) — not in migration's --asset/--approve surface; fix the brief/workflow first.`,
  };
}
