/**
 * Sprint W7 — Mechanism Model Consumption (Governed Selection Justification).
 *
 * The SECOND Governance Model allowed to change planner behaviour. Unlike W6 (ordering), Mechanism
 * governs the SELECTION JUSTIFICATION: WHY each retained section exists. The World-B planner consumes
 * ONLY the World-A `mechanism` Model and enriches every retained PlanItem's reasoning with
 * role / selectionRationale / relationships / communicationObjective evidence. It governs necessity,
 * never aesthetics; it justifies, retains, and annotates — it NEVER generates, invents, rewrites HTML,
 * changes author prompts, performs realization, reorders sections (W6's job), or changes the selected
 * section set. Ordering remains W6's responsibility. No model / empty model ⇒ byte-identical.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `mechanism` model is consumed — any other kind FAILS LOUD (the six remaining Models
 *     stay transport-only). The function is typed for + checks `kind === 'mechanism'`.
 *   - Consumes ONLY these authored categories (the instruction's semantic labels → MODEL_SCHEMA keys):
 *       mechanismDiscovery + mechanismSelection → requiredMechanisms (§6) — section anchor.id refs
 *       mechanismPurpose                        → purposes (§9)           — 1:1 → communicationObjective
 *       mechanismResponsibilities               → responsibilities (§14)  — 1:1 → role (authored 1:1)
 *       mechanismRelationships                  → relationships (§11)      — page-level → relationships
 *       mechanismDependencies                   → dependencies (§15)       — page-level → relationships
 *     orchestration (§12), composition (§13), and hierarchy (§10) are NEVER consumed (no hierarchy is
 *     invented). They remain valid authored categories (transport-only), so they do not fail the
 *     unknown-category check — only a key OUTSIDE the authored schema does.
 *   - Writes evidence ONLY into role / selectionRationale / relationships / communicationObjective —
 *     AUGMENT, never replace (W5's selectionRationale/relationships + W6's orderingRationale/transition
 *     are preserved). NEVER touches orderingRationale / transition.
 *
 * Section binding (the W6 Phase-D precedent, reused): requiredMechanisms references PlanItem anchor.id
 * — a planned section's OWN identity, NOT a component library (governance-clean per COMPONENT_SYSTEM
 * .md:324 "the output remains mechanism intent"). It must cover EVERY retained section (every retained
 * section must have an authored mechanism purpose — §14), with no duplicates and no unknown reference.
 *
 * Content shape (G1): the constitutions author no per-category output shape, so DerivedCategory.content
 * is `unknown`. W7 consumes string / string[] content and FAILS LOUD on any other shape — it refuses
 * to invent a shape. An inert model (null content) enriches nothing → byte-identical.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema; never mutates World A.
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
export interface MechanismConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The authored mechanism categories (read-only from the World-A schema). */
const MECHANISM_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.mechanism.categories.map((c) => c.key));

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
    throw new Error(`mechanism-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
  }
  if (arr.length === 0) return undefined;
  return arr.map((e) => {
    if (typeof e !== 'string' || e.trim() === '') {
      throw new Error(`mechanism-consumption: ${label} contains a non-string / empty entry (malformed).`);
    }
    return e.trim();
  });
}

function contentOf(model: GovernedModel<'mechanism'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

interface ParsedMechanism {
  /** the validated required-mechanism section ids (full coverage of the plan; empty ⇒ no-op). */
  readonly required: string[];
  /** per-required-mechanism role (responsibilities §14, 1:1 with `required`). */
  readonly responsibilities?: string[];
  /** per-required-mechanism purpose (purposes §9, 1:1 with `required`). */
  readonly purposes?: string[];
  /** page-level relationship evidence (relationships §11 + dependencies §15), joined. */
  readonly relationships?: string;
}

/** Validate + parse the mechanism model against the plan. Fail-loud; never repairs/infers/fabricates. */
function parseMechanism(plan: AuthoringPlan, model: GovernedModel<'mechanism'>, opts: MechanismConsumptionOpts): ParsedMechanism {
  if (!model || typeof model !== 'object') {
    throw new Error('mechanism-consumption: Mechanism Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'mechanism') {
    throw new Error(`mechanism-consumption: expected the Mechanism Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('mechanism-consumption: the Mechanism Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'mechanism'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('mechanism-consumption: Mechanism Model has no result.');
  }
  const unknownCats = Object.keys(result).filter((k) => !MECHANISM_CATEGORIES.has(k));
  if (unknownCats.length > 0) {
    throw new Error(`mechanism-consumption: unknown mechanism categories: ${unknownCats.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('mechanism-consumption: repository mismatch — the Mechanism Model was derived against a different repository.');
  }

  const planIds = plan.items.map(referenceIdOf);
  const planIdSet = new Set(planIds);

  // requiredMechanisms — the discovery + selection of section mechanisms. Empty/absent ⇒ no-op.
  const requiredRaw = renderList(contentOf(model, 'requiredMechanisms'), 'required mechanisms');
  if (!requiredRaw || requiredRaw.length === 0) {
    return { required: [] };
  }
  // duplicates — a section named twice, checked on the RAW authored list (always wrong,
  // regardless of which track resolves each entry).
  const seen = new Set<string>();
  for (const id of requiredRaw) {
    if (seen.has(id)) throw new Error(`mechanism-consumption: duplicate mechanism '${id}'.`);
    seen.add(id);
  }

  // W83 — resolve each reference against THIS track's plan, or recognize it as another track's
  // own structural default (legitimately absent here, not an error). See governance-reference.ts.
  const resolution = resolveGovernanceReferences(requiredRaw, plan.track, planIdSet);
  if (resolution.unresolved.length > 0) {
    throw new Error(`mechanism-consumption: unknown section reference '${resolution.unresolved[0]}' (no such section).`);
  }
  const required = requiredRaw.filter((id) => !resolution.elsewhere.has(id));

  // coverage — every retained section must have an authored mechanism purpose (§14), after
  // excluding references that were never applicable to this track (unchanged philosophy).
  const requiredSet = new Set(required);
  const uncovered = planIds.filter((id) => !requiredSet.has(id));
  if (uncovered.length > 0) {
    throw new Error(`mechanism-consumption: incomplete coverage — every retained section must have an authored mechanism (missing: ${uncovered.join(', ')}).`);
  }

  // responsibilities — §14 authored 1:1 with the RAW required mechanisms (the alignment check
  // is unchanged); filtered in lockstep so the final array aligns with `required` below.
  const responsibilitiesRaw = renderList(contentOf(model, 'responsibilities'), 'responsibilities');
  if (responsibilitiesRaw && responsibilitiesRaw.length !== requiredRaw.length) {
    throw new Error(`mechanism-consumption: malformed responsibilities — ${responsibilitiesRaw.length} for ${requiredRaw.length} mechanism(s) (must align 1:1).`);
  }
  // purposes — §9, aligned 1:1 with the RAW required mechanisms; filtered the same way.
  const purposesRaw = renderList(contentOf(model, 'purposes'), 'purposes');
  if (purposesRaw && purposesRaw.length !== requiredRaw.length) {
    throw new Error(`mechanism-consumption: malformed purposes — ${purposesRaw.length} for ${requiredRaw.length} mechanism(s) (must align 1:1).`);
  }
  const filterInLockstep = (values: string[] | undefined): string[] | undefined =>
    values
      ? requiredRaw.reduce<string[]>((acc, id, i) => {
          if (!resolution.elsewhere.has(id)) acc.push(values[i]);
          return acc;
        }, [])
      : undefined;
  const responsibilities = filterInLockstep(responsibilitiesRaw);
  const purposes = filterInLockstep(purposesRaw);

  // relationships (§11) + dependencies (§15) — page-level evidence. Fail-loud on malformed entries.
  const relationships = renderList(contentOf(model, 'relationships'), 'relationships');
  const dependencies = renderList(contentOf(model, 'dependencies'), 'dependencies');
  const relatedParts: string[] = [];
  if (relationships) relatedParts.push(`Relationships: ${relationships.join('; ')}`);
  if (dependencies) relatedParts.push(`Dependencies: ${dependencies.join('; ')}`);

  return {
    required,
    responsibilities,
    purposes,
    relationships: relatedParts.length > 0 ? relatedParts.join(' · ') : undefined,
  };
}

/**
 * Merge mechanism evidence into an item's reasoning (W13 merge contract). `role` is fill-if-empty —
 * Mechanism is its SOLE owner, so this is effectively a set (no other consumer writes role). The three
 * shared fields (selectionRationale / relationships / communicationObjective) APPEND after a ` · `
 * separator (append-to-empty = set), uniform with W5/W8–W11, so the mechanism contributions survive the
 * canonical descent even when an earlier consumer already wrote those fields (W13 resolves W12 M1/M2;
 * before W13, W7 was fill-if-empty and its constant could be silently dropped). It NEVER writes
 * orderingRationale / transition (W6-owned) — carried verbatim. Frozen.
 */
function mergeReasoning(
  existing: SectionReasoning | undefined,
  addition: { role?: string; selectionRationale?: string; relationships?: string; communicationObjective?: string },
): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  if (addition.role && merged.role === undefined) merged.role = addition.role; // role: Mechanism is sole owner
  const append = (field: 'selectionRationale' | 'relationships' | 'communicationObjective', a?: string): void => {
    if (!a) return;
    merged[field] = merged[field] ? `${merged[field]} · ${a}` : a;
  };
  append('selectionRationale', addition.selectionRationale);
  append('relationships', addition.relationships);
  append('communicationObjective', addition.communicationObjective);

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`mechanism-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/** The governed selection fact recorded on every required-mechanism section. */
const SELECTION_RATIONALE = 'Required mechanism — governed selection (Component System §6).';

/**
 * Consume the Mechanism Model: validate (fail-loud), then justify EVERY retained PlanItem — attach
 * role (responsibility), selectionRationale (governed selection), relationships (relationship +
 * dependency evidence), and communicationObjective (purpose). Mutates the plan in place; AUGMENT-only.
 * An empty/absent requiredMechanisms is a no-op (byte-identical). NEVER reorders, never adds/removes
 * sections, never selects components, never touches HTML.
 */
export function applyMechanism(
  plan: AuthoringPlan,
  mechanismModel: GovernedModel<'mechanism'>,
  opts: MechanismConsumptionOpts,
): void {
  const parsed = parseMechanism(plan, mechanismModel, opts);
  if (parsed.required.length === 0) return; // empty mechanism model — no justification (byte-identical)

  // index each required-mechanism section so per-section 1:1 evidence (role/purpose) attaches by id.
  const roleById = new Map<string, string>();
  const objectiveById = new Map<string, string>();
  parsed.required.forEach((id, i) => {
    const resp = parsed.responsibilities?.[i];
    if (resp) roleById.set(id, `Responsibility: ${resp}`);
    const purpose = parsed.purposes?.[i];
    if (purpose) objectiveById.set(id, `Purpose: ${purpose}`);
  });

  for (const item of plan.items) {
    // W83 — roleById/objectiveById are keyed by the track-neutral reference id.
    const id = referenceIdOf(item);
    item.reasoning = mergeReasoning(item.reasoning, {
      role: roleById.get(id),
      selectionRationale: SELECTION_RATIONALE,
      relationships: parsed.relationships,
      communicationObjective: objectiveById.get(id),
    });
  }
}
