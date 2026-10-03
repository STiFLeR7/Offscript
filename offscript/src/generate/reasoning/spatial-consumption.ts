/**
 * Sprint W9 — Spatial Model Consumption (Governed Spatial Intent).
 *
 * Spatial is the first Governance Model that governs HOW selected sections should occupy SPACE.
 * Information governs structure (W5), Progression order (W6), Mechanism purpose (W7), Communication
 * expression (W8); Spatial governs spatial INTENT. The World-B planner consumes ONLY the World-A
 * `spatial` Model and APPEND-only enriches every PlanItem's reasoning. It describes / records /
 * justifies / carries layout INTENT — it NEVER computes layout, assigns a grid, calculates spacing,
 * emits design tokens / CSS, emits HTML, reorders (W6's job), changes the selected section set,
 * overwrites role / orderingRationale / transition, or consumes another Model. No model / no-op model
 * ⇒ byte-identical.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `spatial` model is consumed — any other kind FAILS LOUD (the six remaining Models stay
 *     transport-only). The function is typed for + checks `kind === 'spatial'`.
 *   - Consumes the authored categories (the instruction's labels → MODEL_SCHEMA.spatial keys, §17):
 *       allocation → spatialAllocation; hierarchy → spatialHierarchy; the rest match verbatim
 *       (spatialRelationships, containment, density, readingFlow, composition). All seven authored
 *       spatial categories are consumed. Realization is downstream and never consumed.
 *   - Reasoning ownership (append-only, never overwrite existing evidence):
 *       allocation + density + readingFlow                → communicationObjective (append)
 *       containment + spatialRelationships + composition  → relationships (append)
 *       hierarchy                                         → selectionRationale (append)
 *     It NEVER writes role / orderingRationale / transition (W7 / W6-owned) — carried verbatim.
 *
 * Content shape (G1): the constitution authors no per-category output shape, so DerivedCategory.content
 * is `unknown`. W9 consumes string / string[] content and FAILS LOUD on any other shape — it refuses
 * to invent a shape, calculate layout, or synthesize spacing. An inert model (null content) enriches
 * nothing → byte-identical. The Spatial Model is page-scoped, so the evidence is uniform across sections.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema; never mutates World A.
 */
