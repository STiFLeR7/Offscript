/**
 * P52 — History Reader: the stable, read-only interface over a Project Context.
 *
 * Future planners/discovery consume the context through THESE accessors — so the context can grow
 * and its internals evolve without changing what callers depend on (design review Q7). Pure reads;
 * no mutation, no I/O.
 */
import type { ProjectContext, DecisionRecord, ProjectSession, RejectedAssumption, ArtifactRecord } from './project-context.js';

/** Current value per canonical field (latest confirmed). */
export function currentFacts(context: ProjectContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, cf] of Object.entries(context.confirmedFacts)) out[field] = cf.value;
  return out;
}

/** The current value of one field, or undefined. */
export function factValue(context: ProjectContext, field: string): unknown {
  return context.confirmedFacts[field]?.value;
}

/** Every decision about one subject, in chronological order (the field's full history). */
export function factHistory(context: ProjectContext, subject: string): DecisionRecord[] {
  return context.decisions.filter((d) => d.subject === subject);
}

/** Alias — decisions about any subject (a field, a hero, brand colors, …). */
export const decisionsFor = factHistory;

/** Every decision of a given kind. */
export function decisionsByKind(context: ProjectContext, kind: DecisionRecord['kind']): DecisionRecord[] {
  return context.decisions.filter((d) => d.kind === kind);
}

export function sessionHistory(context: ProjectContext): ProjectSession[] {
  return context.sessions;
}

export function sessionById(context: ProjectContext, id: string): ProjectSession | undefined {
  return context.sessions.find((s) => s.id === id);
}

export function rejectedAssumptions(context: ProjectContext): RejectedAssumption[] {
  return context.rejectedAssumptions;
}

export function generatedArtifacts(context: ProjectContext): ArtifactRecord[] {
  return context.generatedArtifacts;
}
