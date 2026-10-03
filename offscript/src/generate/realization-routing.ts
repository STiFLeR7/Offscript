/**
 * Sprint W16 — Goal 1: the explicit, deterministic realization routing switch.
 *
 * Decision (W16, recorded in SPRINT-W16): the scripted author is RETAINED as deterministic
 * infrastructure — CI, regression testing, offline execution, byte-identical verification — NOT as the
 * production-quality realization path. The in-session subagent (LLM) author is the production-quality
 * realization path: it regenerates headline / copy / proof / CTAs / messaging from the brief while
 * preserving the selected component structure and the Offscript design language.
 *
 * The switch is explicit and deterministic:
 *   governance disabled                              → scripted author
 *   governance enabled + production author available → subagent author
 *
 * This honours both W16 (replace verbatim realization with brief-aware realization) and the standing
 * charter (WORLD-B-EVOLUTION-ARCHITECTURE.md §10.6: the inert/scripted default exists for byte-identity,
 * never as a stand-in for design). When governance is disabled the scripted path runs ⇒ byte-identical.
 *
 * Pure function — no env reads, no I/O. generate.ts supplies the two booleans.
 */

/** The two realization authors the website pipeline can route to. */
export type RealizationAuthor = 'scripted' | 'subagent';

export interface RealizationRoutingInputs {
  /** Governed reasoning is enabled for this run (a per-client governance pack is present). */
  readonly governanceEnabled: boolean;
  /** A production (in-session subagent) author is available / opted in (OFFSCRIPT_AUTHOR=subagent). */
  readonly productionAuthorAvailable: boolean;
}

/**
 * Route the realization layer. Returns 'subagent' (the production-quality path) ONLY when governed
 * reasoning is enabled AND a production author is available; otherwise 'scripted' (the deterministic
 * infrastructure double — keeps the disabled default byte-identical).
 */
export function selectRealizationAuthor(inputs: RealizationRoutingInputs): RealizationAuthor {
  return inputs.governanceEnabled && inputs.productionAuthorAvailable ? 'subagent' : 'scripted';
}
