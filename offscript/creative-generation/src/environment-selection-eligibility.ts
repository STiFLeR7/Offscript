/**
 * Sprint 10AB — the deterministic Environment eligibility filter (HANDOFF-v2.md Step 4 Stage 8):
 * answers only "which governed environments are legally eligible for this creative?", never "which
 * eligible environment is best?" — the semantic pick remains a separate, future capability (Sprint
 * 10AA §13). Composes exactly three source-backed rules, no fourth:
 *
 *   1. Vocabulary membership — isEnvironmentSlug() (environment-library.ts, imported, unmodified).
 *   2. Ratio legality        — design/website/brand-pack/ASSETS.md's own `aspect` column (lines
 *                              99-105), transcribed below as a small static table rather than
 *                              doc-parsed at runtime — the same "compute, don't table-parse" choice
 *                              environment-library.ts already made for its own asset-filename rule
 *                              (see that module's header comment). A future ASSETS.md edit to any
 *                              environment's legal-ratio set would need this table updated too — a
 *                              known, deliberate limitation, not an oversight (see the implementation
 *                              report's "Known Limitations").
 *   3. Recent-env exclusion  — the caller-supplied `lastEnvironment` (Sprint 10Z's own
 *                              getRecentEnvironmentUsage(logPath).lastEnvironment, passed through as
 *                              already-derived context). This module never reads Output/_LOG.md
 *                              itself and never imports recent-environment-usage.ts.
 *
 * Pure and synchronous: no filesystem read, no network call, no LLM dispatch, no belief/feature/
 * camera input. Scoped strictly to Stage 8's own literal "avoid the tail's most recent env="
 * sentence (HANDOFF-v2.md line 787) — it does NOT implement Step 4 Stage 6's separately-worded,
 * broader "vary at least two of material / focal / density / env from the recent log" combinatorial
 * rule (lines 780-781), which the source never states is the same rule as Stage 8's. That
 * contradiction (Sprint 10X §14, Sprint 10AA §8) is preserved, not resolved, here.
 */
import { isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';

const LEGAL_RATIOS: Readonly<Record<EnvironmentSlug, readonly string[]>> = {
  'cliffside-muted': ['16:9', '4:3', '1:1', '3:4'],
  'dawn-haze': ['16:9', '4:3', '1:1'],
  'lake-mirror': ['16:9', '4:3', '1:1', '3:4'],
  'massif-banded': ['16:9', '4:3', '1:1', '3:4'],
  'massif-clear': ['4:3', '16:9', '1:1'],
  'ridges-distant': ['16:9', '4:3', '1:1', '3:4'],
  'valley-deep': ['16:9', '4:3', '1:1', '3:4'],
};

export interface EligibilityInput {
  /** The candidate universe to filter — typically all seven governed EnvironmentSlug values from
   * environment-library.ts, supplied by the caller (this module declares no copy of the vocabulary
   * itself). Unrecognized values are silently rejected, never thrown on; duplicates are
   * deduplicated, first occurrence wins. */
  readonly candidates: readonly string[];
  /** The creative's approved ratio (CreativeIntentInput.ratio). A ratio no environment is ever legal
   * at (an unsupported or missing value) yields zero eligible candidates — fail-closed, never a
   * guessed fallback. */
  readonly ratio: string;
  /** Sprint 10Z's getRecentEnvironmentUsage(logPath).lastEnvironment, passed through as
   * already-derived context. An unrecognized value is treated the same as undefined (excludes
   * nothing), never thrown on. */
  readonly lastEnvironment?: string;
}

/**
 * Returns the governed EnvironmentSlug values that are BOTH legal for `ratio` AND not equal to
 * `lastEnvironment`, preserving `candidates`' own relative order (a stable filter — first occurrence
 * wins on duplicates, never a re-ranked or invented preference order). Never mutates `candidates`.
 * Never throws. Can legitimately return an empty array — the caller must not re-add the recent
 * environment or otherwise invent a fallback candidate.
 */
export function getEligibleEnvironments(input: EligibilityInput): readonly EnvironmentSlug[] {
  const seen = new Set<EnvironmentSlug>();
  const eligible: EnvironmentSlug[] = [];
  for (const candidate of input.candidates) {
    if (!isEnvironmentSlug(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!LEGAL_RATIOS[candidate].includes(input.ratio)) continue;
    if (input.lastEnvironment !== undefined && candidate === input.lastEnvironment) continue;
    eligible.push(candidate);
  }
  return Object.freeze(eligible);
}
