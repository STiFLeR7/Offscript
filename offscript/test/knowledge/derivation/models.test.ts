/**
 * Sprint X — Governed Model Derivation (Phase A): the schema registry + envelope.
 *
 * The constitution IS the schema. These tests pin each Model kind's result keys to the
 * LITERAL authored categories of its governing constitution (drift-proof), and prove the
 * immutable, identity-stamped, serializable envelope assembles + validates fail-loud.
 */
import { describe, it, expect } from 'vitest';
import {
  MODEL_KINDS,
  MODEL_SCHEMA,
  DERIVATION_LAYER_VERSION,
  assembleModel,
  assembleModelSet,
  DerivationError,
  type ModelKind,
  type ModelDraft,
  type DerivationInputs,
} from '../../../src/knowledge/derivation/models.js';

const SHA = /^sha256:[0-9a-f]{64}$/;

// The literal authored categories of each constitution — the governance schema, transcribed.
// If MODEL_SCHEMA drifts from governance, this table fails. (No omission, no invention.)
const GOVERNANCE: Record<ModelKind, { document: string; categories: readonly string[] }> = {
  communication: {
    document: 'COMMUNICATION_AND_PERCEPTION_SYSTEM.md',
    categories: [
      'perceptualEntry', 'communicationArchitecture', 'meaningExpressionSystem',
      'expressionHierarchy', 'beliefFormation', 'communicationEnergy',
      'creativeAssetIntelligence', 'experienceConstruction', 'visualRhythmSystem',
      'interactionAsCommunication',
    ],
  },
  information: {
    document: 'INFORMATION_ARCHITECTURE.md',
    categories: [
      'informationDomains', 'informationRelationships', 'informationDependencies',
      'informationClusters', 'informationPriorities', 'completenessModel',
    ],
  },
  progression: {
    document: 'PAGE_STRUCTURE.md',
    categories: ['progressionUnits', 'encounterSequence', 'transitionLogic', 'progressionObjectives'],
  },
  spatial: {
    document: 'SECTION_LAYOUT.md',
    categories: [
      'spatialAllocation', 'spatialRelationships', 'containment', 'density',
      'readingFlow', 'spatialHierarchy', 'composition',
    ],
  },
  mechanism: {
    document: 'COMPONENT_SYSTEM.md',
    categories: [
      'requiredMechanisms', 'purposes', 'responsibilities', 'relationships',
      'orchestration', 'dependencies', 'composition', 'hierarchy',
    ],
  },
  visual: {
    document: 'VISUAL_LANGUAGE.md',
    categories: [
      'perceivedImportanceAndStanding', 'perceivedDistinction',
      'perceivedRelationshipsAndGrouping', 'perceivedContinuity', 'perceivedAffordance',
      'motionPerception', 'iconographyPerception', 'illustrationPerception',
    ],
  },
  experienceCharacter: {
    document: 'BRAND_EXPRESSION.md',
    categories: [
      'experienceCharacter', 'creativePrinciples', 'behaviouralIdentity', 'embodiment',
      'decisionFilters', 'creativeConstraints', 'creativeOpportunities', 'validationPrinciples',
    ],
  },
};

const INPUTS: DerivationInputs = {
  briefIdentity: 'sha256:' + 'a'.repeat(64),
  repositoryIdentity: 'sha256:' + 'b'.repeat(64),
  assetCount: 96,
  governanceDocuments: Object.values(GOVERNANCE).map((g) => g.document),
};

/** Build a schema-complete draft for a kind, content = a marker per category. */
function fullDraft(kind: ModelKind, mark: (k: string) => unknown = (k) => `content:${k}`): ModelDraft {
  const categories: Record<string, unknown> = {};
  for (const c of MODEL_SCHEMA[kind].categories) categories[c.key] = mark(c.key);
  return { kind, categories, rationale: `derived ${kind}` };
}

