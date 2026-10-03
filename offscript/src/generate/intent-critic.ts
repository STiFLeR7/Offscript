/**
 * W3-S5 — Vagueness Observability: the engine's FIRST subjective signal producer.
 *
 * A subjective intent-critic that judges ONE question — "is the central objective (the One Thing /
 * core reader-outcome) legible to a human reviewer?" — and, when it is NOT, emits a single
 * `critical-warning` (the only valid level: subjective-only, non-gating, → REVIEW REQUIRED). It is
 * pure observability: it never gates, scores, freezes, or influences planning / authoring /
 * consumption, and it never asserts the intent IS bad — only that it MAY be vague and warrants a
 * human look (W3-S5-CONTRACT-RECONCILIATION.md).
 *
 * Doctrine boundaries (frozen):
 *   - SUBJECTIVE only — `nature: 'subjective'`; the first such producer in the engine.
 *   - `critical-warning` ONLY — never Failure (barred by validateSignal), Warning, or Information.
 *   - ≤ ONE signal per brief — multiple observations collapse into one review-required signal.
 *   - judges MEANING legibility, never tokens (S2), consumption (S4), or centeredness (nobody).
 *
 * Structure mirrors the authoring seam (authoring-seam.ts): a deterministic scripted DOUBLE
 * (`defaultScriptedCritic` — always legible → inert no-op, so real runs stay byte-identical) and an
 * in-session subagent seam (`createSubagentCritic`). The subjective judgment lives ONLY in the
 * injected seam; the pure mapper (`intentCriticSignals`) turns its verdict into the signal.
 */

import { type AuthoritySignal } from '../authority.js';
import type { IntentBrief } from './intent-brief.js';

/** Stable attribution key (the signal `producer` / "who"). */
export const INTENT_CRITIC_PRODUCER = 'intent-critic';

/** Anchor for the central-objective concern (the signal `where`). */
const CENTRAL_OBJECTIVE_ANCHOR = 'the-one-thing';

/**
 * The smallest verdict the subjective critic may return:
 *   - `{ legible: true }`                         → the central objective is legible → no signal.
 *   - `{ legible: false, what, why }`             → not legible → one critical-warning.
 * `what` is the specific observation, `why` is what a reviewer should resolve (both required when
 * illegible, so the emitted signal is specific + actionable). NO scores / severity / confidence /
 * ranking / categories — only legibility and the one collapsed observation.
 */
export interface CriticVerdict {
  legible: boolean;
  /** present only when `legible === false` — the specific legibility observation. */
  what?: string;
  /** present only when `legible === false` — what the reviewer should clarify. */
  why?: string;
}

/**
 * Map a critic verdict to its authority signals. PURE and total: a legible verdict yields `[]`; an
 * illegible verdict yields EXACTLY ONE subjective `critical-warning`. Never emits Failure / Warning
 * / Information, never more than one. `what`/`why` come straight from the verdict (the critic
 * collapses multiple observations into one before returning); empty strings fall through to the
 * ledger's validateSignal chokepoint as a LOUD rejection rather than a silent drop.
 */
export function intentCriticSignals(verdict: CriticVerdict): AuthoritySignal[] {
  if (verdict.legible) return [];
  return [
    {
      producer: INTENT_CRITIC_PRODUCER,
      level: 'critical-warning',
      where: CENTRAL_OBJECTIVE_ANCHOR,
      what: verdict.what ?? '',
      why: verdict.why ?? '',
      nature: 'subjective',
    },
  ];
}

/** The subjective intent-critic seam: given an IntentBrief, judge central-objective legibility. */
export interface IntentCritic {
  critique(intentBrief: IntentBrief): Promise<CriticVerdict>;
}

/**
 * Deterministic scripted critic — the DEFAULT, inert double. Always returns `{ legible: true }`,
 * so the mapper yields no signal and runtime behavior is byte-identical to pre-W3-S5. This is the
 * critic wired in the scripted/CI path; the real subjective judgment arrives only via
 * `createSubagentCritic` in-session. Optionally accepts a fixed verdict (or verdict-returning fn)
 * for tests.
 */
export function scriptedCritic(
  verdict: CriticVerdict | ((intentBrief: IntentBrief) => CriticVerdict) = { legible: true },
): IntentCritic {
  return {
    async critique(intentBrief: IntentBrief): Promise<CriticVerdict> {
      return typeof verdict === 'function' ? verdict(intentBrief) : verdict;
    },
  };
}

/** The default scripted critic: always legible (inert no-op). */
export function defaultScriptedCritic(): IntentCritic {
  return scriptedCritic({ legible: true });
}

/**
 * Real-author analog: the in-session subjective critic. Delegates the legibility judgment to the
 * injected `dispatch` (a Claude subagent in-session). Not wired by default — the scripted double is
 * the default path, exactly as `createSubagentAuthor` complements `defaultScriptedAuthor`.
 */
export function createSubagentCritic(opts: {
  dispatch: (intentBrief: IntentBrief) => Promise<CriticVerdict>;
}): IntentCritic {
  return {
    async critique(intentBrief: IntentBrief): Promise<CriticVerdict> {
      return opts.dispatch(intentBrief);
    },
  };
}
