/**
 * P08 — Designer Doctor Review Package.
 *
 * A deterministic manifest over artifacts the driver has ALREADY produced:
 * `doctorReport` (P04-P06), `score` (the existing RunScore), `reviewReport`/
 * `reviewReportMarkdown` (P07), and `validationSummary` (= the already-computed
 * `formatRunHeadline` text — never reformatted, never re-derived). This is the
 * artifact designers review, annotate, and respond to; it is not editable by
 * Offscript and Doctor never reads a response back (see REVIEW_CONTRACT below).
 *
 * `buildReviewPackage` performs NO detection, NO scoring, and NO re-diagnosis —
 * every artifact hash is computed over the EXACT text the caller supplies (the
 * same content the driver writes to disk), so the manifest is a faithful INDEX
 * of what already exists, never a duplicate copy and never an invented fact.
 *
 * Zero runtime coupling to doctor-report.ts (import type only) — this module
 * operates on the already-built `DoctorReport`/`RunScore`/`ReviewReport` data
 * shapes. The one real value import is `renderExecutiveSummary` from
 * review-report.ts — reused verbatim so the package's summary and the review
 * report's own Executive Summary section are always the identical text.
 *
 * P10 — DESIGNER AUTHOR CONSUMPTION ADDENDUM. `ReviewPackage` gains one new,
 * OPTIONAL field: `proposals`. When the caller supplies `AuthorProposal`s
 * (Designer Author, P09), each is reduced to a `ProposalSummary` via
 * `summarizeProposal` (designer-author/proposal-report.ts) — the SAME
 * "one legitimate value import" pattern `renderExecutiveSummary` already
 * established for review-report.ts. This is PURE TRANSPORT: `proposals`
 * never participates in `headlineStatus`/`systematicRatio`/`findingCount`/
 * `validationSummary`/`artifacts`/`replayIdentity` — every one of those is
 * computed identically whether or not `proposals` is supplied (proven in
 * test/doctor/review-package.test.ts's own P10 falsification block and
 * test/designer-author/consumption-isolation.test.ts). When omitted, the
 * field is absent from the returned object entirely — no `[]` default — so
 * every existing production call site (which never supplies it) produces a
 * package IDENTICAL, key-for-key, to the pre-P10 shape.
 *
 * P12 — DESIGNER AUTHOR PROPOSAL REVIEW ADDENDUM. `ReviewPackage` gains a
 * second, OPTIONAL, Designer Author field: `proposalReviews`. Unlike
 * `proposals` (P10, a raw `AuthorProposal[]` this module reduces itself via
 * `summarizeProposal`), the caller here supplies ALREADY-BUILT
 * `ProposalReviewReport[]` (`designer-author/proposal-review.ts#reviewProposal`)
 * — this module performs no review, no detection, and no scoring of its
 * own; it only transports the caller's finished report objects verbatim.
 * The import of `ProposalReviewReport` is therefore TYPE-ONLY (no new value
 * import needed at all, an even thinner coupling than `proposals`' one
 * legitimate `summarizeProposal` call). Exactly like `proposals`,
 * `proposalReviews` never participates in `headlineStatus`/`systematicRatio`/
 * `findingCount`/`validationSummary`/`artifacts` — proven in this file's own
 * P12 falsification block, including the case where the attached proposal
 * review's own status is `'blocked'`. Absent unless supplied — no `[]`
 * default — so every pre-P12 call site is unaffected.
 *
 * P18 — DESIGNER FEEDBACK ADDENDUM. `ReviewPackage` gains a third, OPTIONAL
 * field: `designerFeedback`. This closes the exact gap `REVIEW_CONTRACT`'s
 * own `'designer-feedback'` stage has named since P08 — see that stage's
 * text below, now updated. Like `proposalReviews`, the caller supplies
 * ALREADY-BUILT `DesignerFeedback[]` (`designer-feedback/designer-feedback.js
 * #recordDesignerFeedback`); this module performs no recording, no
 * validation, and no interpretation of its own — the import is TYPE-ONLY, an
 * even thinner coupling than `proposals`. `designerFeedback` never
 * participates in `headlineStatus`/`systematicRatio`/`findingCount`/
 * `validationSummary`/`artifacts` — proven in
 * test/designer-feedback/consumption-isolation.test.ts's own falsification
 * block. Absent unless supplied — no `[]` default — so every pre-P18 call
 * site is unaffected. This is TRANSPORT ONLY: Doctor still reads no feedback
 * back to change its own behavior; a designer (or a future tool) reading the
 * finished package now sees recorded decisions alongside the findings they
 * reference, nothing more.
 */
