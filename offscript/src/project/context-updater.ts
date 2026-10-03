/**
 * P52 — Context Updater: the pure, append-only evolution of a Project Context.
 *
 * `newSession` stamps an authored session (ids/ordinal/links/timestamps — all injected, no clock).
 * `applySession` folds a session into a NEW context (never mutating the input): appends the session
 * + its decisions, advances confirmed facts (latest wins, prior decisions retained), and records
 * rejected assumptions / assets / artifacts. `reconstructContext` replays a session log to the same
 * context — so the log is the source of truth and the current view is always derivable.
 */
import type { Brief } from '../generate/brief.js';
import { CANONICAL_FIELDS, hasValue } from './evidence.js';
import {
  emptyContext,
  type ProjectContext,
  type ProjectIdentity,
  type ProjectSession,
  type SessionInput,
  type DecisionRecord,
  type ConfirmedFact,
  type RejectedAssumption,
  type ArtifactRecord,
} from './project-context.js';

const FACT_KINDS = new Set(['confirmed', 'changed', 'approved']);
const CANONICAL = new Set<string>(CANONICAL_FIELDS);

/** Drop undefined-valued keys so in-memory and reloaded (JSON) objects compare equal. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Stamp an authored session with ordinal/id/link/timestamps against the current context. */
export function newSession(input: SessionInput, ctx: ProjectContext, now: string): ProjectSession {
  const ordinal = ctx.version + 1;
  const id = `s${ordinal}`;
  const prev = ctx.sessions[ctx.sessions.length - 1]?.id;
  const decisions: DecisionRecord[] = (input.decisions ?? []).map((d, i) =>
    compact({ ...d, id: `${id}:${i + 1}`, sessionId: id, timestamp: now }) as DecisionRecord,
  );
  return compact({
    id,
    ordinal,
    previousSessionId: prev,
    timestamp: now,
    goal: input.goal,
    inputs: input.inputs ?? {},
    decisions,
    outputs: input.outputs ?? {},
    artifacts: [...(input.artifacts ?? [])],
    contextChanges: [...(input.contextChanges ?? [])],
  }) as ProjectSession;
}

/** Fold one session into a NEW context (append-only; input untouched). */
export function applySession(ctx: ProjectContext, session: ProjectSession): ProjectContext {
  const confirmedFacts: Record<string, ConfirmedFact> = { ...ctx.confirmedFacts };
  const rejectedAssumptions: RejectedAssumption[] = [...ctx.rejectedAssumptions];
  const knownAssets = [...ctx.knownAssets];
  const generatedArtifacts: ArtifactRecord[] = [...ctx.generatedArtifacts];

  for (const d of session.decisions) {
    if (FACT_KINDS.has(d.kind) && CANONICAL.has(d.subject)) {
      confirmedFacts[d.subject] = { value: d.to, sessionId: d.sessionId, decisionId: d.id, at: d.timestamp };
    } else if (d.kind === 'rejected') {
      rejectedAssumptions.push(
        compact({ subject: d.subject, value: d.to ?? d.from, sessionId: d.sessionId, decisionId: d.id, rationale: d.rationale, at: d.timestamp }) as RejectedAssumption,
      );
    } else if (d.kind === 'asset') {
      const name = String(d.to ?? d.subject);
      if (!knownAssets.includes(name)) knownAssets.push(name);
    }
  }
  for (const a of session.artifacts) {
    if (!generatedArtifacts.some((g) => g.name === a)) generatedArtifacts.push({ name: a, sessionId: session.id, at: session.timestamp });
  }

  return {
    schemaVersion: 1,
    identity: ctx.identity,
    version: ctx.version + 1,
    confirmedFacts,
    rejectedAssumptions,
    decisions: [...ctx.decisions, ...session.decisions],
    sessions: [...ctx.sessions, session],
    knownAssets,
    generatedArtifacts,
  };
}

/** Replay a session log into a context — the deterministic reconstruction. */
export function reconstructContext(identity: ProjectIdentity, sessions: readonly ProjectSession[]): ProjectContext {
  return sessions.reduce((c, s) => applySession(c, s), emptyContext(identity));
}

// ── Deriving a session from an acquired brief ───────────────────────────────────

/** canonical field → the value it takes in a parsed Brief. */
const BRIEF_FIELD: Readonly<Record<string, (b: Brief) => unknown>> = {
  'one-liner': (b) => b.oneLiner,
  audience: (b) => b.audience,
  brand: (b) => b.brand,
  tone: (b) => b.tone,
  goals: (b) => b.goals,
  'must-include': (b) => b.mustInclude,
  'success-criteria': (b) => b.successCriteria,
  'source-doc': (b) => b.sourceDoc,
};

/**
 * Diff an acquired brief against the prior context to author confirmed/changed decisions — so a
 * completed acquisition becomes a traceable set of fact decisions without the caller enumerating them.
 */
export function buildBriefSession(opts: {
  prior: ProjectContext;
  brief: Brief;
  answers?: Record<string, unknown>;
  goal?: string;
  artifacts?: readonly string[];
}): SessionInput {
  const { prior, brief } = opts;
  const decisions: SessionInput['decisions'] = [];
  const contextChanges: string[] = [];
  for (const field of CANONICAL_FIELDS) {
    const value = BRIEF_FIELD[field](brief);
    if (!hasValue(value)) continue;
    const prev = prior.confirmedFacts[field];
    if (!prev) {
      (decisions as any[]).push({ kind: 'confirmed', subject: field, to: value });
      contextChanges.push(`confirmed ${field}`);
    } else if (JSON.stringify(prev.value) !== JSON.stringify(value)) {
      (decisions as any[]).push({ kind: 'changed', subject: field, from: prev.value, to: value });
      contextChanges.push(`changed ${field}`);
    }
  }
  return {
    goal: opts.goal ?? 'acquire-brief',
    inputs: opts.answers ?? {},
    decisions,
    outputs: { brief: 'brief.md' },
    artifacts: [...(opts.artifacts ?? ['brief.md'])],
    contextChanges,
  };
}
