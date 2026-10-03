/**
 * Sprint 2 — Repository Builder: repository STATISTICS (a derived, informational artifact).
 *
 * Deterministic descriptive statistics over the normalized model + derived graphs —
 * assets by kind, assets by scope class, dependency/semantic fan-out, and graph density.
 * Statistics are INFORMATIONAL ONLY: they are derived after the build is otherwise
 * complete and MUST NEVER influence builder behaviour (nothing reads them back). Ratios
 * are emitted as fixed-precision strings so the artifact is byte-deterministic across
 * environments (no float-formatting drift). Canonical digesting gives a stable identity.
 */
import { digest, canonicalText, type Json } from './digest.js';
import type { GraphArtifact } from './graph.js';
import type { NormalizedAsset } from './model.js';

export interface FanOut {
  readonly max: number;
  /** Mean out-degree over assets, fixed to 4 dp (string for determinism). */
  readonly mean: string;
}

export interface Statistics {
  readonly assetsByKind: Readonly<Record<string, number>>;
  readonly assetsByScope: Readonly<Record<string, number>>;
  readonly dependencyFanOut: FanOut;
  readonly semanticFanOut: FanOut;
  /** edges / (n·(n-1)) per graph, fixed to 4 dp (string for determinism). */
  readonly graphDensity: { readonly dependency: string; readonly semantic: string };
}

function tally(keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of [...keys].sort()) out[k] = (out[k] ?? 0) + 1;
  return out;
}

function ratio(numerator: number, denominator: number): string {
  return (denominator === 0 ? 0 : numerator / denominator).toFixed(4);
}

function fanOut(assets: readonly NormalizedAsset[], edges: GraphArtifact['edges']): FanOut {
  const out = new Map<string, number>();
  for (const a of assets) out.set(a.identity.id, 0);
  for (const e of edges) out.set(e.source, (out.get(e.source) ?? 0) + 1);
  const degrees = [...out.values()];
  const max = degrees.reduce((m, d) => Math.max(m, d), 0);
  return { max, mean: ratio(edges.length, assets.length) };
}

function density(nodeCount: number, edgeCount: number): string {
  return ratio(edgeCount, nodeCount * (nodeCount - 1));
}

export function computeStatistics(
  assets: readonly NormalizedAsset[],
  dependencyGraph: GraphArtifact,
  semanticGraph: GraphArtifact,
): Statistics {
  return {
    assetsByKind: tally(assets.map((a) => a.kind)),
    assetsByScope: tally(assets.map((a) => a.scope.class)),
    dependencyFanOut: fanOut(assets, dependencyGraph.edges),
    semanticFanOut: fanOut(assets, semanticGraph.edges),
    graphDensity: {
      dependency: density(dependencyGraph.nodes.length, dependencyGraph.edges.length),
      semantic: density(semanticGraph.nodes.length, semanticGraph.edges.length),
    },
  };
}

export function statisticsCanonical(s: Statistics): Json {
  return s as unknown as Json;
}

export function statisticsDigest(s: Statistics): string {
  return digest(statisticsCanonical(s));
}

export function statisticsText(s: Statistics): string {
  return canonicalText(statisticsCanonical(s));
}
