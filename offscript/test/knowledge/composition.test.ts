/**
 * Sprint 4 — Composition Engine: Discovery Result → deterministic, replayable plan.
 *
 * Disk-free coverage of grouping (by authored specializes), dependency expansion +
 * ordering (authored prerequisite/lineage), plurality preservation, determinism/replay,
 * and the fail-loud cases (cyclic / missing / impossible). Happy paths drive the real
 * Discovery→Composition seam; defensive cases hand-build graphs the builder would reject.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph, type GraphArtifact } from '../../src/knowledge/graph.js';
import { discover, type DiscoveryResult } from '../../src/knowledge/discovery.js';
import {
  compose,
  compositionDigest,
  CompositionError,
  type CompositionRepository,
} from '../../src/knowledge/composition.js';

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

const baseTokens = asset({ identity: { id: 'canonical::base-tokens', title: 'base' } });
const heroA = asset({
  identity: { id: 'canonical::hero-a', title: 'hero-a' },
  semantics: { specializes: ['concept:role:hero'] },
  capabilities: { satisfies: ['serves:hero'] },
  dependencies: { prerequisite: ['canonical::base-tokens'] },
});
const heroB = asset({
  identity: { id: 'canonical::hero-b', title: 'hero-b' },
  semantics: { specializes: ['concept:role:hero'] },
  capabilities: { satisfies: ['serves:hero'] },
});
const ctaA = asset({
  identity: { id: 'canonical::cta-a', title: 'cta-a' },
  semantics: { specializes: ['concept:role:cta'] },
  capabilities: { satisfies: ['serves:hero'] },
});

const assets = [baseTokens, heroA, heroB, ctaA];
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
const disco = (obligations: string[]): DiscoveryResult =>
  discover({ obligations }, { assets, vocabulary: vocab });

describe('compose — grouping + plurality', () => {
  it('groups candidates by authored specializes relationship, preserving plurality', () => {
    const plan = compose(disco(['serves:hero']), repo);
    const byKey = Object.fromEntries(plan.groups.map((g) => [g.key, g.members]));
    expect(byKey['concept:role:hero']).toEqual(['canonical::hero-a', 'canonical::hero-b']); // plurality kept
    expect(byKey['concept:role:cta']).toEqual(['canonical::cta-a']);
  });

  it('records groups with >1 lawful member as unresolved plurality (never collapsed)', () => {
    const plan = compose(disco(['serves:hero']), repo);
    expect(plan.unresolvedPlurality.map((g) => g.key)).toEqual(['concept:role:hero']);
  });

  it('preserves the explicit obligations from discovery', () => {
    const plan = compose(disco(['serves:hero']), repo);
    expect(plan.obligations.map((o) => o.token)).toEqual(['serves:hero']);
  });
});

describe('compose — dependency expansion + ordering', () => {
  it('expands authored prerequisites and orders dependency-before-dependent', () => {
    const plan = compose(disco(['serves:hero']), repo);
    // base-tokens is pulled in (hero-a requires it) and ordered before hero-a.
    expect(plan.order).toContain('canonical::base-tokens');
    expect(plan.order.indexOf('canonical::base-tokens')).toBeLessThan(plan.order.indexOf('canonical::hero-a'));
    const baseUnit = plan.units.find((u) => u.id === 'canonical::base-tokens')!;
    expect(baseUnit.requires).toEqual([]);
    expect(plan.units.find((u) => u.id === 'canonical::hero-a')!.requires).toEqual(['canonical::base-tokens']);
  });

  it('order is a deterministic, total topological order of every plan asset', () => {
    const plan = compose(disco(['serves:hero']), repo);
    expect(plan.order).toEqual([
      'canonical::base-tokens',
      'canonical::cta-a',
      'canonical::hero-a',
      'canonical::hero-b',
    ]);
  });
});

describe('compose — determinism + replay', () => {
  it('same discovery + repo → identical plan digest', () => {
    const a = compose(disco(['serves:hero']), repo);
    const b = compose(disco(['serves:hero']), repo);
    expect(compositionDigest(b)).toBe(compositionDigest(a));
  });

  it('is order-independent of asset traversal', () => {
    const shuffled = repoOf([ctaA, heroB, baseTokens, heroA]);
    const a = compose(disco(['serves:hero']), repo);
    const b = compose(disco(['serves:hero']), shuffled);
    expect(compositionDigest(b)).toBe(compositionDigest(a));
  });

  it('binds the plan to the repository identity (graph digests)', () => {
    const plan = compose(disco(['serves:hero']), repo);
    expect(plan.repositoryIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('compose — repository evolution', () => {
  it('a new lawful variant joins its group deterministically', () => {
    const heroC = asset({
      identity: { id: 'canonical::hero-c', title: 'hero-c' },
      semantics: { specializes: ['concept:role:hero'] },
      capabilities: { satisfies: ['serves:hero'] },
    });
    const grown = [...assets, heroC];
    const plan = compose(
      discover({ obligations: ['serves:hero'] }, { assets: grown, vocabulary: vocab }),
      repoOf(grown),
    );
    expect(plan.groups.find((g) => g.key === 'concept:role:hero')!.members).toEqual([
      'canonical::hero-a',
      'canonical::hero-b',
      'canonical::hero-c',
    ]);
  });
});

describe('compose — fail-loud', () => {
  // Hand-built artifacts the builder would reject, to prove Composition's own guards.
  const minimalDiscovery = (ids: string[]): DiscoveryResult => ({
    intent: ['serves:hero'],
    resolvedObligations: [{ token: 'serves:hero', kind: 'obligation', satisfiers: ids }],
    candidates: ids.map((id) => ({ id, satisfies: ['serves:hero'], specializes: ['concept:role:hero'] })),
    constraints: [],
    unresolvedObligations: [],
    evidence: { assetCount: ids.length, obligationCount: 1, candidateCount: ids.length },
  });

  it('fails loud on a cyclic dependency', () => {
    const a = asset({ identity: { id: 'canonical::x', title: 'x' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
    const b = asset({ identity: { id: 'canonical::y', title: 'y' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
    const cyclic: GraphArtifact = {
      name: 'dependency-graph',
      nodes: [{ id: 'canonical::x', type: 'asset' }, { id: 'canonical::y', type: 'asset' }],
      edges: [
        { source: 'canonical::x', kind: 'prerequisite', target: 'canonical::y' },
        { source: 'canonical::y', kind: 'prerequisite', target: 'canonical::x' },
      ],
    };
    const cyclicRepo: CompositionRepository = { assets: [a, b], dependencyGraph: cyclic, semanticGraph: buildSemanticGraph([a, b]) };
    expect(() => compose(minimalDiscovery(['canonical::x', 'canonical::y']), cyclicRepo)).toThrow(CompositionError);
  });

  it('fails loud on a missing dependency target', () => {
    const a = asset({ identity: { id: 'canonical::x', title: 'x' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
    const dangling: GraphArtifact = {
      name: 'dependency-graph',
      nodes: [{ id: 'canonical::x', type: 'asset' }],
      edges: [{ source: 'canonical::x', kind: 'prerequisite', target: 'canonical::ghost' }],
    };
    const danglingRepo: CompositionRepository = { assets: [a], dependencyGraph: dangling, semanticGraph: buildSemanticGraph([a]) };
    try {
      compose(minimalDiscovery(['canonical::x']), danglingRepo);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CompositionError);
      expect((e as CompositionError).code).toBe('MISSING_DEPENDENCY');
    }
  });

  it('fails loud when a discovery candidate is absent from the repository', () => {
    expect(() => compose(minimalDiscovery(['canonical::not-loaded']), repo)).toThrow(CompositionError);
  });
});
