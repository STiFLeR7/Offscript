/**
 * Sprint 6 — Authoring Runtime: immutable Authoring Context → immutable Authoring Result.
 *
 * The runtime is deterministic; the only controlled non-determinism is the Author's
 * resolution of the plurality Conditioning preserved. Tests mock the Author (no real
 * models): session lifecycle, plurality recording, evidence preservation, identity
 * generation, immutability, provider abstraction, and the fail-loud validation.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition, type AuthoringContext } from '../../src/knowledge/conditioning.js';
import {
  runAuthoring,
  assembleAuthoringResult,
  AuthoringError,
  type Author,
  type AuthoringResponse,
} from '../../src/knowledge/authoring.js';

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
const heroA = asset({ identity: { id: 'canonical::hero-a', title: 'a' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
const heroB = asset({ identity: { id: 'canonical::hero-b', title: 'b' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
const ctaA = asset({ identity: { id: 'canonical::cta-a', title: 'c' }, semantics: { specializes: ['concept:role:cta'] }, capabilities: { satisfies: ['serves:hero'] } });
const assets = [heroA, heroB, ctaA];
const vocab = makeVocabulary({ concepts: ['concept:role:hero', 'concept:role:cta'], obligations: ['serves:hero'], owners: ['ds'], scopeIdentities: ['offscript'] });
const repo: CompositionRepository = { assets, dependencyGraph: buildDependencyGraph(assets), semanticGraph: buildSemanticGraph(assets) };
function context(): AuthoringContext {
  const plan = compose(discover({ obligations: ['serves:hero'] }, { assets, vocabulary: vocab }), repo);
  return condition(plan, repo, { requestId: 'r-1' });
}

// --- Mocked Authors (no real models) ---
const pickFirst: Author = {
  name: 'mock-first',
  author: (req) => ({
    determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })),
    payload: { kind: 'stub', order: req.context.plan.order },
  }),
};
const pickLast: Author = {
  name: 'mock-last',
  author: (req) => ({
    determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[g.members.length - 1] })),
    payload: null,
  }),
};

describe('runAuthoring — session lifecycle', () => {
  it('produces a result with all three identities + metadata', async () => {
    const r = await runAuthoring(context(), pickFirst);
    expect(r.authoringIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.conditioningIdentity).toBe(context().conditioningIdentity);
    expect(r.repositoryIdentity).toBe(context().repositoryIdentity);
    expect(r.metadata.author).toBe('mock-first');
    expect(r.metadata.runtimeVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('runAuthoring — plurality resolution recording', () => {
  it('records every determination with its originating candidate set + selection', async () => {
    const r = await runAuthoring(context(), pickFirst);
    const hero = r.determinations.find((d) => d.key === 'concept:role:hero')!;
    expect(hero.from).toEqual(['canonical::hero-a', 'canonical::hero-b']); // originating plurality
    expect(hero.selected).toBe('canonical::hero-a');
    expect(r.determinations.map((d) => d.key)).toEqual(context().unresolvedPlurality.map((g) => g.key));
  });
});

describe('runAuthoring — evidence preservation', () => {
  it('carries authoring evidence (obligations + repository identity) unchanged', async () => {
    const ctx = context();
    const r = await runAuthoring(ctx, pickFirst);
    expect(r.evidence.obligations).toEqual(ctx.obligations);
    expect(r.evidence.repositoryIdentity).toBe(ctx.repositoryIdentity);
  });

  it('carries the opaque payload without interpreting it', async () => {
    const r = await runAuthoring(context(), pickFirst);
    expect(r.payload).toEqual({ kind: 'stub', order: context().plan.order });
  });
});

describe('runAuthoring — authoring identity', () => {
  it('is deterministic for the same context + determinations', async () => {
    const ctx = context();
    const a = await runAuthoring(ctx, pickFirst);
    const b = await runAuthoring(ctx, pickFirst);
    expect(b.authoringIdentity).toBe(a.authoringIdentity);
  });

  it('changes when the resolved plurality differs (decision-bearing)', async () => {
    const ctx = context();
    const a = await runAuthoring(ctx, pickFirst);
    const b = await runAuthoring(ctx, pickLast);
    expect(b.authoringIdentity).not.toBe(a.authoringIdentity);
  });

  it('excludes the opaque payload (identity captures decisions, not the artifact)', async () => {
    const ctx = context();
    const a = await runAuthoring(ctx, pickFirst);
    const samePicksDiffPayload: Author = {
      name: 'mock-first',
      author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: { totally: 'different' } }),
    };
    const b = await runAuthoring(ctx, samePicksDiffPayload);
    expect(b.authoringIdentity).toBe(a.authoringIdentity);
  });
});

describe('runAuthoring — immutability', () => {
  it('produces a deeply frozen result', async () => {
    const r = await runAuthoring(context(), pickFirst);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.determinations)).toBe(true);
    expect(Object.isFrozen(r.evidence)).toBe(true);
    expect(() => {
      (r as any).authoringIdentity = 'x';
    }).toThrow();
  });
});

describe('runAuthoring — provider abstraction', () => {
  it('works identically across different Author implementations', async () => {
    const a = await runAuthoring(context(), pickFirst);
    const b = await runAuthoring(context(), pickLast);
    expect(a.metadata.author).toBe('mock-first');
    expect(b.metadata.author).toBe('mock-last');
    // both produce a well-formed result; runtime behavior is provider-independent
    expect(a.determinations).toHaveLength(b.determinations.length);
  });
});

describe('runAuthoring — replay', () => {
  it('assembleAuthoringResult deterministically replays a recorded response', () => {
    const ctx = context();
    const response: AuthoringResponse = { determinations: [{ key: 'concept:role:hero', selected: 'canonical::hero-a' }], payload: { x: 1 } };
    const a = assembleAuthoringResult(ctx, response, 'mock-first');
    const b = assembleAuthoringResult(ctx, response, 'mock-first');
    expect(b.authoringIdentity).toBe(a.authoringIdentity);
  });
});

describe('runAuthoring — fail-loud validation', () => {
  it('rejects a non-immutable / malformed authoring context', async () => {
    const mutable = { ...context() }; // a shallow clone is not frozen
    await expect(runAuthoring(mutable as AuthoringContext, pickFirst)).rejects.toBeInstanceOf(AuthoringError);
  });

  it('fails loud when a preserved plurality is left unresolved', async () => {
    const missing: Author = { name: 'm', author: () => ({ determinations: [], payload: null }) };
    await expect(runAuthoring(context(), missing)).rejects.toMatchObject({ code: 'MISSING_PLURALITY' });
  });

  it('fails loud on a determination for an unknown plurality', async () => {
    const extra: Author = {
      name: 'm',
      author: (req) => ({
        determinations: [
          ...req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })),
          { key: 'concept:role:ghost', selected: 'canonical::nope' },
        ],
        payload: null,
      }),
    };
    await expect(runAuthoring(context(), extra)).rejects.toMatchObject({ code: 'INCONSISTENT_DETERMINATION' });
  });

  it('fails loud on a selection outside the lawful candidate set (evidence mismatch)', async () => {
    const cheat: Author = {
      name: 'm',
      author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: 'canonical::not-a-candidate' })), payload: null }),
    };
    await expect(runAuthoring(context(), cheat)).rejects.toMatchObject({ code: 'EVIDENCE_MISMATCH' });
  });

  it('fails loud on duplicate determinations for one plurality', async () => {
    const dup: Author = {
      name: 'm',
      author: (req) => {
        const g = req.context.unresolvedPlurality[0];
        return { determinations: [{ key: g.key, selected: g.members[0] }, { key: g.key, selected: g.members[0] }, ...req.context.unresolvedPlurality.slice(1).map((x) => ({ key: x.key, selected: x.members[0] }))], payload: null };
      },
    };
    await expect(runAuthoring(context(), dup)).rejects.toMatchObject({ code: 'INCONSISTENT_DETERMINATION' });
  });
});
