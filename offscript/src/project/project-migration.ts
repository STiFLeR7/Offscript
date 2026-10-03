/**
 * G3-S1 — Legacy Project Migration: reconstruct a `ProjectReadiness` for a LEGACY project (one with a
 * `references/brief.md` but no `readiness.json`) so it becomes native-eligible without altering its
 * generated outputs.
 *
 * G2-S4 established that every existing production project runs the legacy path because none carries a
 * persisted `ProjectReadiness`. Native execution already exists; the missing capability is MIGRATION.
 * This module owns the one thing migration owns — **legacy artifact interpretation** — and nothing else:
 *
 *  - It reads the legacy brief through the SAME primitives `acquire-brief`/`recordAcquisition` use
 *    (`parseBrief` → `buildBriefSession` → `newSession`/`applySession`), reconstructing the Living Context
 *    IN MEMORY (no disk write, so every existing artifact is left untouched).
 *  - It folds in the operator-supplied evidence for the values legacy artifacts cannot recover — validated
 *    assets and granted approvals (the migration analog of the acquisition interview). These are OPERATOR
 *    ASSERTIONS, not values the tool invents.
 *  - It evaluates readiness with the UNMODIFIED Project-Platform rules (`projectReadinessFor` +
 *    `evaluateReadiness`) — it reuses them, never reimplements or relaxes them.
 *
 * It **fabricates nothing**: with no supplied evidence a real brief evaluates NOT_READY (the missing logo
 * asset / rule-derived approvals are honest blockers), and this module returns that honestly. Deciding
 * whether to PERSIST (only when admitted) and the fs/CLI wiring belong to `scripts/migrate-project.ts`;
 * readiness EVALUATION belongs to the Project Platform; execution belongs to the Generation Platform.
 *
 * Pure over its inputs (brief text + supplied evidence + a caller-provided timestamp), so the same inputs
 * reconstruct a byte-identical readiness — the idempotence the migration command guarantees.
 */
import { parseBrief } from '../generate/brief.js';
import type { AcquisitionPlan } from './acquisition-plan.js';
import type { ProjectReadiness, ReadinessAssessment } from './readiness.js';
import type { ReadinessPolicy } from './readiness-policy.js';
import { projectReadinessFor, evaluateReadiness } from './readiness-evaluator.js';
import { emptyContext, type ProjectIdentity, type SessionInput, type DecisionInput } from './project-context.js';
import { newSession, applySession, buildBriefSession } from './context-updater.js';

/**
 * Deterministic timestamp for a reconstructed migration session — the single source of truth shared by the
 * migration command AND the migration planner, so planning evaluates byte-identically to migration. Never a
 * wall clock (that would break idempotence). It affects only the embedded context's session timestamps —
 * never the generated output, and never the readiness STATE/admission (which are timestamp-independent).
 */
export const MIGRATION_TIMESTAMP = '2000-01-01T00:00:00.000Z';

/** The values a legacy project cannot supply from disk — the operator asserts them (interview analog). */
export interface MigrationEvidence {
  /** Validated asset names present in the engagement (e.g. `logo.svg`) — satisfies asset requirements. */
  readonly assets?: readonly string[];
  /** Approvals the legacy engagement granted (e.g. `brand sign-off`) — satisfies approval requirements. */
  readonly approvals?: readonly string[];
}

export interface LegacyMigrationInput {
  readonly client: string;
  /** The acquisition plan (projectType / deliverables / strategy) — built by the Creative Director. */
  readonly acquisition: AcquisitionPlan;
  /** The existing legacy brief.md text (read by the CLI; interpreted here, never mutated). */
  readonly briefText: string;
  /** Operator-asserted recoverable-gap evidence. Absent ⇒ honest evaluation from the brief alone. */
  readonly evidence?: MigrationEvidence;
  /** Deterministic timestamp for the reconstructed session (idempotence — never a wall clock). */
  readonly now: string;
  /** Readiness-policy seam (mirrors the evaluator) — unchanged rules by default. */
  readonly policy?: ReadinessPolicy;
}

export interface MigrationResult {
  readonly readiness: ProjectReadiness;
  readonly assessment: ReadinessAssessment;
  /** True only when the reconstructed readiness is READY — the CLI persists only then. */
  readonly admitted: boolean;
}

/**
 * Reconstruct + evaluate a legacy project's readiness. Pure: no fs, no clock. The reconstructed Living
 * Context mirrors what `recordAcquisition` would author for this brief, plus the operator-supplied asset /
 * approval decisions — then the UNMODIFIED evaluator decides the state. Never persists; never fabricates.
 */
export function reconstructLegacyReadiness(input: LegacyMigrationInput): MigrationResult {
  const { acquisition: acq, briefText, evidence, now } = input;
  const identity: ProjectIdentity = { client: input.client, projectType: acq.projectType, deliverables: [...acq.deliverables] };
  const brief = parseBrief(briefText);
  const base = emptyContext(identity);

  // Same brief→decisions authoring acquire-brief uses; append the operator-asserted asset / approval
  // decisions so the evaluator sees them exactly as a native interview would have recorded them.
  const session = buildBriefSession({ prior: base, brief });
  const supplied: DecisionInput[] = [
    ...(evidence?.assets ?? []).map((subject) => ({ kind: 'asset' as const, subject })),
    ...(evidence?.approvals ?? []).map((subject) => ({ kind: 'approved' as const, subject })),
  ];
  const merged: SessionInput = { ...session, decisions: [...(session.decisions ?? []), ...supplied] };

  const context = applySession(base, newSession(merged, base, now));
  const readiness = projectReadinessFor(acq, { context });
  const assessment = evaluateReadiness(readiness, input.policy ? { policy: input.policy } : {});
  return { readiness, assessment, admitted: assessment.admission.admitted };
}
