/**
 * R6 — Regeneration Readiness: the admission gate that determines whether a `RegenerationPlan`
 * (R5) may execute, given the optional `WorkspaceState` (F13) Program F currently tracks for that
 * workspace. This sprint decides only — nothing is regenerated, nothing is written, nothing is
 * mutated. No AI, no browser, no HTML, no persistence.
 *
 * Ownership (`docs/review/R6-REGENERATION-READINESS.md` §3 for the full grounding):
 *   1. **Execution prerequisites, as they exist today:** (a) a `WorkspaceState` record must exist
 *      for the (client, track) at all — F13 has no notion of "this workspace" without one
 *      (`WorkspaceStateManager.get()` returns `undefined` for an untracked workspace); (b) that
 *      workspace must have a recorded generation (`WorkspaceState.generation !== undefined`) — you
 *      cannot regenerate a project that was never generated; (c) every `RegenerationTask.unit` must
 *      be something Program F can actually execute — today ONLY `'WHOLE_PROJECT'` (R5 §4, reused
 *      verbatim, never re-derived here) — a `'UNKNOWN'`-unit task can never execute, independent of
 *      workspace state.
 *   2. **Workspace assumptions, reused read-only from F13, never recomputed:**
 *      `WorkspaceState.project.client`/`.track` must match the plan's own identity;
 *      `WorkspaceState.status` (`'FAILED'`/`'STALE'`/…) is F13's OWN derived health signal — this
 *      module reads it, never re-derives `deriveStatus`'s logic.
 *   3. **Whether Program F can execute the requested plan:** only the `WHOLE_PROJECT`-unit tasks
 *      (via `generateProject`, F5) — `UNKNOWN`-unit tasks can NEVER execute today, regardless of any
 *      workspace state (R5's own finding, reused, never re-derived). This module reports that as an
 *      `UNRESOLVED_SCOPE` blocker, not as a capability question — the capability ceiling itself
 *      (whole-project-only granularity) is R5's `RegenerationImpact === 'COARSENED'`, informational,
 *      never something this module blocks on.
 *   4. **Blockers: permanent vs. operational (§6 of the report):** every blocker category this
 *      module can raise today (`WORKSPACE_MISSING`, `PROJECT_NOT_GENERATED`, `WORKSPACE_UNHEALTHY`,
 *      `UNRESOLVED_SCOPE`, `INVALID_INPUT`) is OPERATIONAL — resolvable by an action a caller can
 *      take (generate, re-plan, fix the underlying review data, resolve a preview failure). None is
 *      a permanent architectural ceiling; the one real permanent constraint in this whole area
 *      (whole-project-only regeneration) is not modeled as a blocker at all, since no input to THIS
 *      module could ever resolve it.
 *
 * **A named, honestly-documented gap, not worked around (§6 of the report):** `RegenerationPlan
 * .sourceModelDigest` is a `ProjectModel.digest` (F4) — the INPUT to generation. F13's
 * `WorkspaceState.digests.generationDigest` is a `GeneratedProject.digest` (F5) — the OUTPUT of
 * generation. These are two DIFFERENT hash domains that were never designed to be compared, the
 * exact mistake F13's own header already warns against making with F9's `PreviewProject.digest`.
 * No field in `WorkspaceState` today carries a `ProjectModel.digest` this module could compare
 * `sourceModelDigest` against — so this module does NOT attempt a staleness/mismatch check between
 * the plan and the tracked generation. `sourceModelDigest` is still carried through on
 * `ReadinessDecision` for provenance/tracing only, never compared. A future enhancement to F13
 * (recording the source `ProjectModel.digest` alongside `generationDigest`) is the real fix — not
 * built here, per STOP ("Do not modify Program F").
 */
import type { RegenerationPlan, RegenerationTask } from './regeneration-planning.js';
import type { WorkspaceState } from '../fullstack/workspace-state.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REGENERATION_READINESS_VERSION_TAG = 'r6-regeneration-readiness@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REGENERATION_READINESS_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type RegenerationReadiness = 'READY' | 'WAITING_FOR_WORKSPACE' | 'WAITING_FOR_PROJECT' | 'BLOCKED' | 'INVALID' | 'UNKNOWN';

