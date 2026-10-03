/**
 * Sprint W1 — Reasoned Planning Foundation: the reasoning channel (the WHY).
 *
 * Pure transport + validation + immutability + serialization for `PlanItem.reasoning`
 * (see SectionReasoning in ./types.ts). This module is CAPACITY ONLY: the planner never
 * populates reasoning in W1 (absent ⇒ today's behaviour, byte-identical), and nothing here
 * is invoked on the default generate path. A future reasoning producer (W2+) is the sole
 * writer; these helpers validate + freeze + serialize what it attaches.
 *
 * Per WORLD-B-EVOLUTION-ARCHITECTURE.md §5: reasoning is OPTIONAL + immutable — never
 * synthesized, inferred, defaulted, or auto-populated. These functions only state facts and
 * transform what is already present; they never fabricate a field.
 */
import type { SectionReasoning } from './types.js';

/** The six reasoning responsibilities, in stable serialization order (architecture §5). */
export const REASONING_FIELDS = [
  'role',
  'selectionRationale',
  'orderingRationale',
  'transition',
  'relationships',
  'communicationObjective',
] as const;
export type ReasoningField = (typeof REASONING_FIELDS)[number];

/** Human-readable label for each field in the durable rulebook recipe. */
const FIELD_LABEL: Record<ReasoningField, string> = {
  role: 'role',
  selectionRationale: 'selection-rationale',
  orderingRationale: 'ordering-rationale',
  transition: 'transition',
  relationships: 'relationships',
  communicationObjective: 'communication-objective',
};

/** True iff at least one reasoning field is present — a non-empty channel. */
export function hasReasoning(reasoning: SectionReasoning | undefined): reasoning is SectionReasoning {
  if (!reasoning || typeof reasoning !== 'object') return false;
  return REASONING_FIELDS.some((f) => reasoning[f] !== undefined);
}

/**
 * Validate a reasoning object — PURE, never repairs, never fills. Returns the list of
 * problems (empty ⇒ sound): every PRESENT field must be a non-empty string; no unknown keys.
 * Absent fields are legal (the channel is optional). Consumers map a non-empty result to
 * their own error surface; this module states facts, it does not decide an error surface.
 */
export function validateReasoning(reasoning: SectionReasoning): string[] {
  if (!reasoning || typeof reasoning !== 'object') return ['reasoning is not an object'];
  const problems: string[] = [];
  const allowed = new Set<string>(REASONING_FIELDS);
  for (const key of Object.keys(reasoning)) {
    if (!allowed.has(key)) problems.push(`unknown reasoning field '${key}'`);
  }
  for (const f of REASONING_FIELDS) {
    const v = reasoning[f];
    if (v === undefined) continue;
    if (typeof v !== 'string') problems.push(`reasoning.${f} must be a string`);
    else if (v.trim() === '') problems.push(`reasoning.${f} must not be empty`);
  }
  return problems;
}

/**
 * Return a deep-frozen copy of a reasoning object — the immutability mechanism for the
 * channel. A future producer freezes what it attaches so the carried reasoning is immutable
 * end-to-end. Pure: the input is not mutated; undefined fields are stripped from the copy.
 */
export function freezeReasoning(reasoning: SectionReasoning): SectionReasoning {
  const copy: Record<string, unknown> = {};
  for (const f of REASONING_FIELDS) {
    if (reasoning[f] !== undefined) copy[f] = reasoning[f];
  }
  return Object.freeze(copy) as SectionReasoning;
}

/**
 * Deduplicate ` · `-delimited clauses within each reasoning field — the W13 merge-contract guarantee
 * that no clause is repeated. Two Governance Models may legitimately author the same fragment (e.g.
 * Information and Mechanism both citing the same dependency); the orchestrator applies this after the
 * canonical descent so the layered reasoning carries each distinct clause exactly once. Order-preserving
 * (first occurrence wins), pure, returns frozen reasoning. Single-fragment fields are unchanged; absent
 * fields stay absent. This is the ONLY place clauses are removed — every consumer is append-only.
 */
export function dedupeReasoningClauses(reasoning: SectionReasoning): SectionReasoning {
  const out: Record<string, string> = {};
  for (const f of REASONING_FIELDS) {
    const v = reasoning[f];
    if (typeof v !== 'string' || v.trim() === '') continue;
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const frag of v.split(' · ')) {
      if (!seen.has(frag)) {
        seen.add(frag);
        kept.push(frag);
      }
    }
    out[f] = kept.join(' · ');
  }
  return freezeReasoning(out as SectionReasoning);
}

/**
 * Serialize the present reasoning fields to rulebook bullet lines, in REASONING_FIELDS order.
 * Returns [] when the channel is empty — so an absent channel adds NOTHING to the durable
 * recipe (the byte-identical default). Pure.
 */
export function serializeReasoningLines(reasoning: SectionReasoning | undefined): string[] {
  if (!hasReasoning(reasoning)) return [];
  const out: string[] = [];
  for (const f of REASONING_FIELDS) {
    const v = reasoning[f];
    if (typeof v === 'string' && v.trim() !== '') out.push(`- **${FIELD_LABEL[f]}:** ${v}`);
  }
  return out;
}