import { createHash } from 'node:crypto';
import type { DoctorReport } from './doctor-report.js';
import { renderExecutiveSummary, type ReviewReport } from './review-report.js';
import type { RunScore } from '../score.js';
import type { HeadlineStatus } from '../run-headline.js';
import { PLATFORM_HARNESS_VERSION } from '../platform-harness.js';
import { summarizeProposal, type ProposalSummary } from '../designer-author/proposal-report.js';
import type { AuthorProposal } from '../designer-author/proposal.js';
import type { ProposalReviewReport } from '../designer-author/proposal-review.js';
import type { DesignerFeedback } from '../designer-feedback/designer-feedback.js';

// ─────────────────────────────────────────────────────────────────────────────
// The review contract — SPECIFIED, not implemented. A fixed, closed list; never
// derived from a run, never mutated by one. Doctor's own responsibility ends at
// stage 1: it emits the package and reads nothing back.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewContractStage {
  readonly stage: string;
  readonly description: string;
}

export const REVIEW_CONTRACT: readonly ReviewContractStage[] = Object.freeze([
  Object.freeze({
    stage: 'review-package',
    description:
      'Doctor emits this package: deterministic, read-only, every artifact traceable to an already-existing output. Doctor performs no action beyond emitting it.',
  }),
  Object.freeze({
    stage: 'designer-feedback',
    description:
      'A human designer reads Critical Findings and Warnings and records a decision per finding or proposal (accept / needs-change / defer) via designer-feedback/designer-feedback.js#recordDesignerFeedback (P18). The recorded DesignerFeedback MAY be attached to this package verbatim as transport (see the `designerFeedback` field) so it travels alongside the findings it references. Doctor still collects nothing itself and never reads a response back to change its own behavior — recording and attachment are both caller-driven, outside this module.',
  }),
  Object.freeze({
    stage: 'future-author-or-overlay',
    description:
      'A future, separately-scoped capability (Designer Author / overlay promotion — P01 §11, explicitly out of scope through every Doctor sprint to date) MAY one day consume a designer\'s recorded decisions. Not specified beyond this pointer, and not implemented by this or any prior sprint.',
  }),
]);

// ─────────────────────────────────────────────────────────────────────────────
// The model.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewPackageArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface ReviewPackageMetadata {
  /** = DesignContext.client, verbatim — no separate "project" concept exists in this engine. */
  readonly client: string;
  /** = DesignContext.track, verbatim. */
  readonly track: string;
  /** = doctorReport.generatedAt, verbatim — no new clock read. */
  readonly generatedAt: string;
  /** sha256 over the run's own deterministic content (findings + headline + ratio) —
   *  EXCLUDES subject (env-derived) and generatedAt (a fresh timestamp per real run),
   *  so two runs over identical inputs share the identical replayIdentity. */
  readonly replayIdentity: string;
  /** repository/.knowledge-build/manifest.json's own build_identity, when available. */
  readonly worldABuildIdentity?: string;
  readonly platformHarnessVersion: string;
}

export interface ReviewPackage {
  readonly metadata: ReviewPackageMetadata;
  /** = renderExecutiveSummary(reviewReport), verbatim — the SAME text review-report.md's
   *  own Executive Summary section carries. */
  readonly executiveSummary: string;
  readonly headlineStatus: HeadlineStatus;
  readonly systematicRatio: number;
  readonly findingCount: number;
  /** = the caller-supplied validationSummary verbatim (formatRunHeadline's own output). */
  readonly validationSummary: string;
  readonly artifacts: readonly ReviewPackageArtifact[];
  readonly reviewContract: readonly ReviewContractStage[];
  /** P10 — Designer Author transport metadata. Absent unless the caller supplies proposals. */
  readonly proposals?: readonly ProposalSummary[];
  /** P12 — Designer Author proposal quality review(s), pass-through verbatim. Absent unless supplied. */
  readonly proposalReviews?: readonly ProposalReviewReport[];
  /** P18 — Designer Feedback, pass-through verbatim. Absent unless supplied. */
  readonly designerFeedback?: readonly DesignerFeedback[];
}