import type { AuthoringPlan, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';

/** Caller-supplied expectations the consumed model must satisfy. */
export interface SpatialConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The append-deltas W9 derives from the spatial model and APPENDS into reasoning. */
export interface SpatialEvidence {
  /** allocation + density + reading flow → how the section occupies space. */
  readonly communicationObjective?: string;
  /** containment + spatial relationships + composition → spatial relationship evidence. */
  readonly relationships?: string;
  /** spatial hierarchy → appended to the selection rationale. */
  readonly selectionRationale?: string;
}

/** The authored spatial categories (read-only from the World-A schema). */
const SPATIAL_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.spatial.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/**
 * Render a category's `unknown` content into a single evidence string, or undefined when absent.
 * Consumes ONLY string / string[] (of non-empty strings); FAILS LOUD on any other shape — never
 * invents a structure, calculates layout, or synthesizes spacing (G1). `label` names the category.
 */
function renderContent(content: unknown, label: string): string | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === 'string') {
    if (content.trim() === '') throw new Error(`spatial-consumption: ${label} is an empty string (malformed).`);
    return content.trim();
  }
  if (Array.isArray(content)) {
    if (content.length === 0) return undefined;
    return content
      .map((e) => {
        if (typeof e !== 'string' || e.trim() === '') {
          throw new Error(`spatial-consumption: ${label} contains a non-string / empty entry (malformed).`);
        }
        return e.trim();
      })
      .join('; ');
  }
  throw new Error(`spatial-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
}

/** Validate the model is the immutable, repository-matched, schema-clean Spatial Model. */
function validateSpatialModel(model: GovernedModel<'spatial'>, opts: SpatialConsumptionOpts): void {
  if (!model || typeof model !== 'object') {
    throw new Error('spatial-consumption: Spatial Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'spatial') {
    throw new Error(`spatial-consumption: expected the Spatial Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('spatial-consumption: the Spatial Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'spatial'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('spatial-consumption: Spatial Model has no result.');
  }
  const unknown = Object.keys(result).filter((k) => !SPATIAL_CATEGORIES.has(k));
  if (unknown.length > 0) {
    throw new Error(`spatial-consumption: unknown spatial categories: ${unknown.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('spatial-consumption: repository mismatch — the Spatial Model was derived against a different repository.');
  }
}

/** Read a category's content off the (validated) model result. */
function contentOf(model: GovernedModel<'spatial'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/**
 * Build the spatial evidence from a validated model — PURE. Returns the append-deltas W9 owns. An
 * inert model yields `{}` (no enrichment → byte-identical). Fails loud on malformed content
 * (allocation / hierarchy / density / reading flow / containment / relationships / composition).
 */
export function buildSpatialEvidence(model: GovernedModel<'spatial'>): SpatialEvidence {
  const allocation = renderContent(contentOf(model, 'spatialAllocation'), 'spatial allocation');
  const density = renderContent(contentOf(model, 'density'), 'density');
  const readingFlow = renderContent(contentOf(model, 'readingFlow'), 'reading flow');
  const containment = renderContent(contentOf(model, 'containment'), 'containment');
  const relationships = renderContent(contentOf(model, 'spatialRelationships'), 'spatial relationships');
  const composition = renderContent(contentOf(model, 'composition'), 'composition');
  const hierarchy = renderContent(contentOf(model, 'spatialHierarchy'), 'spatial hierarchy');

  const how: string[] = [];
  if (allocation) how.push(`Spatial allocation: ${allocation}`);
  if (density) how.push(`Density: ${density}`);
  if (readingFlow) how.push(`Reading flow: ${readingFlow}`);

  const related: string[] = [];
  if (containment) related.push(`Containment: ${containment}`);
  if (relationships) related.push(`Spatial relationships: ${relationships}`);
  if (composition) related.push(`Composition: ${composition}`);

  const evidence: { communicationObjective?: string; relationships?: string; selectionRationale?: string } = {};
  if (how.length > 0) evidence.communicationObjective = how.join(' · ');
  if (related.length > 0) evidence.relationships = related.join(' · ');
  if (hierarchy) evidence.selectionRationale = `Spatial hierarchy: ${hierarchy}`;
  return evidence;
}

/**
 * Merge spatial evidence into an item's reasoning — APPEND, never overwrite. Existing content is
 * preserved; W9's evidence is appended to communicationObjective / relationships / selectionRationale.
 * role / orderingRationale / transition are carried verbatim (never written). Returns frozen reasoning.
 */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: SpatialEvidence): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  const append = (field: 'communicationObjective' | 'relationships' | 'selectionRationale', addition?: string): void => {
    if (!addition) return;
    merged[field] = merged[field] ? `${merged[field]} · ${addition}` : addition;
  };
  append('communicationObjective', evidence.communicationObjective);
  append('relationships', evidence.relationships);
  append('selectionRationale', evidence.selectionRationale);

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`spatial-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Spatial Model into the plan: validate (fail-loud), derive evidence, and AUGMENT every
 * PlanItem's reasoning with spatial intent (append-only). Mutates items in place. An inert / no-op
 * model enriches nothing → byte-identical. NEVER reorders, never changes selection, never writes
 * role / orderingRationale / transition, never computes layout / spacing / CSS, never touches HTML.
 */
export function applySpatial(
  plan: AuthoringPlan,
  spatialModel: GovernedModel<'spatial'>,
  opts: SpatialConsumptionOpts,
): void {
  validateSpatialModel(spatialModel, opts);
  const evidence = buildSpatialEvidence(spatialModel);
  if (evidence.communicationObjective === undefined && evidence.relationships === undefined && evidence.selectionRationale === undefined) {
    return; // no-op model — no enrichment, byte-identical
  }
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
