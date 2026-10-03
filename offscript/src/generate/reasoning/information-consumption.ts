/**
 * Sprint W5 — Information Model Consumption (Structural Planning).
 *
 * The FIRST point where the World-B planner consults governed reasoning: it consumes ONLY the
 * World-A `information` Governance Model (the §6 World-A↔World-B bridge in WORLD-B-EVOLUTION made
 * real for one model) and enriches PlanItem.reasoning with information-derived EVIDENCE. It augments
 * planning; it never replaces it.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `information` model is consumed — passing any other kind FAILS LOUD (the six remaining
 *     Models stay transport-only). The function is typed for + checks `kind === 'information'`, so it
 *     structurally cannot read another model.
 *   - It consumes ONLY these categories: informationPriorities, informationDependencies,
 *     informationRelationships, informationClusters, completenessModel. (informationDomains is NOT
 *     consumed.)
 *   - It NEVER reorders sections, changes sequencing, generates reasoning, invokes an LLM, changes
 *     authoring/prompts, or touches HTML. It only WRITES evidence into PlanItem.reasoning's existing
 *     fields (the W1 channel → W2 transport → author request). The website HTML is unchanged because
 *     the scripted author ignores reasoning.
 *   - It NEVER touches orderingRationale / transition (sequencing-adjacent) — only selectionRationale
 *     (priority + coverage) and relationships (dependencies + clusters + relationships).
 *
 * Content shape (G1): the constitutions do not author per-category output shapes, so DerivedCategory
 * .content is `unknown`. W5 consumes string / string[] content and FAILS LOUD on any other shape —
 * it refuses to invent a shape. An inert model (null content) enriches nothing → byte-identical.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema from
 * src/knowledge/derivation/models.ts; it never mutates World A.
 */
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';

/** Caller-supplied expectations the consumed model must satisfy. */
export interface InformationConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The evidence W5 derives from the information model and writes into reasoning. */
export interface InformationEvidence {
  /** priority + coverage → the selection rationale. */
  readonly selectionRationale?: string;
  /** relationships + dependencies + clusters → the relationship evidence. */
  readonly relationships?: string;
}

/** The authored information categories (read-only from the World-A schema). */
const INFORMATION_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.information.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/**
 * Render a category's `unknown` content into a single evidence string, or undefined when absent.
 * Consumes ONLY string / string[] (of non-empty strings); FAILS LOUD on any other shape — never
 * invents a structure (G1). `label` names the category for clear errors.
 */
function renderContent(content: unknown, label: string): string | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === 'string') {
    if (content.trim() === '') throw new Error(`information-consumption: ${label} is an empty string (malformed information evidence).`);
    return content.trim();
  }
  if (Array.isArray(content)) {
    if (content.length === 0) return undefined;
    return content
      .map((e) => {
        if (typeof e !== 'string' || e.trim() === '') {
          throw new Error(`information-consumption: ${label} contains a non-string / empty entry (malformed information evidence).`);
        }
        return e.trim();
      })
      .join('; ');
  }
  throw new Error(`information-consumption: ${label} content has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
}

/** Validate the model is the immutable, repository-matched, schema-clean Information Model. */
function validateInformationModel(model: GovernedModel<'information'>, opts: InformationConsumptionOpts): void {
  if (!model || typeof model !== 'object') {
    throw new Error('information-consumption: Information Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'information') {
    throw new Error(`information-consumption: expected the Information Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('information-consumption: the Information Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'information'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('information-consumption: Information Model has no result.');
  }
  const unknown = Object.keys(result).filter((k) => !INFORMATION_CATEGORIES.has(k));
  if (unknown.length > 0) {
    throw new Error(`information-consumption: unknown information categories: ${unknown.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('information-consumption: repository mismatch — the Information Model was derived against a different repository.');
  }
}

/** Read a category's content off the (validated) model result. */
function contentOf(model: GovernedModel<'information'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/**
 * Build the information evidence from a validated model. PURE; returns only the fields W5 owns
 * (selectionRationale, relationships). An inert model yields `{}` (no enrichment → byte-identical).
 * Fails loud on malformed / broken content (dependencies included).
 */
export function buildInformationEvidence(model: GovernedModel<'information'>): InformationEvidence {
  const priorities = renderContent(contentOf(model, 'informationPriorities'), 'information priorities');
  const coverage = renderContent(contentOf(model, 'completenessModel'), 'completeness observations');
  const dependencies = renderContent(contentOf(model, 'informationDependencies'), 'information dependency');
  const clusters = renderContent(contentOf(model, 'informationClusters'), 'information clusters');
  const relationships = renderContent(contentOf(model, 'informationRelationships'), 'information relationships');

  const selection: string[] = [];
  if (priorities) selection.push(`Information priority: ${priorities}`);
  if (coverage) selection.push(`Coverage: ${coverage}`);

  const related: string[] = [];
  if (relationships) related.push(`Relationships: ${relationships}`);
  if (dependencies) related.push(`Dependencies: ${dependencies}`);
  if (clusters) related.push(`Clusters: ${clusters}`);

  const evidence: { selectionRationale?: string; relationships?: string } = {};
  if (selection.length > 0) evidence.selectionRationale = selection.join(' · ');
  if (related.length > 0) evidence.relationships = related.join(' · ');
  return evidence;
}

/**
 * Merge information evidence into an item's reasoning — APPEND, never overwrite (W13 merge contract).
 * Existing content is preserved; W5's evidence is appended to selectionRationale / relationships after
 * a ` · ` separator (append-to-empty = set). This makes the discipline uniform with W7–W11 so no
 * contribution is dropped under the canonical descent (W13 resolves W12 M1/M2; before W13, W5 was
 * fill-if-empty). It never writes role / orderingRationale / transition. Returns frozen reasoning.
 */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: InformationEvidence): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  const append = (field: 'selectionRationale' | 'relationships', addition?: string): void => {
    if (!addition) return;
    merged[field] = merged[field] ? `${merged[field]} · ${addition}` : addition;
  };
  append('selectionRationale', evidence.selectionRationale);
  append('relationships', evidence.relationships);

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`information-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Information Model into the plan: validate (fail-loud), derive evidence, and enrich each
 * PlanItem.reasoning (augment, never replace). Mutates items in place (consistent with the rest of
 * the planner). An inert / empty model enriches nothing → byte-identical. NEVER reorders.
 */
export function enrichPlanWithInformation(
  plan: AuthoringPlan,
  informationModel: GovernedModel<'information'>,
  opts: InformationConsumptionOpts,
): void {
  validateInformationModel(informationModel, opts);
  const evidence = buildInformationEvidence(informationModel);
  if (evidence.selectionRationale === undefined && evidence.relationships === undefined) {
    return; // inert model — no enrichment, byte-identical
  }
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
