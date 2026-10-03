/**
 * Sprint 4 — Composition Engine.
 *
 * Composition transforms a lawful Discovery Result into a deterministic, replayable
 * Composition Plan. It ORGANIZES — it never authors, generates, ranks by preference, or
 * optimizes aesthetically. It consumes only repository facts (the Discovery candidates +
 * the dependency/semantic graphs) and produces a plan that is a pure function of its inputs.
 *
 * Six responsibilities, each deterministic:
 *   1 candidate grouping     group candidates by authored relationship (semantics.specializes);
 *                            equally-valid candidates are kept (plurality preserved)
 *   2 dependency expansion   transitively pull authored prerequisite + lineage requirements
 *                            (fail loud on a missing target)
 *   3 ordering               Kahn topological order over prerequisite/lineage, dependency-before-
 *                            dependent, sorted tie-break (fail loud on a cycle)
 *   4 obligation preservation carry the Discovery obligations into the plan verbatim
 *   5 plurality preservation record groups with >1 lawful member as unresolved plurality
 *   6 replayable plan        bind to the repository identity (graph digests); emit a digestible plan
 *
 * Fail-loud: cyclic dependency, missing dependency, and an invalid repository state (a
 * candidate absent from the repository) throw a CompositionError. The plan is the sole
 * input to Conditioning (not implemented here).
 */
import { digest } from './digest.js';
import { graphDigest, type GraphArtifact } from './graph.js';
import type { Edge } from './edge.js';
import type { NormalizedAsset } from './model.js';
import type { DiscoveryResult, ResolvedObligation } from './discovery.js';

const UNGROUPED = '(unspecialized)';
const STRUCTURAL_KINDS = new Set(['prerequisite', 'lineage']);

/** The repository facts Composition consumes (validated, built). */
export interface CompositionRepository {
  readonly assets: readonly NormalizedAsset[];
  readonly dependencyGraph: GraphArtifact;
  readonly semanticGraph: GraphArtifact;
}

/** A plurality set: candidates that fill the same authored role/relationship. */
export interface CompositionGroup {
  readonly key: string;
  readonly members: readonly string[];
}

/** One ordered asset in the plan: a candidate or an expanded structural requirement. */
export interface CompositionUnit {
  readonly id: string;
  /** Whether the unit is a discovery candidate or pulled in by dependency expansion. */
  readonly origin: 'candidate' | 'dependency';
  /** Role concepts the unit specializes (sorted). */
  readonly role: readonly string[];
  /** Direct authored prerequisite + lineage targets (sorted). */
  readonly requires: readonly string[];
}

export interface CompositionPlan {
  readonly intent: readonly string[];
  /** The Discovery obligations, preserved verbatim. */
  readonly obligations: readonly ResolvedObligation[];
  /** Candidates grouped by authored relationship; plurality preserved. */
  readonly groups: readonly CompositionGroup[];
  /** Deterministic topological order over every plan asset id. */
  readonly order: readonly string[];
  /** Per-asset structure, in execution order. */
  readonly units: readonly CompositionUnit[];
  /** Groups still carrying >1 lawful candidate — Composition does not resolve these. */
  readonly unresolvedPlurality: readonly CompositionGroup[];
  readonly evidence: {
    readonly candidateCount: number;
    readonly groupCount: number;
    readonly expandedCount: number;
    readonly unitCount: number;
  };
  /** Binds the plan to the exact repository structure it was composed against. */
  readonly repositoryIdentity: string;
}

/** Fail-loud Composition error. */
export class CompositionError extends Error {
  readonly code:
    | 'EMPTY_DISCOVERY'
    | 'INVALID_REPOSITORY_STATE'
    | 'MISSING_DEPENDENCY'
    | 'CYCLIC_DEPENDENCY';
  constructor(code: CompositionError['code'], message: string) {
    super(message);
    this.name = 'CompositionError';
    this.code = code;
  }
}

/** Structural (prerequisite + lineage) adjacency: requirer → its required targets. */
function structuralRequires(graph: GraphArtifact): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of graph.edges as readonly Edge[]) {
    if (!STRUCTURAL_KINDS.has(e.kind)) continue;
    let list = out.get(e.source);
    if (!list) {
      list = [];
      out.set(e.source, list);
    }
    list.push(e.target);
  }
  for (const [k, v] of out) out.set(k, [...new Set(v)].sort());
  return out;
}

/** Stage 2 — transitively expand authored requirements; fail loud on a missing target. */
function expandDependencies(
  seed: readonly string[],
  requires: ReadonlyMap<string, string[]>,
  present: ReadonlySet<string>,
): Set<string> {
  const planned = new Set<string>(seed);
  const queue = [...seed];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of requires.get(id) ?? []) {
      if (!present.has(target)) {
        throw new CompositionError(
          'MISSING_DEPENDENCY',
          `composition: '${id}' requires '${target}', which is not in the repository.`,
        );
      }
      if (!planned.has(target)) {
        planned.add(target);
        queue.push(target);
      }
    }
  }
  return planned;
}

