/**
 * P16 — Overlay Activation Architecture: the deterministic boundary between
 * a Materialized Overlay (P15) and the real Overlay runtime.
 *
 * FRESH INVESTIGATION (grounded, not assumed — see
 * docs/internals/P16-OVERLAY-ACTIVATION-ARCHITECTURE.md §3 for the full
 * pipeline inventory, re-traced from current source, not from prior
 * reports): the real overlay-loading pipeline has exactly TWO production
 * `readOverlay` call sites — `scripts/harden.ts` (tags Tier-2 advisory
 * candidates with a `frozenId`, informational) and
 * `src/generate/validate-loop-driver.ts` (feeds Doctor's read-only
 * `frozen` field, reporting only). `filterFrozenFindings` — the ONE
 * function whose own docstring describes gating re-actuation on frozen
 * entries — has ZERO production call sites; it exists only in
 * `overlay.ts`'s module doc comment and `test/overlay.test.ts`. **The real
 * runtime, today, treats overlay entries as read-only and informational,
 * never as a live behavioral gate.** Activation, as this sprint defines
 * it, matches that reality rather than inventing a stronger contract the
 * runtime doesn't actually have.
 *
 * ARCHITECTURE DECISION: all three named options were evaluated and none
 * survives literally:
 *   - Option A (materialize into a literal `Frozen`) — still blocked.
 *     `pass`/`findingIds` remain REQUIRED and UNAVAILABLE (re-confirmed
 *     unchanged from P15 — activation adds accountability metadata about
 *     WHO/WHEN, never new rail-actuation provenance). Producing a literal
 *     `Frozen` would still require fabrication.
 *   - Option B, read literally ("Activation Package produces Frozen") —
 *     blocked for the identical reason as Option A: an activation record
 *     supplies no new pass/findingIds provenance either.
 *   - Option C (wire the real overlay runtime — `overlay.ts`/
 *     `scripts/harden.ts` — to consume a Materialized/Activated overlay
 *     directly) — would require modifying live production/runtime code,
 *     forbidden by this sprint's explicit "no automatic runtime
 *     consumption" constraint and by the whole P09-P15 program's
 *     never-touch-`overlay.ts` isolation discipline.
 *   - What IS built: Option B's SPIRIT, corrected — a dedicated
 *     `OverlayActivation` model, deterministic and packaged, that records
 *     WHO/WHEN made a materialized overlay eligible for a future runtime
 *     step, without ever claiming to BE a `Frozen` or touching the real
 *     overlay store. This is the same elimination method P13/P14/P15 used
 *     against `Frozen`/`DecisionLogEntry`, applied a third time.
 *
 * Reversibility (the brief's explicit "activation must remain
 * deterministic, reversible, auditable"): `revokeOverlayActivation`
 * records an immutable, timestamped, actor-attributed revocation
 * referencing the original activation's id — it never mutates the
 * activation itself. `resolveActivationStatus` is a pure partition
 * function over an activation and a list of revocations, mirroring
 * `overlay.ts`'s own `filterFrozenFindings` pattern (compute status by
 * reading, never by mutating in place).
 *
 * Isolation: `MaterializedFrozenOverlay` is a real value import (this
 * module reads its fields directly, exactly like P14/P15 read their own
 * upstream inputs). No value from `overlay.ts` is ever imported or
 * called — activation never writes an overlay, never reads one, and
 * never touches `repository/` or `governance/` (see the falsification
 * tests in overlay-activation.test.ts / overlay-activation-io.test.ts).
 */
import { createHash } from 'node:crypto';
import type { MaterializedFrozenOverlay } from './overlay-materialization.js';

/** Who/when made a materialized overlay eligible for a future runtime step. Never Frozen. */
export interface OverlayActivation {
  readonly id: string;
  readonly sourceMaterializedId: string;
  readonly sourceApprovalId: string;
  readonly sourceCandidateId: string;
  readonly sourceProposalId: string;
  readonly activatedBy: string;
  readonly activatedAt: string;
}

export interface RecordOverlayActivationInput {
  readonly activatedBy: string;
}

export interface RecordOverlayActivationOptions {
  readonly now?: () => string;
}

/** An immutable, auditable reversal of a prior OverlayActivation. Never mutates the activation. */
export interface ActivationRevocation {
  readonly id: string;
  readonly activationId: string;
  readonly revokedBy: string;
  readonly reason: string;
  readonly revokedAt: string;
}

export interface RevokeOverlayActivationInput {
  readonly revokedBy: string;
  readonly reason: string;
}

