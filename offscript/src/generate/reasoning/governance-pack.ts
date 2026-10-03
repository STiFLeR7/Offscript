/**
 * Sprint W15 — Governed Production Enablement: the Governed Producer's persisted-output seam.
 *
 * This is the switch W14 found dormant. The Governed Producer (World-A `deriveModels`) produces the
 * seven Governance Models; in an in-session run its content comes from the subagent deriver, and that
 * output is persisted per client as `governance-drafts.json` (an array of the seven `ModelDraft`s). This
 * module loads that persisted output and replays it deterministically through `deriveModels` so the
 * headless production generator can consume real governed reasoning — no provider-specific logic, no new
 * Models, no redesign. World A is imported read-only (deriveModels + scriptedDeriver + types).
 *
 * Enablement is purely presence-based: a client with NO `governance-drafts.json` derives no models, the
 * orchestrator no-ops, and generation is byte-identical (the disabled default). A client WITH a pack
 * activates W5–W11 over its plan.
 */
import { readFileSync, existsSync } from 'node:fs';
import { deriveModels } from '../../knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../knowledge/derivation/scripted-deriver.js';
import type { DerivedModelSet, ModelDraft, RawBrief } from '../../knowledge/derivation/models.js';

/** The per-client persisted Governed Producer output (the seven model drafts). */
export const GOVERNANCE_PACK_FILENAME = 'governance-drafts.json';

/** The minimal brief shape the pack derivation needs (the generate-path Brief satisfies it). */
export interface GovernancePackBrief {
  readonly brand?: string;
  readonly oneLiner: string;
  readonly audience?: string;
  readonly goals?: readonly string[];
  readonly mustInclude?: readonly string[];
  readonly tone?: string;
  readonly successCriteria?: readonly string[];
  readonly body?: string;
}

/**
 * Load the persisted Governed Producer drafts at `path`, or `undefined` when the file is absent
 * (governance disabled → byte-identical). Fail-loud on a malformed pack — never silently disables.
 */
export function loadGovernanceDrafts(path: string): ModelDraft[] | undefined {
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`governance-pack: ${path} is not valid JSON — ${e instanceof Error ? e.message : String(e)}.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`governance-pack: ${path} must be a JSON array of the seven model drafts.`);
  }
  return parsed as ModelDraft[];
}

/**
 * Assemble the seven Governance Models from persisted drafts via World-A `deriveModels` (read-only).
 * `scriptedDeriver` replays the drafts deterministically; `deriveModels` validates the draft set
 * EXACTLY against the constitutional schema and freezes the result (fail-loud on a malformed pack —
 * missing/extra category, wrong kind). The repository identity binds the set; the orchestrator reads it
 * back from `models.inputs`, so the per-consumer repository check is self-consistent.
 */
export async function deriveGovernanceModels(
  drafts: readonly ModelDraft[],
  brief: GovernancePackBrief,
  repositoryIdentity: string,
): Promise<DerivedModelSet> {
  const rawBrief: RawBrief = {
    brand: brief.brand && brief.brand.trim() !== '' ? brief.brand : 'Brand',
    oneLiner: brief.oneLiner,
    audience: brief.audience ?? '',
    goals: brief.goals ? [...brief.goals] : [],
    mustInclude: brief.mustInclude ? [...brief.mustInclude] : [],
    tone: brief.tone ?? '',
    successCriteria: brief.successCriteria ? [...brief.successCriteria] : [],
    body: brief.body ?? '',
  };
  return deriveModels(rawBrief, { repositoryIdentity, assetCount: 0 }, scriptedDeriver(drafts));
}
