/**
 * Sprint 3 — Discovery Engine: integration against the REAL enriched repository
 * (offscript/repository/, Stage-1 serves/surface/limits). Proves Discovery operates on
 * production facts: deterministic intent → lawful candidate set, plurality preserved,
 * fail-loud on the impossible, consistent with the published semantic graph.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover, discoveryDigest, DiscoveryError } from '../../src/knowledge/discovery.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const repo = loadRepository(REAL_REPO);

describe('Discovery — the real enriched repository', () => {
  it('discovers all hero variants by role concept (plurality preserved, family excluded)', () => {
    const r = discover({ obligations: ['concept:role:hero'] }, repo);
    const ids = r.candidates.map((c) => c.id);
    expect(ids).toContain('canonical::hero-bento');
    expect(ids).toContain('canonical::hero-lending');
    expect(ids.length).toBeGreaterThanOrEqual(4); // hero family has ≥4 variants
    expect(ids).not.toContain('canonical::family-hero'); // the abstract role is not a candidate
  });

  it('discovers by authored serves obligation', () => {
    const r = discover({ obligations: ['serves:hero'] }, repo);
    expect(r.candidates.map((c) => c.id)).toContain('canonical::hero-bento');
    expect(r.candidates.length).toBeGreaterThan(1); // serves:hero is served by several variants
  });

  it('narrows by conjunction (serves:hero AND surface:base)', () => {
    const all = discover({ obligations: ['serves:hero'] }, repo);
    const narrowed = discover({ obligations: ['serves:hero', 'surface:base'] }, repo);
    expect(narrowed.candidates.length).toBeLessThanOrEqual(all.candidates.length);
    for (const c of narrowed.candidates) {
      expect(c.satisfies).toContain('serves:hero');
      expect(c.satisfies).toContain('surface:base');
    }
  });

  it('fails loud on an unknown obligation', () => {
    expect(() => discover({ obligations: ['serves:does-not-exist'] }, repo)).toThrow(DiscoveryError);
  });

  it('is deterministic across repeated discovery on the real repo', () => {
    const a = discover({ obligations: ['serves:hero', 'surface:base'] }, repo);
    const b = discover({ obligations: ['serves:hero', 'surface:base'] }, repo);
    expect(discoveryDigest(b)).toBe(discoveryDigest(a));
  });

  it('candidate resolution is consistent with the published semantic graph', () => {
    // Discovery indexes specializes/satisfies from assets — the same edges the semantic
    // graph is derived from. The candidate set must equal the graph-derived satisfier set.
    const sem = buildSemanticGraph(repo.assets);
    const fromGraph = sem.edges
      .filter((e) => e.kind === 'satisfies' && e.target === 'serves:hero')
      .map((e) => e.source)
      .sort();
    const fromDiscovery = discover({ obligations: ['serves:hero'] }, repo).candidates.map((c) => c.id).sort();
    expect(fromDiscovery).toEqual(fromGraph);
  });
});
