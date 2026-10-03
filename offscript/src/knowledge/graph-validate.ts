/**
 * Sprint 2 — Repository Builder: GRAPH-LEVEL validation.
 *
 * Asset-level validation (duplicate id, single producer, missing references, invalid
 * scopes, F2 consistency) already lives in validate.ts, and dependency cycles are
 * caught fail-loud in graph.ts. This module adds the remaining graph-level integrity
 * check the Sprint-2 scope names — SEMANTIC INCONSISTENCY: a concept that is
 * `specializes`/`derives_from`-referenced (an inheritance/derivation edge) but is
 * PRODUCED by no asset is a broken semantic join (a role specialized that nobody owns).
 * It mirrors the projection layer's fatal orphan-variant invariant.
 *
 * Operates only on the derived semantic graph (serialization-independent). Returns
 * deterministic, sorted FATAL findings; the Builder aggregates and aborts before
 * publication. Orphan / unreachable / isolated assets are NOT failures (a standalone
 * family or variant is legitimate) — they are reported by diagnostics.ts instead.
 */
import type { Finding } from './finding.js';
import type { GraphArtifact } from './graph.js';

const INHERITANCE_KINDS = new Set(['specializes', 'derives_from']);

export function validateGraphs(semanticGraph: GraphArtifact): Finding[] {
  const produced = new Set<string>();
  for (const e of semanticGraph.edges) {
    if (e.kind === 'produces') produced.add(e.target);
  }

  const findings: Finding[] = [];
  for (const e of semanticGraph.edges) {
    if (INHERITANCE_KINDS.has(e.kind) && !produced.has(e.target)) {
      findings.push({
        stage: 'semantic',
        code: 'SEMANTIC_INCONSISTENCY',
        location: e.source,
        message: `'${e.source}' ${e.kind} '${e.target}', which no asset produces (broken semantic join)`,
      });
    }
  }

  findings.sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      a.location.localeCompare(b.location) ||
      a.message.localeCompare(b.message),
  );
  return findings;
}
