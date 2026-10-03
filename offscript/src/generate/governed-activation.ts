/**
 * Sprint W60 — Governed Default Activation.
 *
 * The governance pack's presence (`governanceEnabled` — see `realization-routing.ts`) is already
 * the single, authoritative runtime signal that lets the pipeline default to its production-quality
 * behaviour: `selectRealizationAuthor` routes to the subagent author whenever a governance pack
 * exists and a production author is available, with no manual flag required for the governance
 * half of that decision.
 *
 * W16 semantic selection (W19), family selection (W24), and mission selection (W30) are each
 * independently proven, tested, and byte-identical-proven capabilities that have, until now, sat
 * behind their own manual environment flag regardless of whether governance is active — the exact
 * gap W59 measured as the highest-ROI remaining bottleneck. This module extends the SAME
 * precedence rule those flags already follow (an explicit env value always wins) so that, when the
 * env var is simply unset, the default now follows governance-pack presence instead of a hardcoded
 * `false`.
 *
 * Pure function — no env reads, no I/O, no new detection or scoring. generate.ts supplies the raw
 * env-var value and the pre-computed `governanceEnabled` boolean.
 */

/**
 * Resolve a governed-activation boolean for one selection consumer's env gate.
 *
 * Precedence (highest to lowest), mirroring "Environment → Governance default → Built-in default":
 *   1. The environment variable is EXPLICITLY set (any value, including empty string) — the
 *      historical strict `=== '1'` equality decides on/off. This is the explicit override; it wins
 *      regardless of governance state in either direction.
 *   2. The environment variable is ABSENT (`undefined`) — default to governance-pack presence.
 *   3. No governance pack and no env var — off (today's byte-identical default is preserved).
 */
export function resolveGovernedActivation(
  envValue: string | undefined,
  governanceEnabled: boolean,
): boolean {
  if (envValue !== undefined) return envValue === '1';
  return governanceEnabled;
}
