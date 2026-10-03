/**
 * Sprint 2 — Repository Builder: build DIAGNOSTICS (a derived artifact).
 *
 * Deterministic, derived-only structural observations about a successfully built
 * repository — asset / edge counts, graph depth, isolated assets, node-type counts,
 * and a validation summary (always clean by the time diagnostics run; the build aborts
 * earlier otherwise). Diagnostics are NEVER authored metadata and NEVER influence
 * builder behaviour — they are computed from the normalized model + derived graphs and
 * published verbatim. Canonical-form digesting (digest.ts) gives them a stable identity.
 */
import { digest, canonicalText, type Json } from './digest.js';
import { compareEdge } from './edge.js';
import type { GraphArtifact, NodeType } from './graph.js';
import type { NormalizedAsset } from './model.js';

export interface Diagnostics {
  readonly assetCount: number;
  readonly dependencyEdgeCount: number;
  readonly semanticEdgeCount: number;
  /** Longest asset→asset chain in the (acyclic) dependency graph, in edges. */
  readonly dependencyGraphDepth: number;
  /** Longest path in the semantic graph, in edges. */
  readonly semanticGraphDepth: number;
  /** Assets with no edge in EITHER graph (sorted). */
  readonly isolatedAssets: readonly string[];
  readonly isolatedAssetCount: number;
  readonly nodeTypeCounts: {
    readonly dependency: Readonly<Record<string, number>>;
    readonly semantic: Readonly<Record<string, number>>;
  };
  readonly validation: { readonly status: 'clean'; readonly findingCount: 0 };
}

/** Longest path (edge count) over a DAG given its edges. Acyclicity is a precondition. */
function longestPath(edges: GraphArtifact['edges']): number {
  const adj = new Map<string, string[]>();
  for (const e of [...edges].sort(compareEdge)) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const memo = new Map<string, number>();
  const depth = (u: string, path: Set<string>): number => {
    if (memo.has(u)) return memo.get(u)!;
    if (path.has(u)) return 0; // defensive: cycles are rejected upstream
    path.add(u);
    let best = 0;
    for (const v of adj.get(u) ?? []) best = Math.max(best, 1 + depth(v, path));
    path.delete(u);
    memo.set(u, best);
    return best;
  };
  let max = 0;
  for (const u of adj.keys()) max = Math.max(max, depth(u, new Set()));
  return max;
}

function countByType(nodes: readonly { type: NodeType }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  return counts;
}

export function computeDiagnostics(
  assets: readonly NormalizedAsset[],
  dependencyGraph: GraphArtifact,
  semanticGraph: GraphArtifact,
): Diagnostics {
  const touched = new Set<string>();
  for (const e of dependencyGraph.edges) {
    touched.add(e.source);
    touched.add(e.target);
  }
  for (const e of semanticGraph.edges) {
    touched.add(e.source);
    touched.add(e.target);
  }
  const isolatedAssets = assets
    .map((a) => a.identity.id)
    .filter((id) => !touched.has(id))
    .sort();

  return {
    assetCount: assets.length,
    dependencyEdgeCount: dependencyGraph.edges.length,
    semanticEdgeCount: semanticGraph.edges.length,
    dependencyGraphDepth: longestPath(dependencyGraph.edges),
    semanticGraphDepth: longestPath(semanticGraph.edges),
    isolatedAssets,
    isolatedAssetCount: isolatedAssets.length,
    nodeTypeCounts: {
      dependency: countByType(dependencyGraph.nodes),
      semantic: countByType(semanticGraph.nodes),
    },
    validation: { status: 'clean', findingCount: 0 },
  };
}

export function diagnosticsCanonical(d: Diagnostics): Json {
  return d as unknown as Json;
}

export function diagnosticsDigest(d: Diagnostics): string {
  return digest(diagnosticsCanonical(d));
}

export function diagnosticsText(d: Diagnostics): string {
  return canonicalText(diagnosticsCanonical(d));
}
