/**
 * Phase B — Conditioning Model Carrier.
 *
 * Conditioning transports the validated seven-Model set into the immutable Authoring Context,
 * READ-ONLY: it verifies identities + replay + evidence + governance + immutability + repository
 * binding, folds the set identity into the conditioning identity, and deep-freezes. It NEVER
 * interprets, projects, flattens, or transforms a Model. Default-off (no model set) is byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../../src/knowledge/model.js';
import { makeVocabulary } from '../../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../../src/knowledge/graph.js';
import { discover } from '../../../src/knowledge/discovery.js';
import { compose, repositoryIdentity, type CompositionRepository } from '../../../src/knowledge/composition.js';
import { condition, ConditioningError } from '../../../src/knowledge/conditioning.js';
import { runAuthoring, type Author } from '../../../src/knowledge/authoring.js';
import { deriveModels, type DerivationRepository } from '../../../src/knowledge/derivation/deriver.js';
import { defaultScriptedDeriver } from '../../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, type RawBrief, type DerivedModelSet } from '../../../src/knowledge/derivation/models.js';

const SHA = /^sha256:[0-9a-f]{64}$/;

const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};
function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset({ ...base, ...loose }, (loose.identity as any).id);
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}
const assets = [
  asset({ identity: { id: 'canonical::base', title: 'base' }, semantics: { specializes: ['concept:role:base'] }, capabilities: { satisfies: ['serves:base'] } }),
  asset({ identity: { id: 'canonical::hero', title: 'h' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] }, dependencies: { prerequisite: ['canonical::base'] } }),
];
const vocabulary = makeVocabulary({
  concepts: ['concept:role:hero', 'concept:role:base'],
  obligations: ['serves:hero', 'serves:base'],
  owners: ['ds'],
  scopeIdentities: ['offscript'],
});
const composeRepo: CompositionRepository = {
  assets,
  dependencyGraph: buildDependencyGraph(assets),
  semanticGraph: buildSemanticGraph(assets),
};
const repoId = repositoryIdentity(composeRepo);
const plan = compose(discover({ obligations: ['serves:hero'] }, { assets, vocabulary }), composeRepo);
const EXEC = { requestId: 'phase-b' };

const BRIEF: RawBrief = {
  brand: 'Example Brand', oneLiner: 'autonomous workers', audience: 'ops', goals: ['g'],
  mustInclude: ['m'], tone: 't', successCriteria: ['s'], body: 'b',
};
const derRepo: DerivationRepository = { repositoryIdentity: repoId, assetCount: assets.length };

async function makeSet(): Promise<DerivedModelSet> {
  return deriveModels(BRIEF, derRepo, defaultScriptedDeriver());
}

describe('Conditioning carrier — read-only transport', () => {
  it('binds the immutable ModelSet to the Authoring Context unchanged', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    expect(ctx.models).toBeDefined();
    expect(ctx.models!.derivationIdentity).toBe(set.derivationIdentity);
    expect(ctx.models).toEqual(set);
    for (const k of MODEL_KINDS) expect(ctx.models!.models[k].identity).toBe(set.models[k].identity);
  });

  it('deep-freezes the carried ModelSet', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    expect(Object.isFrozen(ctx.models)).toBe(true);
    expect(Object.isFrozen(ctx.models!.models)).toBe(true);
    expect(Object.isFrozen(ctx.models!.models.mechanism.result)).toBe(true);
  });

  it('folds the set identity into the conditioning identity', async () => {
    const set = await makeSet();
    const withModel = condition(plan, composeRepo, EXEC, set);
    const withoutModel = condition(plan, composeRepo, EXEC);
    expect(withModel.conditioningIdentity).not.toBe(withoutModel.conditioningIdentity);
    expect(withModel.conditioningIdentity).toMatch(SHA);
  });

  it('default-off is byte-identical to pre-Phase-B conditioning', () => {
    const a = condition(plan, composeRepo, EXEC);
    const b = condition(plan, composeRepo, EXEC, undefined);
    expect(a.conditioningIdentity).toBe(b.conditioningIdentity);
    expect('models' in a).toBe(false);
    expect(a.models).toBeUndefined();
  });

  it('replays identically (same set ⇒ same conditioning identity)', async () => {
    const set = await makeSet();
    const a = condition(plan, composeRepo, EXEC, set);
    const b = condition(plan, composeRepo, EXEC, await makeSet());
    expect(b.conditioningIdentity).toBe(a.conditioningIdentity);
  });

  it('preserves evidence + governance references on every Model', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    for (const k of MODEL_KINDS) {
      expect(ctx.models!.models[k].evidence.repositoryIdentity).toBe(repoId);
      expect(ctx.models!.models[k].governanceReferences.model.document).toBeTruthy();
    }
  });

  it('Authoring receives the ModelSet untouched (no interpretation)', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    const recorder: Author = {
      name: 'test::recorder',
      author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: null }),
    };
    const ar = await runAuthoring(ctx, recorder);
    expect(ar.context.models).toBeDefined();
    expect(ar.context.models!.derivationIdentity).toBe(set.derivationIdentity);
    expect(ar.context.models).toEqual(set);
  });
});

describe('Conditioning carrier — fail-loud validation (never repair, never infer)', () => {
  it('rejects a repository-identity mismatch', async () => {
    const otherSet = await deriveModels(BRIEF, { repositoryIdentity: 'sha256:' + 'f'.repeat(64), assetCount: 1 }, defaultScriptedDeriver());
    try {
      condition(plan, composeRepo, EXEC, otherSet);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConditioningError);
      expect((e as ConditioningError).code).toBe('MODELSET_REPOSITORY_MISMATCH');
    }
  });

  it('rejects a mutable (non-frozen) ModelSet', async () => {
    const set = await makeSet();
    const mutable = JSON.parse(JSON.stringify(set)) as DerivedModelSet; // identities preserved, but unfrozen
    try {
      condition(plan, composeRepo, EXEC, mutable);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ConditioningError).code).toBe('MODELSET_MUTABLE');
    }
  });

  it('rejects a malformed ModelSet', () => {
    try {
      condition(plan, composeRepo, EXEC, {} as unknown as DerivedModelSet);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ConditioningError).code).toBe('MODELSET_MALFORMED');
    }
  });

  it('rejects a ModelSet whose identity does not replay', async () => {
    const set = await makeSet();
    // Tamper a category's content while keeping the stored identity → replay must catch it.
    const tampered = JSON.parse(JSON.stringify(set)) as DerivedModelSet;
    (tampered.models.mechanism.result.requiredMechanisms as { content: unknown }).content = 'TAMPERED';
    deepFreeze(tampered);
    try {
      condition(plan, composeRepo, EXEC, tampered);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ConditioningError).code).toBe('MODELSET_REPLAY_MISMATCH');
    }
  });
});

// local deep-freeze for the tamper test
function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v as Record<string, unknown>)) deepFreeze(x);
  }
  return v;
}
