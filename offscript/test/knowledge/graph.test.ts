/**
 * PKG — Repository Builder: graph generation + acyclicity + determinism.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import {
  buildDependencyGraph,
  buildSemanticGraph,
  graphDigest,
} from '../../src/knowledge/graph.js';
import { GraphCycleError } from '../../src/knowledge/finding.js';

function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset(loose, 'loc');
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}

const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};

describe('buildDependencyGraph', () => {
  it('projects prerequisite (asset→asset) and realizes (asset→guarantee)', () => {
    const a = asset({ ...base, identity: { id: 'canonical::a', title: 'A' } });
    const b = asset({
      ...base,
      identity: { id: 'canonical::b', title: 'B' },
      dependencies: { prerequisite: ['canonical::a'], realizes: ['guarantee:g1'] },
    });
    const g = buildDependencyGraph([a, b]);
    expect(g.nodes.find((n) => n.id === 'guarantee:g1')?.type).toBe('guarantee');
    expect(g.edges).toContainEqual({ source: 'canonical::b', kind: 'prerequisite', target: 'canonical::a' });
    expect(g.edges).toContainEqual({ source: 'canonical::b', kind: 'realizes', target: 'guarantee:g1' });
  });

  it('throws GraphCycleError on a self-referential prerequisite (A → A)', () => {
    const a = asset({
      ...base,
      identity: { id: 'canonical::a', title: 'A' },
      dependencies: { prerequisite: ['canonical::a'] },
    });
    expect(() => buildDependencyGraph([a])).toThrow(GraphCycleError);
  });

  it('throws GraphCycleError on a prerequisite cycle', () => {
    const a = asset({
      ...base,
      identity: { id: 'canonical::a', title: 'A' },
      dependencies: { prerequisite: ['canonical::b'] },
    });
    const b = asset({
      ...base,
      identity: { id: 'canonical::b', title: 'B' },
      dependencies: { prerequisite: ['canonical::a'] },
    });
    expect(() => buildDependencyGraph([a, b])).toThrow(GraphCycleError);
  });
});

describe('buildSemanticGraph', () => {
  it('projects produces (asset→concept) and satisfies (asset→obligation)', () => {
    const a = asset({
      ...base,
      identity: { id: 'canonical::a', title: 'A' },
      semantics: { produces: ['concept:x'] },
      capabilities: { satisfies: ['obligation:o'] },
    });
    const g = buildSemanticGraph([a]);
    expect(g.nodes.find((n) => n.id === 'concept:x')?.type).toBe('concept');
    expect(g.nodes.find((n) => n.id === 'obligation:o')?.type).toBe('obligation');
    expect(g.edges).toContainEqual({ source: 'canonical::a', kind: 'produces', target: 'concept:x' });
  });
});

describe('graph determinism', () => {
  it('digest is independent of asset input order', () => {
    const a = asset({ ...base, identity: { id: 'canonical::a', title: 'A' }, semantics: { produces: ['concept:x'] } });
    const b = asset({ ...base, identity: { id: 'canonical::b', title: 'B' }, semantics: { consumes: ['concept:x'] } });
    expect(graphDigest(buildSemanticGraph([a, b]))).toBe(graphDigest(buildSemanticGraph([b, a])));
  });
});
