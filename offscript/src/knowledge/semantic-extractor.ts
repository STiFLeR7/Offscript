/**
 * PKG — Repository Builder: semantic-edge extraction (ES-2 stage 8).
 *
 * Projects the authored conceptual relations into edges. Sprint 1 emits the LITERAL
 * asset-anchored projection of every declaration (no invention):
 *   produces / consumes / derives_from / specializes : asset → concept
 *   communicates                                       : asset → capability
 *   satisfies                                          : asset → obligation
 *
 * The concept→concept refinement of derives_from / specializes (and its acyclicity
 * check) is deferred: the schema carries these at asset level only, so deriving a
 * term→term edge would require data not present — and the Builder never invents.
 */
import { compareEdge, type Edge } from './edge.js';
import type { NormalizedAsset } from './model.js';

export function extractSemanticEdges(assets: readonly NormalizedAsset[]): Edge[] {
  const edges: Edge[] = [];
  for (const a of assets) {
    const src = a.identity.id;
    for (const t of a.semantics.produces) edges.push({ source: src, kind: 'produces', target: t });
    for (const t of a.semantics.consumes) edges.push({ source: src, kind: 'consumes', target: t });
    for (const t of a.semantics.derivesFrom) edges.push({ source: src, kind: 'derives_from', target: t });
    for (const t of a.semantics.specializes) edges.push({ source: src, kind: 'specializes', target: t });
    for (const t of a.capabilities.communicates) edges.push({ source: src, kind: 'communicates', target: t });
    for (const t of a.capabilities.satisfies) edges.push({ source: src, kind: 'satisfies', target: t });
  }
  return edges.sort(compareEdge);
}
