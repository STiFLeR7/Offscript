/**
 * Sprint W10 — Visual Model Consumption (Governed Perceptual Intent).
 *
 * Visual is the Governance Model that governs HOW each section should be PERCEIVED. Spatial governs
 * spatial intent (W9); Visual governs perception. Visual never realizes. The World-B planner consumes
 * ONLY the World-A `visual` Model and APPEND-only enriches every PlanItem's reasoning with perceptual
 * INTENT. It records / describes / justifies perceptual intent — it NEVER computes layout, generates
 * CSS / animation / icons / illustrations, rewrites HTML, reorders (W6's job), changes the selected
 * section set, overwrites role / orderingRationale / transition, or consumes another Model. No model /
 * empty model ⇒ byte-identical.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `visual` model is consumed — any other kind FAILS LOUD (the six remaining Models stay
 *     transport-only). The function is typed for + checks `kind === 'visual'`.
 *   - Consumes EXACTLY the authored categories (the instruction's labels → MODEL_SCHEMA.visual keys,
 *     §25): hierarchyDominance → perceivedImportanceAndStanding; contrast → perceivedDistinction;
 *     grouping → perceivedRelationshipsAndGrouping; continuity → perceivedContinuity; affordance →
 *     perceivedAffordance; motion → motionPerception; iconography → iconographyPerception;
 *     illustration → illustrationPerception. The instruction's `rhythmBalance` + `clarity` are NOT
 *     authored visual categories (rhythm is Communication's visualRhythmSystem; clarity is unauthored)
 *     — per "consume exactly the authored categories, do not invent any", they are NOT consumed.
 *   - Reasoning ownership (append-only, never overwrite existing evidence):
 *       hierarchyDominance + contrast            → selectionRationale (append)
 *       grouping + continuity                    → relationships (append)
 *       affordance + motion + iconography + illustration → communicationObjective (append)
 *     It NEVER writes role / orderingRationale / transition (W7 / W6-owned) — carried verbatim.
 *
 * Content shape (G1): the constitution authors no per-category output shape, so DerivedCategory.content
 * is `unknown`. W10 consumes string / string[] content and FAILS LOUD on any other shape — it refuses
 * to invent a shape, synthesize perception, or calculate styling. An inert model (null content)
 * enriches nothing → byte-identical. The Visual Model is page-scoped, so evidence is uniform.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema; never mutates World A.
 */
