/**
 * Sprint W6 — Progression Model Consumption (Governed Sequencing).
 *
 * The FIRST Governance Model allowed to change planner BEHAVIOUR — specifically section ORDERING.
 * The World-B planner consumes ONLY the World-A `progression` Model and reorders the EXISTING
 * PlanItems by its `encounterSequence`. It also validates `transitionLogic` (an acyclic graph) and
 * records ordering/transition/objective EVIDENCE.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `progression` model is consumed — any other kind FAILS LOUD (the five remaining
 *     Models + Information stay out of W6).
 *   - Consumes ONLY: encounterSequence (→ ordering), transitionLogic (→ acyclic validation +
 *     evidence), progressionObjectives (→ evidence). "Progression integrity" is a VALIDATION, not a
 *     consumed category. progressionUnits is NOT consumed.
 *   - Reorders existing PlanItems ONLY — a PURE PERMUTATION. Never adds, removes, renames, merges, or
 *     splits sections. Never selects components. Never invokes an LLM. Never touches HTML directly.
 *   - Writes evidence ONLY into the W6-owned reasoning fields (orderingRationale, transition) — the
 *     fields W5 deliberately left untouched; W5's selectionRationale/relationships are preserved.
 *
 * Phase-D resolution (World B): the encounter sequence references PlanItem `anchor.id` (the planner's
 * own namespace) — closing the audit's binding gap — and W6 consumes only `string[]` content,
 * failing loud on any other shape rather than inventing one (G1).
 *
 * Ordering contract: no model / empty sequence ⇒ byte-identical (no reorder, no evidence). A valid
 * sequence MUST be an exact permutation of the plan's section ids (no add/remove). Read-only World-A
 * consumption (imports types + schema; never mutates World A).
 */
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';
import { resolveGovernanceReferences } from './governance-reference.js';

/** Sprint W83 — the track-neutral identity a governance pack references: the item's own
 * governanceReferenceId when the planner attached one, else its anchor.id (hand-built plan
 * fixtures in tests never set governanceReferenceId — falling back keeps them valid). */
function referenceIdOf(item: PlanItem): string {
  return item.governanceReferenceId ?? item.anchor.id;
}

/** Caller-supplied expectations the consumed model must satisfy. */
export interface ProgressionConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The authored progression categories (read-only from the World-A schema). */
const PROGRESSION_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.progression.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/** Render a category's `unknown` content into string[], or undefined when absent. Fail-loud on any
 * other shape (G1 — refuse to invent). `label` names the category for clear errors. */
