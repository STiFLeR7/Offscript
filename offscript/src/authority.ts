import type { Finding } from './operator.js';

/**
 * W1-S1 — Signal Authority Taxonomy + Producer Contract.
 *
 * The v3 "Loud Observability" substrate's first, additive layer. It gives every
 * signal an **authority level** (for human awareness) and an **attributable
 * producer contract** (who/where/what/why) — WITHOUT touching the scoring path.
 *
 * Governance (all frozen):
 *   - docs/internals/W1-S1-EXECUTION-PACKAGE.md
 *   - docs/internals/OFFSCRIPT-V3-AUTHORITY-SIGNAL-OWNERSHIP-CONTRACT.md
 *   - docs/internals/OFFSCRIPT-V3-EXECUTION-CHARTER.md   (run policy: LOUD-MARK)
 *
 * Hard invariants this module preserves:
 *   - ADDITIVE: `Finding.outcome` (src/operator.ts) stays the scoring union; the
 *     authority level is a read-only *label* mapped over it, never a replacement.
 *     `systematicRatio`, `goalMet`, and the freeze behaviour are untouched.
 *   - AUTHORITY IS A LABEL, NEVER CONTROL FLOW: nothing here throws-to-terminate,
 *     exits, or short-circuits on a `Failure`. LOUD-MARK compatibility is a
 *     property of this contract — a Failure is surfaced, never auto-terminating.
 *   - OBJECTIVE → AUTHORITY; SUBJECTIVE → OBSERVABILITY: `Failure` is reserved
 *     for objective signals; `critical-warning` is the subjective-only ceiling.
 */

/**
 * The four authority levels, in severity order (display/readout ordering only —
 * ordering carries NO control-flow meaning; see module invariants).
 *
 * - `information`     — deterministic, nominal or resolved (e.g. auto-remediated).
 * - `warning`         — deterministic, soft, non-blocking; no guarantee violated.
 * - `critical-warning`— the SUBJECTIVE-ONLY ceiling; human-escalated; zero gate
 *                       authority. (No deterministic producer may emit it.)
 * - `failure`         — a deterministic, objective guarantee violation. Under
 *                       LOUD-MARK it qualifies the headline; it does NOT terminate.
 */
export type AuthorityLevel =
  | 'information'
  | 'warning'
  | 'critical-warning'
  | 'failure';

export const AUTHORITY_LEVELS: readonly AuthorityLevel[] = [
  'information',
  'warning',
  'critical-warning',
  'failure',
] as const;

/**
 * Whether a signal rests on an objective/deterministic determination or a
 * subjective/semantic judgement. This split is the doctrinal firewall: it,
 * together with the level, is what `validateSignal` enforces.
 */
export type SignalNature = 'objective' | 'subjective';

/**
 * An attributable authority signal — the producer contract. Anonymous authority
 * is banned: every field is load-bearing.
 *   - producer: WHO emitted it (an attributable producer key).
 *   - level:    WHICH authority level.
 *   - where:    WHERE — the anchor (section / rail / unit / category).
 *   - what:     WHAT was observed.
 *   - why:      WHY — the rationale (which guarantee, or the basis of judgement).
 *   - nature:   objective | subjective (drives the level firewall).
 */
export interface AuthoritySignal {
  producer: string;
  level: AuthorityLevel;
  where: string;
  what: string;
  why: string;
  nature: SignalNature;
}

/**
 * The frozen, total, read-only mapping from `Finding.outcome` to an authority
 * level. This is the additive bridge — it reads `Finding.outcome`, never writes
 * it. Mapping rationale (ownership contract §Authority Definitions):
 *   - auto-remediated → information  (deterministic, resolved)
 *   - warning         → warning      (deterministic, soft, non-blocking)
 *   - escalated       → failure      (objective guarantee violation → frozen region)
 * `critical-warning` is intentionally absent here: it has no deterministic
 * producer (its first producers arrive in W2/W3 as subjective signals).
 */
const OUTCOME_AUTHORITY: Record<Finding['outcome'], AuthorityLevel> = {
  'auto-remediated': 'information',
  warning: 'warning',
  escalated: 'failure',
};

/** Read-only `Finding.outcome → AuthorityLevel`. Pure; never throws on a valid outcome. */
export function outcomeToAuthority(outcome: Finding['outcome']): AuthorityLevel {
  return OUTCOME_AUTHORITY[outcome];
}

/** Human-readable rationale for an outcome-derived signal's `why`. */
const OUTCOME_WHY: Record<Finding['outcome'], string> = {
  'auto-remediated': 'systematically remediated by the rail',
  warning: 'deterministic soft QA note (no objective guarantee violated)',
  escalated: 'objective guarantee violation: handed to a frozen bespoke region',
};

/**
 * Additive bridge: build an objective authority signal from an existing
 * `Finding`, given its attribution (producer + anchor). Pure and read-only — the
 * source `Finding` is never mutated. The result is an objective signal whose
 * level is the frozen mapping of the finding's outcome.
 */
export function signalFromFinding(
  finding: Finding,
  attribution: { producer: string; where: string },
): AuthoritySignal {
  return {
    producer: attribution.producer,
    level: outcomeToAuthority(finding.outcome),
    where: attribution.where,
    what: finding.description,
    why: OUTCOME_WHY[finding.outcome],
    nature: 'objective',
  };
}

export interface SignalValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a signal against the producer contract + the doctrinal firewall.
 * This NEVER throws and NEVER terminates — it returns a verdict (authority is a
 * label, not control flow). A returned `{ valid: false }` is itself just data
 * for the caller to surface loudly.
 *
 * Rejection conditions:
 *   - anonymous / incomplete attribution (missing producer / where / what / why);
 *   - a subjective signal labelled `failure` (subjective never reaches Failure);
 *   - an objective signal labelled `critical-warning` (Critical Warning is
 *     subjective-only).
 */
export function validateSignal(signal: AuthoritySignal): SignalValidation {
  if (!signal.producer.trim()) {
    return { valid: false, reason: 'anonymous signal: missing producer (who)' };
  }
  if (!signal.where.trim()) {
    return { valid: false, reason: 'unattributed signal: missing where (anchor)' };
  }
  if (!signal.what.trim()) {
    return { valid: false, reason: 'incomplete signal: missing what (observation)' };
  }
  if (!signal.why.trim()) {
    return { valid: false, reason: 'incomplete signal: missing why (rationale)' };
  }
  if (signal.nature === 'subjective' && signal.level === 'failure') {
    return {
      valid: false,
      reason: 'doctrine: a subjective signal may never be labelled Failure',
    };
  }
  if (signal.nature === 'objective' && signal.level === 'critical-warning') {
    return {
      valid: false,
      reason: 'doctrine: Critical Warning is subjective-only',
    };
  }
  return { valid: true };
}
