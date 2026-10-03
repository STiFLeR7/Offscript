/**
 * Sprint X — Governed Model Derivation (Phase A): the seven Models as first-class artifacts.
 *
 * THE CONSTITUTION IS THE SCHEMA. Each derived Governance Model's `result` is keyed by the
 * LITERAL authored categories of its governing constitution — seven different result shapes,
 * never a generic schema, never shared invented fields, never collapsed abstractions. The
 * registry `MODEL_SCHEMA` is the single source of truth; it transcribes each constitution's own
 * "§N — The output of …" enumeration (Communication, which authors no single output section,
 * anchors to its governing chapters §3–§12).
 *
 * This module owns the immutable envelope, governance references (model- and category-level),
 * evidence, identity (content hash), serialization, and fail-loud validation. It performs NO
 * reasoning and reads NO constitution text — the derived content is supplied by an injected
 * `ModelDeriver` (see deriver.ts). Governance references are document+section CITATIONS: the
 * constitutions are authored in governance.zip and are not yet materialized into the repository
 * (resources/governance is empty), so a citation is the correct, sufficient reference form.
 *
 * Phase A boundary: these Models are derived and verified, NEVER consumed downstream. No
 * projection into DiscoveryIntent. No obligation mapping.
 */
import { digest } from '../digest.js';

export const DERIVATION_LAYER_VERSION = '0.1.0';

/** The seven derived Governance Models. */
export type ModelKind =
  | 'communication'
  | 'information'
  | 'progression'
  | 'spatial'
  | 'mechanism'
  | 'visual'
  | 'experienceCharacter';

export const MODEL_KINDS: readonly ModelKind[] = [
  'communication',
  'information',
  'progression',
  'spatial',
  'mechanism',
  'visual',
  'experienceCharacter',
] as const;

/** A traceable citation to authored governance — the constitution document + section. */
export interface GovernanceRef {
  /** Constitution filename, e.g. 'COMPONENT_SYSTEM.md'. */
  readonly document: string;
  /** The output/anchor section, e.g. '§23'. */
  readonly section: string;
  /** Optional finer origin of an individual category, e.g. '§9'. */
  readonly authoredAt?: string;
}

/** A schema entry: an authored category key + the governance it traces to. */
export interface CategorySchema {
  readonly key: string;
  readonly ref: GovernanceRef;
}

/** The constitutional schema for one Model kind. */
export interface ModelSchema {
  readonly kind: ModelKind;
  /** Model-level citation (the constitution as a whole / its output section). */
  readonly model: GovernanceRef;
  /** The literal authored categories, in authored order. */
  readonly categories: readonly CategorySchema[];
}

// --- helpers to keep the registry literal + auditable ---
function ref(document: string, section: string, authoredAt?: string): GovernanceRef {
  return authoredAt ? { document, section, authoredAt } : { document, section };
}
function cats(document: string, section: string, entries: readonly (readonly [string, string?])[]): CategorySchema[] {
  return entries.map(([key, authoredAt]) => ({ key, ref: ref(document, section, authoredAt) }));
}

const COMMUNICATION = 'COMMUNICATION_AND_PERCEPTION_SYSTEM.md';
const INFORMATION = 'INFORMATION_ARCHITECTURE.md';
const PROGRESSION = 'PAGE_STRUCTURE.md';
const SPATIAL = 'SECTION_LAYOUT.md';
const MECHANISM = 'COMPONENT_SYSTEM.md';
const VISUAL = 'VISUAL_LANGUAGE.md';
const BRAND = 'BRAND_EXPRESSION.md';

/**
 * THE SCHEMA. Each category key is a constitution's own authored category; the section refs cite
 * the authoring location. Do not simplify, merge, reinterpret, or invent — verification proves
 * every authored category is present, none omitted, none invented.
 */
