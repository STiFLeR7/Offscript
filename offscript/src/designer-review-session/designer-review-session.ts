/**
 * P20 — Designer Review Session Foundation: the DesignerReviewSession model.
 *
 * "The Session owns workflow. The Workspace owns evidence." (the brief,
 * verbatim). ARCHITECTURE DECISION (grounded, not assumed — see
 * docs/internals/P20-DESIGNER-REVIEW-SESSION-FOUNDATION.md §3 for the full
 * evaluation): three options were investigated.
 *
 *   A) Extend Workspace — rejected. `DesignerWorkspace` (P19) is explicitly
 *      defined as an IMMUTABLE SNAPSHOT: its own content-derived identity
 *      formula deliberately excludes `createdAt` so re-building the SAME
 *      set of references always yields the SAME id. A Session's entire
 *      purpose is to carry state ACROSS TIME (open now, closed later) —
 *      folding that onto Workspace would either break Workspace's snapshot
 *      identity discipline or force Workspace to grow a mutable field,
 *      both of which contradict P19's own architecture.
 *   B) Reference Workspace only — insufficient on its own. The brief names
 *      ReviewPackage/ProposalPackage/FeedbackPackage (not just Workspace)
 *      as things "the Session may reference" — evidence a reviewer collects
 *      DURING the session that may postdate the Workspace snapshot the
 *      session was opened against (e.g. feedback recorded mid-session,
 *      before anyone re-snapshots a fresh Workspace to fold it in).
 *   C) Reference Workspace AND, optionally, individual artifacts directly
 *      — CHOSEN. Mirrors Workspace's own `{kind, id, sha256}` reference
 *      pattern one level up: `SessionArtifactReference` adds `'workspace'`
 *      to the same closed-kind-vocabulary idea `WorkspaceArtifactReference`
 *      established in P19.
 *
 * ISOLATION: every import of `DesignerWorkspace`/`WorkspaceReviewProgress`/
 * `ReviewPackage`/`ProposalPackage`/`FeedbackPackage` below is TYPE-ONLY.
 * `openReviewSession`/`closeReviewSession` never call `buildDesignerWorkspace`,
 * `buildReviewPackage`, `buildProposalPackage`, `recordDesignerFeedback`, or
 * `buildFeedbackPackage` — they only read fields off objects the CALLER has
 * already built (see the isolation tests in designer-review-session.test.ts).
 *
 * SESSION MODEL — "represent only workflow state" (the brief, verbatim):
 * `progressCheckpoint` is a VERBATIM COPY of the referenced Workspace's own
 * `.progress` at open time — the SAME "copy an already-computed scalar
 * summary, never re-derive it" discipline Workspace itself used against
 * `ReviewPackage.findingCount` in P19. `artifacts` are references, never
 * embedded objects — proven by a falsification test that a unique proposal
 * marker never appears in a serialized session.
 *
 * IDENTITY — the ONE deliberate deviation from every P09-P19 model's
 * identity formula. Every prior model EXCLUDES its own timestamp from
 * identity, because re-recording the identical DECISION (the same approval,
 * the same activation, the same feedback) at a different moment is still
 * the SAME fact and should hash to the SAME id. A session-open is not a
 * decision-fact — it is an EVENT: the same reviewer opening a session
 * against the same workspace on two different days is legitimately TWO
 * different sessions, so `openedAt` IS part of `DesignerReviewSession.id`.
 * `closedAt`, by contrast, stays EXCLUDED — closing a session must never
 * change its `id`, since it is the SAME session, now closed (see
 * `closeReviewSession`, which returns a new object with the SAME `id`).
 *
 * P21 — DESIGNER PLATFORM INTEGRATION AUDIT ADDENDUM. Gains a fifth,
 * OPTIONAL artifact kind: `overlay-activation`, mirroring the identical
 * seam `designer-workspace.ts`'s own P21 addendum closes one level down —
 * see that module's header for the full evidence. `overlayActivationPackages`
 * references P16's `ActivationPackage`; same `{kind, id, sha256}` discipline
 * as every other kind, never embedded, absent unless supplied.
 */
import { createHash } from 'node:crypto';
import type { DesignerWorkspace, WorkspaceReviewProgress } from '../designer-workspace/designer-workspace.js';
import type { ReviewPackage } from '../doctor/review-package.js';
import type { ProposalPackage } from '../designer-author/proposal-package.js';
import type { ActivationPackage } from '../designer-author/overlay-activation-package.js';
import type { FeedbackPackage } from '../designer-feedback/designer-feedback-package.js';

export type SessionArtifactKind = 'workspace' | 'review-package' | 'proposal-package' | 'feedback-package' | 'overlay-activation';

/** A reference to an already-built package — id + hash only, never the object itself. */
export interface SessionArtifactReference {
  readonly kind: SessionArtifactKind;
  readonly id: string;
  readonly sha256: string;
}

