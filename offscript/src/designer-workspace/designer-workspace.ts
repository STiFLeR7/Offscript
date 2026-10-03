/**
 * P19 — Designer Workspace Foundation: the DesignerWorkspace model.
 *
 * ARCHITECTURE DECISION (grounded, not assumed — see
 * docs/internals/P19-DESIGNER-WORKSPACE-FOUNDATION.md §3 for the full
 * evaluation): three options were investigated.
 *
 *   A) Extend ReviewPackage — rejected. `ReviewPackage` (P08, extended
 *      P10/P12/P18) is scoped to ONE run's diagnostic content — its
 *      `replayIdentity`/`headlineStatus`/`systematicRatio`/`findingCount`
 *      are all single-run facts. A review session spans MULTIPLE
 *      independently-persisted packages (many proposals, many feedback
 *      entries accumulated over time, potentially two tracks) — a
 *      many-to-many aggregation, not a single optional array field like
 *      `proposals`/`proposalReviews`/`designerFeedback`. Extending
 *      `ReviewPackage` further would also force `doctor/` to gain a
 *      VALUE-level dependency on `designer-author/`/`designer-feedback/` to
 *      discover and aggregate their packages — `doctor/` has never done
 *      this (every prior addendum is a caller-supplied, already-in-memory
 *      array; Workspace needs to reference packages that may have been
 *      built/persisted by a wholly separate process at a different time).
 *   B) A bare aggregation function, no persisted artifact — rejected. The
 *      brief's OBJECTIVE states "The Workspace is an immutable snapshot,"
 *      and its IMPLEMENTATION section names a manifest/package/IO — none of
 *      which exist under a pure "just aggregate on demand" reading. A
 *      snapshot needs its own deterministic identity, capturable and
 *      replayable, not a live query recomputed differently each time.
 *   C) A NEW, independent `DesignerWorkspace` package — CHOSEN. It
 *      REFERENCES (never embeds) already-built `ReviewPackage` /
 *      `ProposalPackage` / `ProposalReviewReport` / `FeedbackPackage`
 *      objects, mirroring how `ReviewPackage.artifacts` itself indexes
 *      review-report.md/doctor-report.json/score.json by {name, path,
 *      sha256} rather than re-embedding their text. Option B's insight
 *      (aggregate, don't duplicate) is fully preserved — it becomes this
 *      option's computation, not its persistence model.
 *
 * ISOLATION: every import of `ReviewPackage`/`ProposalPackage`/
 * `ProposalReviewReport`/`FeedbackPackage` below is TYPE-ONLY.
 * `buildDesignerWorkspace` never calls `buildReviewPackage`,
 * `buildProposalPackage`, `reviewProposal`, `recordDesignerFeedback`, or
 * `buildFeedbackPackage` — it only reads fields off objects the CALLER has
 * already built (see the isolation tests in designer-workspace.test.ts).
 *
 * WORKSPACE MODEL — "represent only organization" (the brief, verbatim):
 * `artifacts` is a list of {kind, id, sha256} REFERENCES — the id is
 * always a field the referenced object ALREADY carries verbatim
 * (`ReviewPackage.metadata.replayIdentity`, `ProposalPackage.manifest.
 * proposalId`, `ProposalReviewReport.subject`, `FeedbackPackage.manifest.
 * feedbackId`); the sha256 is a fresh hash over the exact object supplied.
 * `progress` is raw counts only — total/resolved/unresolved — computed by
 * DISTINCT-deduplicating `DesignerFeedback.subject` references against
 * `reviewPackage.findingCount` and the supplied proposal count. Nothing
 * here infers quality or generates a recommendation: every number is
 * either a caller-supplied count or a distinct-id tally, the same
 * discipline `review-report.ts`'s `metrics` block already established for
 * Doctor findings.
 *
 * KNOWN, ACCEPTED LIMITATION (named, not hidden): `resolvedFindings` can
 * exceed a workspace's own `totalFindings` if the supplied feedback
 * references a doctor-finding subject id that isn't among the CURRENT
 * `reviewPackage`'s findings (e.g. stale feedback from a different run) —
 * `ReviewPackage` exposes only `findingCount` (a number), never the actual
 * finding id list, so Workspace cannot cross-validate individual ids
 * without importing `DoctorReport`'s full finding shape, a heavier
 * coupling than "references and summaries" justifies. `unresolvedFindings`
 * / `unresolvedProposals` are floored at 0 rather than allowed to go
 * negative — arithmetic hygiene, not a quality judgment.
 *
 * P21 — DESIGNER PLATFORM INTEGRATION AUDIT ADDENDUM. `DesignerWorkspace`
 * gains a fifth, OPTIONAL artifact kind: `overlay-activation`. This closes
 * a gap this module's own §2 investigation named and then left unaddressed:
 * the Artifact Inventory above lists `OverlayCandidate`/`Approval`/
 * `Materialized`/`Activation` (P13-P16) as belonging to the SAME "compose
 * naturally along one axis" set as `ReviewPackage`/`ProposalPackage`/
 * `ProposalReviewReport`/`FeedbackPackage` — but §3.1's actual input shape
 * never referenced it. `overlayActivationPackages` references P16's
 * `ActivationPackage` — the overlay lifecycle's own terminal, already-
 * packaged artifact (P17 confirmed Activation is the lifecycle's
 * intentional terminus, so this references the lifecycle's outcome, not
 * every intermediate stage). Same discipline as every other kind: a
 * `{kind, id, sha256}` reference via the caller-supplied `ActivationPackage`
 * object, never embedded, never re-derived, never gated on approval status
 * (a workspace organizes whatever activations exist; it does not judge
 * them). Absent unless supplied — no `[]` default — so every pre-P21 call
 * site is unaffected.
 */
