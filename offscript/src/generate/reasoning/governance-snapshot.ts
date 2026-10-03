/**
 * Sprint W4 — governance snapshot acquisition for the Governed Reasoning Runtime.
 *
 * Per GOVERNED-REASONING-RUNTIME-ARCHITECTURE.md §11 + Decision G2: a real reasoner must ground its
 * judgment in the actual constitution text, and the runtime must record WHICH text it grounded on.
 * A `GovernanceSnapshot` is a read-only, content-addressed view of that grounding excerpt — its id
 * is the content hash of its text, so evidence can prove the grounding is versioned + verifiable
 * (closing the "citation but un-ingested" gap, §11). Acquiring the snapshot is injected
 * (GovernedReasoningDeps.acquireSnapshot), never materialized inside the runtime — G2 materialization
 * is a separate prerequisite, so W4 stays decoupled from it.
 *
 * World-B local digest: this layer uses node:crypto directly and imports NOTHING from
 * src/knowledge/ (World A). World B borrows World A's *concepts*, never its code
 * (WORLD-B-EVOLUTION-ARCHITECTURE.md §6/§10).
 */
import { createHash } from 'node:crypto';

/** `sha256:<hex>` over UTF-8 text — the World-B reasoning digest (matches the repo's hash convention). */
export function reasoningDigest(text: string): string {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

/** A read-only, content-addressed snapshot of the governance text a reasoner grounds on (G2). */
export interface GovernanceSnapshot {
  /** sha256 content hash of `grounding` — versioned, verifiable provenance (governanceSnapshotId). */
  readonly id: string;
  /** the constitution excerpt the reasoner reads to ground its judgment. */
  readonly grounding: string;
}

/**
 * Build a snapshot from grounding text. Fail-loud on missing/empty grounding (RK6 — the reasoner
 * would have nothing authored to reason FROM). The id is computed, never supplied, so a snapshot is
 * always internally consistent: `id === reasoningDigest(grounding)`.
 */
export function snapshotGovernance(grounding: string): GovernanceSnapshot {
  if (typeof grounding !== 'string' || grounding.trim() === '') {
    throw new Error('governed reasoning: governance grounding is missing or empty — cannot snapshot (G2 prerequisite).');
  }
  return Object.freeze({ id: reasoningDigest(grounding), grounding });
}