export type SessionState = 'open' | 'closed';

export interface DesignerReviewSession {
  readonly id: string;
  readonly workspaceId: string;
  readonly reviewer: string;
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly state: SessionState;
  /** verbatim copy of the referenced Workspace's own `.progress` at open time. */
  readonly progressCheckpoint: WorkspaceReviewProgress;
  readonly artifacts: readonly SessionArtifactReference[];
}

export interface OpenReviewSessionInput {
  readonly workspace: DesignerWorkspace;
  readonly reviewer: string;
  readonly reviewPackages?: readonly ReviewPackage[];
  readonly proposalPackages?: readonly ProposalPackage[];
  readonly feedbackPackages?: readonly FeedbackPackage[];
  /** P21 — the overlay lifecycle's own terminal, already-packaged artifact (P16's
   *  ActivationPackage). Same reference discipline as every other artifact kind. */
  readonly overlayActivationPackages?: readonly ActivationPackage[];
}

export interface OpenReviewSessionOptions {
  readonly now?: () => string;
}

export interface CloseReviewSessionOptions {
  readonly now?: () => string;
}

export class DesignerReviewSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerReviewSessionError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function validateOpenInput(input: OpenReviewSessionInput): void {
  if (!isNonEmptyString(input.workspace?.id)) {
    throw new DesignerReviewSessionError('openReviewSession: workspace.id must be a non-empty string');
  }
  if (!isNonEmptyString(input.reviewer)) {
    throw new DesignerReviewSessionError('openReviewSession: reviewer must be a non-empty string');
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

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function refFor(kind: SessionArtifactKind, id: string, obj: unknown): SessionArtifactReference {
  return { kind, id, sha256: sha256Hex(stableStringify(obj)) };
}

function compareRefs(a: SessionArtifactReference, b: SessionArtifactReference): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildArtifactReferences(input: OpenReviewSessionInput): SessionArtifactReference[] {
  const refs: SessionArtifactReference[] = [refFor('workspace', input.workspace.id, input.workspace)];
  for (const r of input.reviewPackages ?? []) {
    refs.push(refFor('review-package', r.metadata.replayIdentity, r));
  }
  for (const p of input.proposalPackages ?? []) {
    refs.push(refFor('proposal-package', p.manifest.proposalId, p));
  }
  for (const f of input.feedbackPackages ?? []) {
    refs.push(refFor('feedback-package', f.manifest.feedbackId, f));
  }
  for (const a of input.overlayActivationPackages ?? []) {
    refs.push(refFor('overlay-activation', a.manifest.activationId, a));
  }
  return refs.sort(compareRefs);
}

/**
 * Content-derived identity — INCLUDES `openedAt` (a session-open is an
 * event, not a decision-fact; see the module header) and EXCLUDES
 * `closedAt` (closing must never change the id).
 */
function computeSessionId(workspaceId: string, reviewer: string, openedAt: string, artifacts: readonly SessionArtifactReference[]): string {
  return sha256Hex(stableStringify({ workspaceId, reviewer, openedAt, artifacts }));
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
 * Open a review session against an already-built Workspace. Pure and
 * total: no filesystem, no overlay store, no catalog, no governance, no
 * runtime consumption. Computes nothing about whether the workspace or any
 * referenced artifact is correct or complete.
 */
export function openReviewSession(
  input: OpenReviewSessionInput,
  opts: OpenReviewSessionOptions = {},
): DesignerReviewSession {
  validateOpenInput(input);
  const now = opts.now ?? (() => new Date().toISOString());
  const openedAt = now();
  const artifacts = buildArtifactReferences(input);
  const session: DesignerReviewSession = {
    id: computeSessionId(input.workspace.id, input.reviewer, openedAt, artifacts),
    workspaceId: input.workspace.id,
    reviewer: input.reviewer,
    openedAt,
    state: 'open',
    progressCheckpoint: input.workspace.progress,
    artifacts: Object.freeze(artifacts),
  };
  return deepFreeze(session);
}

/**
 * Close an open review session. Returns a NEW, deep-frozen object — never
 * mutates the input session. The `id` is carried over verbatim: closing is
 * a state transition of the SAME session, not a new session.
 */
export function closeReviewSession(
  session: DesignerReviewSession,
  opts: CloseReviewSessionOptions = {},
): DesignerReviewSession {
  if (session.state !== 'open') {
    throw new DesignerReviewSessionError(`closeReviewSession: session "${session.id}" is already closed`);
  }
  const now = opts.now ?? (() => new Date().toISOString());
  const closed: DesignerReviewSession = {
    id: session.id,
    workspaceId: session.workspaceId,
    reviewer: session.reviewer,
    openedAt: session.openedAt,
    closedAt: now(),
    state: 'closed',
    progressCheckpoint: session.progressCheckpoint,
    artifacts: session.artifacts,
  };
  return deepFreeze(closed);
}
