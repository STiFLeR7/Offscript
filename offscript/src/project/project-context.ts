/**
 * P52 — Living Project Context model.
 *
 * The Canonical Brief is a SNAPSHOT (the generation input contract, unchanged). The Project Context
 * is LONG-LIVED: it accumulates every project's knowledge across sessions — identity, confirmed
 * facts, rejected assumptions, decisions, session history, known assets, and generated artifacts.
 * It is APPEND-ONLY: a new session enriches it without mutating prior decisions, so the full
 * history is always traceable and the current view is a deterministic fold over the session log.
 *
 * Pure data — no clock/rng/fs here (timestamps and ids are injected by the updater). It belongs
 * entirely to the Project Platform and never leaks into generation.
 */
import type { Track } from '../paths.js';

/** The kind of a recorded decision — the audit vocabulary. */
export type DecisionKind =
  | 'confirmed' // a fact was established
  | 'changed' // a fact was revised (from → to)
  | 'approved' // a proposal was accepted (e.g. brand colors)
  | 'rejected' // a proposal was rejected (e.g. a hero variant)
  | 'stakeholder' // a stakeholder decision
  | 'asset' // a known asset was registered
  | 'artifact' // a generated artifact was recorded
  | 'note'; // a free note

/** A decision as authored (before the session stamps id/sessionId/timestamp). */
export interface DecisionInput {
  readonly kind: DecisionKind;
  /** What the decision is about — a canonical brief field ('audience') or anything ('hero'). */
  readonly subject: string;
  readonly from?: unknown;
  readonly to?: unknown;
  readonly rationale?: string;
  /** The id of a decision this supersedes (explicit conflict lineage). */
  readonly supersedes?: string;
}

/** A stamped, immutable decision record. */
export interface DecisionRecord extends DecisionInput {
  readonly id: string;
  readonly sessionId: string;
  readonly timestamp: string;
}

/** A session as authored (before the updater assigns ordinal/id/links). */
export interface SessionInput {
  readonly goal: string;
  readonly inputs?: Record<string, unknown>;
  readonly decisions?: readonly DecisionInput[];
  readonly outputs?: Record<string, unknown>;
  readonly artifacts?: readonly string[];
  readonly contextChanges?: readonly string[];
}

/** One recorded interaction with the project. */
export interface ProjectSession {
  readonly id: string;
  readonly ordinal: number;
  readonly previousSessionId?: string;
  readonly timestamp: string;
  readonly goal: string;
  readonly inputs: Record<string, unknown>;
  readonly decisions: DecisionRecord[];
  readonly outputs: Record<string, unknown>;
  readonly artifacts: string[];
  readonly contextChanges: string[];
}

export interface ConfirmedFact {
  readonly value: unknown;
  readonly sessionId: string;
  readonly decisionId: string;
  readonly at: string;
}

export interface RejectedAssumption {
  readonly subject: string;
  readonly value: unknown;
  readonly sessionId: string;
  readonly decisionId: string;
  readonly rationale?: string;
  readonly at: string;
}

export interface ArtifactRecord {
  readonly name: string;
  readonly sessionId: string;
  readonly at: string;
}

export interface ProjectIdentity {
  readonly client: string;
  readonly projectType: string;
  readonly deliverables: Track[];
}

/** The living context — a derived view over the append-only session log. */
export interface ProjectContext {
  readonly schemaVersion: 1;
  readonly identity: ProjectIdentity;
  /** Number of sessions applied (monotonic — the context version). */
  readonly version: number;
  /** Current value per canonical field (latest confirmed/changed/approved). */
  readonly confirmedFacts: Record<string, ConfirmedFact>;
  readonly rejectedAssumptions: RejectedAssumption[];
  /** The full ordered decision log (the audit trail). */
  readonly decisions: DecisionRecord[];
  readonly sessions: ProjectSession[];
  readonly knownAssets: string[];
  readonly generatedArtifacts: ArtifactRecord[];
}

/** A fresh, empty context for a project identity. */
export function emptyContext(identity: ProjectIdentity): ProjectContext {
  return {
    schemaVersion: 1,
    identity,
    version: 0,
    confirmedFacts: {},
    rejectedAssumptions: [],
    decisions: [],
    sessions: [],
    knownAssets: [],
    generatedArtifacts: [],
  };
}