/** Stage 3 — deterministic Kahn topological order (dependency before dependent). */
function topologicalOrder(ids: ReadonlySet<string>, requires: ReadonlyMap<string, string[]>): string[] {
  // Edge meaning: a requires b ⇒ b must precede a. indegree counts unmet requirements.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // b → [a, …] (things that come after b)
  for (const id of ids) indegree.set(id, 0);
  for (const a of ids) {
    for (const b of requires.get(a) ?? []) {
      if (!ids.has(b)) continue;
      indegree.set(a, (indegree.get(a) ?? 0) + 1);
      let list = dependents.get(b);
      if (!list) {
        list = [];
        dependents.set(b, list);
      }
      list.push(a);
    }
  }
  // Deterministic frontier: always emit the smallest available id.
  const ready = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const dep of (dependents.get(id) ?? []).sort()) {
      const n = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, n);
      if (n === 0) {
        // insert keeping `ready` sorted
        const at = lowerBound(ready, dep);
        ready.splice(at, 0, dep);
      }
    }
  }
  if (order.length !== ids.size) {
    const stuck = [...ids].filter((id) => !order.includes(id)).sort();
    throw new CompositionError(
      'CYCLIC_DEPENDENCY',
      `composition: cyclic dependency among {${stuck.join(', ')}} — cannot order.`,
    );
  }
  return order;
}

function lowerBound(sorted: readonly string[], value: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The repository identity a plan is bound to: a digest of the dependency + semantic graph
 * digests. Shared by compose() (to stamp a plan) and Conditioning (to verify a plan was
 * composed against the repository it is being conditioned with).
 */
export function repositoryIdentity(repo: CompositionRepository): string {
  return digest({
    dependency: graphDigest(repo.dependencyGraph),
    semantic: graphDigest(repo.semanticGraph),
  });
}

/** Stage 1 — group candidates by authored specializes; plurality preserved. */
function groupCandidates(discovery: DiscoveryResult): CompositionGroup[] {
  const byKey = new Map<string, string[]>();
  for (const c of discovery.candidates) {
    const key = c.specializes.length > 0 ? [...c.specializes].sort().join('+') : UNGROUPED;
    let list = byKey.get(key);
    if (!list) {
      list = [];
      byKey.set(key, list);
    }
    list.push(c.id);
  }
  return [...byKey.entries()]
    .map(([key, members]) => ({ key, members: [...new Set(members)].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Compose a Discovery Result into a deterministic, replayable Composition Plan.
 * Throws CompositionError on an empty/invalid discovery, missing dependency, or cycle.
 */
export function compose(discovery: DiscoveryResult, repo: CompositionRepository): CompositionPlan {
  if (discovery.candidates.length === 0) {
    throw new CompositionError('EMPTY_DISCOVERY', 'composition: discovery result carries no candidates.');
  }
  const present = new Set(repo.assets.map((a) => a.identity.id));
  const candidateIds = discovery.candidates.map((c) => c.id).sort();
  for (const id of candidateIds) {
    if (!present.has(id)) {
      throw new CompositionError(
        'INVALID_REPOSITORY_STATE',
        `composition: discovery candidate '${id}' is absent from the repository.`,
      );
    }
  }

  const requires = structuralRequires(repo.dependencyGraph);
  const planned = expandDependencies(candidateIds, requires, present); // stage 2 (throws on missing)
  const order = topologicalOrder(planned, requires); // stage 3 (throws on cycle)

  const groups = groupCandidates(discovery); // stage 1
  const unresolvedPlurality = groups.filter((g) => g.members.length > 1); // stage 5

  const assetById = new Map(repo.assets.map((a) => [a.identity.id, a]));
  const candidateSet = new Set(candidateIds);
  const units: CompositionUnit[] = order.map((id) => {
    const a = assetById.get(id)!;
    return {
      id,
      origin: candidateSet.has(id) ? 'candidate' : 'dependency',
      role: [...a.semantics.specializes].sort(),
      requires: requires.get(id) ?? [],
    };
  });

  return {
    intent: discovery.intent,
    obligations: discovery.resolvedObligations, // stage 4 — preserved verbatim
    groups,
    order,
    units,
    unresolvedPlurality,
    evidence: {
      candidateCount: candidateIds.length,
      groupCount: groups.length,
      expandedCount: planned.size - candidateIds.length,
      unitCount: units.length,
    },
    repositoryIdentity: repositoryIdentity(repo),
  };
}

/** Deterministic digest over the canonical plan — for replay verification. */
export function compositionDigest(plan: CompositionPlan): string {
  return digest({
    intent: plan.intent,
    obligations: plan.obligations.map((o) => ({ token: o.token, kind: o.kind, satisfiers: o.satisfiers })),
    groups: plan.groups.map((g) => ({ key: g.key, members: g.members })),
    order: plan.order,
    units: plan.units.map((u) => ({ id: u.id, origin: u.origin, role: u.role, requires: u.requires })),
    unresolvedPlurality: plan.unresolvedPlurality.map((g) => ({ key: g.key, members: g.members })),
    repositoryIdentity: plan.repositoryIdentity,
  });
}
