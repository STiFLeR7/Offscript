/**
 * W2-S4 — Source Fidelity Signals + W1 Composition.
 *
 * The FIRST live producer of Source Fidelity authority signals, and the seam that
 * carries them (with the existing rail signals) through the W1 substrate end-to-end:
 *
 *   Produced → Bound → Accounted → Signaled → Delivered → Surfaced
 *      (plan)   (W2-S2)  (W2-S3)    (here)    (ledger)   (headline)
 *
 * Two responsibilities, both named in the W2-S4 scope ("source-fidelity signals" +
 * "W1 composition"):
 *
 *   1. fidelitySignals(accounting) — convert the deterministic W2-S3 accounting into
 *      objective AuthoritySignals. NO judgment, NO LLM, NO re-traversal of planner
 *      state (reads only the accounting rollups + per-unit records).
 *   2. composeRunHealth(...) — emit fidelity AND rail signals through ONE ledger
 *      (the single delivery surface), run the live severed-path meta-check, and build
 *      the headline FROM THE DELIVERED SET. This closes the W1-closure-audit seam:
 *      the headline no longer bypasses the ledger.
 *
 * Frozen ownership (W2-FIDELITY-FAILURE-OWNERSHIP.md), honoured exactly:
 *   - `source-fidelity` is the SOLE fidelity emitter; the planner emits nothing.
 *   - OBJECTIVE ONLY → may carry `failure` / `warning` / `information`; NEVER
 *     `critical-warning` (subjective-only — reserved for W3).
 *   - Failure = a violated guarantee (G1 lost unit / G2 unbound segment /
 *     G3 unattributed delivery / G4 authored-from-void). Warning = delivered-but-
 *     degraded (coarse blank-block segment / engine-default padding).
 *   - AUTHORITY IS A LABEL, NEVER CONTROL FLOW (LOUD-MARK): nothing here throws,
 *     terminates, gates, or alters scoring / goalMet / freeze. A FAILED headline is
 *     a statement about a completed run, not an action on it.
 */

import { type AuthoritySignal } from '../authority.js';
import {
  createSignalLedger,
  detectSeveredPaths,
  type SeveredPathReport,
} from '../signal-delivery.js';
import { buildRunHeadline, type RunHeadline } from '../run-headline.js';
import type { SourceAccounting } from './source-accounting.js';

/** The single fidelity producer key (attribution `who`). */
export const SOURCE_FIDELITY_PRODUCER = 'source-fidelity';

/**
 * Inputs that the accounting alone cannot determine, supplied by the caller:
 *   - briefSupplied: was any source unit extracted? (default: extractedCount > 0).
 *     When false, ungrounded consumers are engine-default (no brief to ground from)
 *     → Warning, never G4 Failure (the ownership doc's empty-brief padding case).
 *   - enginePaddingConsumerIds: consumers known to be engine-origin padding (they
 *     carry an engine-default intent, not "void") → Warning, never G4 Failure.
 */
export interface FidelityOptions {
  briefSupplied?: boolean;
  enginePaddingConsumerIds?: readonly string[];
}

function objective(
  level: 'failure' | 'warning',
  where: string,
  what: string,
  why: string,
): AuthoritySignal {
  return {
    producer: SOURCE_FIDELITY_PRODUCER,
    level,
    // Guard: a signal must always be attributable to pass the ledger chokepoint
    // (validateSignal). Slugs/ids are non-empty in practice; this is belt-and-braces.
    where: where || '(unattributed)',
    what,
    why,
    nature: 'objective',
  };
}

/**
 * Convert the W2-S3 accounting into objective fidelity signals. Deterministic and
 * pure — same accounting in, same signals out. Emits nothing to the ledger itself
 * (that is composeRunHealth's job); it only PRODUCES the signal payloads.
 */
