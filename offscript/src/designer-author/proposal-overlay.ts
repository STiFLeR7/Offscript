/**
 * P13 — Designer Author Proposal→Overlay Translation.
 *
 * ARCHITECTURE DECISION (grounded, not assumed — see
 * docs/internals/P13-DESIGNER-AUTHOR-PROPOSAL-OVERLAY-TRANSLATION.md §3 for
 * the full inventory): `Frozen` (`overlay.ts`) CANNOT be reused directly.
 * Two of its fields are REQUIRED and have no legitimate proposal-derived
 * value: `pass` names WHICH rail-actuation pass escalated a finding — a
 * proposal never enters an actuation pass; `findingIds` references real
 * `operator.ts` `Finding.id` values from a `detect()` run — a proposal was
 * never detected by any operator. Populating either would require
 * fabrication, which the brief forbids. `snapshotHtml` (optional in
 * `Frozen`) is likewise unavailable: it documents the WORKING DOCUMENT's
 * actual HTML at the moment of freeze, presupposing a real generation run a
 * proposal was never part of. This module is therefore Option B — an
 * intermediate `OverlayCandidate` model — never Option A.
 *
 * `FROZEN_FIELD_MAPPING` is the closed, deterministic documentation of
 * every one of Frozen's 7 fields' classification (direct/derived/
 * unavailable) — itself a frozen, testable constant, mirroring Doctor's
 * `REVIEW_CONTRACT` precedent (P08): specified once, never derived from a
 * run, never mutated.
 *
 * Isolation: `Frozen` is imported TYPE-ONLY (a compile-time exhaustiveness
 * anchor for `FROZEN_FIELD_MAPPING`'s `frozenField` key — if overlay.ts's
 * Frozen interface ever gains/loses a field, this file fails to type-check).
 * No value from `overlay.ts` (`writeOverlay`/`readOverlay`/
 * `freezeFromDecisionLog`/`filterFrozenFindings`) is ever imported or
 * called — translation never touches the real overlay store (see the
 * falsification tests in proposal-overlay.test.ts / proposal-overlay-io.test.ts).
 */
import type { AuthorProposal, ProposalKind, ProposalStatus } from './proposal.js';
import type { Frozen } from '../overlay.js';

export type OverlayFieldMappingKind = 'direct' | 'derived' | 'unavailable';

export interface OverlayFieldMapping {
  readonly frozenField: keyof Frozen;
  readonly kind: OverlayFieldMappingKind;
  readonly rationale: string;
  /** the corresponding OverlayCandidate field name — absent when kind === 'unavailable'. */
  readonly candidateField?: string;
}

export const FROZEN_FIELD_MAPPING: readonly OverlayFieldMapping[] = Object.freeze([
  Object.freeze({
    frozenField: 'id',
    kind: 'derived',
    rationale:
      "Frozen.id is a content-derived hash of (pass, findingIds); a proposal has neither, but its own identity.id is ALREADY a stable content hash — the candidate id is deterministically derived as `proposal-overlay:${proposal.identity.id}`.",
    candidateField: 'id',
  }),
  Object.freeze({
    frozenField: 'pass',
    kind: 'unavailable',
    rationale:
      'pass names WHICH rail-actuation pass escalated a finding. A proposal never enters generate/validate.ts or any actuation pass — there is no legitimate value; fabricating one would misrepresent provenance.',
  }),
  Object.freeze({
    frozenField: 'findingIds',
    kind: 'unavailable',
    rationale:
      "findingIds references real operator.ts Finding.id values from a detect() run. A proposal was never detected by any operator. The proposal's own review findings (proposal-review.ts, P12) are a structurally different shape (keyed by `dimension`, not `id`) representing a quality review, not a rail escalation — reusing them here would misrepresent what 'escalated' means.",
  }),
  Object.freeze({
    frozenField: 'snapshotHtml',
    kind: 'unavailable',
    rationale:
      "snapshotHtml is the working document's actual HTML at the moment of freeze — it presupposes a real generation run. A proposal's own content (often a deterministic Markdown brief, P11) was never part of an in-progress rendered document; mapping it here would misrepresent it as a live render. It is instead carried, honestly labeled, as the candidate's own proposedContent field.",
  }),
  Object.freeze({
    frozenField: 'reason',
    kind: 'derived',
    rationale:
      "assembled deterministically from the proposal's own status and evidence count via a closed template — never generative text.",
    candidateField: 'reason',
  }),
  Object.freeze({
    frozenField: 'decidedAt',
    kind: 'derived',
    rationale:
      'NOT proposal.identity.createdAt (a different moment — proposal AUTHORING, not an overlay DECISION). Stamped as the moment translation runs, via the same injectable now() every P0x module already uses.',
    candidateField: 'decidedAt',
  }),
  Object.freeze({
    frozenField: 'decidedBy',
    kind: 'derived',
    rationale:
      "= proposal.origin.authoredBy, carried through under Frozen's 'who decided' semantics — the proposal's own attributed author is the closest honest analogue this translation can offer.",
    candidateField: 'decidedBy',
  }),
]);

