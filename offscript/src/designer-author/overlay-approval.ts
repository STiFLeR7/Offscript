/**
 * P14 — Overlay Candidate Approval: the deterministic boundary between
 * Proposal Translation (P13's `OverlayCandidate`) and Overlay creation
 * (`overlay.ts`'s `Frozen`, unwritten by this module).
 *
 * ARCHITECTURE DECISION (grounded, not assumed — see
 * docs/internals/P14-OVERLAY-CANDIDATE-APPROVAL-ARCHITECTURE.md §4 for the
 * full transition matrix): `DecisionLogEntry` (`actuation.ts`) CANNOT be
 * reused for this. Its required fields name a rail-actuation gate-loop an
 * OverlayCandidate never entered — `rails` names the Rail[] a pass was
 * gated by; `loops` counts actuator invocations; `residualViolations`
 * references real `operator.ts` `Finding[]` from a `runGate` call. None of
 * these have a legitimate value for a human approving a translated
 * proposal — populating them would be exactly the fabrication P13 already
 * ruled out for `Frozen.pass`/`findingIds`. This module is therefore a
 * dedicated `OverlayApproval` model (Option B), the same shape of decision
 * P13 made for `OverlayCandidate` itself.
 *
 * This is also the FIRST genuinely human-decision-shaped artifact in the
 * designer-author domain — P09-P13 are all deterministic transport or pure
 * computation. `recordOverlayApproval` therefore transports facts the
 * CALLER supplies (reviewer, status, rationale) and computes nothing about
 * whether to approve — see the "no automatic decisions" tests, which prove
 * a 'blocked' ProposalReviewReport does not force rejection and a clean one
 * does not force approval. The engine only transports the decision.
 *
 * Isolation: `OverlayCandidate` and `ProposalReviewReport` are imported
 * TYPE-ONLY. No value from `overlay.ts` is ever imported or called — this
 * module never writes an overlay, never reads one, and never touches
 * `repository/` or `governance/` (see the falsification tests in
 * overlay-approval.test.ts / overlay-approval-io.test.ts).
 */
import { createHash } from 'node:crypto';
import type { OverlayCandidate } from './proposal-overlay.js';
import type { ProposalReviewReport } from './proposal-review.js';

/** A human decision on an OverlayCandidate. Never inferred, never automatic. */
export type ApprovalStatus = 'approved' | 'rejected';

/** The decided facts: who, what, why, when. No generated commentary. */
export interface ApprovalDecision {
  readonly status: ApprovalStatus;
  readonly reviewer: string;
  readonly rationale: string;
  readonly decidedAt: string;
}

/** A recorded approval decision on an OverlayCandidate. */
export interface OverlayApproval {
  readonly id: string;
  readonly candidateId: string;
  readonly sourceProposalId: string;
  /** Present only when a ProposalReviewReport was supplied — a review is advisory, never mandatory (P12). */
  readonly sourceReviewSubject?: string;
  readonly decision: ApprovalDecision;
}

export interface RecordOverlayApprovalInput {
  readonly candidate: OverlayCandidate;
  readonly review?: ProposalReviewReport;
  readonly reviewer: string;
  readonly status: ApprovalStatus;
  readonly rationale: string;
}

export interface RecordOverlayApprovalOptions {
  readonly now?: () => string;
}

export class OverlayApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverlayApprovalError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function validate(input: RecordOverlayApprovalInput): void {
  if (!isNonEmptyString(input.candidate?.id)) {
    throw new OverlayApprovalError('recordOverlayApproval: input.candidate.id must be a non-empty string');
  }
  if (!isNonEmptyString(input.candidate?.sourceProposalId)) {
    throw new OverlayApprovalError('recordOverlayApproval: input.candidate.sourceProposalId must be a non-empty string');
  }
  if (input.status !== 'approved' && input.status !== 'rejected') {
    throw new OverlayApprovalError(`recordOverlayApproval: status must be 'approved' or 'rejected', got '${String(input.status)}'`);
  }
  if (!isNonEmptyString(input.reviewer)) {
    throw new OverlayApprovalError('recordOverlayApproval: reviewer must be a non-empty string');
  }
  if (!isNonEmptyString(input.rationale)) {
    throw new OverlayApprovalError('recordOverlayApproval: rationale must be a non-empty string');
  }
  if (input.review !== undefined && !isNonEmptyString(input.review.subject)) {
    throw new OverlayApprovalError('recordOverlayApproval: review.subject must be a non-empty string when review is supplied');
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

/**
 * Content-derived identity — excludes `decidedAt`, mirroring `proposal.ts`'s
 * exclusion of `createdAt` and `overlay.ts`'s `Frozen.id` exclusion of
 * `decidedAt`: the SAME decision (same candidate, same reviewer, same
 * status, same rationale) always yields the same id, regardless of when it
 * was recorded.
 */
function computeApprovalId(
  candidateId: string,
  sourceProposalId: string,
  sourceReviewSubject: string | undefined,
  decision: { status: ApprovalStatus; reviewer: string; rationale: string },
): string {
  const identityContent = {
    candidateId,
    sourceProposalId,
    sourceReviewSubject,
    status: decision.status,
    reviewer: decision.reviewer,
    rationale: decision.rationale,
  };
  return createHash('sha256').update(stableStringify(identityContent)).digest('hex');
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

/**
 * Record a human approval decision on an OverlayCandidate. Pure and total:
 * no filesystem, no overlay store, no catalog, no governance. Computes
 * nothing about whether to approve — `status`/`reviewer`/`rationale` are
 * facts the caller supplies; this function only validates their presence
 * and assembles them deterministically. Never gates on `review.reviewStatus`
 * — see the "no automatic decisions" tests.
 */
export function recordOverlayApproval(
  input: RecordOverlayApprovalInput,
  opts: RecordOverlayApprovalOptions = {},
): OverlayApproval {
  validate(input);
  const now = opts.now ?? (() => new Date().toISOString());
  const decision: ApprovalDecision = {
    status: input.status,
    reviewer: input.reviewer,
    rationale: input.rationale,
    decidedAt: now(),
  };
  const sourceReviewSubject = input.review?.subject;
  const approval: OverlayApproval = {
    id: computeApprovalId(input.candidate.id, input.candidate.sourceProposalId, sourceReviewSubject, decision),
    candidateId: input.candidate.id,
    sourceProposalId: input.candidate.sourceProposalId,
    ...(sourceReviewSubject !== undefined ? { sourceReviewSubject } : {}),
    decision,
  };
  return deepFreeze(approval);
}