export type ReadinessBlockerSeverity = 'BLOCKING' | 'WARNING';

export type ReadinessBlockerCategory =
  | 'INVALID_INPUT'
  | 'WORKSPACE_MISSING'
  | 'PROJECT_NOT_GENERATED'
  | 'WORKSPACE_UNHEALTHY'
  | 'UNRESOLVED_SCOPE'
  | 'INDETERMINATE_CAPABILITY';

export interface ReadinessBlocker {
  readonly category: ReadinessBlockerCategory;
  readonly severity: ReadinessBlockerSeverity;
  /** Real, data-driven explanation (counts/ids are live) — never AI-authored, never speculative. */
  readonly reason: string;
  /** `RegenerationTask.id` values this blocker specifically covers — `[]` for a workspace-level
   *  blocker that isn't about any one task. */
  readonly affectedTasks: readonly string[];
  /** A plain, data-driven suggestion of what would resolve this blocker — never a semantic
   *  interpretation of the review content itself. */
  readonly resolution: string;
}

export interface ReadinessSummary {
  readonly totalTasks: number;
  /** Tasks whose OWN unit is something Program F can execute today (i.e. not `'UNKNOWN'`) —
   *  independent of workspace-level gating, which blocks the whole plan regardless of which task. */
  readonly executableTasks: number;
  readonly blockedTasks: number;
  readonly blockerCount: number;
  readonly blockingBlockerCount: number;
  readonly warningBlockerCount: number;
}

export interface ReadinessDecision {
  readonly sessionId: string;
  readonly client: string;
  readonly track: RegenerationPlan['track'];
  readonly state: RegenerationReadiness;
  readonly blockers: readonly ReadinessBlocker[];
  readonly summary: ReadinessSummary;
  /** = `RegenerationPlan.sourceModelDigest` — traces this decision back to the plan it evaluated. */
  readonly sourceModelDigest: string;
  readonly digest: string;
}

/** Pure rules only — no AI, no NLP, no filesystem/browser access, no workspace mutation.
 *  Injectable so a future sprint can add new blocker categories without touching the evaluator's
 *  own state-derivation/summary logic. */
export interface RegenerationReadinessPolicy {
  evaluate(plan: RegenerationPlan, workspaceState: WorkspaceState | undefined): readonly ReadinessBlocker[];
}

// ── default policy — the real rules, grounded in F13's actual WorkspaceState shape ─────────────

/** The only unit `generateProject` (F5) is confirmed to execute today (R5 §4). */
const CONFIRMED_EXECUTABLE_UNIT = 'WHOLE_PROJECT';

function unresolvedScopeBlockers(plan: RegenerationPlan): ReadinessBlocker[] {
  const unresolved = plan.tasks.filter((t) => t.unit === 'UNKNOWN');
  if (unresolved.length === 0) return [];
  return [
    {
      category: 'UNRESOLVED_SCOPE',
      severity: 'BLOCKING',
      reason: `${unresolved.length} regeneration task(s) reference scope that could not be resolved onto real project structure — nothing can be regenerated for them.`,
      affectedTasks: Object.freeze(unresolved.map((t) => t.id).sort()),
      resolution: 'Resolve the underlying review targets (R1) so Review Scope Resolution (R4) can map them onto real project structure, then re-plan (R5).',
    },
  ];
}

/** R5's `RegenerationPlanningPolicy` is injectable — a custom policy can already claim a finer unit
 *  (e.g. `'SECTION'`) than Program F has confirmed capability for (R5's own extensibility test).
 *  This evaluator only KNOWS two facts: `'WHOLE_PROJECT'` is confirmed executable, `'UNKNOWN'` is
 *  confirmed unresolved. Any OTHER unit is neither — genuinely indeterminate, not fabricated into
 *  either BLOCKED or READY. */
