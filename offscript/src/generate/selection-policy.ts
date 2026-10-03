/**
 * W33 — the Soft-Band Cascade policy vocabulary (implements SPRINT-W32 §6.3).
 *
 * A set of pure, deterministic, INTEGER-ONLY narrowing operations over an ordered
 * candidate "band" (W32 §6.2): an ordered subset of the structural candidate pool that
 * is NEVER empty for a non-empty input and PRESERVES catalog order among survivors.
 * Every policy is FLOOR-PROTECTED — it can narrow the band but never empties it, so a
 * role is never left without a candidate (architecture invariant 3).
 *
 * No floating-point scoring, no randomness, no LLM, no embeddings (W33 STRICT RULES).
 * The candidate scores these policies consume are the existing integer selector scores
 * (regex cue counts, set-overlap counts, tag-overlap counts); the policies compare them
 * exactly and never divide.
 *
 * SCOPE (W33): the ONLY stage whose policy changes is W16 brief-affinity, which moves
 * from exact-max (`hard`/`keepMax`) to `band(δ)`. Crucially `band(_, _, 0)` is
 * byte-identical to `keepMax`, so the default (δ=0) reproduces the current engine
 * exactly. The full vocabulary (hard, band, identity, keep-max, keep-max+floor-exclude,
 * terminal) is implemented + tested here as the W32 contract; wiring beyond the W16
 * stage is intentionally NOT done in W33 (the other stages keep their existing inline
 * equivalents — "nothing more, nothing less").
 */

/** A per-candidate integer score (higher = better). Values are exact integers. */
export type ScoreOf<T> = (candidate: T) => number;

/** The stage-maximum score over a non-empty band (helper; not exported). */
function maxScore<T>(bandIn: readonly T[], scoreOf: ScoreOf<T>): number {
  let max = -Infinity;
  for (const cand of bandIn) {
    const s = scoreOf(cand);
    if (s > max) max = s;
  }
  return max;
}

/**
 * `keep-max` / `hard` (W32 §6.3) — keep only the candidates at the exact maximum score.
 * Order-preserved, floor-protected (a non-empty input never yields an empty band).
 */
export function keepMax<T>(bandIn: readonly T[], scoreOf: ScoreOf<T>): T[] {
  if (bandIn.length === 0) return [];
  const max = maxScore(bandIn, scoreOf);
  const kept = bandIn.filter((cand) => scoreOf(cand) === max);
  return kept.length > 0 ? kept : [...bandIn];
}

/**
 * `hard` (W32 §6.3) — mandatory exact-max keep for stages that must not soften
 * (Structural, Adjacency). Mechanically identical to `keepMax`; named separately for
 * contract clarity at the call sites.
 */
export const hard = keepMax;

/**
 * `band(δ)` (W32 §6.3) — the tolerance band: keep every candidate whose score is within
 * the integer tolerance δ of the stage maximum (`keep score >= max − δ`). δ is coerced
 * to a non-negative integer, so `band(_, _, 0)` ≡ `keepMax` (exact-max) — the
 * byte-identical baseline — and δ≥1 keeps near-tie candidates alive for the stages below.
 * Order-preserved, floor-protected. This is the ONLY policy W33 newly wires (at W16).
 */
export function band<T>(bandIn: readonly T[], scoreOf: ScoreOf<T>, delta: number): T[] {
  if (bandIn.length === 0) return [];
  const d = delta > 0 ? Math.trunc(delta) : 0; // non-negative integer; guards float/negative δ
  const threshold = maxScore(bandIn, scoreOf) - d;
  const kept = bandIn.filter((cand) => scoreOf(cand) >= threshold);
  return kept.length > 0 ? kept : [...bandIn];
}

/**
 * `identity` (W32 §6.3) — no narrowing (a disabled or absent signal). Returns a copy so
 * callers never alias the input band.
 */
export function identity<T>(bandIn: readonly T[]): T[] {
  return [...bandIn];
}

/**
 * `keep-max + floor-exclude` (W32 §6.3/§6.4) — the W19/W24 exclusion semantics reframed
 * as floor-protected demotion: drop the excluded candidates, keep the maximum of the
 * remainder; but if exclusion would empty the band, keep-max over ALL candidates instead
 * (demotion, never deletion — invariant 3). Order-preserved.
 */
export function keepMaxFloorExclude<T>(
  bandIn: readonly T[],
  scoreOf: ScoreOf<T>,
  isExcluded: (candidate: T) => boolean,
): T[] {
  if (bandIn.length === 0) return [];
  const kept = bandIn.filter((cand) => !isExcluded(cand));
  const base = kept.length > 0 ? kept : bandIn;
  return keepMax(base, scoreOf);
}

/**
 * `terminal` (W32 §6.3) — collapse the final band to ONE winner: prefer the first
 * candidate not in the recent (cross-page LRU) window; else the lowest use-count; else
 * the first in band (catalog) order. Band order is the deterministic final tiebreak, so
 * the winner is unique. Returns `undefined` only for an empty band.
 */
export function terminal<T>(
  bandIn: readonly T[],
  opts: {
    inRecentWindow?: (candidate: T) => boolean;
    useCount?: (candidate: T) => number;
  } = {},
): T | undefined {
  if (bandIn.length === 0) return undefined;
  const { inRecentWindow, useCount } = opts;
  if (inRecentWindow) {
    const fresh = bandIn.find((cand) => !inRecentWindow(cand));
    if (fresh !== undefined) return fresh;
  }
  if (useCount) {
    let best = bandIn[0];
    let bestUse = useCount(best);
    for (let i = 1; i < bandIn.length; i++) {
      const u = useCount(bandIn[i]);
      if (u < bestUse) {
        best = bandIn[i];
        bestUse = u;
      }
    }
    return best;
  }
  return bandIn[0];
}