import { createHash } from 'node:crypto';
import type { ReviewPackage } from '../doctor/review-package.js';
import type { ProposalPackage } from '../designer-author/proposal-package.js';
import type { ProposalReviewReport } from '../designer-author/proposal-review.js';
import type { ActivationPackage } from '../designer-author/overlay-activation-package.js';
import type { FeedbackPackage } from '../designer-feedback/designer-feedback-package.js';

export type WorkspaceArtifactKind =
  | 'review-package'
  | 'proposal-package'
  | 'proposal-review'
  | 'feedback-package'
  | 'overlay-activation';

/** A reference to an already-built package/report — id + hash only, never the object itself. */
export interface WorkspaceArtifactReference {
  readonly kind: WorkspaceArtifactKind;
  readonly id: string;
  readonly sha256: string;
}

/** Raw counts only. No inferred quality, no generated recommendation. */
export interface WorkspaceReviewProgress {
  readonly totalFindings: number;
  readonly resolvedFindings: number;
  readonly unresolvedFindings: number;
  readonly totalProposals: number;
  readonly resolvedProposals: number;
  readonly unresolvedProposals: number;
  readonly totalFeedback: number;
}

export interface DesignerWorkspace {
  readonly id: string;
  readonly client: string;
  readonly track: string;
  readonly createdAt: string;
  readonly artifacts: readonly WorkspaceArtifactReference[];
  readonly progress: WorkspaceReviewProgress;
}

export interface BuildDesignerWorkspaceInput {
  readonly client: string;
  readonly track: string;
  readonly reviewPackage?: ReviewPackage;
  readonly proposalPackages?: readonly ProposalPackage[];
  readonly proposalReviews?: readonly ProposalReviewReport[];
  readonly feedbackPackages?: readonly FeedbackPackage[];
  /** P21 — the overlay lifecycle's own terminal, already-packaged artifact (P16's
   *  ActivationPackage; P17 confirmed Activation is the lifecycle's intentional
   *  terminus). Referenced the same way as every other artifact kind — never embedded. */
  readonly overlayActivationPackages?: readonly ActivationPackage[];
}

export interface BuildDesignerWorkspaceOptions {
  readonly now?: () => string;
}