export const MODEL_SCHEMA: { readonly [K in ModelKind]: ModelSchema } = {
  // Communication & Perception — the Transformation Constitution. No single "output" section;
  // its governed output is produced by the authored chapters §3–§12.
  communication: {
    kind: 'communication',
    model: ref(COMMUNICATION, '§15', '§2'),
    categories: cats(COMMUNICATION, '§3', [
      ['perceptualEntry', '§3'],
      ['communicationArchitecture', '§4'],
      ['meaningExpressionSystem', '§5'],
      ['expressionHierarchy', '§6'],
      ['beliefFormation', '§7'],
      ['communicationEnergy', '§8'],
      ['creativeAssetIntelligence', '§9'],
      ['experienceConstruction', '§10'],
      ['visualRhythmSystem', '§11'],
      ['interactionAsCommunication', '§12'],
    ]),
  },
  // Information Architecture — the Information Model (§13 "The output … comprises:").
  information: {
    kind: 'information',
    model: ref(INFORMATION, '§13'),
    categories: cats(INFORMATION, '§13', [
      ['informationDomains'],
      ['informationRelationships'],
      ['informationDependencies'],
      ['informationClusters'],
      ['informationPriorities'],
      ['completenessModel'],
    ]),
  },
  // Page Structure — the Progression Model (§12 "The output … comprises:").
  progression: {
    kind: 'progression',
    model: ref(PROGRESSION, '§12'),
    categories: cats(PROGRESSION, '§12', [
      ['progressionUnits'],
      ['encounterSequence'],
      ['transitionLogic'],
      ['progressionObjectives'],
    ]),
  },
  // Section Layout — the Spatial Model (§17 "The output … comprises:").
  spatial: {
    kind: 'spatial',
    model: ref(SPATIAL, '§17'),
    categories: cats(SPATIAL, '§17', [
      ['spatialAllocation'],
      ['spatialRelationships'],
      ['containment'],
      ['density'],
      ['readingFlow'],
      ['spatialHierarchy'],
      ['composition'],
    ]),
  },
  // Component System — the Mechanism Model (§23 output enumeration; sub-sections cited per category).
  mechanism: {
    kind: 'mechanism',
    model: ref(MECHANISM, '§23'),
    categories: cats(MECHANISM, '§23', [
      ['requiredMechanisms', '§6'],
      ['purposes', '§9'],
      ['responsibilities', '§14'],
      ['relationships', '§11'],
      ['orchestration', '§12'],
      ['dependencies', '§15'],
      ['composition', '§13'],
      ['hierarchy', '§10'],
    ]),
  },
  // Visual Language — the Visual Model (§25 output enumeration; sub-sections cited per category).
  visual: {
    kind: 'visual',
    model: ref(VISUAL, '§25'),
    categories: cats(VISUAL, '§25', [
      ['perceivedImportanceAndStanding', '§8'],
      ['perceivedDistinction', '§9'],
      ['perceivedRelationshipsAndGrouping', '§10'],
      ['perceivedContinuity', '§11'],
      ['perceivedAffordance', '§14'],
      ['motionPerception', '§15'],
      ['iconographyPerception', '§16'],
      ['illustrationPerception', '§17'],
    ]),
  },
  // Brand Expression — the Experience Character Model (§21 output enumeration; sub-sections cited).
  experienceCharacter: {
    kind: 'experienceCharacter',
    model: ref(BRAND, '§21'),
    categories: cats(BRAND, '§21', [
      ['experienceCharacter', '§8'],
      ['creativePrinciples', '§9'],
      ['behaviouralIdentity', '§10'],
      ['embodiment', '§11'],
      ['decisionFilters', '§12'],
      ['creativeConstraints', '§13'],
      ['creativeOpportunities', '§14'],
      ['validationPrinciples', '§15'],
    ]),
  },
};

/** The raw, pre-derivation brief the layer consumes (independent of the generate-path Brief). */
export interface RawBrief {
  readonly brand: string;
  readonly oneLiner: string;
  readonly audience: string;
  readonly goals: readonly string[];
  readonly mustInclude: readonly string[];
  readonly tone: string;
  readonly successCriteria: readonly string[];
  readonly body: string;
  /** Optional deliverable track, when known. Metadata in Phase A. */
  readonly track?: string;
}