export function fidelitySignals(
  accounting: SourceAccounting,
  opts: FidelityOptions = {},
): AuthoritySignal[] {
  const briefSupplied = opts.briefSupplied ?? accounting.extractedCount > 0;
  const padding = new Set(opts.enginePaddingConsumerIds ?? []);
  const signals: AuthoritySignal[] = [];

  // ── G1 — reachability: a declared (must-include) unit reached no consumer. ──────
  for (const slug of accounting.unusedUnitSlugs) {
    signals.push(
      objective(
        'failure',
        slug,
        `declared source unit "${slug}" reached no consumer`,
        'objective guarantee G1 (reachability): a declared required unit reached no consumer',
      ),
    );
  }

  // ── G2 — no silent loss: an extracted body segment reached no consumer. ─────────
  for (const slug of accounting.unmatchedUnitSlugs) {
    signals.push(
      objective(
        'failure',
        slug,
        `body segment "${slug}" bound to no consumer`,
        'objective guarantee G2 (no-silent-loss): an extracted body segment reached no consumer',
      ),
    );
  }

  // ── G3 — attribution: a delivered (bound) unit carries no recorded consumer. ────
  // Internal-invariant guard (boolean field-presence), not an opinion.
  for (const u of accounting.units) {
    if (u.disposition === 'bound' && !u.consumerId) {
      signals.push(
        objective(
          'failure',
          u.unitSlug,
          `delivered unit "${u.unitSlug}" has no consumer binding`,
          'objective guarantee G3 (attribution): a delivered unit carries no consumer id',
        ),
      );
    }
  }

  // ── G4 — no authoring from void: a consumer with no grounding. ──────────────────
  // Engine-default padding (explicit id, or the no-brief-supplied case) is delivered-
  // but-degraded → Warning. A genuinely void consumer (brief supplied) → Failure.
  for (const id of accounting.ungroundedConsumerIds) {
    if (padding.has(id)) {
      signals.push(
        objective(
          'warning',
          id,
          `consumer "${id}" is engine-default (carries an engine-origin intent, not brief-derived)`,
          'delivered-but-degraded: engine-default padding is a transparency concern, not a void',
        ),
      );
    } else if (briefSupplied) {
      signals.push(
        objective(
          'failure',
          id,
          `consumer "${id}" authored with no bound source unit`,
          'objective guarantee G4 (no-authoring-from-void): a consumer has no brief grounding while a brief was supplied',
        ),
      );
    } else {
      signals.push(
        objective(
          'warning',
          id,
          `consumer "${id}" is engine-default (no brief was supplied)`,
          'delivered-but-degraded: no brief was supplied, so every consumer is engine-default padding',
        ),
      );
    }
  }

  // ── Coarse-segment fallback: a bound blank-block (heading-less coarse) segment. ──
  // Delivered, just coarsely → Warning (no guarantee violated). Unmatched coarse
  // segments are already G2 Failures above; only BOUND ones land here.
  for (const u of accounting.units) {
    if (u.disposition === 'bound' && u.kind === 'blank-block') {
      signals.push(
        objective(
          'warning',
          u.unitSlug,
          `body segment "${u.unitSlug}" bound as a coarse blank-block`,
          'delivered-but-degraded: a heading-less body degraded to a coarse segment (no guarantee violated)',
        ),
      );
    }
  }

  return signals;
}

export interface RunHealthInput {
  /** fidelity signals (from fidelitySignals). */
  fidelity: readonly AuthoritySignal[];
  /** rail signals (from signalsFromPerRail). */
  rail: readonly AuthoritySignal[];
  /** the loop's goal decision — a separate reporting axis, carried verbatim. */
  goalMet: boolean;
  /** the architecture-purity number — a separate reporting axis, carried verbatim. */
  systematicRatio: number;
}

export interface RunHealth {
  headline: RunHeadline;
  severed: SeveredPathReport;
  /** the signals the ledger actually delivered (the headline's input set). */
  delivered: AuthoritySignal[];
}

/**
 * Compose the run's health through the W1 substrate — the single delivery surface.
 *
 * Closes the W1-closure-audit seam: BOTH fidelity and rail signals are emitted into
 * ONE ledger, drained (delivered), the severed-path meta-check runs LIVE over the
 * ledger, and the headline is built FROM THE DELIVERED SET (+ any minted severed
 * Failures) — never from a parallel perRail bypass. Pure orchestration; no throw,
 * no termination, no scoring/goalMet/freeze mutation (LOUD-MARK).
 */
export function composeRunHealth(input: RunHealthInput): RunHealth {
  const ledger = createSignalLedger();

  // Register every producer so detectSeveredPaths never flags one as unregistered.
  ledger.registerProducer(SOURCE_FIDELITY_PRODUCER);
  for (const s of input.fidelity) ledger.registerProducer(s.producer);
  for (const s of input.rail) ledger.registerProducer(s.producer);

  // Emit through the chokepoint (validateSignal runs inside emit).
  for (const s of input.fidelity) ledger.emit(s);
  for (const s of input.rail) ledger.emit(s);

  // Deliver everything via the one surface (the consumer set for the headline).
  const delivered = ledger.drain();

  // Live meta-check: any signal emitted-but-undelivered is surfaced as a severed-path
  // Failure (a generated-then-undelivered fidelity signal cannot hide). After a full
  // drain this is clean; running it live is what closes the audit's "zero-consumer leaf".
  const severed = detectSeveredPaths(
    ledger.entries(),
    ledger.rejectedSignals(),
    ledger.registeredProducers(),
  );

  // Surfaced: headline from the delivered set + any minted severed Failures. goalMet
  // and systematicRatio remain separate axes, carried verbatim.
  const headline = buildRunHeadline({
    signals: [...delivered, ...severed.failures],
    goalMet: input.goalMet,
    systematicRatio: input.systematicRatio,
  });

  return { headline, severed, delivered };
}
