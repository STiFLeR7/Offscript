/**
 * Sprint 4 — Composition Engine: integration on the REAL enriched repository.
 * Discovery Result → deterministic, replayable Composition Plan over production facts.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, compositionDigest, type CompositionRepository } from '../../src/knowledge/composition.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const loaded = loadRepository(REAL_REPO);
const repo: CompositionRepository = {
  assets: loaded.assets,
  dependencyGraph: buildDependencyGraph(loaded.assets),
  semanticGraph: buildSemanticGraph(loaded.assets),
};

describe('compose — the real enriched repository', () => {
  it('groups serves:hero candidates by their authored role (plurality preserved)', () => {
    const plan = compose(discover({ obligations: ['serves:hero'] }, loaded), repo);
    const keys = plan.groups.map((g) => g.key);
    expect(keys).toContain('concept:role:hero'); // hero variants
    expect(keys).toContain('concept:role:call-to-action'); // cta variants that also serve hero
    const heroGroup = plan.groups.find((g) => g.key === 'concept:role:hero')!;
    expect(heroGroup.members.length).toBeGreaterThan(1); // plurality not collapsed
  });

  it('order is a deterministic total order over every candidate (no authored deps on real repo)', () => {
    const plan = compose(discover({ obligations: ['serves:hero'] }, loaded), repo);
    // With no prerequisite/lineage edges materialized, order == sorted candidate ids.
    expect(plan.order).toEqual([...plan.order].sort());
    expect(plan.order.length).toBe(plan.units.length);
  });

  it('produces the identical plan on repeated composition (replayable)', () => {
    const a = compose(discover({ obligations: ['serves:hero', 'surface:base'] }, loaded), repo);
    const b = compose(discover({ obligations: ['serves:hero', 'surface:base'] }, loaded), repo);
    expect(compositionDigest(b)).toBe(compositionDigest(a));
    expect(a.repositoryIdentity).toBe(b.repositoryIdentity);
  });

  it('preserves obligations and binds repository identity', () => {
    const plan = compose(discover({ obligations: ['concept:role:hero'] }, loaded), repo);
    expect(plan.obligations.map((o) => o.token)).toEqual(['concept:role:hero']);
    expect(plan.repositoryIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    // role-concept intent → one group (the hero family's variants)
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].key).toBe('concept:role:hero');
  });
});
