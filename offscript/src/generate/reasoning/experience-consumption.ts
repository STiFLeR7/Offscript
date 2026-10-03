/**
 * Sprint W11 — Experience Character Model Consumption (the seventh and FINAL governance consumer).
 *
 * Experience Character governs HOW the overall experience should BEHAVE — not what components exist,
 * where they appear, or how they are rendered. The World-B planner consumes ONLY the World-A
 * `experienceCharacter` Model and APPEND-only enriches every PlanItem's reasoning with behavioural /
 * experiential intent. It carries behavioural intent / creative constraints / decision filters /
 * experiential objectives — it NEVER changes selection, ordering, layout, realization, prompts,
 * generates copy / HTML, overwrites role / orderingRationale / transition, or consumes another Model.
 * No model / empty model ⇒ byte-identical.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `experienceCharacter` model is consumed — any other kind FAILS LOUD (the six remaining
 *     Models stay transport-only). The function is typed for + checks `kind === 'experienceCharacter'`.
 *   - Consumes EXACTLY the authored MODEL_SCHEMA.experienceCharacter categories (§21) — does not invent.
 *     The constitution (BRAND_EXPRESSION.md §21) and MODEL_SCHEMA agree (eight categories); there is no
 *     divergence to reconcile. All eight authored categories are consumed (the sprint's "suggested
 *     ownership" omits validationPrinciples; it is mapped to selectionRationale so no governance is
 *     orphaned, ahead of the post-W11 audit). Mapping:
 *       experienceCharacter (§8) + creativePrinciples (§9) + decisionFilters (§12) → communicationObjective
 *       behaviouralIdentity (§10) + creativeConstraints (§13) + creativeOpportunities (§14)
 *         + validationPrinciples (§15)                                            → selectionRationale
 *       embodiment (§11)                                                          → relationships
 *   - Reasoning ownership (append-only, never overwrite existing evidence): writes ONLY
 *     communicationObjective / selectionRationale / relationships. NEVER writes role / orderingRationale
 *     / transition (W7 / W6-owned) — carried verbatim.
 *
 * Content shape (G1): the constitution authors no per-category output shape, so DerivedCategory.content
 * is `unknown`. W11 consumes string / string[] content and FAILS LOUD on any other shape — it refuses
 * to invent a shape, synthesize tone, or invent personality. An inert model (null content) enriches
 * nothing → byte-identical. The Experience Character Model is page-scoped, so evidence is uniform.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema; never mutates World A.
 */
