/**
 * P37 — Designer Author Script: overlay-materialization orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * field mapping, validation, materialization logic, or persistence of its own.
 * `readOverlayCandidatePackage` (proposal-overlay-io.ts, P13) and `readApprovalPackage`
 * (overlay-approval-io.ts, P14) read back the two artifacts a prior `--step=overlay` and
 * `--step=approve` run each persisted; `materializeOverlayCandidate` (overlay-materialization.ts,
 * P15) does the OverlayCandidate + OverlayApproval -> MaterializedFrozenOverlay transform
 * verbatim (including its own integrity checks — candidate/approval match, approved-not-rejected);
 * `buildMaterializationPackage` (overlay-materialization-package.ts, P15) does the packaging
 * verbatim; `writeMaterializationPackage` (overlay-materialization-io.ts, P15) does the
 * persistence verbatim.
 *
 * Unlike overlay approval (P36), materialization takes NO human-supplied CLI input at all —
 * `materializeOverlayCandidate` is a pure, deterministic transform of two already-decided
 * artifacts, with no new decision to record. `--step=materialize` therefore needs no new flags;
 * "ground the command shape from the existing Materialization model" (this sprint's brief) means
 * exactly that the CLI invents nothing the model doesn't already require.
 *
 * BOTH overlay-candidate-package.json and overlay-approval-package.json are HARD preconditions —
 * unlike run-approve.ts's optional review, materializeOverlayCandidate's own signature requires
 * both a candidate and an approval; there is no "materialize without an approval" case to honor.
 * A rejected approval, or an approval that does not match the candidate, is not a missing-artifact
 * error — it is `materializeOverlayCandidate`'s own `MaterializationError`, thrown unchanged;
 * this module adds no additional validation beyond locating its two required inputs.
 *
 * Never activates (overlay-activation.ts not imported), never touches the real overlay store
 * (overlay.ts not imported — mirrors overlay-materialization-io.ts's own guarantee that this
 * whole chain never calls writeOverlay/readOverlay), never dispatches a subagent — see the
 * isolation falsification tests in run-materialize.test.ts.
 *
 * Output lands under <discovery.dir>/designer-author/ alongside the P33–P36 artifacts — exactly
 * overlay-materialization-package.json, nothing else.
 */
import { join } from 'node:path';
import { readOverlayCandidatePackage } from './proposal-overlay-io.js';
import { readApprovalPackage } from './overlay-approval-io.js';
import { materializeOverlayCandidate } from './overlay-materialization.js';
import { buildMaterializationPackage } from './overlay-materialization-package.js';
import { writeMaterializationPackage } from './overlay-materialization-io.js';
import type { MaterializationPackage } from './overlay-materialization-package.js';
import type { ReadyDiscovery } from './run-artifacts.js';
import { DESIGNER_AUTHOR_OUTPUT_DIRNAME } from './run-propose.js';
import { OVERLAY_CANDIDATE_PACKAGE_FILENAME } from './run-overlay.js';
import { OVERLAY_APPROVAL_PACKAGE_FILENAME } from './run-approve.js';

export const OVERLAY_MATERIALIZATION_PACKAGE_FILENAME = 'overlay-materialization-package.json';

export class DesignerAuthorMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorMaterializationError';
  }
}

export interface MaterializeStepOptions {
  readonly now?: () => string;
}

export interface MaterializeStepResult {
  readonly materializationPackage: MaterializationPackage;
  readonly materializationPackagePath: string;
}

/**
 * Orchestrate overlay materialization: read back the already-persisted OverlayCandidatePackage
 * and ApprovalPackage (both verbatim), materialize (materializeOverlayCandidate, verbatim —
 * throws MaterializationError, unchanged, on a rejected or mismatched approval), package it
 * (buildMaterializationPackage, verbatim), then persist it (writeMaterializationPackage,
 * verbatim). Throws DesignerAuthorMaterializationError only when either required precondition
 * artifact is missing or unreadable.
 */
export function runMaterializeStep(discovery: ReadyDiscovery, opts: MaterializeStepOptions = {}): MaterializeStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

  const candidatePackagePath = join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME);
  const candidatePackage = readOverlayCandidatePackage(candidatePackagePath);
  if (candidatePackage === undefined) {
    throw new DesignerAuthorMaterializationError(
      `runMaterializeStep: no readable overlay-candidate-package.json at ${candidatePackagePath} — run --step=overlay first`,
    );
  }

  const approvalPackagePath = join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME);
  const approvalPackage = readApprovalPackage(approvalPackagePath);
  if (approvalPackage === undefined) {
    throw new DesignerAuthorMaterializationError(
      `runMaterializeStep: no readable overlay-approval-package.json at ${approvalPackagePath} — run --step=approve first`,
    );
  }

  const materialization = materializeOverlayCandidate(candidatePackage.translation.candidate, approvalPackage.approval, opts);
  const materializationPackage = buildMaterializationPackage({ materialization }, opts);

  const materializationPackagePath = join(outDir, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME);
  writeMaterializationPackage(materializationPackagePath, materializationPackage);

  return { materializationPackage, materializationPackagePath };
}
