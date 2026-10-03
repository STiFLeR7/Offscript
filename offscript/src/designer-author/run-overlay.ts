/**
 * P35 — Designer Author Script: overlay-candidate orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * translation logic of its own. `readProposalPackage` (proposal-io.ts, P09) reads back the
 * proposal-package.json a prior `--step=propose` run persisted (run-propose.ts, P33); a small
 * local existence/parse check confirms proposal-review.json — persisted by a prior `--step=review`
 * run (run-review.ts, P34) — is present and readable; `translateProposalToOverlayCandidate`
 * (proposal-overlay.ts, P13) does the field-mapping translation verbatim; `buildOverlayCandidatePackage`
 * (proposal-overlay-package.ts, P13) does the packaging verbatim; `writeOverlayCandidatePackage`
 * (proposal-overlay-io.ts, P13) does the persistence verbatim — this module never duplicates
 * stableStringify/writeIfChanged itself, unlike run-propose.ts/run-review.ts, because P13 already
 * built a complete writer for this exact shape.
 *
 * The review artifact is a PRECONDITION ONLY. This sprint's workflow requires an
 * "already-reviewed" proposal before translating it (propose -> review -> overlay-candidate), but
 * `translateProposalToOverlayCandidate` itself never reads the review's *content* — per its own
 * header comment: "Never gates on the proposal's own review status (P12) — translation is a data
 * transform, not a promotion decision." This module honors that by construction: reviewStatus
 * (blocked / needs-attention / ready-for-review) is never inspected, only proposal-review.json's
 * existence and parseability are checked. A human, not this script, decides whether a "blocked"
 * proposal should still be translated.
 *
 * Never records an approval (overlay-approval.ts not imported), never materializes
 * (overlay-materialization.ts not imported), never activates (overlay-activation.ts not
 * imported), never touches the real overlay store (overlay.ts not imported — mirrors
 * proposal-overlay-io.ts's own guarantee that this whole chain never calls
 * writeOverlay/readOverlay), never dispatches a subagent — see the isolation falsification tests
 * in run-overlay.test.ts.
 *
 * Output lands under <discovery.dir>/designer-author/ alongside the P33/P34 artifacts — exactly
 * overlay-candidate-package.json, nothing else.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readProposalPackage } from './proposal-io.js';
import { translateProposalToOverlayCandidate } from './proposal-overlay.js';
import { buildOverlayCandidatePackage } from './proposal-overlay-package.js';
import { writeOverlayCandidatePackage } from './proposal-overlay-io.js';
import type { OverlayCandidatePackage } from './proposal-overlay-package.js';
import type { ReadyDiscovery } from './run-artifacts.js';
import { DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from './run-propose.js';
import { PROPOSAL_REVIEW_FILENAME } from './run-review.js';

export const OVERLAY_CANDIDATE_PACKAGE_FILENAME = 'overlay-candidate-package.json';

export class DesignerAuthorOverlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorOverlayError';
  }
}

export interface OverlayStepOptions {
  readonly now?: () => string;
}

export interface OverlayStepResult {
  readonly overlayCandidatePackage: OverlayCandidatePackage;
  readonly overlayCandidatePackagePath: string;
}

/**
 * Confirm proposal-review.json exists and parses as JSON. Content is never interpreted — this
 * is a precondition check only (see module header). Never throws.
 */
function reviewArtifactIsReadable(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    JSON.parse(readFileSync(filePath, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Orchestrate overlay-candidate translation: read back the already-persisted ProposalPackage
 * (readProposalPackage, verbatim), confirm the proposal was already reviewed (existence/parse
 * check only), translate it (translateProposalToOverlayCandidate, verbatim), package it
 * (buildOverlayCandidatePackage, verbatim), then persist it (writeOverlayCandidatePackage,
 * verbatim). Throws DesignerAuthorOverlayError when either precondition artifact is missing or
 * unreadable — this module adds no translation logic of its own beyond locating its inputs.
 */
export function runOverlayStep(discovery: ReadyDiscovery, opts: OverlayStepOptions = {}): OverlayStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

  const proposalPackagePath = join(outDir, PROPOSAL_PACKAGE_FILENAME);
  const pkg = readProposalPackage(proposalPackagePath);
  if (pkg === undefined) {
    throw new DesignerAuthorOverlayError(
      `runOverlayStep: no readable proposal-package.json at ${proposalPackagePath} — run --step=propose first`,
    );
  }

  const reviewPath = join(outDir, PROPOSAL_REVIEW_FILENAME);
  if (!reviewArtifactIsReadable(reviewPath)) {
    throw new DesignerAuthorOverlayError(
      `runOverlayStep: no readable proposal-review.json at ${reviewPath} — run --step=review first`,
    );
  }

  const translation = translateProposalToOverlayCandidate(pkg.proposal, opts);
  const overlayCandidatePackage = buildOverlayCandidatePackage({ translation }, opts);

  const overlayCandidatePackagePath = join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME);
  writeOverlayCandidatePackage(overlayCandidatePackagePath, overlayCandidatePackage);

  return { overlayCandidatePackage, overlayCandidatePackagePath };
}