describe('MODEL_SCHEMA — the constitution is the schema', () => {
  it('declares exactly the seven Models', () => {
    expect([...MODEL_KINDS].sort()).toEqual(
      ['communication', 'experienceCharacter', 'information', 'mechanism', 'progression', 'spatial', 'visual'],
    );
    expect(Object.keys(MODEL_SCHEMA).sort()).toEqual([...MODEL_KINDS].sort());
  });

  for (const kind of Object.keys(GOVERNANCE) as ModelKind[]) {
    it(`${kind}: result keys == the literal authored categories (none omitted, none invented)`, () => {
      const keys = MODEL_SCHEMA[kind].categories.map((c) => c.key);
      expect(keys).toEqual(GOVERNANCE[kind].categories); // order + membership exact
    });
    it(`${kind}: every category cites its governing constitution`, () => {
      expect(MODEL_SCHEMA[kind].model.document).toBe(GOVERNANCE[kind].document);
      for (const c of MODEL_SCHEMA[kind].categories) {
        expect(c.ref.document).toBe(GOVERNANCE[kind].document);
        expect(c.ref.section).toMatch(/§/);
      }
    });
  }

  it('the seven result shapes are genuinely distinct (no merge)', () => {
    const shapes = MODEL_KINDS.map((k) => MODEL_SCHEMA[k].categories.map((c) => c.key).join(','));
    expect(new Set(shapes).size).toBe(MODEL_KINDS.length);
  });
});

describe('assembleModel — immutable, evidence-carrying, identity-stamped', () => {
  it('assembles a conforming Model from a complete draft', () => {
    const m = assembleModel(fullDraft('mechanism'), INPUTS);
    expect(m.kind).toBe('mechanism');
    expect(Object.keys(m.result).sort()).toEqual([...GOVERNANCE.mechanism.categories].sort());
    // each category carries content + a category-level governance reference
    expect(m.result.requiredMechanisms.content).toBe('content:requiredMechanisms');
    expect(m.result.requiredMechanisms.governanceRef.document).toBe('COMPONENT_SYSTEM.md');
    expect(m.governanceReferences.model.document).toBe('COMPONENT_SYSTEM.md');
    expect(m.evidence.repositoryIdentity).toBe(INPUTS.repositoryIdentity);
    expect(m.evidence.briefIdentity).toBe(INPUTS.briefIdentity);
    expect(m.evidence.assetCount).toBe(96);
    expect(m.rationale).toBe('derived mechanism');
    expect(m.identity).toMatch(SHA);
    expect(m.metadata.layerVersion).toBe(DERIVATION_LAYER_VERSION);
    expect(m.metadata.categoryCount).toBe(GOVERNANCE.mechanism.categories.length);
  });

  it('is deep-frozen (immutable state)', () => {
    const m = assembleModel(fullDraft('progression'), INPUTS);
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.result)).toBe(true);
    expect(Object.isFrozen(m.result.progressionUnits)).toBe(true);
  });

  it('identity is deterministic and content-sensitive', () => {
    const a = assembleModel(fullDraft('spatial'), INPUTS);
    const b = assembleModel(fullDraft('spatial'), INPUTS);
    expect(a.identity).toBe(b.identity);
    const c = assembleModel(fullDraft('spatial', (k) => `OTHER:${k}`), INPUTS);
    expect(c.identity).not.toBe(a.identity);
  });

  it('rejects a draft missing an authored category (fail-loud)', () => {
    const d = fullDraft('information');
    delete (d.categories as Record<string, unknown>).completenessModel;
    try {
      assembleModel(d, INPUTS);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DerivationError);
      expect((e as DerivationError).code).toBe('MISSING_CATEGORY');
    }
  });

  it('rejects a draft with an invented category (fail-loud)', () => {
    const d = fullDraft('information');
    (d.categories as Record<string, unknown>).inventedThing = 'nope';
    try {
      assembleModel(d, INPUTS);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DerivationError);
      expect((e as DerivationError).code).toBe('UNKNOWN_CATEGORY');
    }
  });

  it('serializes losslessly (independently serializable)', () => {
    const m = assembleModel(fullDraft('visual'), INPUTS);
    const round = JSON.parse(JSON.stringify(m));
    expect(round).toEqual(m);
  });
});

describe('assembleModelSet — the seven Models as one artifact', () => {
  it('assembles all seven with a content-hash set identity', () => {
    const drafts = MODEL_KINDS.map((k) => fullDraft(k));
    const set = assembleModelSet(drafts, INPUTS);
    expect(Object.keys(set.models).sort()).toEqual([...MODEL_KINDS].sort());
    expect(set.derivationIdentity).toMatch(SHA);
    expect(Object.isFrozen(set)).toBe(true);
    for (const k of MODEL_KINDS) expect(set.models[k].kind).toBe(k);
  });

  it('rejects a set missing a Model kind (fail-loud)', () => {
    const drafts = MODEL_KINDS.filter((k) => k !== 'visual').map((k) => fullDraft(k));
    try {
      assembleModelSet(drafts, INPUTS);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DerivationError);
      expect((e as DerivationError).code).toBe('MISSING_MODEL');
    }
  });
});
