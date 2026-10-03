/**
 * W3 Stage-0 — Director Creation Seam: the missing PRODUCER of the Intent Brief.
 *
 * Every W3 stage (S1 persist · S2 readiness · S3 surface · S4 consume · S5 review) is wired,
 * but in production NOTHING writes an IntentBrief — so `context.intentBrief` is always
 * undefined and the chain runs its dormant branch. This seam is the one missing producer: a
 * reasoning layer that EMITS an IntentBrief (or null). It does NOT persist, replay, surface,
 * consume, or judge — those remain S1–S5. The orchestrator (scripts/generate.ts) is what
 * persists the emitted brief via S1's writeIntentBrief, ONLY when absent, before buildContext
 * replays it (DIRECTOR-CREATION-SEAM-EXECUTION-PACKAGE.md).
 *
 * Ownership boundaries (frozen):
 *   - CREATION only — this module reasons; it never writes a file (no node:fs import) and
 *     never reads readiness / surfacing / consumption / review output (one-shot, upstream).
 *   - The PERSISTED markdown is the source of truth; the emitted object is the carrier shape
 *     S1 serializes/replays. The in-memory object never reaches runtime except via disk.
 *   - `null` = "produced nothing" (distinct from an empty IntentBrief, which S2 surfaces FAILED).
 *
 * Structure mirrors the authoring seam (authoring-seam.ts) and the critic seam
 * (intent-critic.ts): a deterministic scripted DOUBLE (`defaultScriptedDirector` — always
 * null → inert no-op, so real runs stay byte-identical) and an in-session subagent seam
 * (`createSubagentDirector`). The real subjective creation lives ONLY in the injected seam.
 */

import type { IntentBrief } from './intent-brief.js';
import type { Track } from '../paths.js';

/** The minimal input the Director reasons from — the run's identity (no Brief coupling). */
export interface DirectorInput {
  client: string;
  track: Track;
}

/**
 * The creation seam: given the run's identity, produce an IntentBrief — or `null` when the
 * director declines to author one. The orchestrator persists a non-null result via S1.
 */
export interface Director {
  create(input: DirectorInput): Promise<IntentBrief | null>;
}

/**
 * Deterministic scripted director double — the test/CI shape. Accepts a fixed verdict (an
 * IntentBrief, or `null` for the inert no-op) or a function of the input. Default `null`, so
 * `scriptedDirector()` is itself inert. Pure: same input → same output; never touches disk.
 */
export function scriptedDirector(
  verdict: IntentBrief | null | ((input: DirectorInput) => IntentBrief | null) = null,
): Director {
  return {
    async create(input: DirectorInput): Promise<IntentBrief | null> {
      return typeof verdict === 'function' ? verdict(input) : verdict;
    },
  };
}

/** The default scripted director: always null (inert no-op → no artifact written). */
export function defaultScriptedDirector(): Director {
  return scriptedDirector(null);
}

/**
 * Real-author analog: the in-session subjective director. Delegates creation to the injected
 * `dispatch` (a Claude subagent in-session that reads the brief / governance / philosophy and
 * authors the IntentBrief). Not wired by default — the scripted double is the default path,
 * exactly as `createSubagentAuthor` / `createSubagentCritic` complement their inert defaults.
 */
export function createSubagentDirector(opts: {
  dispatch: (input: DirectorInput) => Promise<IntentBrief | null>;
}): Director {
  return {
    async create(input: DirectorInput): Promise<IntentBrief | null> {
      return opts.dispatch(input);
    },
  };
}
