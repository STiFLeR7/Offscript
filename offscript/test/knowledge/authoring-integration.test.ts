/**
 * Sprint 6 — Authoring Runtime: the full five-engine pipeline on the REAL repository
 * (Repository → Discovery → Composition → Conditioning → Authoring), with a mocked Author.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition } from '../../src/knowledge/conditioning.js';
import { runAuthoring, type Author } from '../../src/knowledge/authoring.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const loaded = loadRepository(REAL_REPO);
const repo: CompositionRepository = {
  assets: loaded.assets,
  dependencyGraph: buildDependencyGraph(loaded.assets),
  semanticGraph: buildSemanticGraph(loaded.assets),
};
const firstAuthor: Author = {
  name: 'mock-first',
  author: (req) => ({
    determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })),
    payload: { stub: true },
  }),
};
function ctx(obligations: string[]) {
  return condition(compose(discover({ obligations }, loaded), repo), repo, { requestId: 'e2e-1' });
}

describe('Authoring Runtime — full pipeline on the real repository', () => {
  it('authors an immutable result resolving the real preserved plurality', async () => {
    const r = await runAuthoring(ctx(['serves:hero']), firstAuthor);
    expect(Object.isFrozen(r)).toBe(true);
    expect(r.determinations.length).toBeGreaterThan(0);
    for (const d of r.determinations) expect(d.from).toContain(d.selected); // every selection is lawful
    expect(r.authoringIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is deterministic end-to-end (same inputs + same author → same authoring identity)', async () => {
    const a = await runAuthoring(ctx(['serves:hero', 'surface:base']), firstAuthor);
    const b = await runAuthoring(ctx(['serves:hero', 'surface:base']), firstAuthor);
    expect(b.authoringIdentity).toBe(a.authoringIdentity);
    expect(b.repositoryIdentity).toBe(a.repositoryIdentity);
    expect(b.conditioningIdentity).toBe(a.conditioningIdentity);
  });
});