function indeterminateCapabilityBlockers(plan: RegenerationPlan): ReadinessBlocker[] {
  const indeterminate = plan.tasks.filter((t) => t.unit !== CONFIRMED_EXECUTABLE_UNIT && t.unit !== 'UNKNOWN');
  if (indeterminate.length === 0) return [];
  const units = [...new Set(indeterminate.map((t) => t.unit))].sort();
  return [
    {
      category: 'INDETERMINATE_CAPABILITY',
      severity: 'BLOCKING',
      reason: `${indeterminate.length} regeneration task(s) declare a unit (${units.join(', ')}) that Program F's current, confirmed capability (whole-project-only, R5 §4) has not verified as executable.`,
      affectedTasks: Object.freeze(indeterminate.map((t) => t.id).sort()),
      resolution: 'Confirm whether Program F can actually execute this granularity before admitting the plan — today only WHOLE_PROJECT is confirmed.',
    },
  ];
}

function workspaceBlockers(plan: RegenerationPlan, workspaceState: WorkspaceState | undefined): ReadinessBlocker[] {
  if (workspaceState === undefined) {
    return [
      {
        category: 'WORKSPACE_MISSING',
        severity: 'BLOCKING',
        reason: `No WorkspaceState was provided for ${plan.client}/${plan.track} — Program F's tracked state for this workspace is unknown.`,
        affectedTasks: [],
        resolution: 'Provide the current WorkspaceState for this (client, track), e.g. via WorkspaceStateManager.get().',
      },
    ];
  }

  if (workspaceState.project.client !== plan.client || workspaceState.project.track !== plan.track) {
    return [
      {
        category: 'INVALID_INPUT',
        severity: 'BLOCKING',
        reason: `WorkspaceState (${workspaceState.project.client}/${workspaceState.project.track}) does not belong to this RegenerationPlan (${plan.client}/${plan.track}).`,
        affectedTasks: [],
        resolution: 'Pass the WorkspaceState for the same (client, track) as the RegenerationPlan.',
      },
    ];
  }

  if (workspaceState.generation === undefined) {
    return [
      {
        category: 'PROJECT_NOT_GENERATED',
        severity: 'BLOCKING',
        reason: `${plan.client}/${plan.track} has no recorded generation yet — nothing exists to regenerate.`,
        affectedTasks: [],
        resolution: 'Run an initial generation (Program F) for this workspace before requesting a regeneration.',
      },
    ];
  }

  // Deliberately NOT a digest comparison against `workspaceState.digests.generationDigest` — see
  // the header's named gap: that field is a `GeneratedProject.digest` (F5, an OUTPUT), while
  // `plan.sourceModelDigest` is a `ProjectModel.digest` (F4, an INPUT) — different hash domains.
  const blockers: ReadinessBlocker[] = [];

  if (workspaceState.status === 'FAILED') {
    blockers.push({
      category: 'WORKSPACE_UNHEALTHY',
      severity: 'BLOCKING',
      reason: `${plan.client}/${plan.track}'s tracked workspace status is FAILED.`,
      affectedTasks: [],
      resolution: 'Investigate and resolve the underlying preview/health failure (Program F) before regenerating.',
    });
  } else if (workspaceState.status === 'STALE') {
    blockers.push({
      category: 'WORKSPACE_UNHEALTHY',
      severity: 'WARNING',
      reason: `${plan.client}/${plan.track}'s tracked workspace status is STALE (generated and materialized digests disagree).`,
      affectedTasks: [],
      resolution: 'Informational — regenerating will typically resolve this; no action required before proceeding.',
    });
  }

  return blockers;
}

export function createDefaultRegenerationReadinessPolicy(): RegenerationReadinessPolicy {
  return {
    evaluate(plan, workspaceState) {
      return [...workspaceBlockers(plan, workspaceState), ...unresolvedScopeBlockers(plan), ...indeterminateCapabilityBlockers(plan)];
    },
  };
}

export interface RegenerationReadinessEvaluator {
  decide(plan: RegenerationPlan, workspaceState?: WorkspaceState, policy?: RegenerationReadinessPolicy): ReadinessDecision;
}

