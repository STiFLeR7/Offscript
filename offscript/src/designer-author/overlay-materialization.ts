/**
 * P15 — Overlay Materialization Foundation: the deterministic transformation
 * OverlayCandidate + OverlayApproval -> MaterializedFrozenOverlay.
 *
 * INVESTIGATION (grounded, not assumed — see
 * docs/internals/P15-OVERLAY-MATERIALIZATION-FOUNDATION.md §3 for the full
 * mapping matrix): every one of `Frozen`'s 7 fields was re-inventoried
 * against BOTH the real `OverlayCandidate` (P13) and the real
 * `OverlayApproval` (P14).
 *
 * P14's approval closes NONE of P13's three genuinely unavailable fields:
 * `pass` (which rail-actuation pass escalated — a Designer Author
 * candidate never enters one, approved or not), `findingIds` (real
 * `operator.ts` `Finding[]` ids from a `detect()` run — none ever exist for
 * a proposal), and `snapshotHtml` (the working document's actual HTML at
 * the moment of freeze — a proposal was never part of a real generation
 * run). `pass` and `findingIds` are REQUIRED on `Frozen` — populating them
 * would be fabrication. Reusing `Frozen` directly (Option A) therefore
 * remains not viable, exactly as P13 already found for the same two
 * fields.
 *
 * P14's approval DOES upgrade three of P13's `derived`-but-approximate
 * fields to genuinely authoritative values: P13's `OverlayCandidate.reason`
 * was a deterministic TEMPLATE (status + evidence count); a real human
 * rationale (`OverlayApproval.decision.rationale`) now exists and is
 * strictly more authoritative. P13's `OverlayCandidate.decidedAt` was
 * necessarily the moment of TRANSLATION (no human had decided anything
 * yet); `OverlayApproval.decision.decidedAt` is the TRUE moment a human
 * decided. P13's `OverlayCandidate.decidedBy` was necessarily the
 * proposal's own AUTHOR (the closest honest analogue available before any
 * reviewer existed); `OverlayApproval.decision.reviewer` is the actual
 * person who decided. Materialization corrects all three rather than
 * propagating the earlier approximations — see `MATERIALIZED_FROZEN_FIELD_MAPPING`.
 *
 * ARCHITECTURE: since `pass`/`findingIds` remain unavailable and both are
 * required on `Frozen`, this module produces `MaterializedFrozenOverlay`
 * (Option B) — structurally compatible with `Frozen` in field-
 * correspondence (id/reason/decidedAt/decidedBy all have a direct
 * counterpart), never literally `Frozen`.
 *
 * Isolation: `Frozen` is imported TYPE-ONLY (the same compile-time
 * exhaustiveness anchor P13 established for `FROZEN_FIELD_MAPPING`).
 * `OverlayCandidate` and `OverlayApproval` are also imported TYPE-ONLY. No
 * value from `overlay.ts` is ever imported or called — materialization
 * never writes an overlay, never reads one, and never touches
 * `repository/` or `governance/` (see the falsification tests in
 * overlay-materialization.test.ts / overlay-materialization-io.test.ts).
 */
import { createHash } from 'node:crypto';
import type { OverlayCandidate } from './proposal-overlay.js';
import type { OverlayApproval } from './overlay-approval.js';
import type { Frozen } from '../overlay.js';

export type MaterializedFieldMappingKind = 'direct' | 'derived' | 'approval' | 'unavailable';

export interface MaterializedFieldMapping {
  readonly frozenField: keyof Frozen;
  readonly kind: MaterializedFieldMappingKind;
  readonly rationale: string;
  /** the corresponding MaterializedFrozenOverlay field name — absent when kind === 'unavailable'. */
  readonly materializedField?: string;
}

export const MATERIALIZED_FROZEN_FIELD_MAPPING: readonly MaterializedFieldMapping[] = Object.freeze([
  Object.freeze({
    frozenField: 'id',
    kind: 'derived',
    rationale:
      "Frozen.id hashes (pass, findingIds) — both unavailable here (see below), so that exact formula cannot be replayed. MaterializedFrozenOverlay.id is a NEW, equally content-derived hash over (candidate.id, approval.id) — stable and non-fabricated in the same SPIRIT as Frozen.id, computed from what is actually available rather than reusing Frozen's own formula.",
    materializedField: 'id',
  }),
  Object.freeze({
    frozenField: 'pass',
    kind: 'unavailable',
    rationale:
      'Names WHICH rail-actuation pass escalated a finding. A Designer Author candidate never enters generate/validate.ts or any actuation pass, approved or not — P14\'s approval supplies no pass name either. Still unavailable; fabricating one would misrepresent provenance.',
  }),
  Object.freeze({
    frozenField: 'findingIds',
    kind: 'unavailable',
    rationale:
      "References real operator.ts Finding.id values from a detect() run. No operator ever ran against a proposal or candidate. OverlayApproval's own decision carries no finding ids either (a review's findings, P12, are a structurally different, dimension-keyed shape). Still unavailable.",
  }),
  Object.freeze({
    frozenField: 'snapshotHtml',
    kind: 'unavailable',
    rationale:
      "The working document's actual HTML at the moment of freeze, presupposing a real generation run. A proposal's content was never part of one, and approval — a decision about the proposal, not a render — supplies no HTML either. Still unavailable; carried, honestly, nowhere on MaterializedFrozenOverlay.",
  }),
  Object.freeze({
    frozenField: 'reason',
    kind: 'approval',
    rationale:
      "UPGRADED from P13's derived, template-assembled reason (status + evidence count) to the human's own stated rationale (OverlayApproval.decision.rationale) — a genuinely authoritative 'why this was frozen' now that a real approval decision exists.",
    materializedField: 'reason',
  }),
  Object.freeze({
    frozenField: 'decidedAt',
    kind: 'approval',
    rationale:
      "CORRECTED from P13's OverlayCandidate.decidedAt, which was necessarily the moment of TRANSLATION (no human had decided anything yet). OverlayApproval.decision.decidedAt is the TRUE moment a human decided — materialization uses it instead of propagating the earlier approximation.",
    materializedField: 'decidedAt',
  }),
  Object.freeze({
    frozenField: 'decidedBy',
    kind: 'approval',
    rationale:
      "CORRECTED from P13's OverlayCandidate.decidedBy, which was necessarily the proposal's own AUTHOR (the closest honest analogue available before any reviewer existed). OverlayApproval.decision.reviewer is the actual person who decided — materialization uses it instead.",
    materializedField: 'decidedBy',
  }),
]);