function renderList(content: unknown, label: string): string[] | undefined {
  if (content === undefined || content === null) return undefined;
  const arr = typeof content === 'string' ? [content] : content;
  if (!Array.isArray(arr)) {
    throw new Error(`progression-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
  }
  if (arr.length === 0) return undefined;
  return arr.map((e) => {
    if (typeof e !== 'string' || e.trim() === '') {
      throw new Error(`progression-consumption: ${label} contains a non-string / empty entry (malformed).`);
    }
    return e.trim();
  });
}

/** Parse a transition entry `"<from> -> <to>"` / `"<from> → <to>"` into an edge, or null. */
function parseEdge(entry: string): readonly [string, string] | null {
  const parts = entry.split(/\s*(?:->|→)\s*/);
  if (parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== '') {
    return [parts[0].trim(), parts[1].trim()];
  }
  return null;
}

/** Detect a cycle in a directed edge list (DFS three-colour). */
function hasCycle(edges: readonly (readonly [string, string])[]): boolean {
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const [a, b] of edges) {
    nodes.add(a);
    nodes.add(b);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
  }
  const color = new Map<string, 0 | 1 | 2>(); // 0 white, 1 gray, 2 black
  const visit = (n: string): boolean => {
    color.set(n, 1);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? 0;
      if (c === 1) return true;
      if (c === 0 && visit(m)) return true;
    }
    color.set(n, 2);
    return false;
  };
  for (const n of nodes) if ((color.get(n) ?? 0) === 0 && visit(n)) return true;
  return false;
}

interface ParsedProgression {
  /** the validated encounter order (a permutation of plan ids); empty ⇒ no-op. */
  readonly order: string[];
  /** transition evidence per source section id ("Hands to: <to>"). */
  readonly transitionsByFrom: Map<string, string[]>;
  /** per-encounter-position objective, aligned to `order`. */
  readonly objectives?: string[];
}

function contentOf(model: GovernedModel<'progression'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/** Validate + parse the progression model against the plan. Fail-loud; never repairs/infers. */
function parseProgression(plan: AuthoringPlan, model: GovernedModel<'progression'>, opts: ProgressionConsumptionOpts): ParsedProgression {
  if (!model || typeof model !== 'object') {
    throw new Error('progression-consumption: Progression Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'progression') {
    throw new Error(`progression-consumption: expected the Progression Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('progression-consumption: the Progression Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'progression'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('progression-consumption: Progression Model has no result.');
  }
  const unknownCats = Object.keys(result).filter((k) => !PROGRESSION_CATEGORIES.has(k));
  if (unknownCats.length > 0) {
    throw new Error(`progression-consumption: unknown progression categories: ${unknownCats.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('progression-consumption: repository mismatch — the Progression Model was derived against a different repository.');
  }

  const planIds = plan.items.map(referenceIdOf);
  const planIdSet = new Set(planIds);

  // encounterSequence — the order. Empty/absent ⇒ no ordering influence (no-op).
  const sequence = renderList(contentOf(model, 'encounterSequence'), 'encounter sequence');
  if (!sequence || sequence.length === 0) {
    return { order: [], transitionsByFrom: new Map() };
  }
  // duplicates — checked on the RAW authored sequence; a genuine duplicate is always wrong,
  // regardless of which track resolves each entry.
  const seen = new Set<string>();
  for (const id of sequence) {
    if (seen.has(id)) throw new Error(`progression-consumption: duplicate sequence entry '${id}'.`);
    seen.add(id);
  }

  // W83 — resolve each reference against THIS track's plan, or recognize it as another track's
  // own structural default (legitimately absent here, not an error). See governance-reference.ts.
  const resolution = resolveGovernanceReferences(sequence, plan.track, planIdSet);
  if (resolution.unresolved.length > 0) {
    throw new Error(`progression-consumption: unknown sequence reference '${resolution.unresolved[0]}' (no such section).`);
  }
  // sequence filtered to references that apply to THIS track (elsewhere-scoped ids dropped).
  const filteredSequence = sequence.filter((id) => !resolution.elsewhere.has(id));

  // coverage — the filtered sequence must be an exact permutation of the CURRENT track's plan
  // ids (no implicit add/remove of REAL content — unchanged philosophy, just computed after
  // excluding references that were never applicable to this track).
  if (filteredSequence.length !== planIds.length) {
    const missing = planIds.filter((id) => !filteredSequence.includes(id));
    throw new Error(`progression-consumption: encounter sequence does not cover all sections (would remove: ${missing.join(', ')}) — only a permutation is allowed.`);
  }

  // transitionLogic — acyclic edge graph; each endpoint resolves the same way as the sequence.
  // An edge with an elsewhere-scoped endpoint does not apply to this track and is dropped.
  const transitionsByFrom = new Map<string, string[]>();
  const transitionRaw = renderList(contentOf(model, 'transitionLogic'), 'transition logic');
  if (transitionRaw) {
    const edges: (readonly [string, string])[] = [];
    for (const entry of transitionRaw) {
      const edge = parseEdge(entry);
      if (!edge) throw new Error(`progression-consumption: broken transition graph — unparseable entry '${entry}' (expected '<from> -> <to>').`);
      const [from, to] = edge;
      const endpoints = resolveGovernanceReferences([from, to], plan.track, planIdSet);
      if (endpoints.unresolved.length > 0) {
        throw new Error(`progression-consumption: broken transition graph — unknown reference in '${entry}'.`);
      }
      if (endpoints.elsewhere.size > 0) continue; // doesn't apply to this track
      edges.push(edge);
      (transitionsByFrom.get(from) ?? transitionsByFrom.set(from, []).get(from)!).push(to);
    }
    if (hasCycle(edges)) {
      throw new Error('progression-consumption: cyclic progression — the transition graph contains a cycle.');
    }
  }

  // progressionObjectives — optional; authored 1:1 against the ORIGINAL declared sequence (the
  // alignment check is unchanged); filtered in lockstep so the final array aligns with the
  // filtered sequence returned below.
  const objectivesRaw = renderList(contentOf(model, 'progressionObjectives'), 'progression objectives');
  if (objectivesRaw && objectivesRaw.length !== sequence.length) {
    throw new Error(`progression-consumption: malformed objectives — ${objectivesRaw.length} objective(s) for ${sequence.length} sequenced section(s) (must align 1:1).`);
  }
  const objectives = objectivesRaw
    ? sequence.reduce<string[]>((acc, id, i) => {
        if (!resolution.elsewhere.has(id)) acc.push(objectivesRaw[i]);
        return acc;
      }, [])
    : undefined;

  return { order: filteredSequence, transitionsByFrom, objectives };
}

/**
 * Merge progression evidence into an item's reasoning — AUGMENT, never replace: existing fields win;
 * W6 fills only the empty orderingRationale / transition (the fields W5 leaves untouched). Frozen.
 */
function mergeReasoning(existing: SectionReasoning | undefined, addition: { orderingRationale?: string; transition?: string }): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  if (addition.orderingRationale && merged.orderingRationale === undefined) merged.orderingRationale = addition.orderingRationale;
  if (addition.transition && merged.transition === undefined) merged.transition = addition.transition;

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`progression-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Progression Model: validate (fail-loud), reorder the EXISTING PlanItems by the encounter
 * sequence (a pure permutation), and enrich each with ordering/transition evidence. Mutates the plan
 * in place. An empty/absent sequence is a no-op (byte-identical). NEVER adds/removes/renames sections,
 * never selects components, never touches HTML.
 */
export function applyProgression(
  plan: AuthoringPlan,
  progressionModel: GovernedModel<'progression'>,
  opts: ProgressionConsumptionOpts,
): void {
  const parsed = parseProgression(plan, progressionModel, opts);
  if (parsed.order.length === 0) return; // empty progression — no ordering influence (byte-identical)

  // W83 — parsed.order/transitionsByFrom are keyed by the track-neutral reference id, not
  // necessarily anchor.id (they differ on collateral for a prefixed must-include entry).
  const byId = new Map(plan.items.map((i) => [referenceIdOf(i), i] as const));
  const reordered: PlanItem[] = parsed.order.map((id) => byId.get(id)!); // permutation: all present

  reordered.forEach((item, i) => {
    const orderingParts = [`Encounter position: ${i + 1} of ${reordered.length}`];
    const objective = parsed.objectives?.[i];
    if (objective) orderingParts.push(`Objective: ${objective}`);
    const handsTo = parsed.transitionsByFrom.get(referenceIdOf(item));
    const transition = handsTo && handsTo.length > 0 ? `Hands to: ${handsTo.join(', ')}` : undefined;
    item.reasoning = mergeReasoning(item.reasoning, { orderingRationale: orderingParts.join(' · '), transition });
  });

  // Reorder in place (pure permutation — same items, new order).
  plan.items.splice(0, plan.items.length, ...reordered);
}