/** One derived category: its content + the governance it traces to (category-level reference). */
export interface DerivedCategory {
  readonly governanceRef: GovernanceRef;
  /**
   * The derived content for this category. INERT (null) under the scripted double; filled by the
   * injected subagent deriver. The layer never interprets it.
   */
  readonly content: unknown;
}

/** A Model's result — every authored category of its constitution, keyed literally. */
export type ModelResult = { readonly [category: string]: DerivedCategory };

/** Provenance of what the derivation consumed. */
export interface DerivationInputs {
  readonly briefIdentity: string;
  readonly repositoryIdentity: string;
  readonly assetCount: number;
  /** The constitutions consulted (citations). */
  readonly governanceDocuments: readonly string[];
}

/** Traceability record for one Model. */
export interface ModelEvidence {
  readonly briefIdentity: string;
  readonly repositoryIdentity: string;
  readonly assetCount: number;
  readonly governanceReference: GovernanceRef;
}

/** The immutable, evidence-carrying, identity-stamped Model artifact. */
export interface GovernedModel<K extends ModelKind = ModelKind> {
  readonly kind: K;
  readonly governanceReferences: { readonly model: GovernanceRef };
  readonly inputs: DerivationInputs;
  readonly evidence: ModelEvidence;
  readonly rationale: string;
  readonly result: ModelResult;
  readonly identity: string;
  readonly metadata: {
    readonly layerVersion: string;
    readonly deriver: string;
    readonly categoryCount: number;
  };
}

/** The seven Models as one immutable set. */
export interface DerivedModelSet {
  readonly derivationIdentity: string;
  readonly inputs: DerivationInputs;
  readonly models: { readonly [K in ModelKind]: GovernedModel<K> };
  readonly metadata: {
    readonly layerVersion: string;
    readonly deriver: string;
    readonly modelCount: number;
  };
}

/** What a ModelDeriver produces per kind, before the layer wraps it. Raw category content only. */
export interface ModelDraft {
  readonly kind: ModelKind;
  readonly categories: { readonly [category: string]: unknown };
  readonly rationale: string;
}

/** Fail-loud derivation error. */
export class DerivationError extends Error {
  readonly code:
    | 'UNKNOWN_KIND'
    | 'MISSING_CATEGORY'
    | 'UNKNOWN_CATEGORY'
    | 'MISSING_MODEL'
    | 'DUPLICATE_MODEL'
    | 'INVALID_INPUTS'
    | 'INVALID_BRIEF'
    | 'INVALID_DRAFT';
  constructor(code: DerivationError['code'], message: string) {
    super(message);
    this.name = 'DerivationError';
    this.code = code;
  }
}

const SHA = /^sha256:[0-9a-f]{64}$/;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

function validateInputs(inputs: DerivationInputs): void {
  const ok =
    !!inputs &&
    typeof inputs === 'object' &&
    typeof inputs.briefIdentity === 'string' &&
    SHA.test(inputs.briefIdentity) &&
    typeof inputs.repositoryIdentity === 'string' &&
    SHA.test(inputs.repositoryIdentity) &&
    Number.isInteger(inputs.assetCount) &&
    inputs.assetCount >= 0 &&
    Array.isArray(inputs.governanceDocuments);
  if (!ok) {
    throw new DerivationError('INVALID_INPUTS', 'derivation: inputs are invalid (identities must be content hashes).');
  }
}

/**
 * Assemble + validate one Model from a deriver draft — PURE and deterministic.
 * Validates the draft's category set EXACTLY against the constitutional schema (no missing, no
 * extra), attaches category-level governance references, stamps a content-hash identity, and
 * deep-freezes. Reusable for replay (no deriver invocation required).
 */