import type { AuthoringPlan, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';

/** Caller-supplied expectations the consumed model must satisfy. */
export interface VisualConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The append-deltas W10 derives from the visual model and APPENDS into reasoning. */
export interface VisualEvidence {
  /** importance/standing + distinction/contrast → appended to the selection rationale. */
  readonly selectionRationale?: string;
  /** grouping + continuity → appended to relationships. */
  readonly relationships?: string;
  /** affordance + motion + iconography + illustration → appended to the communication objective. */
  readonly communicationObjective?: string;
}

/** The authored visual categories (read-only from the World-A schema). */
const VISUAL_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.visual.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/**
 * Render a category's `unknown` content into a single evidence string, or undefined when absent.
 * Consumes ONLY string / string[] (of non-empty strings); FAILS LOUD on any other shape — never
 * invents a structure, synthesizes perception, or calculates styling (G1). `label` names the category.
 */
function renderContent(content: unknown, label: string): string | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === 'string') {
    if (content.trim() === '') throw new Error(`visual-consumption: ${label} is an empty string (malformed).`);
    return content.trim();
  }
  if (Array.isArray(content)) {
    if (content.length === 0) return undefined;
    return content
      .map((e) => {
        if (typeof e !== 'string' || e.trim() === '') {
          throw new Error(`visual-consumption: ${label} contains a non-string / empty entry (malformed).`);
        }
        return e.trim();
      })
      .join('; ');
  }
  throw new Error(`visual-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
}

/** Validate the model is the immutable, repository-matched, schema-clean Visual Model. */
function validateVisualModel(model: GovernedModel<'visual'>, opts: VisualConsumptionOpts): void {
  if (!model || typeof model !== 'object') {
    throw new Error('visual-consumption: Visual Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'visual') {
    throw new Error(`visual-consumption: expected the Visual Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('visual-consumption: the Visual Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'visual'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('visual-consumption: Visual Model has no result.');
  }
  const unknown = Object.keys(result).filter((k) => !VISUAL_CATEGORIES.has(k));
  if (unknown.length > 0) {
    throw new Error(`visual-consumption: unknown visual categories: ${unknown.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('visual-consumption: repository mismatch — the Visual Model was derived against a different repository.');
  }
}

/** Read a category's content off the (validated) model result. */
function contentOf(model: GovernedModel<'visual'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/**
 * Build the perceptual evidence from a validated model — PURE. Returns the append-deltas W10 owns. An
 * inert model yields `{}` (no enrichment → byte-identical). Fails loud on malformed content (any of the
 * eight authored visual categories).
 */
export function buildVisualEvidence(model: GovernedModel<'visual'>): VisualEvidence {
  const importance = renderContent(contentOf(model, 'perceivedImportanceAndStanding'), 'importance & standing');
  const distinction = renderContent(contentOf(model, 'perceivedDistinction'), 'distinction / contrast');
  const grouping = renderContent(contentOf(model, 'perceivedRelationshipsAndGrouping'), 'grouping');
  const continuity = renderContent(contentOf(model, 'perceivedContinuity'), 'continuity');
  const affordance = renderContent(contentOf(model, 'perceivedAffordance'), 'affordance');
  const motion = renderContent(contentOf(model, 'motionPerception'), 'motion perception');
  const iconography = renderContent(contentOf(model, 'iconographyPerception'), 'iconography perception');
  const illustration = renderContent(contentOf(model, 'illustrationPerception'), 'illustration perception');

  const standing: string[] = [];
  if (importance) standing.push(`Importance & standing: ${importance}`);
  if (distinction) standing.push(`Distinction / contrast: ${distinction}`);

  const grouped: string[] = [];
  if (grouping) grouped.push(`Grouping: ${grouping}`);
  if (continuity) grouped.push(`Continuity: ${continuity}`);

  const perception: string[] = [];
  if (affordance) perception.push(`Affordance: ${affordance}`);
  if (motion) perception.push(`Motion: ${motion}`);
  if (iconography) perception.push(`Iconography: ${iconography}`);
  if (illustration) perception.push(`Illustration: ${illustration}`);

  const evidence: { selectionRationale?: string; relationships?: string; communicationObjective?: string } = {};
  if (standing.length > 0) evidence.selectionRationale = standing.join(' · ');
  if (grouped.length > 0) evidence.relationships = grouped.join(' · ');
  if (perception.length > 0) evidence.communicationObjective = perception.join(' · ');
  return evidence;
}

/**
 * Merge perceptual evidence into an item's reasoning — APPEND, never overwrite. Existing content is
 * preserved; W10's evidence is appended to selectionRationale / relationships / communicationObjective.
 * role / orderingRationale / transition are carried verbatim (never written). Returns frozen reasoning.
 */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: VisualEvidence): SectionReasoning {
  const merged: Record<string, string> = {};
  if (existing) {
    for (const f of REASONING_FIELDS) {
      const v = existing[f];
      if (typeof v === 'string' && v.trim() !== '') merged[f] = v;
    }
  }
  const append = (field: 'selectionRationale' | 'relationships' | 'communicationObjective', addition?: string): void => {
    if (!addition) return;
    merged[field] = merged[field] ? `${merged[field]} · ${addition}` : addition;
  };
  append('selectionRationale', evidence.selectionRationale);
  append('relationships', evidence.relationships);
  append('communicationObjective', evidence.communicationObjective);

  const problems = validateReasoning(merged as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`visual-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Visual Model into the plan: validate (fail-loud), derive evidence, and AUGMENT every
 * PlanItem's reasoning with perceptual intent (append-only). Mutates items in place. An inert / empty
 * model enriches nothing → byte-identical. NEVER reorders, never changes selection, never writes
 * role / orderingRationale / transition, never generates CSS / animation / icons / illustrations,
 * never touches HTML.
 */
export function applyVisual(
  plan: AuthoringPlan,
  visualModel: GovernedModel<'visual'>,
  opts: VisualConsumptionOpts,
): void {
  validateVisualModel(visualModel, opts);
  const evidence = buildVisualEvidence(visualModel);
  if (evidence.selectionRationale === undefined && evidence.relationships === undefined && evidence.communicationObjective === undefined) {
    return; // empty model — no enrichment, byte-identical
  }
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
