/**
 * Sprint W8 — Communication Model Consumption (Governed HOW).
 *
 * Communication is the first Governance Model that governs HOW every retained section should
 * communicate — Mechanism (W7) answered WHY; Communication answers HOW. The World-B planner consumes
 * ONLY the World-A `communication` Model and AUGMENTS every PlanItem's reasoning with a
 * communicationObjective (the HOW), append-only into selectionRationale + relationships. It describes,
 * guides, justifies, and expresses intent — it NEVER authors copy / headlines / body text, never
 * rewrites prompts / HTML, never reorders (W6's job), never changes the selected section set, never
 * touches components, and never consumes another Model. No model / empty model ⇒ byte-identical.
 *
 * Hard boundaries (per the sprint contract):
 *   - ONLY the `communication` model is consumed — any other kind FAILS LOUD (the six remaining Models
 *     stay transport-only). The function is typed for + checks `kind === 'communication'`.
 *   - Consumes ONLY these authored categories (the instruction's labels → MODEL_SCHEMA.communication):
 *       perceptualEntry (§3) + meaningExpressionSystem (§5) + communicationEnergy (§8) → communicationObjective
 *       beliefFormation (§7)        → selectionRationale (APPEND)
 *       expressionHierarchy (§6)    → relationships (APPEND, only if authored)
 *     communicationArchitecture (§4), creativeAssetIntelligence (§9), experienceConstruction (§10),
 *     visualRhythmSystem (§11), interactionAsCommunication (§12) are NEVER consumed (transport-only) —
 *     they remain valid authored categories, so they do not fail the unknown-category check.
 *   - Reasoning ownership: writes ONLY communicationObjective / selectionRationale / relationships,
 *     APPEND-only (existing content is preserved + appended, never overwritten). It NEVER writes
 *     role / orderingRationale / transition (W7 / W6-owned) — those are preserved verbatim.
 *
 * Content shape (G1): the constitution authors no per-category output shape, so DerivedCategory.content
 * is `unknown`. W8 consumes string / string[] content and FAILS LOUD on any other shape — it refuses
 * to invent a shape or synthesize messaging. An inert model (null content) enriches nothing →
 * byte-identical. The Communication Model is page-scoped, so the evidence is uniform across sections.
 *
 * Read-only World-A consumption: imports the model TYPES + the authored schema; never mutates World A.
 */
import type { AuthoringPlan, SectionReasoning } from '../types.js';
import { REASONING_FIELDS, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import { MODEL_SCHEMA, type GovernedModel } from '../../knowledge/derivation/models.js';

/** Caller-supplied expectations the consumed model must satisfy. */
export interface CommunicationConsumptionOpts {
  /** The repository identity the plan was built against — the model's evidence must match it. */
  readonly repositoryIdentity: string;
}

/** The append-deltas W8 derives from the communication model and APPENDS into reasoning. */
export interface CommunicationEvidence {
  /** how this section communicates (perceptual entry + meaning expression + energy). */
  readonly communicationObjective?: string;
  /** belief-formation logic — appended to the selection rationale. */
  readonly selectionRationale?: string;
  /** expression hierarchy — appended to relationships, only if authored. */
  readonly relationships?: string;
}

/** The authored communication categories (read-only from the World-A schema). */
const COMMUNICATION_CATEGORIES: ReadonlySet<string> = new Set(MODEL_SCHEMA.communication.categories.map((c) => c.key));

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

/**
 * Render a category's `unknown` content into a single evidence string, or undefined when absent.
 * Consumes ONLY string / string[] (of non-empty strings); FAILS LOUD on any other shape — never
 * invents a structure or synthesizes messaging (G1). `label` names the category for clear errors.
 */
function renderContent(content: unknown, label: string): string | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === 'string') {
    if (content.trim() === '') throw new Error(`communication-consumption: ${label} is an empty string (malformed).`);
    return content.trim();
  }
  if (Array.isArray(content)) {
    if (content.length === 0) return undefined;
    return content
      .map((e) => {
        if (typeof e !== 'string' || e.trim() === '') {
          throw new Error(`communication-consumption: ${label} contains a non-string / empty entry (malformed).`);
        }
        return e.trim();
      })
      .join('; ');
  }
  throw new Error(`communication-consumption: ${label} has an unsupported shape (expected string or string[]) — refusing to invent a shape (G1).`);
}