export function assembleModel(draft: ModelDraft, inputs: DerivationInputs, deriverName = 'unknown'): GovernedModel {
  validateInputs(inputs);
  if (!draft || typeof draft !== 'object' || !draft.categories || typeof draft.categories !== 'object') {
    throw new DerivationError('INVALID_DRAFT', 'derivation: draft is malformed.');
  }
  const schema = MODEL_SCHEMA[draft.kind];
  if (!schema) {
    throw new DerivationError('UNKNOWN_KIND', `derivation: '${draft.kind}' is not one of the seven Models.`);
  }

  const allowed = new Set(schema.categories.map((c) => c.key));
  const provided = Object.keys(draft.categories);
  for (const c of schema.categories) {
    if (!(c.key in draft.categories)) {
      throw new DerivationError(
        'MISSING_CATEGORY',
        `derivation: ${draft.kind} omits authored category '${c.key}' (${c.ref.document} ${c.ref.authoredAt ?? c.ref.section}).`,
      );
    }
  }
  for (const k of provided) {
    if (!allowed.has(k)) {
      throw new DerivationError(
        'UNKNOWN_CATEGORY',
        `derivation: ${draft.kind} invents category '${k}' — not authored by ${schema.model.document}.`,
      );
    }
  }

  // Build the result in authored order; each category carries content + its governance reference.
  const result: Record<string, DerivedCategory> = {};
  for (const c of schema.categories) {
    result[c.key] = { governanceRef: c.ref, content: draft.categories[c.key] };
  }

  const evidence: ModelEvidence = {
    briefIdentity: inputs.briefIdentity,
    repositoryIdentity: inputs.repositoryIdentity,
    assetCount: inputs.assetCount,
    governanceReference: schema.model,
  };

  // Identity captures the derived decisions (kind + per-category content) + the provenance.
  const identity = digest({
    layerVersion: DERIVATION_LAYER_VERSION,
    kind: draft.kind,
    inputs,
    result: schema.categories.map((c) => ({ key: c.key, content: draft.categories[c.key] })),
  });

  const model: GovernedModel = {
    kind: draft.kind,
    governanceReferences: { model: schema.model },
    inputs,
    evidence,
    rationale: typeof draft.rationale === 'string' ? draft.rationale : '',
    result,
    identity,
    metadata: {
      layerVersion: DERIVATION_LAYER_VERSION,
      deriver: deriverName,
      categoryCount: schema.categories.length,
    },
  };
  return deepFreeze(model);
}

/**
 * Assemble + validate the complete seven-Model set from drafts — PURE and deterministic.
 * Requires exactly one draft per Model kind; stamps a set-level content-hash identity over the
 * seven model identities + inputs; deep-freezes.
 */
export function assembleModelSet(
  drafts: readonly ModelDraft[],
  inputs: DerivationInputs,
  deriverName = 'unknown',
): DerivedModelSet {
  validateInputs(inputs);
  const byKind = new Map<ModelKind, ModelDraft>();
  for (const d of drafts) {
    if (!MODEL_SCHEMA[d?.kind]) {
      throw new DerivationError('UNKNOWN_KIND', `derivation: '${d?.kind}' is not one of the seven Models.`);
    }
    if (byKind.has(d.kind)) {
      throw new DerivationError('DUPLICATE_MODEL', `derivation: duplicate draft for '${d.kind}'.`);
    }
    byKind.set(d.kind, d);
  }
  for (const k of MODEL_KINDS) {
    if (!byKind.has(k)) {
      throw new DerivationError('MISSING_MODEL', `derivation: no draft for required Model '${k}'.`);
    }
  }

  const models: Record<ModelKind, GovernedModel> = {} as Record<ModelKind, GovernedModel>;
  for (const k of MODEL_KINDS) {
    models[k] = assembleModel(byKind.get(k)!, inputs, deriverName);
  }

  const derivationIdentity = digest({
    layerVersion: DERIVATION_LAYER_VERSION,
    inputs,
    models: MODEL_KINDS.map((k) => ({ kind: k, identity: models[k].identity })),
  });

  const set: DerivedModelSet = {
    derivationIdentity,
    inputs,
    models: models as DerivedModelSet['models'],
    metadata: {
      layerVersion: DERIVATION_LAYER_VERSION,
      deriver: deriverName,
      modelCount: MODEL_KINDS.length,
    },
  };
  return deepFreeze(set);
}