export interface RevokeOverlayActivationOptions {
  readonly now?: () => string;
}

export type ActivationStatus = 'activated' | 'revoked';

export class ActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivationError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
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

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

function validateMaterialized(materialized: MaterializedFrozenOverlay): void {
  if (!isNonEmptyString(materialized?.id)) {
    throw new ActivationError('recordOverlayActivation: materialized.id must be a non-empty string');
  }
  if (!isNonEmptyString(materialized?.sourceApprovalId)) {
    throw new ActivationError('recordOverlayActivation: materialized.sourceApprovalId must be a non-empty string');
  }
  if (!isNonEmptyString(materialized?.sourceCandidateId)) {
    throw new ActivationError('recordOverlayActivation: materialized.sourceCandidateId must be a non-empty string');
  }
  if (!isNonEmptyString(materialized?.sourceProposalId)) {
    throw new ActivationError('recordOverlayActivation: materialized.sourceProposalId must be a non-empty string');
  }
}

/**
 * Content-derived identity — excludes `activatedAt`, mirroring every prior
 * P09-P15 identity formula: the SAME activation (same materialized overlay,
 * same actor) always yields the same id, regardless of when it was recorded.
 */
function computeActivationId(sourceMaterializedId: string, sourceApprovalId: string, activatedBy: string): string {
  return createHash('sha256').update(stableStringify({ sourceMaterializedId, sourceApprovalId, activatedBy })).digest('hex');
}

/**
 * Record an activation of an already-materialized, already-approved
 * overlay. Pure and total: no filesystem, no overlay store, no catalog, no
 * governance, no runtime consumption. Trusts `MaterializedFrozenOverlay`'s
 * own type as proof the underlying approval was genuine (P15's
 * `materializeOverlayCandidate` already refused to produce one otherwise)
 * — this function's only job is to validate presence of its OWN required
 * facts and record who/when activated it.
 */
export function recordOverlayActivation(
  materialized: MaterializedFrozenOverlay,
  input: RecordOverlayActivationInput,
  opts: RecordOverlayActivationOptions = {},
): OverlayActivation {
  validateMaterialized(materialized);
  if (!isNonEmptyString(input.activatedBy)) {
    throw new ActivationError('recordOverlayActivation: activatedBy must be a non-empty string');
  }
  const now = opts.now ?? (() => new Date().toISOString());
  const activation: OverlayActivation = {
    id: computeActivationId(materialized.id, materialized.sourceApprovalId, input.activatedBy),
    sourceMaterializedId: materialized.id,
    sourceApprovalId: materialized.sourceApprovalId,
    sourceCandidateId: materialized.sourceCandidateId,
    sourceProposalId: materialized.sourceProposalId,
    activatedBy: input.activatedBy,
    activatedAt: now(),
  };
  return deepFreeze(activation);
}

/**
 * Record a revocation of a prior activation. Never mutates the activation
 * itself — a revocation is a separate, immutable, auditable fact
 * referencing the original activation's id.
 */
export function revokeOverlayActivation(
  activation: OverlayActivation,
  input: RevokeOverlayActivationInput,
  opts: RevokeOverlayActivationOptions = {},
): ActivationRevocation {
  if (!isNonEmptyString(activation?.id)) {
    throw new ActivationError('revokeOverlayActivation: activation.id must be a non-empty string');
  }
  if (!isNonEmptyString(input.revokedBy)) {
    throw new ActivationError('revokeOverlayActivation: revokedBy must be a non-empty string');
  }
  if (!isNonEmptyString(input.reason)) {
    throw new ActivationError('revokeOverlayActivation: reason must be a non-empty string');
  }
  const now = opts.now ?? (() => new Date().toISOString());
  const revocation: ActivationRevocation = {
    id: createHash('sha256').update(stableStringify({ activationId: activation.id, revokedBy: input.revokedBy, reason: input.reason })).digest('hex'),
    activationId: activation.id,
    revokedBy: input.revokedBy,
    reason: input.reason,
    revokedAt: now(),
  };
  return deepFreeze(revocation);
}

/**
 * Pure partition: is this activation currently activated or revoked?
 * Mirrors overlay.ts's own `filterFrozenFindings` — compute status by
 * reading, never by mutating anything in place.
 */
export function resolveActivationStatus(
  activation: OverlayActivation,
  revocations: readonly ActivationRevocation[],
): ActivationStatus {
  return revocations.some((r) => r.activationId === activation.id) ? 'revoked' : 'activated';
}
