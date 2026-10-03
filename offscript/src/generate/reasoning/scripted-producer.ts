/**
 * Sprint W3 — the scripted ReasoningProducer double + the in-session subagent seam.
 *
 * Mirrors the derivation seam (knowledge/derivation/scripted-deriver.ts) and the director/critic
 * seams exactly: a deterministic scripted DOUBLE (the inert default), a test fixture, and a
 * `createSubagentProducer` factory that routes real reasoning through an injected dispatch — the
 * in-session LLM path, NOT wired by default.
 *
 * GUARDRAIL — the scripted double is a double, NOT evidence. `defaultScriptedProducer` produces
 * NOTHING (`{ reasoning: undefined }`) for every section: NO reasoning, NO heuristics, NO keyword
 * matching, NO fake/TODO/placeholder reasoning, and it does NOT read the context. Its ONLY purpose
 * is byte-identity — with it wired, no item gains a reasoning channel and the whole deliverable is
 * identical to pre-W3. Real, on-brand reasoning comes only from the subagent seam (W4).
 */
import type { ReasoningContext, ReasoningProducer, ReasoningResult } from './types.js';

/** The inert result: this producer reasoned about nothing. */
const NOTHING: ReasoningResult = { reasoning: undefined };

/**
 * The default scripted producer — for CI and the default generate path. Always returns
 * `{ reasoning: undefined }`: schema-shaped, inert, context-independent. There is no heuristic
 * production implementation by design — real reasoning lives only in the subagent seam.
 */
export function defaultScriptedProducer(): ReasoningProducer {
  return {
    name: 'reasoning::scripted',
    produce: () => NOTHING,
  };
}

/**
 * A test fixture: a producer that returns the supplied result verbatim (or computes it from the
 * context via a function). Deterministic — same input → same output; never touches disk. Used by
 * tests to drive the lifecycle's validation / freeze / transport paths.
 */
export function scriptedProducer(
  verdict: ReasoningResult | ((context: ReasoningContext) => ReasoningResult) = NOTHING,
): ReasoningProducer {
  return {
    name: 'reasoning::scripted-fixture',
    produce: (context: ReasoningContext): ReasoningResult =>
      typeof verdict === 'function' ? verdict(context) : verdict,
  };
}

/** The dispatch a subagent producer delegates real reasoning to. */
export interface ReasoningDispatch {
  dispatch(context: ReasoningContext): Promise<ReasoningResult>;
}

/**
 * The in-session LLM reasoning seam. Routes the context to an injected dispatch that produces
 * real, brief-grounded reasoning (validated + frozen by the lifecycle). This is the on-brand
 * reasoning intelligence — but it is NOT wired by default; a caller must construct it explicitly
 * with a dispatch. Mirrors createSubagentDeriver / createSubagentDirector / createSubagentAuthor.
 */
export function createSubagentProducer(deps: ReasoningDispatch): ReasoningProducer {
  return {
    name: 'reasoning::subagent',
    produce: (context) => deps.dispatch(context),
  };
}
