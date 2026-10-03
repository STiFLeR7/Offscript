/**
 * Sprint 5 — Conditioning Engine: integration on the REAL enriched repository.
 * Discovery → Composition → Conditioning over production facts, deterministic + immutable.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition, conditioningDigest } from '../../src/knowledge/conditioning.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const loaded = loadRepository(REAL_REPO);
const repo: CompositionRepository = {
  assets: loaded.assets,
  dependencyGraph: buildDependencyGraph(loaded.assets),
  semanticGraph: buildSemanticGraph(loaded.assets),
};
const planOf = (obligations: string[]) => compose(discover({ obligations }, loaded), repo);

describe('condition — the real enriched repository', () => {
  it('produces an immutable authoring context from a real plan', () => {
    const ctx = condition(planOf(['serves:hero']), repo, { requestId: 'real-1', options: { track: 'website' } });
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(ctx.repositoryIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ctx.conditioningIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ctx.evidence.assetCount).toBe(loaded.assets.length);
  });

  it('preserves unresolved plurality from the real composition (no resolution)', () => {
    const plan = planOf(['serves:hero']);
    const ctx = condition(plan, repo, { requestId: 'real-2' });
    expect(ctx.unresolvedPlurality).toEqual(plan.unresolvedPlurality);
    expect(ctx.unresolvedPlurality.length).toBeGreaterThan(0); // hero/cta groups carry plurality
  });

  it('is deterministic: identical inputs → identical conditioning identity', () => {
    const exec = { requestId: 'real-3', options: { track: 'website' } };
    const a = condition(planOf(['serves:hero', 'surface:base']), repo, exec);
    const b = condition(planOf(['serves:hero', 'surface:base']), repo, exec);
    expect(conditioningDigest(b)).toBe(conditioningDigest(a));
  });
});
