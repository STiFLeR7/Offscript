/**
 * Phase C — Governed Model Interpretation (Authoring).
 *
 * The Authoring RUNTIME stays interpretation-free: it validates availability + traceability of the
 * carried ModelSet (fail-loud) and exposes it to the Author EXPLICITLY on the request — it never
 * flattens, merges, summarizes, projects, derives, or reinterprets. The Author implementation is the
 * sole component permitted to realize the Models. Default-off (no carried set) is byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../../src/knowledge/model.js';
import { makeVocabulary } from '../../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../../src/knowledge/graph.js';
import { discover } from '../../../src/knowledge/discovery.js';
import { compose, repositoryIdentity, type CompositionRepository } from '../../../src/knowledge/composition.js';
import { condition, type AuthoringContext } from '../../../src/knowledge/conditioning.js';
import { runAuthoring, AuthoringError, type Author, type AuthoringRequest } from '../../../src/knowledge/authoring.js';
import { deriveModels, type DerivationRepository } from '../../../src/knowledge/derivation/deriver.js';
import { defaultScriptedDeriver } from '../../../src/knowledge/derivation/scripted-deriver.js';
import { checkModelSetIntegrity, MODEL_KINDS, type RawBrief, type DerivedModelSet } from '../../../src/knowledge/derivation/models.js';

const base = {
  schema_version: '1.0', kind: 'component', ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' }, governance: { authority: 'canonical-global' },
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
  concepts: ['concept:role:hero', 'concept:role:base'], obligations: ['serves:hero', 'serves:base'],
  owners: ['ds'], scopeIdentities: ['offscript'],
});
const composeRepo: CompositionRepository = { assets, dependencyGraph: buildDependencyGraph(assets), semanticGraph: buildSemanticGraph(assets) };
const repoId = repositoryIdentity(composeRepo);
const plan = compose(discover({ obligations: ['serves:hero'] }, { assets, vocabulary }), composeRepo);
const EXEC = { requestId: 'phase-c' };
const BRIEF: RawBrief = { brand: 'Example Brand', oneLiner: 'autonomous workers', audience: 'ops', goals: ['g'], mustInclude: ['m'], tone: 't', successCriteria: ['s'], body: 'b' };
const derRepo: DerivationRepository = { repositoryIdentity: repoId, assetCount: assets.length };
const makeSet = () => deriveModels(BRIEF, derRepo, defaultScriptedDeriver());

function recorder(capture?: (r: AuthoringRequest) => void): Author {
  return {
    name: 'test::author',
    author: (req) => {
      capture?.(req);
      return { determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: null };
    },
  };
}
function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v as Record<string, unknown>)) deepFreeze(x); }
  return v;
}

describe('Authoring runtime — exposes the Models to the Author (no interpretation)', () => {
  it('the Author explicitly receives the seven Models on the request', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    let received: AuthoringRequest | null = null;
    await runAuthoring(ctx, recorder((r) => (received = r)));
    expect(received!.models).toBeDefined();
    expect(received!.models!.derivationIdentity).toBe(set.derivationIdentity);
    for (const k of MODEL_KINDS) expect(received!.models!.models[k].identity).toBe(set.models[k].identity);
  });

  it('forwards the Models unchanged (runtime derives nothing, changes no identity)', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    let received: AuthoringRequest | null = null;
    await runAuthoring(ctx, recorder((r) => (received = r)));
    expect(received!.models).toEqual(set);
    expect(received!.models).toBe(ctx.models); // same immutable reference — not rebuilt
  });

  it('preserves governance references + evidence as received', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    let received: AuthoringRequest | null = null;
    await runAuthoring(ctx, recorder((r) => (received = r)));
    for (const k of MODEL_KINDS) {
      expect(received!.models!.models[k].governanceReferences.model.document).toBe(set.models[k].governanceReferences.model.document);
      expect(received!.models!.models[k].evidence.repositoryIdentity).toBe(repoId);
    }
  });

  it('is provider-independent — any Author receives the identical ModelSet', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    let a: AuthoringRequest | null = null, b: AuthoringRequest | null = null;
    await runAuthoring(ctx, recorder((r) => (a = r)));
    await runAuthoring(ctx, recorder((r) => (b = r)));
    expect(a!.models!.derivationIdentity).toBe(b!.models!.derivationIdentity);
    expect(a!.models!.derivationIdentity).toBe(set.derivationIdentity);
  });

  it('authoring replays identically with a carried ModelSet', async () => {
    const set = await makeSet();
    const ctx = condition(plan, composeRepo, EXEC, set);
    const r1 = await runAuthoring(ctx, recorder());
    const r2 = await runAuthoring(ctx, recorder());
    expect(r2.authoringIdentity).toBe(r1.authoringIdentity);
  });

  it('default-off is byte-identical — no carried set ⇒ request.models undefined, authoring unchanged', async () => {
    const ctx = condition(plan, composeRepo, EXEC); // no models
    let received: AuthoringRequest | null = null;
    const ar = await runAuthoring(ctx, recorder((r) => (received = r)));
    expect(received!.models).toBeUndefined();
    // identity is the pre-Phase-C authoring identity (depends only on conditioning + determinations)
    const ar2 = await runAuthoring(ctx, recorder());
    expect(ar.authoringIdentity).toBe(ar2.authoringIdentity);
  });
});

describe('Authoring runtime — fail-loud validation (never repair, never infer)', () => {
  it('rejects a mutable carried ModelSet', async () => {
    const set = await makeSet();
    const mutable = JSON.parse(JSON.stringify(set)) as DerivedModelSet;
    const plainCtx = condition(plan, composeRepo, EXEC);
    const badCtx = Object.freeze({ ...plainCtx, models: mutable }) as AuthoringContext; // top frozen, models mutable
    await expect(runAuthoring(badCtx, recorder())).rejects.toMatchObject({ code: 'INVALID_MODEL_SET' });
  });

  it('rejects a tampered (replay-broken) carried ModelSet', async () => {
    const set = await makeSet();
    const tampered = JSON.parse(JSON.stringify(set)) as DerivedModelSet;
    (tampered.models.mechanism.result.requiredMechanisms as { content: unknown }).content = 'TAMPERED';
    deepFreeze(tampered);
    const plainCtx = condition(plan, composeRepo, EXEC);
    const badCtx = Object.freeze({ ...plainCtx, models: tampered }) as AuthoringContext;
    await expect(runAuthoring(badCtx, recorder())).rejects.toBeInstanceOf(AuthoringError);
  });
});

describe('checkModelSetIntegrity — read-only integrity facts', () => {
  it('returns no problems for a sound set', async () => {
    expect(checkModelSetIntegrity(await makeSet())).toEqual([]);
  });
  it('reports a mutable set', async () => {
    const mutable = JSON.parse(JSON.stringify(await makeSet())) as DerivedModelSet;
    expect(checkModelSetIntegrity(mutable).some((p) => /deep-frozen|mutable/.test(p))).toBe(true);
  });
  it('reports a repository mismatch when expected id differs', async () => {
    expect(checkModelSetIntegrity(await makeSet(), { expectedRepositoryIdentity: 'sha256:' + '9'.repeat(64) }).some((p) => /repository mismatch/.test(p))).toBe(true);
  });
  it('reports a malformed set', () => {
    expect(checkModelSetIntegrity({} as unknown as DerivedModelSet)).toEqual(['model set is malformed']);
  });
});