// ── state derivation — worst blocking category wins; WARNING blockers never change state ───────

const STATE_BY_CATEGORY: Record<ReadinessBlockerCategory, RegenerationReadiness> = {
  INVALID_INPUT: 'INVALID',
  WORKSPACE_MISSING: 'WAITING_FOR_WORKSPACE',
  PROJECT_NOT_GENERATED: 'WAITING_FOR_PROJECT',
  WORKSPACE_UNHEALTHY: 'BLOCKED',
  UNRESOLVED_SCOPE: 'BLOCKED',
  INDETERMINATE_CAPABILITY: 'UNKNOWN',
};

const STATE_RANK: Record<RegenerationReadiness, number> = {
  INVALID: 0, WAITING_FOR_WORKSPACE: 1, WAITING_FOR_PROJECT: 2, BLOCKED: 3, UNKNOWN: 4, READY: 5,
};

function deriveState(blockers: readonly ReadinessBlocker[]): RegenerationReadiness {
  const blocking = blockers.filter((b) => b.severity === 'BLOCKING');
  if (blocking.length === 0) return 'READY';
  return blocking.reduce<RegenerationReadiness>((worst, b) => {
    const candidate = STATE_BY_CATEGORY[b.category];
    return STATE_RANK[candidate] < STATE_RANK[worst] ? candidate : worst;
  }, 'READY');
}

function summarize(tasks: readonly RegenerationTask[], blockers: readonly ReadinessBlocker[]): ReadinessSummary {
  const blockedTaskIds = new Set(blockers.flatMap((b) => b.affectedTasks));
  const blockedTasks = tasks.filter((t) => blockedTaskIds.has(t.id)).length;
  return {
    totalTasks: tasks.length,
    executableTasks: tasks.length - blockedTasks,
    blockedTasks,
    blockerCount: blockers.length,
    blockingBlockerCount: blockers.filter((b) => b.severity === 'BLOCKING').length,
    warningBlockerCount: blockers.filter((b) => b.severity === 'WARNING').length,
  };
}

const EMPTY_SUMMARY: ReadinessSummary = { totalTasks: 0, executableTasks: 0, blockedTasks: 0, blockerCount: 0, blockingBlockerCount: 0, warningBlockerCount: 0 };

export function createRegenerationReadinessEvaluator(): RegenerationReadinessEvaluator {
  return {
    decide(plan, workspaceState, policy = createDefaultRegenerationReadinessPolicy()) {
      // An empty plan has nothing to admit or block — vacuously READY regardless of workspace
      // state (§5 of the report: not a fabrication, since executing a no-op plan is always safe).
      if (plan.tasks.length === 0) {
        const core = {
          sessionId: plan.sessionId,
          client: plan.client,
          track: plan.track,
          state: 'READY' as RegenerationReadiness,
          blockers: Object.freeze([] as ReadinessBlocker[]),
          summary: Object.freeze({ ...EMPTY_SUMMARY }),
          sourceModelDigest: plan.sourceModelDigest,
        };
        return Object.freeze({ ...core, digest: digestOf(core) });
      }

      const blockers = Object.freeze(
        policy.evaluate(plan, workspaceState).map((b) => Object.freeze({ ...b, affectedTasks: Object.freeze([...b.affectedTasks].sort()) })),
      );
      const state = deriveState(blockers);
      const summary = Object.freeze(summarize(plan.tasks, blockers));

      const core = { sessionId: plan.sessionId, client: plan.client, track: plan.track, state, blockers, summary, sourceModelDigest: plan.sourceModelDigest };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2–R5's own `analyze`/`plan`/`resolve` convenience idiom. */
export function evaluateRegenerationReadiness(
  plan: RegenerationPlan,
  workspaceState?: WorkspaceState,
  evaluator: RegenerationReadinessEvaluator = createRegenerationReadinessEvaluator(),
  policy?: RegenerationReadinessPolicy,
): ReadinessDecision {
  return evaluator.decide(plan, workspaceState, policy);
}
