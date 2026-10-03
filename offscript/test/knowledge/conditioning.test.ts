/**
 * Sprint 5 — Conditioning Engine: Composition Plan → immutable Authoring Context.
 *
 * Disk-free coverage of execution binding, context assembly (plan/obligations/plurality/
 * evidence carried unchanged), repository-identity verification, deterministic conditioning,
 * immutability, and the fail-loud cases. Happy paths drive the full Discovery → Composition
 * → Conditioning seam.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionPlan, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition, conditioningDigest, ConditioningError } from '../../src/knowledge/conditioning.js';

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
const vocab = makeVocabulary({
  concepts: ['concept:role:hero', 'concept:role:cta'],
  obligations: ['serves:hero'],
  owners: ['ds'],
  scopeIdentities: ['offscript'],
});
function repoOf(list: NormalizedAsset[]): CompositionRepository {
  return { assets: list, dependencyGraph: buildDependencyGraph(list), semanticGraph: buildSemanticGraph(list) };
}
const repo = repoOf(assets);
const plan = (): CompositionPlan => compose(discover({ obligations: ['serves:hero'] }, { assets, vocabulary: vocab }), repo);
const exec = { requestId: 'req-001', options: { track: 'website', dryRun: true } };

describe('condition — execution binding', () => {
  it('binds runtime execution information', () => {
    const ctx = condition(plan(), repo, exec);
    expect(ctx.execution.requestId).toBe('req-001');
    expect(ctx.execution.options).toEqual({ dryRun: true, track: 'website' });
  });

  it('rejects an empty request id (incomplete conditioning)', () => {
    expect(() => condition(plan(), repo, { requestId: '' })).toThrow(ConditioningError);
  });

  it('rejects a non-scalar option value (no prompts/HTML/model-params may be bound)', () => {
    expect(() => condition(plan(), repo, { requestId: 'r', options: { bad: { nested: 1 } as any } })).toThrow(
      ConditioningError,
    );
  });
});

describe('condition — context assembly (plan authoritative, nothing transformed)', () => {
  const ctx = condition(plan(), repo, exec);

  it('carries the replayable plan unchanged', () => {
    expect(ctx.plan).toEqual(plan());
  });

  it('preserves authored obligations and repository evidence', () => {
    expect(ctx.obligations).toEqual(plan().obligations);
    expect(ctx.evidence.obligations).toEqual(plan().obligations);
    expect(ctx.evidence.assetCount).toBe(repo.assets.length);
    expect(ctx.evidence.candidateCount).toBe(plan().evidence.candidateCount);
  });

  it('preserves unresolved plurality exactly (never resolves/collapses/ranks)', () => {
    expect(ctx.unresolvedPlurality).toEqual(plan().unresolvedPlurality);
    expect(ctx.unresolvedPlurality.map((g) => g.key)).toEqual(['concept:role:hero']);
  });

  it('preserves repository identity and stamps a conditioning identity', () => {
    expect(ctx.repositoryIdentity).toBe(plan().repositoryIdentity);
    expect(ctx.conditioningIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('condition — immutability', () => {
  it('produces a deeply frozen, immutable context', () => {
    const ctx = condition(plan(), repo, exec);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.execution)).toBe(true);
    expect(Object.isFrozen(ctx.plan)).toBe(true);
    expect(Object.isFrozen(ctx.evidence)).toBe(true);
    expect(() => {
      (ctx as any).repositoryIdentity = 'tampered';
    }).toThrow();
  });
});

describe('condition — determinism', () => {
  it('identical plan + repo + runtime config → identical conditioning identity', () => {
    const a = condition(plan(), repo, exec);
    const b = condition(plan(), repo, exec);
    expect(conditioningDigest(b)).toBe(conditioningDigest(a));
    expect(b.conditioningIdentity).toBe(a.conditioningIdentity);
  });

  it('is independent of option key order', () => {
    const a = condition(plan(), repo, { requestId: 'r', options: { a: 1, b: 2 } });
    const b = condition(plan(), repo, { requestId: 'r', options: { b: 2, a: 1 } });
    expect(b.conditioningIdentity).toBe(a.conditioningIdentity);
  });

  it('a different request id yields a different conditioning identity (input-dependent)', () => {
    const a = condition(plan(), repo, { requestId: 'r1' });
    const b = condition(plan(), repo, { requestId: 'r2' });
    expect(b.conditioningIdentity).not.toBe(a.conditioningIdentity);
    expect(b.repositoryIdentity).toBe(a.repositoryIdentity); // repo identity unchanged
  });
});

describe('condition — fail-loud', () => {
  it('fails on an invalid plan (empty order/units)', () => {
    const bad = { ...plan(), order: [], units: [] } as CompositionPlan;
    try {
      condition(bad, repo, exec);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ConditioningError);
      expect((e as ConditioningError).code).toBe('INVALID_PLAN');
    }
  });

  it('fails on a repository identity mismatch (plan composed against a different repo)', () => {
    const otherRepo = repoOf([heroA, heroB]); // different asset set → different graphs → different identity
    try {
      condition(plan(), otherRepo, exec);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ConditioningError);
      expect((e as ConditioningError).code).toBe('REPOSITORY_IDENTITY_MISMATCH');
    }
  });

  it('fails on missing evidence (no obligations)', () => {
    const bad = { ...plan(), obligations: [] } as CompositionPlan;
    try {
      condition(bad, repo, exec);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ConditioningError).code).toBe('MISSING_EVIDENCE');
    }
  });
});
