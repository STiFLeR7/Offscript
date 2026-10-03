/**
 * Sprint 2 — Repository Builder: diagnostics + statistics (derived, deterministic).
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { computeDiagnostics, diagnosticsDigest } from '../../src/knowledge/diagnostics.js';
import { computeStatistics, statisticsDigest } from '../../src/knowledge/statistics.js';

const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};

function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset(loose, 'loc');
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}

const family = asset({ ...base, identity: { id: 'canonical::family', title: 'F' }, semantics: { produces: ['concept:role'] } });
const v1 = asset({ ...base, identity: { id: 'canonical::v1', title: 'V1' }, semantics: { specializes: ['concept:role'] } });
const v2 = asset({
  ...base,
  identity: { id: 'canonical::v2', title: 'V2' },
  semantics: { specializes: ['concept:role'] },
  dependencies: { prerequisite: ['canonical::v1'] },
});
const lone = asset({ ...base, identity: { id: 'canonical::lone', title: 'L' } });

const assets = [family, v1, v2, lone];
const dep = buildDependencyGraph(assets);
const sem = buildSemanticGraph(assets);

describe('computeDiagnostics', () => {
  const d = computeDiagnostics(assets, dep, sem);

  it('counts assets and edges', () => {
    expect(d.assetCount).toBe(4);
    expect(d.dependencyEdgeCount).toBe(1); // v2 → v1
    expect(d.semanticEdgeCount).toBe(3); // produces + 2 specializes
  });

  it('measures dependency depth and isolated assets', () => {
    expect(d.dependencyGraphDepth).toBe(1); // v2 → v1
    expect(d.semanticGraphDepth).toBe(1);
    expect(d.isolatedAssets).toEqual(['canonical::lone']); // no edge in either graph
  });

  it('is deterministic (stable digest)', () => {
    expect(diagnosticsDigest(computeDiagnostics(assets, dep, sem))).toBe(diagnosticsDigest(d));
  });
});

describe('computeStatistics', () => {
  const s = computeStatistics(assets, dep, sem);

  it('tallies by kind and scope', () => {
    expect(s.assetsByKind).toEqual({ component: 4 });
    expect(s.assetsByScope).toEqual({ canonical: 4 });
  });

  it('reports fan-out as fixed-precision strings (cross-env determinism)', () => {
    expect(s.semanticFanOut.mean).toMatch(/^\d+\.\d{4}$/);
    expect(s.dependencyFanOut.max).toBe(1);
  });

  it('is deterministic (stable digest)', () => {
    expect(statisticsDigest(computeStatistics(assets, dep, sem))).toBe(statisticsDigest(s));
  });
});