/** Validate the model is the immutable, repository-matched, schema-clean Communication Model. */
function validateCommunicationModel(model: GovernedModel<'communication'>, opts: CommunicationConsumptionOpts): void {
  if (!model || typeof model !== 'object') {
    throw new Error('communication-consumption: Communication Model is missing.');
  }
  if ((model as GovernedModel).kind !== 'communication') {
    throw new Error(`communication-consumption: expected the Communication Model, got '${String((model as GovernedModel).kind)}' — no other Governance Model may be consumed.`);
  }
  if (!deepFrozen(model)) {
    throw new Error('communication-consumption: the Communication Model must be immutable (deep-frozen).');
  }
  const result = (model as GovernedModel<'communication'>).result;
  if (!result || typeof result !== 'object') {
    throw new Error('communication-consumption: Communication Model has no result.');
  }
  const unknown = Object.keys(result).filter((k) => !COMMUNICATION_CATEGORIES.has(k));
  if (unknown.length > 0) {
    throw new Error(`communication-consumption: unknown communication categories: ${unknown.join(', ')}.`);
  }
  if (!model.evidence || model.evidence.repositoryIdentity !== opts.repositoryIdentity) {
    throw new Error('communication-consumption: repository mismatch — the Communication Model was derived against a different repository.');
  }
}

/** Read a category's content off the (validated) model result. */
function contentOf(model: GovernedModel<'communication'>, category: string): unknown {
  const cat = model.result[category];
  return cat ? (cat as { content: unknown }).content : undefined;
}

/**
 * Build the communication evidence from a validated model — PURE. Returns the append-deltas W8 owns.
 * An inert model yields `{}` (no enrichment → byte-identical). Fails loud on malformed content
 * (expression / hierarchy / belief chain / energy).
 */
export function buildCommunicationEvidence(model: GovernedModel<'communication'>): CommunicationEvidence {
  const perceptualEntry = renderContent(contentOf(model, 'perceptualEntry'), 'perceptual entry');
  const meaningExpression = renderContent(contentOf(model, 'meaningExpressionSystem'), 'meaning expression');
  const energy = renderContent(contentOf(model, 'communicationEnergy'), 'communication energy');
  const beliefFormation = renderContent(contentOf(model, 'beliefFormation'), 'belief formation');
  const expressionHierarchy = renderContent(contentOf(model, 'expressionHierarchy'), 'expression hierarchy');

  const how: string[] = [];
  if (perceptualEntry) how.push(`Perceptual entry: ${perceptualEntry}`);
  if (meaningExpression) how.push(`Meaning expression: ${meaningExpression}`);
  if (energy) how.push(`Energy: ${energy}`);

  const evidence: { communicationObjective?: string; selectionRationale?: string; relationships?: string } = {};
  if (how.length > 0) evidence.communicationObjective = how.join(' · ');
  if (beliefFormation) evidence.selectionRationale = `Belief formation: ${beliefFormation}`;
  if (expressionHierarchy) evidence.relationships = `Expression hierarchy: ${expressionHierarchy}`;
  return evidence;
}

/**
 * Merge communication evidence into an item's reasoning — APPEND, never overwrite. Existing content is
 * preserved; W8's evidence is appended to communicationObjective / selectionRationale / relationships.
 * role / orderingRationale / transition are carried verbatim (never written). Returns frozen reasoning.
 */
function mergeReasoning(existing: SectionReasoning | undefined, evidence: CommunicationEvidence): SectionReasoning {
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
    throw new Error(`communication-consumption: produced malformed reasoning — ${problems.join('; ')}.`);
  }
  return freezeReasoning(merged as SectionReasoning);
}

/**
 * Consume the Communication Model into the plan: validate (fail-loud), derive evidence, and AUGMENT
 * every PlanItem's reasoning with the communication HOW (append-only). Mutates items in place. An
 * inert / empty model enriches nothing → byte-identical. NEVER reorders, never changes selection,
 * never writes role / orderingRationale / transition, never authors copy or touches HTML.
 */
export function applyCommunication(
  plan: AuthoringPlan,
  communicationModel: GovernedModel<'communication'>,
  opts: CommunicationConsumptionOpts,
): void {
  validateCommunicationModel(communicationModel, opts);
  const evidence = buildCommunicationEvidence(communicationModel);
  if (evidence.communicationObjective === undefined && evidence.selectionRationale === undefined && evidence.relationships === undefined) {
    return; // inert model — no enrichment, byte-identical
  }
  for (const item of plan.items) {
    item.reasoning = mergeReasoning(item.reasoning, evidence);
  }
}
