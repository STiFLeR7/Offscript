/**
 * P51 — Acquisition Plan model + interview execution + serialization.
 *
 * The explicit plan the interview EXECUTES (instead of emitting raw gaps): ordered questions with
 * dependencies, optional/critical flags, and the plan's intelligence (what already exists, what is
 * critical, what can be inferred, what must never be inferred, what must be confirmed). Pure data —
 * JSON-serializable and replayable, so a plan can be paused, stored, and resumed deterministically.
 *
 * The plan is BUILT by a PlanningPolicy (planning-policy.ts); this module owns only the model, its
 * canonical field ordering/dependencies, and the execution/serialization mechanics.
 */
import type { Track } from '../paths.js';
import type { Evidence } from './evidence.js';
import type { InferredFact } from './inference.js';
import type { GapReport } from './gap-analysis.js';
import type { CreativeStrategy } from './creative-strategy.js';

export type QuestionReason = 'unknown' | 'conflicting' | 'low-confidence' | 'confirm';

/** One planned interview question, anchored to a canonical-brief field. */
export interface PlannedQuestion {
  readonly field: string;
  readonly prompt: string;
  /** Ordering weight (lower asked first); also the deterministic tie-break within a dependency tier. */
  readonly priority: number;
  readonly optional: boolean;
  /** Fields that must be answered/known before this one is asked. */
  readonly dependsOn: string[];
  readonly reason: QuestionReason;
  /** A must-answer/must-confirm decision (never silently inferred). */
  readonly critical: boolean;
}

export interface QuestionPlan {
  readonly questions: PlannedQuestion[];
}

export interface AcquisitionPlan {
  readonly projectType: string;
  readonly track: Track;
  readonly deliverables: Track[];
  readonly sourceId: string;
  readonly strategy: CreativeStrategy;
  readonly questionPlan: QuestionPlan;
  /** Backward-compatible view: ordered NON-optional question fields (the required interview). */
  readonly questions: string[];
  readonly ready: boolean;
  readonly alreadyKnown: string[];
  readonly critical: string[];
  readonly inferable: string[];
  readonly neverInfer: string[];
  readonly mustConfirm: string[];
  // Observability (attached by the Creative Director; not part of the serialized replay artifact).
  readonly evidence?: Evidence[];
  readonly facts?: InferredFact[];
  readonly gap?: GapReport;
}

/** Canonical field ask-order (lower first). Dependencies below never contradict this ordering. */
export const FIELD_PRIORITY: Readonly<Record<string, number>> = {
  'one-liner': 1,
  brand: 2,
  audience: 3,
  goals: 4,
  'must-include': 5,
  tone: 6,
  'success-criteria': 7,
  'source-doc': 8,
};

/** A question is asked only after its dependencies (you need the message before you pick sections). */
export const FIELD_DEPENDENCIES: Readonly<Record<string, string[]>> = {
  'must-include': ['one-liner'],
  goals: ['one-liner'],
  'success-criteria': ['goals'],
  tone: ['brand'],
};

const PROMPTS: Readonly<Record<string, string>> = {
  'one-liner': 'What single sentence must this deliverable land?',
  audience: 'Who is the primary audience?',
  brand: 'What is the brand / product name?',
  tone: 'What tone / voice should it carry?',
  goals: 'What are the primary goals?',
  'must-include': 'Which sections / pages / slides must be included?',
  'success-criteria': 'How will success be measured?',
  'source-doc': 'Is there a long-form source document to ground the copy?',
};

export function questionPrompt(field: string, reason: QuestionReason): string {
  const base = PROMPTS[field] ?? `Provide "${field}".`;
  return reason === 'confirm' ? `Confirm: ${base}` : base;
}

export function fieldPriority(field: string): number {
  return FIELD_PRIORITY[field] ?? 99;
}
export function fieldDependencies(field: string): string[] {
  return FIELD_DEPENDENCIES[field] ?? [];
}

/**
 * Order questions by dependency (Kahn), using priority as the deterministic selection heuristic.
 * A dependency on a field that is NOT itself a planned question is treated as already satisfied
 * (it is known / provided elsewhere), so it never deadlocks.
 */
export function orderQuestions(questions: PlannedQuestion[]): PlannedQuestion[] {
  const inPlan = new Set(questions.map((q) => q.field));
  const emitted = new Set<string>();
  const pending = [...questions];
  const out: PlannedQuestion[] = [];
  while (pending.length) {
    const ready = pending.filter((q) => q.dependsOn.every((d) => emitted.has(d) || !inPlan.has(d)));
    const pool = (ready.length ? ready : pending).slice().sort((a, b) => a.priority - b.priority);
    const next = pool[0]; // cycle-safe: falls back to lowest-priority pending
    out.push(next);
    emitted.add(next.field);
    pending.splice(pending.indexOf(next), 1);
  }
  return out;
}

// ── Interview execution ───────────────────────────────────────────────────────

interface ExecutablePlan {
  readonly questionPlan: QuestionPlan;
  readonly alreadyKnown: string[];
}

/** The questions askable NOW: not yet answered, and every dependency answered or already known. */
export function nextQuestions(plan: ExecutablePlan, answered: Iterable<string>): PlannedQuestion[] {
  const done = new Set(answered);
  const known = new Set(plan.alreadyKnown);
  return plan.questionPlan.questions.filter(
    (q) => !done.has(q.field) && q.dependsOn.every((d) => done.has(d) || known.has(d)),
  );
}

/** The plan is complete when every NON-optional question has been answered. */
export function isPlanComplete(plan: ExecutablePlan, answered: Iterable<string>): boolean {
  const done = new Set(answered);
  return plan.questionPlan.questions.filter((q) => !q.optional).every((q) => done.has(q.field));
}

// ── Serialization (deterministic; the replay artifact) ──────────────────────────

/** The serializable projection of a plan — everything needed to resume/replay, no volatile data. */
export interface SerializedAcquisitionPlan {
  readonly schemaVersion: 1;
  readonly projectType: string;
  readonly track: Track;
  readonly deliverables: Track[];
  readonly sourceId: string;
  readonly strategy: CreativeStrategy;
  readonly questionPlan: QuestionPlan;
  readonly questions: string[];
  readonly ready: boolean;
  readonly alreadyKnown: string[];
  readonly critical: string[];
  readonly inferable: string[];
  readonly neverInfer: string[];
  readonly mustConfirm: string[];
}

/** Build the canonical projection (fixed key order → deterministic serialization). */
export function toSerializable(plan: AcquisitionPlan): SerializedAcquisitionPlan {
  return {
    schemaVersion: 1,
    projectType: plan.projectType,
    track: plan.track,
    deliverables: plan.deliverables,
    sourceId: plan.sourceId,
    strategy: plan.strategy,
    questionPlan: plan.questionPlan,
    questions: plan.questions,
    ready: plan.ready,
    alreadyKnown: plan.alreadyKnown,
    critical: plan.critical,
    inferable: plan.inferable,
    neverInfer: plan.neverInfer,
    mustConfirm: plan.mustConfirm,
  };
}

export function serializeAcquisitionPlan(plan: AcquisitionPlan): string {
  return JSON.stringify(toSerializable(plan), null, 2);
}

export function deserializeAcquisitionPlan(text: string): SerializedAcquisitionPlan {
  const obj = JSON.parse(text) as SerializedAcquisitionPlan;
  if (obj.schemaVersion !== 1) throw new Error(`acquisition plan: unsupported schemaVersion ${String(obj.schemaVersion)}.`);
  return obj;
}
