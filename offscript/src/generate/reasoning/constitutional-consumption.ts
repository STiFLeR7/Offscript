/**
 * Program Y, Sprint Y4 — Constitutional Governance Consumption.
 *
 * Per Y3: cross-track creative identity (design/shared's Inherited Creative Constitution, ported into
 * resources/design_principles/ in Y2) is a fixed REFERENCE, not a per-brief-derived Governance
 * Model — it is NOT a MODEL_SCHEMA kind and does not go through `deriveModels`/a `ModelDeriver`. This
 * module is therefore independent of `reasoning-orchestrator.ts` and the seven `*-consumption.ts`
 * files: it is not part of the canonical descent, has no `repositoryIdentity` binding (there is no
 * per-brief derivation to bind against — the content is read live), and is gated purely on the
 * presence of BOTH ported documents (a different, repo-level switch from `governance-drafts.json`'s
 * per-client gate).
 *
 * The constitution is 600+ lines of governing prose, not itself authored as reasoning evidence (unlike
 * the seven models' short, curated per-category drafts) — so evidence here is a FIXED, short,
 * non-interpretive pointer clause, never an attempted summary/parse of its content (Y1: the document is
 * "never parsed into a bespoke schema"; mechanically paraphrasing risks misrepresenting it).
 *
 * Same validate → derive evidence → append-only merge contract as every existing consumer: absent
 * input ⇒ {} ⇒ byte-identical; malformed/truncated input ⇒ fail-loud; present ⇒ APPEND-only into
 * `communicationObjective` (the field already designated "the HOW a section communicates" — identity/
 * character/tone is a HOW concern, the same field `experienceCharacter` also contributes to). NEVER
 * writes role / orderingRationale / transition / selectionRationale / relationships, never reorders,
 * never changes selection, never touches HTML.
 *
 * Call-site placement (scripts/generate.ts): BEFORE `enrichPlanWithGovernedReasoning`, so its clause
 * becomes the first content in `communicationObjective` and the seven models' own contributions append
 * after it — matching the constitution's own precedence (identity before expression).
 */
import type { AuthoringPlan, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { validateCrossTrackGovernanceShape } from '../../cross-track-governance.js';

/** The two ported documents, already loaded by the caller (or absent). Pure — no file I/O here. */
export interface ConstitutionalGovernanceInput {
  readonly creativeDirection?: string;
  readonly inheritedConstitution?: string;
}

export interface ConstitutionalEvidence {
  readonly communicationObjective?: string;
}

const POINTER_CLAUSE =
  'Cross-track creative identity: inherited from the Universal Creative Constitution, never ' +
  're-authored per section — see resources/design_principles/INHERITED_CREATIVE_CONSTITUTION.md.';

/**
 * Derive the evidence — PURE. Both documents present ⇒ the fixed pointer clause (validated first,
 * fail-loud on a malformed/truncated document). Either absent ⇒ {} (all-or-nothing, not partial — a
 * lone charter or a lone constitution is an incomplete port, not a legitimate half-enrichment).
 */
export function buildConstitutionalEvidence(input: ConstitutionalGovernanceInput): ConstitutionalEvidence {
  const { creativeDirection, inheritedConstitution } = input;
  if (!creativeDirection || !inheritedConstitution) return {};

  for (const [name, content] of [
    ['CREATIVE_DIRECTION', creativeDirection],
    ['INHERITED_CREATIVE_CONSTITUTION', inheritedConstitution],
  ] as const) {
    const problems = validateCrossTrackGovernanceShape(content);
    if (problems.length > 0) {
      throw new Error(`constitutional-consumption: ${name} failed shape validation — ${problems.join('; ')}.`);
    }
  }
  return { communicationObjective: POINTER_CLAUSE };
}

/** Merge — APPEND, never overwrite. Only communicationObjective is ever written; every other field is
 *  carried verbatim. Returns frozen reasoning. */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: ConstitutionalEvidence): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  if (evidence.communicationObjective) {
    merged.communicationObjective = merged.communicationObjective
      ? `${merged.communicationObjective} · ${evidence.communicationObjective}`
      : evidence.communicationObjective;
  }

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`constitutional-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume cross-track constitutional governance into the plan: derive evidence (fail-loud on malformed
 * input), and APPEND-only enrich every PlanItem's reasoning. Mutates items in place. Absent/partial
 * input ⇒ no-op ⇒ byte-identical. NEVER reorders, never changes selection, never writes role /
 * orderingRationale / transition / selectionRationale / relationships, never touches HTML.
 */
export function applyConstitutionalGovernance(plan: AuthoringPlan, input: ConstitutionalGovernanceInput): void {
  const evidence = buildConstitutionalEvidence(input);
  if (evidence.communicationObjective === undefined) return; // no-op — byte-identical
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