export class DesignerWorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerWorkspaceError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function validate(input: BuildDesignerWorkspaceInput): void {
  if (!isNonEmptyString(input.client)) {
    throw new DesignerWorkspaceError('buildDesignerWorkspace: client must be a non-empty string');
  }
  if (!isNonEmptyString(input.track)) {
    throw new DesignerWorkspaceError('buildDesignerWorkspace: track must be a non-empty string');
  }
  if (input.reviewPackage !== undefined) {
    if (input.reviewPackage.metadata.client !== input.client) {
      throw new DesignerWorkspaceError(
        `buildDesignerWorkspace: client "${input.client}" does not match reviewPackage.metadata.client "${input.reviewPackage.metadata.client}"`,
      );
    }
    if (input.reviewPackage.metadata.track !== input.track) {
      throw new DesignerWorkspaceError(
        `buildDesignerWorkspace: track "${input.track}" does not match reviewPackage.metadata.track "${input.reviewPackage.metadata.track}"`,
      );
    }
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

function refFor(kind: WorkspaceArtifactKind, id: string, obj: unknown): WorkspaceArtifactReference {
  return { kind, id, sha256: sha256Hex(stableStringify(obj)) };
}

function compareRefs(a: WorkspaceArtifactReference, b: WorkspaceArtifactReference): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildArtifactReferences(input: BuildDesignerWorkspaceInput): WorkspaceArtifactReference[] {
  const refs: WorkspaceArtifactReference[] = [];
  if (input.reviewPackage !== undefined) {
    refs.push(refFor('review-package', input.reviewPackage.metadata.replayIdentity, input.reviewPackage));
  }
  for (const p of input.proposalPackages ?? []) {
    refs.push(refFor('proposal-package', p.manifest.proposalId, p));
  }
  for (const r of input.proposalReviews ?? []) {
    refs.push(refFor('proposal-review', r.subject, r));
  }
  for (const f of input.feedbackPackages ?? []) {
    refs.push(refFor('feedback-package', f.manifest.feedbackId, f));
  }
  for (const a of input.overlayActivationPackages ?? []) {
    refs.push(refFor('overlay-activation', a.manifest.activationId, a));
  }
  return refs.sort(compareRefs);
}

function computeProgress(input: BuildDesignerWorkspaceInput): WorkspaceReviewProgress {
  const resolvedFindingIds = new Set<string>();
  const resolvedProposalIds = new Set<string>();
  for (const f of input.feedbackPackages ?? []) {
    const subject = f.feedback.subject;
    if (subject.kind === 'doctor-finding') resolvedFindingIds.add(subject.id);
    else if (subject.kind === 'proposal') resolvedProposalIds.add(subject.id);
  }
  const totalFindings = input.reviewPackage?.findingCount ?? 0;
  const totalProposals = (input.proposalPackages ?? []).length;
  const totalFeedback = (input.feedbackPackages ?? []).length;
  const resolvedFindings = resolvedFindingIds.size;
  const resolvedProposals = resolvedProposalIds.size;
  return {
    totalFindings,
    resolvedFindings,
    unresolvedFindings: Math.max(0, totalFindings - resolvedFindings),
    totalProposals,
    resolvedProposals,
    unresolvedProposals: Math.max(0, totalProposals - resolvedProposals),
    totalFeedback,
  };
}

/**
 * Content-derived identity — excludes `createdAt`, mirroring every prior
 * P09-P18 identity formula: the SAME set of referenced artifacts (same
 * client, same track, same artifact multiset) always yields the same id,
 * regardless of when the workspace was assembled or the input array order.
 */
function computeWorkspaceId(client: string, track: string, artifacts: readonly WorkspaceArtifactReference[]): string {
  return sha256Hex(stableStringify({ client, track, artifacts }));
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
 * Assemble a DesignerWorkspace from already-built packages/reports. Pure
 * and total: no filesystem, no overlay store, no catalog, no governance, no
 * runtime consumption. Computes nothing about whether any referenced
 * artifact is correct or complete — every field is either a verbatim
 * reference to a caller-supplied object's own identity, a hash of that
 * exact object, or a distinct-id count derived from it.
 */
export function buildDesignerWorkspace(
  input: BuildDesignerWorkspaceInput,
  opts: BuildDesignerWorkspaceOptions = {},
): DesignerWorkspace {
  validate(input);
  const now = opts.now ?? (() => new Date().toISOString());
  const artifacts = buildArtifactReferences(input);
  const progress = computeProgress(input);
  const workspace: DesignerWorkspace = {
    id: computeWorkspaceId(input.client, input.track, artifacts),
    client: input.client,
    track: input.track,
    createdAt: now(),
    artifacts: Object.freeze(artifacts),
    progress: Object.freeze(progress),
  };
  return deepFreeze(workspace);
}
