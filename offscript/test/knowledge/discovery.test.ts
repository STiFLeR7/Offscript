/**
 * Sprint 3 — Discovery Engine: deterministic intent → smallest lawful candidate set.
 *
 * Disk-free unit coverage of the 6 stages + the pipeline: vocabulary resolution,
 * semantic (concept) + obligation (capability) lookup, plurality preservation, the
 * fail-loud cases (empty intent / unknown vocabulary / impossible satisfaction), the
 * constraint evidence, deterministic replay, and serialization independence.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import {
  discover,
  normalizeIntent,
  resolveVocabulary,
  resolveObligations,
  lookupCandidates,
  discoveryDigest,
  DiscoveryError,
  type DiscoveryRepository,
} from '../../src/knowledge/discovery.js';

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

const familyHero = asset({ identity: { id: 'canonical::family-hero', title: 'Hero' }, semantics: { produces: ['concept:role:hero'] } });
const heroA = asset({
  identity: { id: 'canonical::hero-a', title: 'hero-a' },
  semantics: { specializes: ['concept:role:hero'] },
  capabilities: { satisfies: ['serves:hero', 'surface:base'] },
  validation: { expects: ['maxPerPage:1'] },
});
const heroB = asset({
  identity: { id: 'canonical::hero-b', title: 'hero-b' },
  semantics: { specializes: ['concept:role:hero'] },
  capabilities: { satisfies: ['serves:hero', 'surface:contrast'] },
});
const featA = asset({
  identity: { id: 'canonical::feat-a', title: 'feat-a' },
  semantics: { specializes: ['concept:role:feature'] },
  capabilities: { satisfies: ['serves:feature', 'surface:base'] },
});

const repo: DiscoveryRepository = {
  assets: [familyHero, heroA, heroB, featA],
  vocabulary: makeVocabulary({
    concepts: ['concept:role:hero', 'concept:role:feature'],
    obligations: ['serves:hero', 'serves:feature', 'surface:base', 'surface:contrast', 'serves:ghost'],
    owners: ['ds'],
    scopeIdentities: ['offscript'],
  }),
};

describe('Stage 1 — normalizeIntent', () => {
  it('dedupes, NFC-normalizes, sorts, and classifies tokens', () => {
    const toks = normalizeIntent({ obligations: ['surface:base', 'concept:role:hero', 'surface:base'] });
    expect(toks.map((t) => t.token)).toEqual(['concept:role:hero', 'surface:base']);
    expect(toks.find((t) => t.token === 'concept:role:hero')!.kind).toBe('concept');
    expect(toks.find((t) => t.token === 'surface:base')!.kind).toBe('obligation');
  });

  it('fails loud on an empty intent', () => {
    expect(() => normalizeIntent({ obligations: [] })).toThrow(DiscoveryError);
    expect(() => normalizeIntent({ obligations: ['  '] })).toThrow(DiscoveryError);
  });
});

describe('Stage 2 — resolveVocabulary', () => {
  it('separates known from unknown against the governed vocabulary', () => {
    const toks = normalizeIntent({ obligations: ['serves:hero', 'serves:nope', 'concept:role:ghost'] });
    const { unknown } = resolveVocabulary(toks, repo.vocabulary);
    expect(unknown).toEqual(['concept:role:ghost', 'serves:nope']);
  });
});

describe('Stage 3 — resolveObligations', () => {
  it('resolves concept tokens via specializes and obligation tokens via satisfies', () => {
    const toks = normalizeIntent({ obligations: ['concept:role:hero', 'surface:base'] });
    const resolved = resolveObligations(toks, repo.assets);
    const role = resolved.find((r) => r.token === 'concept:role:hero')!;
    expect(role.satisfiers).toEqual(['canonical::hero-a', 'canonical::hero-b']); // variants, NOT the family
    const surf = resolved.find((r) => r.token === 'surface:base')!;
    expect(surf.satisfiers).toEqual(['canonical::feat-a', 'canonical::hero-a']);
  });
});

describe('Stage 4 — lookupCandidates (strict AND, plurality preserved)', () => {
  it('returns every asset satisfying ALL tokens, sorted, never collapsed', () => {
    const toks = normalizeIntent({ obligations: ['serves:hero'] });
    expect(lookupCandidates(toks, repo.assets).map((a) => a.identity.id)).toEqual([
      'canonical::hero-a',
      'canonical::hero-b',
    ]);
  });

  it('narrows by conjunction', () => {
    const toks = normalizeIntent({ obligations: ['serves:hero', 'surface:base'] });
    expect(lookupCandidates(toks, repo.assets).map((a) => a.identity.id)).toEqual(['canonical::hero-a']);
  });
});

describe('discover — pipeline', () => {
  it('a role intent discovers all lawful variants (plurality), excludes the family', () => {
    const r = discover({ obligations: ['concept:role:hero'] }, repo);
    expect(r.candidates.map((c) => c.id)).toEqual(['canonical::hero-a', 'canonical::hero-b']);
    expect(r.unresolvedObligations).toEqual([]);
  });

  it('surfaces per-candidate constraint evidence (validation.expects)', () => {
    const r = discover({ obligations: ['serves:hero', 'surface:base'] }, repo);
    expect(r.candidates.map((c) => c.id)).toEqual(['canonical::hero-a']);
    expect(r.constraints).toEqual([{ id: 'canonical::hero-a', expects: ['maxPerPage:1'] }]);
  });

  it('fails loud on unknown vocabulary', () => {
    try {
      discover({ obligations: ['serves:hero', 'surface:figure'] }, repo);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DiscoveryError);
      expect((e as DiscoveryError).code).toBe('UNKNOWN_OBLIGATION');
    }
  });

  it('fails loud on impossible satisfaction (over-constrained conjunction), carrying the partial result', () => {
    try {
      discover({ obligations: ['serves:feature', 'surface:contrast'] }, repo);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DiscoveryError);
      const err = e as DiscoveryError;
      expect(err.code).toBe('IMPOSSIBLE_SATISFACTION');
      expect(err.result?.candidates).toEqual([]);
      // both individually satisfiable → unresolved empty, but conjunction impossible
      expect(err.result?.unresolvedObligations).toEqual([]);
    }
  });

  it('fails loud on a vocab-valid obligation no asset satisfies (carries it as unresolved)', () => {
    try {
      discover({ obligations: ['serves:ghost'] }, repo);
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as DiscoveryError;
      expect(err.code).toBe('IMPOSSIBLE_SATISFACTION');
      expect(err.result?.unresolvedObligations).toEqual(['serves:ghost']);
    }
  });

  it('is deterministic: same intent + repo → identical digest', () => {
    const a = discover({ obligations: ['serves:hero'] }, repo);
    const b = discover({ obligations: ['serves:hero'] }, repo);
    expect(discoveryDigest(b)).toBe(discoveryDigest(a));
  });

  it('is order-independent: asset traversal order does not change the result', () => {
    const shuffled: DiscoveryRepository = { ...repo, assets: [featA, heroB, familyHero, heroA] };
    const a = discover({ obligations: ['serves:hero'] }, repo);
    const b = discover({ obligations: ['serves:hero'] }, shuffled);
    expect(discoveryDigest(b)).toBe(discoveryDigest(a));
  });

  it('serialization independence: YAML- vs Markdown-sourced assets yield identical discovery', () => {
    // Same asset content, two source shapes → identical normalized model → identical discovery.
    const loose = {
      ...base,
      identity: { id: 'canonical::hero-a', title: 'hero-a' },
      semantics: { specializes: ['concept:role:hero'] },
      capabilities: { satisfies: ['serves:hero', 'surface:base'] },
      validation: { expects: ['maxPerPage:1'] },
    };
    const fromA = parseAsset(loose, 'a').asset!;
    const fromB = parseAsset(JSON.parse(JSON.stringify(loose)), 'b').asset!;
    const r1 = discover({ obligations: ['serves:hero'] }, { assets: [fromA], vocabulary: repo.vocabulary });
    const r2 = discover({ obligations: ['serves:hero'] }, { assets: [fromB], vocabulary: repo.vocabulary });
    expect(discoveryDigest(r2)).toBe(discoveryDigest(r1));
  });

  it('repository evolution: a new lawful variant joins the candidate set deterministically', () => {
    const heroC = asset({
      identity: { id: 'canonical::hero-c', title: 'hero-c' },
      semantics: { specializes: ['concept:role:hero'] },
      capabilities: { satisfies: ['serves:hero', 'surface:base'] },
    });
    const grown: DiscoveryRepository = { ...repo, assets: [...repo.assets, heroC] };
    const r = discover({ obligations: ['serves:hero'] }, grown);
    expect(r.candidates.map((c) => c.id)).toEqual(['canonical::hero-a', 'canonical::hero-b', 'canonical::hero-c']);
  });
});
