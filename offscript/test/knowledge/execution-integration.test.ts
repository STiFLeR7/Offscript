/**
 * Sprint 7 — Execution Runtime: the full SIX-engine pipeline on the REAL repository
 * (Repository → Discovery → Composition → Conditioning → Authoring → Execution), mock provider.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition } from '../../src/knowledge/conditioning.js';
import { runAuthoring, type Author } from '../../src/knowledge/authoring.js';
import { execute } from '../../src/knowledge/execution.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const loaded = loadRepository(REAL_REPO);
const repo: CompositionRepository = {
  assets: loaded.assets,
  dependencyGraph: buildDependencyGraph(loaded.assets),
  semanticGraph: buildSemanticGraph(loaded.assets),
};
const recordingAuthor: Author = {
  name: 'authoring-pass',
  author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: { stub: true } }),
};
const provider: Author = { name: 'mock-provider', author: () => ({ determinations: [], payload: { artifact: '<html/>' } }) };
async function authoringOf(obligations: string[]) {
  const ctx = condition(compose(discover({ obligations }, loaded), repo), repo, { requestId: 'e2e' });
  return runAuthoring(ctx, recordingAuthor);
}

describe('Execution Runtime — full pipeline on the real repository', () => {
  it('executes a mock provider into an immutable execution result', async () => {
    const r = await execute(await authoringOf(['serves:hero']), provider);
    expect(Object.isFrozen(r)).toBe(true);
    expect(r.status).toBe('succeeded');
    expect(r.provider).toEqual({ name: 'mock-provider', deterministic: false });
    expect(r.payload).toEqual({ artifact: '<html/>' });
    expect(r.executionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('produces a deterministic execution identity end-to-end (same inputs + same provider)', async () => {
    const ar = await authoringOf(['serves:hero', 'surface:base']);
    const a = await execute(ar, provider);
    const b = await execute(ar, provider);
    expect(b.executionIdentity).toBe(a.executionIdentity);
    expect(b.authoringIdentity).toBe(a.authoringIdentity);
  });
});
