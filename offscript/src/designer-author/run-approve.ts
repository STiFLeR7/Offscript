/**
 * P36 — Designer Author Script: overlay-approval orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * approval model, package shape, persistence, or validation of its own. `readOverlayCandidatePackage`
 * (proposal-overlay-io.ts, P13) reads back the overlay-candidate-package.json a prior
 * `--step=overlay` run persisted (run-overlay.ts, P35); `recordOverlayApproval` (overlay-approval.ts,
 * P14) does the decision-recording verbatim; `buildApprovalPackage` (overlay-approval-package.ts,
 * P14) does the packaging verbatim; `writeApprovalPackage` (overlay-approval-io.ts, P14) does the
 * persistence verbatim.
 *
 * `reviewer`/`status`/`rationale` are facts the CLI caller supplies — this module computes nothing
 * about whether to approve. Per overlay-approval.ts's own header: this is "the FIRST genuinely
 * human-decision-shaped artifact in the designer-author domain" — `recordOverlayApproval`
 * transports the decision, it never infers one, and neither does this orchestrator.
 *
 * proposal-review.json is read as a BEST-EFFORT, OPTIONAL input — `OverlayApproval.sourceReviewSubject`
 * is populated when a review is present and readable, and simply omitted otherwise. This mirrors
 * `RecordOverlayApprovalInput.review`'s own optionality: per overlay-approval.ts's header, "a
 * review is advisory, never mandatory (P12)." Unlike run-overlay.ts's proposal-review.json check
 * (a hard precondition — translation requires "already reviewed" as a workflow order), approval
 * has no such requirement; the underlying model never gates on it either.
 *
 * Never materializes (overlay-materialization.ts not imported), never activates
 * (overlay-activation.ts not imported), never touches the real overlay store (overlay.ts not
 * imported — mirrors overlay-approval-io.ts's own guarantee that this whole chain never calls
 * writeOverlay/readOverlay), never dispatches a subagent — see the isolation falsification tests
 * in run-approve.test.ts.
 *
 * Output lands under <discovery.dir>/designer-author/ alongside the P33/P34/P35 artifacts —
 * exactly overlay-approval-package.json, nothing else.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readOverlayCandidatePackage } from './proposal-overlay-io.js';
import { recordOverlayApproval } from './overlay-approval.js';
import type { ApprovalStatus } from './overlay-approval.js';
import { buildApprovalPackage } from './overlay-approval-package.js';
import { writeApprovalPackage } from './overlay-approval-io.js';
import type { ApprovalPackage } from './overlay-approval-package.js';
import type { ProposalReviewReport } from './proposal-review.js';
import type { ReadyDiscovery } from './run-artifacts.js';
import { DESIGNER_AUTHOR_OUTPUT_DIRNAME } from './run-propose.js';
import { PROPOSAL_REVIEW_FILENAME } from './run-review.js';
import { OVERLAY_CANDIDATE_PACKAGE_FILENAME } from './run-overlay.js';

export const OVERLAY_APPROVAL_PACKAGE_FILENAME = 'overlay-approval-package.json';

export class DesignerAuthorApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorApprovalError';
  }
}

/** The human-supplied CLI input — grounded 1:1 in RecordOverlayApprovalInput's own decision fields. */
export interface ApproveCliInput {
  readonly reviewer: string;
  readonly status: ApprovalStatus;
  readonly rationale: string;
}

export interface ApproveStepOptions {
  readonly now?: () => string;
}

export interface ApproveStepResult {
  readonly approvalPackage: ApprovalPackage;
  readonly approvalPackagePath: string;
}

/**
 * Best-effort read of the optional proposal-review.json. Missing or unparsable is "no review
 * supplied" — never an error, matching the underlying model's own advisory-not-mandatory review.
 */
function readOptionalReview(filePath: string): ProposalReviewReport | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as ProposalReviewReport;
  } catch {
    return undefined;
  }
}

/**
 * Orchestrate overlay approval: read back the already-persisted OverlayCandidatePackage
 * (readOverlayCandidatePackage, verbatim), best-effort read the optional proposal-review.json,
 * record the human decision (recordOverlayApproval, verbatim), package it (buildApprovalPackage,
 * verbatim), then persist it (writeApprovalPackage, verbatim). Throws DesignerAuthorApprovalError
 * only when overlay-candidate-package.json is missing or unreadable; a malformed decision
 * (empty reviewer/rationale, invalid status) surfaces as recordOverlayApproval's own
 * OverlayApprovalError, unchanged — this module adds no validation of its own beyond locating
 * its required input.
 */
export function runApproveStep(
  discovery: ReadyDiscovery,
  input: ApproveCliInput,
  opts: ApproveStepOptions = {},
): ApproveStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

  const candidatePackagePath = join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME);
  const candidatePackage = readOverlayCandidatePackage(candidatePackagePath);
  if (candidatePackage === undefined) {
    throw new DesignerAuthorApprovalError(
      `runApproveStep: no readable overlay-candidate-package.json at ${candidatePackagePath} — run --step=overlay first`,
    );
  }

  const review = readOptionalReview(join(outDir, PROPOSAL_REVIEW_FILENAME));

  const approval = recordOverlayApproval(
    {
      candidate: candidatePackage.translation.candidate,
      ...(review !== undefined ? { review } : {}),
      reviewer: input.reviewer,
      status: input.status,
      rationale: input.rationale,
    },
    opts,
  );
  const approvalPackage = buildApprovalPackage({ approval }, opts);

  const approvalPackagePath = join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME);
  writeApprovalPackage(approvalPackagePath, approvalPackage);

  return { approvalPackage, approvalPackagePath };
}
