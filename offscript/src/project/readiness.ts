/**
 * P54 — Project Readiness model + admission decision.
 *
 * The Readiness Gate is the explicit admission decision before generation: is this project actually
 * ready to enter the (privileged) generation pipeline? It is a PLANNING ARTIFACT — it evaluates only;
 * it never generates, executes, schedules, or invokes anything. This module owns the model (the
 * explicit states, the Blocker shape, the AdmissionDecision, the ReadinessAssessment), the pure
 * state-derivation from blockers, and a deterministic serialize/deserialize for replay. The requirement
 * derivation is a policy (readiness-policy.ts); the evaluation mechanics are in readiness-evaluator.ts.
 *
 * Pure data — no clock/rng/fs. Belongs entirely to the Project Platform; generation never imports it.
 */
import type { Track } from '../paths.js';
import type { WorkflowPlan } from './workflow.js';
import type { CreativeStrategy } from './creative-strategy.js';
import type { ProjectContext } from './project-context.js';

/** Readiness is an EXPLICIT state, never a boolean — each non-ready state names its reason. */
export type ReadinessState =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_INFORMATION'
  | 'BLOCKED'
  | 'NOT_READY';

export const READINESS_STATES: readonly ReadinessState[] = [
  'READY', 'PARTIALLY_READY', 'WAITING_FOR_APPROVAL', 'WAITING_FOR_INFORMATION', 'BLOCKED', 'NOT_READY',
];

export type BlockerCategory =
  | 'evidence' // a required canonical fact is missing
  | 'asset' // a required asset (e.g. logo / brand kit) is missing
  | 'approval' // a required approval is not granted
  | 'decision' // a required decision is open
  | 'workflow' // a required workflow task is not complete
  | 'deliverable' // a required deliverable has no generation task
  | 'dependency' // a structurally blocked dependency
  | 'conflict'; // an outstanding, unresolved conflict (e.g. a rejected required decision)

export type BlockerSeverity = 'critical' | 'major' | 'minor';

/** A self-explaining reason a project is not ready — no opaque failures. */
export interface Blocker {
  readonly id: string;
  readonly reason: string;
  readonly category: BlockerCategory;
  readonly severity: BlockerSeverity;
  /** The logical capability responsible for resolving it. */
  readonly owner: string;
  /** Concrete guidance on how to clear the blocker. */
  readonly resolution: string;
  /** Workflow task ids this blocker holds up. */
  readonly dependentTasks: string[];
}

/** The explicit generation-admission decision derived from the readiness state. */
export interface AdmissionDecision {
  readonly admitted: boolean;
  readonly state: ReadinessState;
  readonly reason: string;
}

/** The evaluated result — the readiness state, its admission decision, and the blockers explaining it. */
export interface ReadinessAssessment {
  readonly schemaVersion: 1;
  readonly projectType: string;
  readonly deliverables: Track[];
  /** The Living Project Context version this reflects (0 without context). */
  readonly version: number;
  readonly policyId: string;
  readonly state: ReadinessState;
  readonly admission: AdmissionDecision;
  readonly blockers: Blocker[];
  /** Requirement ids that passed (the audit of what IS satisfied). */
  readonly satisfied: string[];
  readonly summary: string;
}

/** The readiness-relevant projection of a project — the evaluator's input. */
export interface ProjectReadiness {
  readonly projectType: string;
  readonly deliverables: Track[];
  readonly workflow: WorkflowPlan;
  readonly strategy: CreativeStrategy;
  readonly context?: ProjectContext;
}

/** Information (non-approval) major categories vs the approval category — the WAITING_* split. */
const INFO_CATEGORIES: ReadonlySet<BlockerCategory> = new Set<BlockerCategory>(['evidence', 'asset', 'decision', 'workflow', 'deliverable']);

/**
 * Derive the explicit readiness state from the blockers. Precedence (highest first):
 *   critical → BLOCKED · none → READY · only minor → PARTIALLY_READY ·
 *   both approval+info majors → NOT_READY · approval-only → WAITING_FOR_APPROVAL ·
 *   info-only → WAITING_FOR_INFORMATION.
 */
export function deriveReadinessState(blockers: readonly Blocker[]): ReadinessState {
  if (blockers.some((b) => b.severity === 'critical')) return 'BLOCKED';
  if (blockers.length === 0) return 'READY';
  const majors = blockers.filter((b) => b.severity === 'major');
  if (majors.length === 0) return 'PARTIALLY_READY';
  const approval = majors.some((b) => b.category === 'approval');
  const info = majors.some((b) => INFO_CATEGORIES.has(b.category));
  if (approval && info) return 'NOT_READY';
  if (approval) return 'WAITING_FOR_APPROVAL';
  return 'WAITING_FOR_INFORMATION';
}

const ADMISSION_REASON: Record<ReadinessState, string> = {
  READY: 'all required conditions satisfied — admitted to generation.',
  PARTIALLY_READY: 'required conditions met, but optional enrichment is missing.',
  WAITING_FOR_APPROVAL: 'awaiting required approval before generation.',
  WAITING_FOR_INFORMATION: 'awaiting required information before generation.',
  BLOCKED: 'a critical blocker must be resolved before generation.',
  NOT_READY: 'multiple required conditions are unmet.',
};

/** Admission is granted ONLY in READY. Every other state is explained by its blockers. */
export function decideAdmission(state: ReadinessState, blockers: readonly Blocker[]): AdmissionDecision {
  const detail = blockers.length ? ` (${blockers.map((b) => b.reason).join('; ')})` : '';
  return { admitted: state === 'READY', state, reason: state === 'READY' ? ADMISSION_REASON.READY : ADMISSION_REASON[state] + detail };
}

// ── Serialization (deterministic replay artifact) ───────────────────────────────

const BLOCKER_KEYS: (keyof Blocker)[] = ['id', 'reason', 'category', 'severity', 'owner', 'resolution', 'dependentTasks'];

function orderBlocker(b: Blocker): Blocker {
  const o = {} as Record<string, unknown>;
  for (const k of BLOCKER_KEYS) o[k] = b[k];
  return o as unknown as Blocker;
}

export function serializeReadiness(a: ReadinessAssessment): string {
  const canonical: ReadinessAssessment = {
    schemaVersion: 1,
    projectType: a.projectType,
    deliverables: a.deliverables,
    version: a.version,
    policyId: a.policyId,
    state: a.state,
    admission: { admitted: a.admission.admitted, state: a.admission.state, reason: a.admission.reason },
    blockers: a.blockers.map(orderBlocker),
    satisfied: a.satisfied,
    summary: a.summary,
  };
  return JSON.stringify(canonical, null, 2);
}

export function deserializeReadiness(text: string): ReadinessAssessment {
  const obj = JSON.parse(text) as ReadinessAssessment;
  if (obj.schemaVersion !== 1) throw new Error(`readiness: unsupported schemaVersion ${String(obj.schemaVersion)}.`);
  return obj;
}