/**
 * The materialization model (Option B). Frozen-equivalent subset
 * (id/reason/decidedAt/decidedBy — see MATERIALIZED_FROZEN_FIELD_MAPPING)
 * plus traceability fields (sourceCandidateId/sourceApprovalId/
 * sourceProposalId/sourceReviewSubject) needed to make the artifact
 * self-describing — never a Frozen field under a different name.
 */
export interface MaterializedFrozenOverlay {
  readonly id: string;
  readonly sourceCandidateId: string;
  readonly sourceApprovalId: string;
  readonly sourceProposalId: string;
  readonly sourceReviewSubject?: string;
  readonly reason: string;
  readonly decidedAt: string;
  readonly decidedBy: string;
}

export interface MaterializationReport {
  readonly materialized: MaterializedFrozenOverlay;
  /** = MATERIALIZED_FROZEN_FIELD_MAPPING, verbatim — the same closed table on every report. */
  readonly fieldMapping: readonly MaterializedFieldMapping[];
  /** = materialized.decidedAt is NOT this — materializedAt is when THIS TRANSFORM ran, one clock read. */
  readonly materializedAt: string;
}

export interface MaterializeOverlayCandidateOptions {
  readonly now?: () => string;
}

export class MaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaterializationError';
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacerKeys(value), 2) + '\n';
}

function sortedReplacerKeys(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function computeMaterializedId(candidateId: string, approvalId: string): string {
  return createHash('sha256').update(stableStringify({ candidateId, approvalId })).digest('hex');
}

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

function validate(candidate: OverlayCandidate, approval: OverlayApproval): void {
  if (approval.candidateId !== candidate.id) {
    throw new MaterializationError(
      `materializeOverlayCandidate: approval.candidateId ('${approval.candidateId}') does not match candidate.id ('${candidate.id}') — an approval must be for the candidate it materializes`,
    );
  }
  if (approval.sourceProposalId !== candidate.sourceProposalId) {
    throw new MaterializationError(
      `materializeOverlayCandidate: approval.sourceProposalId ('${approval.sourceProposalId}') does not match candidate.sourceProposalId ('${candidate.sourceProposalId}')`,
    );
  }
  if (approval.decision.status !== 'approved') {
    throw new MaterializationError(
      `materializeOverlayCandidate: approval.decision.status must be 'approved', got '${approval.decision.status}' — a rejected OverlayCandidate cannot be materialized`,
    );
  }
}

/**
 * Materialize an approved OverlayCandidate into a MaterializedFrozenOverlay.
 * Pure and total: no filesystem, no overlay store read/write, no catalog
 * access, no governance mutation. Requires the approval to genuinely match
 * the candidate and to be `status: 'approved'` — this is a structural
 * integrity check on the inputs, not a computed judgment: the function
 * still transports every fact (reason/decidedAt/decidedBy) verbatim from
 * the caller-supplied approval, never inferring or scoring anything.
 */
export function materializeOverlayCandidate(
  candidate: OverlayCandidate,
  approval: OverlayApproval,
  opts: MaterializeOverlayCandidateOptions = {},
): MaterializationReport {
  validate(candidate, approval);
  const now = opts.now ?? (() => new Date().toISOString());
  const sourceReviewSubject = approval.sourceReviewSubject;
  const materialized: MaterializedFrozenOverlay = {
    id: computeMaterializedId(candidate.id, approval.id),
    sourceCandidateId: candidate.id,
    sourceApprovalId: approval.id,
    sourceProposalId: candidate.sourceProposalId,
    ...(sourceReviewSubject !== undefined ? { sourceReviewSubject } : {}),
    reason: approval.decision.rationale,
    decidedAt: approval.decision.decidedAt,
    decidedBy: approval.decision.reviewer,
  };
  return deepFreeze({
    materialized,
    fieldMapping: MATERIALIZED_FROZEN_FIELD_MAPPING,
    materializedAt: now(),
  });
}
