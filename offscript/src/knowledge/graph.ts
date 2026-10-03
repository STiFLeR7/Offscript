/**
 * PKG — Repository Builder: graph generation (ES-2 stage 9-10).
 *
 * Materializes the dependency and semantic graphs from the normalized model — a
 * dependency-free DiGraph with deterministic, canonical serialization. The
 * dependency graph's asset→asset relations (prerequisite + lineage) are checked
 * acyclic (#4); a cycle is a fail-loud GraphCycleError. Graphs are derived,
 * disposable, and reproducible: same model → identical canonical form + digest.
 */
import { canonicalText, digest, type Json } from './digest.js';
import { compareEdge, type Edge } from './edge.js';
import { GraphCycleError } from './finding.js';
import { extractDependencyEdges } from './dependency-extractor.js';
import { extractSemanticEdges } from './semantic-extractor.js';
import type { NormalizedAsset } from './model.js';

export type NodeType = 'asset' | 'guarantee' | 'concept' | 'capability' | 'obligation';

export interface GraphNode {
  readonly id: string;
  readonly type: NodeType;
}

export interface GraphArtifact {
  readonly name: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
}

function sortedNodes(map: Map<string, NodeType>): GraphNode[] {
  return [...map.entries()]
    .map(([id, type]) => ({ id, type }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildDependencyGraph(assets: readonly NormalizedAsset[]): GraphArtifact {
  const edges = extractDependencyEdges(assets);
  const nodes = new Map<string, NodeType>();
  for (const a of assets) nodes.set(a.identity.id, 'asset');
  for (const e of edges) {
    if (e.kind === 'realizes' || e.kind === 'verifies') {
      if (!nodes.has(e.target)) nodes.set(e.target, 'guarantee');
    }
  }
  const cycle = findCycle(
    [...nodes.keys()],
    edges.filter((e) => e.kind === 'prerequisite' || e.kind === 'lineage'),
  );
  if (cycle) throw new GraphCycleError(cycle);
  return { name: 'dependency-graph', nodes: sortedNodes(nodes), edges };
}

export function buildSemanticGraph(assets: readonly NormalizedAsset[]): GraphArtifact {
  const edges = extractSemanticEdges(assets);
  const nodes = new Map<string, NodeType>();
  for (const a of assets) nodes.set(a.identity.id, 'asset');
  const typeByKind: Record<string, NodeType> = {
    produces: 'concept',
    consumes: 'concept',
    derives_from: 'concept',
    specializes: 'concept',
    communicates: 'capability',
    satisfies: 'obligation',
  };
  for (const e of edges) {
    const t = typeByKind[e.kind];
    if (t && !nodes.has(e.target)) nodes.set(e.target, t);
  }
  return { name: 'semantic-graph', nodes: sortedNodes(nodes), edges };
}

/** Canonical, deterministic representation of a graph artifact. */
export function graphCanonical(g: GraphArtifact): Json {
  return {
    name: g.name,
    nodes: [...g.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({ id: n.id, type: n.type })),
    edges: [...g.edges].sort(compareEdge).map((e) => ({
      source: e.source,
      kind: e.kind,
      target: e.target,
    })),
  };
}

export function graphDigest(g: GraphArtifact): string {
  return digest(graphCanonical(g));
}

export function graphText(g: GraphArtifact): string {
  return canonicalText(graphCanonical(g));
}

/** Deterministic DFS cycle detection over asset→asset edges; returns a cycle path. */
function findCycle(nodeIds: string[], edges: readonly Edge[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of [...edges].sort(compareEdge)) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);
  const stack: string[] = [];

  const visit = (u: string): string[] | null => {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) {
        const start = stack.indexOf(v);
        return [...stack.slice(start), v];
      }
      if (c === WHITE) {
        const found = visit(v);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(u, BLACK);
    return null;
  };

  for (const id of [...adj.keys()].sort()) {
    if (color.get(id) === WHITE) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}
