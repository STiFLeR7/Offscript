/**
 * W3-S3 — Readiness Surfacing (verdict → signal mapper).
 *
 * Turns the W3-S2 ReadinessVerdict (inert data) into objective AuthoritySignals.
 * This is the single edge the engine was missing: the verdict already exists
 * (intent-readiness.ts) and the delivery surface already exists (composeRunHealth,
 * source-fidelity.ts) — this module is the pure mapper between them. The wiring site
 * (scripts/generate.ts) routes the result through the EXISTING ledger (Option B —
 * concatenated into composeRunHealth's rail bucket; composeRunHealth is untouched).
 *
 * Frozen mapping (W3-S3-EXECUTION-PACKAGE.md §2; reconciliation + discriminator docs):
 *   - absent artifact           → exactly one Information ("no Intent Brief present").
 *                                 NEVER a Failure — there is no discriminator; absent is
 *                                 surfaced, not judged (IR1). Absent-when-EXPECTED → Failure
 *                                 belongs to the future Director Creation Seam, not S3.
 *   - present & ready           → exactly one Information confirming readiness.
 *   - missing floor categories  → one objective Failure each (where = category).
 *   - form oversteps            → one objective Failure each (where = intent-brief).
 *
 * DOCTRINE: every signal is OBJECTIVE and never `critical-warning` (that is S5/subjective
 * territory). All four attribution fields are non-empty so every signal passes
 * validateSignal at the ledger chokepoint. PURE: no ledger, no headline, no disk, no
 * throw, no control flow — a Failure is a label the headline reads, never a terminator
 * (LOUD-MARK). goalMet / systematicRatio are not touched here.
 */

import { type AuthoritySignal } from '../authority.js';
import type { ReadinessVerdict } from './intent-readiness.js';

/** Stable attribution key (the signal `producer` / "who"). */
export const INTENT_READINESS_PRODUCER = 'intent-readiness';

function objective(
  level: 'information' | 'failure',
  where: string,
  what: string,
  why: string,
): AuthoritySignal {
  return { producer: INTENT_READINESS_PRODUCER, level, where, what, why, nature: 'objective' };
}

/**
 * Map a ReadinessVerdict to its authority signals. PURE and total — same verdict in,
 * same signals out; never throws. See the frozen mapping in the module header / §2.
 */
export function intentReadinessSignals(verdict: ReadinessVerdict): AuthoritySignal[] {
  // Absent → a single Information; the verdict's category/overstep arrays are empty by
  // construction (intent-readiness.ts short-circuits undefined), so nothing else applies.
  if (verdict.missingArtifact) {
    return [
      objective(
        'information',
        'intent-brief',
        'no Intent Brief present',
        'intent layer not active for this run; replay found no persisted brief',
      ),
    ];
  }

  const signals: AuthoritySignal[] = [];

  // Present-but-not-ready: one objective Failure per missing floor category (verdict order)…
  for (const category of verdict.missingCategories) {
    signals.push(
      objective(
        'failure',
        category,
        `intent floor category "${category}" is empty`,
        'objective readiness floor: a required intent category is empty',
      ),
    );
  }

  // …and one per form overstep (intent must not specify form).
  for (const token of verdict.formOversteps) {
    signals.push(
      objective(
        'failure',
        'intent-brief',
        `intent specifies form literal "${token}"`,
        'objective separation: intent must not specify form (color literal / length value)',
      ),
    );
  }

  // Present & ready → a single positive Information. `ready` is false whenever a Failure
  // above fired, so this and the Failures are mutually exclusive (no mixed readout).
  if (verdict.ready) {
    signals.push(
      objective(
        'information',
        'intent-brief',
        'Intent Brief present and ready',
        'all five floor categories non-empty; no authority-class form literal present',
      ),
    );
  }

  return signals;
}