/** digest of a RawBrief — its content identity (used as inputs.briefIdentity). */
export function briefIdentity(brief: RawBrief): string {
  return digest(brief);
}

/** Reconstruct the deriver drafts from an assembled set (inverse of assembleModel's wrapping). */
function draftsFromSet(set: DerivedModelSet): ModelDraft[] {
  return MODEL_KINDS.map((k) => {
    const m = set.models[k];
    const categories: Record<string, unknown> = {};
    for (const c of MODEL_SCHEMA[k].categories) categories[c.key] = m.result[c.key]?.content;
    return { kind: k, categories, rationale: m.rationale };
  });
}

/**
 * Re-assemble a model set from its OWN contents — a pure, read-only replay. Reproduces every
 * per-model identity + the set identity iff the set is internally consistent and untampered.
 * Used by consumers (e.g. the Conditioning carrier) to PROVE replay without owning the hash recipe.
 */
export function replayModelSet(set: DerivedModelSet): DerivedModelSet {
  return assembleModelSet(draftsFromSet(set), set.inputs, set.metadata.deriver);
}

/** Read-only deep-frozen check. */
function isDeepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isDeepFrozen);
}

/**
 * Read-only integrity check for a carried/received model set — PURE, never repairs, never infers.
 * Returns the list of problems (empty ⇒ sound): all seven Models present, identities are content
 * hashes, governance references (model + category) intact, evidence binds the set inputs, the set is
 * deep-frozen (immutable), optional repository match, and the set replays to its identities.
 * Consumers map a non-empty result to their own fail-loud error (the derivation layer states facts,
 * it does not decide the consumer's error surface).
 */
export function checkModelSetIntegrity(
  models: DerivedModelSet,
  opts: { readonly expectedRepositoryIdentity?: string } = {},
): string[] {
  if (!models || typeof models !== 'object' || typeof models.derivationIdentity !== 'string' || !models.inputs || !models.models) {
    return ['model set is malformed'];
  }
  const problems: string[] = [];
  for (const k of MODEL_KINDS) {
    const m = models.models[k];
    if (!m || m.kind !== k || !m.result) {
      problems.push(`missing/mismatched Model '${k}'`);
      continue;
    }
    if (typeof m.identity !== 'string' || !SHA.test(m.identity)) problems.push(`'${k}' identity is not a content hash`);
    if (!m.governanceReferences?.model?.document) problems.push(`'${k}' missing model governance reference`);
    else for (const cat of Object.keys(m.result)) if (!m.result[cat]?.governanceRef?.document) problems.push(`'${k}.${cat}' missing category governance reference`);
    const ev = m.evidence;
    if (!ev || ev.repositoryIdentity !== models.inputs.repositoryIdentity || ev.briefIdentity !== models.inputs.briefIdentity) problems.push(`'${k}' evidence does not bind the set inputs`);
  }
  if (!SHA.test(models.derivationIdentity)) problems.push('set derivation identity is not a content hash');
  if (!isDeepFrozen(models)) problems.push('model set is not deep-frozen (mutable Model detected)');
  if (opts.expectedRepositoryIdentity && models.inputs.repositoryIdentity !== opts.expectedRepositoryIdentity) {
    problems.push(`repository mismatch: ${models.inputs.repositoryIdentity} ≠ ${opts.expectedRepositoryIdentity}`);
  }
  if (problems.length === 0) {
    try {
      const replayed = replayModelSet(models);
      if (replayed.derivationIdentity !== models.derivationIdentity) problems.push('set does not replay to its derivation identity');
      else for (const k of MODEL_KINDS) if (replayed.models[k].identity !== models.models[k].identity) problems.push(`'${k}' does not replay to its identity`);
    } catch (e) {
      problems.push(`replay failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return problems;
}
