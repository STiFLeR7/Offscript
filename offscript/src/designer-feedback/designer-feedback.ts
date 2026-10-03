/**
 * P18 — Designer Feedback Foundation: the DesignerFeedback model.
 *
 * ARCHITECTURE DECISION (grounded, not assumed — see
 * docs/internals/P18-DESIGNER-FEEDBACK-FOUNDATION.md §3 for the full
 * artifact inventory): `doctor/review-package.ts`'s own `REVIEW_CONTRACT`
 * has, since P08, named this exact gap in its `'designer-feedback'` stage:
 * "A human designer reads Critical Findings and Warnings and records a
 * decision per finding (e.g. accept / needs-change / defer) OUTSIDE this
 * package. Doctor does not collect, store, transmit, or process any
 * designer response — there is no feedback channel back into Offscript today."
 * `FeedbackStatus`'s three values are lifted VERBATIM from that sentence.
 * This grounds Attachment Option A (Doctor findings) directly from source —
 * not an assumption made for this sprint. `proposal` is included as a
 * second `FeedbackSubjectKind` because the same designer-facing artifact
 * (`ReviewPackage`, P10/P12) already transports `AuthorProposal` summaries
 * and `ProposalReviewReport`s alongside Doctor findings; a designer reading
 * one package should be able to record a fact against either.
 *
 * "Review Package" (Option C) and "a separate Feedback Package" (Option D)
 * were both evaluated as ATTACHMENT points and rejected as such: neither is
 * a legitimate SUBJECT a fact can be recorded "about" — `ReviewPackage` is a
 * manifest over several artifacts, not a single reviewable claim, and a
 * "Feedback Package" is the OUTPUT container this module builds
 * (`designer-feedback-package.ts`), not something feedback attaches to.
 * "Proposal reviews" (Option B) — `ProposalReviewReport` — was evaluated and
 * rejected as a THIRD subject kind: its findings are keyed by `dimension`
 * (a closed 5-value enum shared across every proposal, e.g.
 * `'evidence-completeness'`), not a unique per-instance id; a designer's
 * decision naturally attaches to the PROPOSAL the review is about, not to
 * which structural-quality dimension flagged it — recorded here via the
 * existing `'proposal'` subject kind, not a new one.
 *
 * ZERO domain coupling, deliberately narrower than `overlay-approval.ts`
 * (P14, which imports `OverlayCandidate`/`ProposalReviewReport` TYPES to
 * snapshot fields): `recordDesignerFeedback` accepts a plain `{kind, id}`
 * subject reference the caller assembles — no import beyond node:crypto.
 * "The engine must transport feedback, must never interpret it, must never
 * automatically apply it" — this module computes nothing about whether a
 * finding is right or wrong; `status`/`note` are facts the caller supplies
 * verbatim. Domain-aware convenience helpers that DO import
 * `DoctorFinding`/`AuthorProposal` types (so a caller doesn't have to know
 * `AuthorProposal.identity.id` is the right field to reference) live in a
 * separate file, designer-feedback-subjects.ts, keeping this file's
 * isolation guarantee absolute (see this file's own isolation tests).
 */
import { createHash } from 'node:crypto';

/** Lifted verbatim from REVIEW_CONTRACT's own 'designer-feedback' stage text (review-package.ts). */
export type FeedbackStatus = 'accept' | 'needs-change' | 'defer';

const FEEDBACK_STATUSES: readonly FeedbackStatus[] = Object.freeze(['accept', 'needs-change', 'defer']);

/** What this feedback is about. A doctor-finding or a proposal — never inferred, always caller-supplied. */
export type FeedbackSubjectKind = 'doctor-finding' | 'proposal';

const FEEDBACK_SUBJECT_KINDS: readonly FeedbackSubjectKind[] = Object.freeze(['doctor-finding', 'proposal']);

/** A reference to the subject this feedback is about — id verbatim, never dereferenced or validated against it. */
export interface FeedbackSubject {
  readonly kind: FeedbackSubjectKind;
  readonly id: string;
}

/** A recorded designer decision. Facts only: who, what, why, when. No generated commentary. */
export interface DesignerFeedback {
  readonly id: string;
  readonly subject: FeedbackSubject;
  readonly reviewer: string;
  readonly status: FeedbackStatus;
  readonly note: string;
  readonly recordedAt: string;
}

export interface RecordDesignerFeedbackInput {
  readonly subject: FeedbackSubject;
  readonly reviewer: string;
  readonly status: FeedbackStatus;
  readonly note: string;
}

export interface RecordDesignerFeedbackOptions {
  readonly now?: () => string;
}

export class DesignerFeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerFeedbackError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function validate(input: RecordDesignerFeedbackInput): void {
  if (!FEEDBACK_SUBJECT_KINDS.includes(input.subject?.kind)) {
    throw new DesignerFeedbackError(
      `recordDesignerFeedback: subject.kind must be one of ${FEEDBACK_SUBJECT_KINDS.join('/')}, got '${String(input.subject?.kind)}'`,
    );
  }
  if (!isNonEmptyString(input.subject?.id)) {
    throw new DesignerFeedbackError('recordDesignerFeedback: subject.id must be a non-empty string');
  }
  if (!isNonEmptyString(input.reviewer)) {
    throw new DesignerFeedbackError('recordDesignerFeedback: reviewer must be a non-empty string');
  }
  if (!FEEDBACK_STATUSES.includes(input.status)) {
    throw new DesignerFeedbackError(`recordDesignerFeedback: status must be one of ${FEEDBACK_STATUSES.join('/')}, got '${String(input.status)}'`);
  }
  if (!isNonEmptyString(input.note)) {
    throw new DesignerFeedbackError('recordDesignerFeedback: note must be a non-empty string');
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
 * Content-derived identity — excludes `recordedAt`, mirroring every prior
 * P09-P17 identity formula (`proposal.ts`'s `createdAt`, `overlay-approval.ts`'s
 * `decidedAt`, `overlay-activation.ts`'s `activatedAt`): the SAME fact (same
 * subject, same reviewer, same status, same note) always yields the same
 * id, regardless of when it was recorded.
 */
function computeFeedbackId(input: RecordDesignerFeedbackInput): string {
  const identityContent = {
    subjectKind: input.subject.kind,
    subjectId: input.subject.id,
    reviewer: input.reviewer,
    status: input.status,
    note: input.note,
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
 * Record a designer's decision about a subject (a Doctor finding or a
 * proposal). Pure and total: no filesystem, no overlay store, no catalog, no
 * governance, no runtime consumption. Computes nothing about whether the
 * subject is right or wrong — `reviewer`/`status`/`note` are facts the
 * caller supplies; this function only validates their presence and assembles
 * them deterministically.
 */
export function recordDesignerFeedback(
  input: RecordDesignerFeedbackInput,
  opts: RecordDesignerFeedbackOptions = {},
): DesignerFeedback {
  validate(input);
  const now = opts.now ?? (() => new Date().toISOString());
  const feedback: DesignerFeedback = {
    id: computeFeedbackId(input),
    subject: { kind: input.subject.kind, id: input.subject.id },
    reviewer: input.reviewer,
    status: input.status,
    note: input.note,
    recordedAt: now(),
  };
  return deepFreeze(feedback);
}