import type { AuthoringPlan, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';

/** Caller-supplied expectations the consumed model must satisfy. */
export interface ExperienceConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The append-deltas W11 derives from the experience model and APPENDS into reasoning. */
export interface ExperienceEvidence {
  /** character + principles + decision filters → appended to the communication objective. */
  readonly communicationObjective?: string;
  /** behaviour + constraints + opportunities + validation → appended to the selection rationale. */
  readonly selectionRationale?: string;
  /** embodiment → appended to relationships. */
  readonly relationships?: string;
}

/** The authored experience-character categories (read-only from the World-A schema). */
const EXPERIENCE_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.experienceCharacter.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/**
 * Render a category's `unknown` content into a single evidence string, or undefined when absent.
 * Consumes ONLY string / string[] (of non-empty strings); FAILS LOUD on any other shape — never
 * invents a structure, synthesizes tone, or invents personality (G1). `label` names the category.
 */
function renderContent(content: unknown, label: string): string | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === 'string') {
    if (content.trim() === '') throw new Error(`experience-consumption: ${label} is an empty string (malformed).`);
    return content.trim();
  }
  if (Array.isArray(content)) {
    if (content.length === 0) return undefined;
    return content
      .map((e) => {
        if (typeof e !== 'string' || e.trim() === '') {
          throw new Error(`experience-consumption: ${label} contains a non-string / empty entry (malformed).`);
        }
        return e.trim();
      })
      .join('; ');
  }
  throw new Error(`experience-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
}

/** Validate the model is the immutable, repository-matched, schema-clean Experience Character Model. */
function validateExperienceModel(model: GovernedModel<'experienceCharacter'>, opts: ExperienceConsumptionOpts): void {
  if (!model || typeof model !== 'object') {
    throw new Error('experience-consumption: Experience Character Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'experienceCharacter') {
    throw new Error(`experience-consumption: expected the Experience Character Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('experience-consumption: the Experience Character Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'experienceCharacter'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('experience-consumption: Experience Character Model has no result.');
  }
  const unknown = Object.keys(result).filter((k) => !EXPERIENCE_CATEGORIES.has(k));
  if (unknown.length > 0) {
    throw new Error(`experience-consumption: unknown experience categories: ${unknown.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('experience-consumption: repository mismatch — the Experience Character Model was derived against a different repository.');
  }
}

/** Read a category's content off the (validated) model result. */
function contentOf(model: GovernedModel<'experienceCharacter'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/**
 * Build the behavioural/experiential evidence from a validated model — PURE. Returns the append-deltas
 * W11 owns. An inert model yields `{}` (no enrichment → byte-identical). Fails loud on malformed
 * content (any of the eight authored experience categories).
 */
export function buildExperienceEvidence(model: GovernedModel<'experienceCharacter'>): ExperienceEvidence {
  const character = renderContent(contentOf(model, 'experienceCharacter'), 'experience character');
  const principles = renderContent(contentOf(model, 'creativePrinciples'), 'creative principles');
  const filters = renderContent(contentOf(model, 'decisionFilters'), 'decision filters');
  const behaviour = renderContent(contentOf(model, 'behaviouralIdentity'), 'behavioural identity');
  const constraints = renderContent(contentOf(model, 'creativeConstraints'), 'creative constraints');
  const opportunities = renderContent(contentOf(model, 'creativeOpportunities'), 'creative opportunities');
  const validation = renderContent(contentOf(model, 'validationPrinciples'), 'validation principles');
  const embodiment = renderContent(contentOf(model, 'embodiment'), 'embodiment');

  const objective: string[] = [];
  if (character) objective.push(`Experience character: ${character}`);
  if (principles) objective.push(`Creative principles: ${principles}`);
  if (filters) objective.push(`Decision filters: ${filters}`);

  const selection: string[] = [];
  if (behaviour) selection.push(`Behaviour: ${behaviour}`);
  if (constraints) selection.push(`Constraints: ${constraints}`);
  if (opportunities) selection.push(`Opportunities: ${opportunities}`);
  if (validation) selection.push(`Validation principles: ${validation}`);

  const evidence: { communicationObjective?: string; selectionRationale?: string; relationships?: string } = {};
  if (objective.length > 0) evidence.communicationObjective = objective.join(' · ');
  if (selection.length > 0) evidence.selectionRationale = selection.join(' · ');
  if (embodiment) evidence.relationships = `Embodiment: ${embodiment}`;
  return evidence;
}

/**
 * Merge experience evidence into an item's reasoning — APPEND, never overwrite. Existing content is
 * preserved; W11's evidence is appended to communicationObjective / selectionRationale / relationships.
 * role / orderingRationale / transition are carried verbatim (never written). Returns frozen reasoning.
 */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: ExperienceEvidence): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  const append = (field: 'communicationObjective' | 'selectionRationale' | 'relationships', addition?: string): void => {
    if (!addition) return;
    merged[field] = merged[field] ? `${merged[field]} · ${addition}` : addition;
  };
  append('communicationObjective', evidence.communicationObjective);
  append('selectionRationale', evidence.selectionRationale);
  append('relationships', evidence.relationships);

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`experience-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Experience Character Model into the plan: validate (fail-loud), derive evidence, and
 * AUGMENT every PlanItem's reasoning with behavioural/experiential intent (append-only). Mutates items
 * in place. An inert / empty model enriches nothing → byte-identical. NEVER reorders, never changes
 * selection, never writes role / orderingRationale / transition, never realizes / generates copy /
 * touches HTML.
 */
export function applyExperience(
  plan: AuthoringPlan,
  experienceModel: GovernedModel<'experienceCharacter'>,
  opts: ExperienceConsumptionOpts,
): void {
  validateExperienceModel(experienceModel, opts);
  const evidence = buildExperienceEvidence(experienceModel);
  if (evidence.communicationObjective === undefined && evidence.selectionRationale === undefined && evidence.relationships === undefined) {
    return; // empty model — no enrichment, byte-identical
  }
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
