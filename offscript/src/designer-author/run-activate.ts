/**
 * P38 — Designer Author Script: overlay-activation orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * activation model, package shape, persistence, or validation of its own.
 * `readMaterializationPackage` (overlay-materialization-io.ts, P15) reads back the
 * overlay-materialization-package.json a prior `--step=materialize` run persisted (P37);
 * `recordOverlayActivation` (overlay-activation.ts, P16) records the activation verbatim;
 * `buildActivationPackage` (overlay-activation-package.ts, P16) packages it verbatim;
 * `writeActivationPackage` (overlay-activation-io.ts, P16) persists it verbatim.
 *
 * `activatedBy` is the only human-supplied CLI input — this mirrors the model itself:
 * `RecordOverlayActivationInput` has exactly one field. There is no runtime-consumption gate to
 * add on top: per overlay-activation.ts's own header, "the real runtime, today, treats overlay
 * entries as read-only and informational, never as a live behavioral gate" — activation records
 * WHO/WHEN, nothing more, and this orchestrator adds no additional precondition beyond locating
 * its one required input (the materialized overlay).
 *
 * `runRevokeStep` (the "revoked activation" TDD requirement, and the CLI section's instruction to
 * "ground the activation interface from the existing OverlayActivation model — do not invent
 * lifecycle states") exposes `revokeOverlayActivation` (overlay-activation.ts, P16) the same way:
 * reused verbatim. It deliberately PERSISTS NOTHING — this sprint's brief caps
 * designer-author/'s contents at exactly eight named artifacts (proposal-package.json through
 * overlay-activation-package.json), and the P16 model has no `RevocationPackage` /
 * writer counterpart to `ActivationPackage` to reuse for a ninth. The returned
 * `ActivationRevocation` is content-derived (sha256 over activationId/revokedBy/reason,
 * excluding `revokedAt`) — deterministically recomputable at any time from the same inputs, so
 * nothing auditable is lost by not persisting it as its own file; the CLI prints it instead.
 *
 * Never consumes at runtime (no write to `overlay/`, no read of `overlay.ts`'s own runtime
 * call sites), never writes a Frozen overlay entry, never dispatches a subagent — see the
 * isolation falsification tests in run-activate.test.ts.
 *
 * Output lands under <discovery.dir>/designer-author/ alongside the P33–P37 artifacts — exactly
 * overlay-activation-package.json, nothing else.
 */
import { join } from 'node:path';
import { readMaterializationPackage } from './overlay-materialization-io.js';
import { readActivationPackage, writeActivationPackage } from './overlay-activation-io.js';
import { recordOverlayActivation, revokeOverlayActivation } from './overlay-activation.js';
import type { ActivationRevocation } from './overlay-activation.js';
import { buildActivationPackage } from './overlay-activation-package.js';
import type { ActivationPackage } from './overlay-activation-package.js';
import type { ReadyDiscovery } from './run-artifacts.js';
import { DESIGNER_AUTHOR_OUTPUT_DIRNAME } from './run-propose.js';
import { OVERLAY_MATERIALIZATION_PACKAGE_FILENAME } from './run-materialize.js';

export const OVERLAY_ACTIVATION_PACKAGE_FILENAME = 'overlay-activation-package.json';

export class DesignerAuthorActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorActivationError';
  }
}

/** The human-supplied CLI input for activation — grounded 1:1 in RecordOverlayActivationInput. */
export interface ActivateCliInput {
  readonly activatedBy: string;
}

export interface ActivateStepOptions {
  readonly now?: () => string;
}

export interface ActivateStepResult {
  readonly activationPackage: ActivationPackage;
  readonly activationPackagePath: string;
}

/**
 * Orchestrate overlay activation: read back the already-persisted MaterializationPackage
 * (readMaterializationPackage, verbatim), record the activation (recordOverlayActivation,
 * verbatim), package it (buildActivationPackage, verbatim), then persist it
 * (writeActivationPackage, verbatim). Throws DesignerAuthorActivationError only when
 * overlay-materialization-package.json is missing or unreadable; a malformed decision (empty
 * activatedBy) surfaces as recordOverlayActivation's own ActivationError, unchanged.
 */
export function runActivateStep(
  discovery: ReadyDiscovery,
  input: ActivateCliInput,
  opts: ActivateStepOptions = {},
): ActivateStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

  const materializationPackagePath = join(outDir, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME);
  const materializationPackage = readMaterializationPackage(materializationPackagePath);
  if (materializationPackage === undefined) {
    throw new DesignerAuthorActivationError(
      `runActivateStep: no readable overlay-materialization-package.json at ${materializationPackagePath} — run --step=materialize first`,
    );
  }

  const activation = recordOverlayActivation(
    materializationPackage.materialization.materialized,
    { activatedBy: input.activatedBy },
    opts,
  );
  const activationPackage = buildActivationPackage({ activation }, opts);

  const activationPackagePath = join(outDir, OVERLAY_ACTIVATION_PACKAGE_FILENAME);
  writeActivationPackage(activationPackagePath, activationPackage);

  return { activationPackage, activationPackagePath };
}

/** The human-supplied CLI input for revocation — grounded 1:1 in RevokeOverlayActivationInput. */
export interface RevokeCliInput {
  readonly revokedBy: string;
  readonly reason: string;
}

export interface RevokeStepOptions {
  readonly now?: () => string;
}

export interface RevokeStepResult {
  readonly revocation: ActivationRevocation;
}

/**
 * Orchestrate activation revocation: read back the already-persisted ActivationPackage
 * (readActivationPackage, verbatim), record the revocation (revokeOverlayActivation, verbatim).
 * Persists nothing (see module header). Throws DesignerAuthorActivationError only when
 * overlay-activation-package.json is missing or unreadable.
 */
export function runRevokeStep(
  discovery: ReadyDiscovery,
  input: RevokeCliInput,
  opts: RevokeStepOptions = {},
): RevokeStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

  const activationPackagePath = join(outDir, OVERLAY_ACTIVATION_PACKAGE_FILENAME);
  const activationPackage = readActivationPackage(activationPackagePath);
  if (activationPackage === undefined) {
    throw new DesignerAuthorActivationError(
      `runRevokeStep: no readable overlay-activation-package.json at ${activationPackagePath} — run --step=activate first`,
    );
  }

  const revocation = revokeOverlayActivation(
    activationPackage.activation,
    { revokedBy: input.revokedBy, reason: input.reason },
    opts,
  );

  return { revocation };
}