/**
 * The intermediate model (Option B). Fields fall into two groups: a
 * Frozen-equivalent subset (id/reason/decidedAt/decidedBy — see
 * FROZEN_FIELD_MAPPING) and genuinely new, proposal-domain fields
 * (sourceProposalId/sourceProposalStatus/kind/semanticFamily/
 * parentComponent/proposedContent) needed to make the candidate
 * self-describing and traceable — never a Frozen field under a
 * different name.
 */
export interface OverlayCandidate {
  readonly id: string;
  readonly sourceProposalId: string;
  readonly sourceProposalStatus: ProposalStatus;
  readonly kind: ProposalKind;
  readonly semanticFamily: string;
  readonly parentComponent?: string;
  readonly proposedContent: string;
  readonly reason: string;
  readonly decidedAt: string;
  readonly decidedBy: string;
}

export interface OverlayTranslationReport {
  readonly candidate: OverlayCandidate;
  /** = FROZEN_FIELD_MAPPING, verbatim — the same closed table on every report. */
  readonly fieldMapping: readonly OverlayFieldMapping[];
  /** = candidate.decidedAt, verbatim — one clock read, never two. */
  readonly translatedAt: string;
}

export interface TranslateProposalOptions {
  readonly now?: () => string;
}

function assembleReason(proposal: AuthorProposal): string {
  const evidenceNote =
    proposal.evidence.length > 0 ? `${proposal.evidence.length} evidence item(s) supplied` : 'no evidence supplied';
  return `Translated from Designer Author proposal ${proposal.identity.id} (status: ${proposal.status}; ${evidenceNote}).`;
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
 * Translate a proposal into an OverlayCandidate. Pure and total: no
 * filesystem, no overlay store read/write, no catalog access. Never gates
 * on the proposal's own review status (P12) — translation is a data
 * transform, not a promotion decision.
 */
export function translateProposalToOverlayCandidate(
  proposal: AuthorProposal,
  opts: TranslateProposalOptions = {},
): OverlayTranslationReport {
  const now = opts.now ?? (() => new Date().toISOString());
  const decidedAt = now();
  const candidate: OverlayCandidate = {
    id: `proposal-overlay:${proposal.identity.id}`,
    sourceProposalId: proposal.identity.id,
    sourceProposalStatus: proposal.status,
    kind: proposal.kind,
    semanticFamily: proposal.semanticFamily,
    ...(proposal.parentComponent !== undefined ? { parentComponent: proposal.parentComponent } : {}),
    proposedContent: proposal.content,
    reason: assembleReason(proposal),
    decidedAt,
    decidedBy: proposal.origin.authoredBy,
  };
  return deepFreeze({
    candidate,
    fieldMapping: FROZEN_FIELD_MAPPING,
    translatedAt: decidedAt,
  });
}