export interface ReviewPackageInput {
  readonly client: string;
  readonly track: string;
  readonly doctorReport: DoctorReport;
  readonly score: RunScore;
  readonly reviewReport: ReviewReport;
  /** the EXACT Markdown text already written to review-report.md. */
  readonly reviewReportMarkdown: string;
  /** the EXACT text already produced by formatRunHeadline — never recomputed here. */
  readonly validationSummary: string;
  readonly worldABuildIdentity?: string;
  /** P10 — optional Designer Author proposals to carry as pure transport metadata. */
  readonly proposals?: readonly AuthorProposal[];
  /** P12 — optional, ALREADY-BUILT proposal quality reviews to carry verbatim. */
  readonly proposalReviews?: readonly ProposalReviewReport[];
  /** P18 — optional, ALREADY-BUILT designer feedback to carry verbatim. */
  readonly designerFeedback?: readonly DesignerFeedback[];
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline.
 *  IDENTICAL algorithm to doctor-report-io.ts/score.ts/review-report-io.ts's own
 *  stableStringify — reproducing it here (rather than importing a write function)
 *  keeps this module a pure hasher with zero disk I/O: hashing the SAME algorithm
 *  over the SAME object the driver already wrote yields the SAME bytes that are on
 *  disk, verified in production (docs/internals/P08 §6). */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer(value), 2) + '\n';
}

function sortedReplacer(root: unknown): string[] {
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

/** sha256 over ONLY the run's deterministic content — never subject/generatedAt. */
function computeReplayIdentity(doctorReport: DoctorReport): string {
  return sha256Hex(
    stableStringify({
      findings: doctorReport.findings,
      headlineStatus: doctorReport.headlineStatus,
      systematicRatio: doctorReport.systematicRatio,
    }),
  );
}

/**
 * Pure, total. Every field is either a verbatim copy of a caller-supplied value,
 * a hash of caller-supplied text, or a fixed closed constant (REVIEW_CONTRACT).
 * No detect/apply/score is called; no new diagnostic is produced.
 */
export function buildReviewPackage(input: ReviewPackageInput): ReviewPackage {
  const doctorReportText = stableStringify(input.doctorReport);
  const scoreText = stableStringify(input.score);

  const artifacts: ReviewPackageArtifact[] = [
    Object.freeze({ name: 'review-report.md', path: 'review-report.md', sha256: sha256Hex(input.reviewReportMarkdown) }),
    Object.freeze({ name: 'doctor-report.json', path: 'doctor-report.json', sha256: sha256Hex(doctorReportText) }),
    Object.freeze({ name: 'score.json', path: 'score.json', sha256: sha256Hex(scoreText) }),
  ];

  const metadata: ReviewPackageMetadata = Object.freeze({
    client: input.client,
    track: input.track,
    generatedAt: input.doctorReport.generatedAt,
    replayIdentity: computeReplayIdentity(input.doctorReport),
    ...(input.worldABuildIdentity !== undefined ? { worldABuildIdentity: input.worldABuildIdentity } : {}),
    platformHarnessVersion: PLATFORM_HARNESS_VERSION,
  });

  return Object.freeze({
    metadata,
    executiveSummary: renderExecutiveSummary(input.reviewReport),
    headlineStatus: input.doctorReport.headlineStatus,
    systematicRatio: input.doctorReport.systematicRatio,
    findingCount: input.doctorReport.findingCount,
    validationSummary: input.validationSummary,
    artifacts: Object.freeze(artifacts),
    reviewContract: REVIEW_CONTRACT,
    ...(input.proposals !== undefined
      ? { proposals: Object.freeze(input.proposals.map(summarizeProposal)) }
      : {}),
    ...(input.proposalReviews !== undefined
      ? { proposalReviews: Object.freeze([...input.proposalReviews]) }
      : {}),
    ...(input.designerFeedback !== undefined
      ? { designerFeedback: Object.freeze([...input.designerFeedback]) }
      : {}),
  });
}
