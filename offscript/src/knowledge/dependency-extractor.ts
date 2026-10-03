/**
 * PKG — Repository Builder: dependency-edge extraction (ES-2 stage 7).
 *
 * Projects the authored structural relations into edges (dependent → depended-upon):
 *   prerequisite : asset → asset
 *   realizes     : asset → guarantee
 *   verifies     : asset → guarantee
 *   lineage      : asset → canonical asset   (from governance.lineage.derives_from)
 *
 * Pure projection of the normalized model; no reverse edges, no closures.
 */
import { compareEdge, type Edge } from './edge.js';
import type { NormalizedAsset } from './model.js';

export function extractDependencyEdges(assets: readonly NormalizedAsset[]): Edge[] {
  const edges: Edge[] = [];
  for (const a of assets) {
    const src = a.identity.id;
    for (const t of a.dependencies.prerequisite) edges.push({ source: src, kind: 'prerequisite', target: t });
    for (const t of a.dependencies.realizes) edges.push({ source: src, kind: 'realizes', target: t });
    for (const t of a.dependencies.verifies) edges.push({ source: src, kind: 'verifies', target: t });
    if (a.governance.lineage) {
      edges.push({ source: src, kind: 'lineage', target: a.governance.lineage.derivesFrom });
    }
  }
  return edges.sort(compareEdge);
}
