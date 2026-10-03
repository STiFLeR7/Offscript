/**
 * R3 — Review Intent Planning: a pure, deterministic layer converting a `ReviewSession` (R1) +
 * its `ReviewAnalysis` (R2) into an executable `ReviewPlan`. No AI, no persistence, no
 * regeneration, no HTML/browser access — every field is a grouping, sort, or pure rule over data
 * R1/R2 already produced.
 *
 * Ownership (`docs/review/R3-REVIEW-PLANNING.md` §3 for the full grounding):
 *   1. Current Review lifecycle (R1, unchanged): `OPEN → RESOLVED | DISMISSED`, one-way. This
 *      module reads that shape via R2's already-sorted `ReviewAnalysis.timeline` — it never calls
 *      `ReviewStore`/`ReviewManager`, and never calls `analyzeReviewSession` itself; both
 *      `ReviewSession` and `ReviewAnalysis` are plain, caller-supplied inputs.
 *   2. Current ownership: R1 owns persistence/mutation; R2 owns pure structural statistics; this
 *      module owns pure structural PLANNING (grouping notes into executable units) — a third,
 *      sibling, non-overlapping layer. It introduces no new fact about a review beyond what R1
 *      recorded and R2 already summarized.
 *   3. Current identifiers reused verbatim: `ReviewTarget.targetType`/`.targetId`/`.pageId`,
 *      `ReviewNote.id`/`.severity`/`.state`/`.timestamp`.
 *   4. Stable ordering guarantee reused from R2: `ReviewAnalysis.timeline` is already sorted
 *      (timestamp ascending, id tie-break) — this module iterates it directly for note ordering
 *      within a task rather than re-deriving a sort, avoiding logic duplication.
 *
 * **A named, honest limitation, not worked around:** `ReviewTarget` carries `pageId` but no
 * pointer from a component/slot to the SPECIFIC section (or from a slot to the specific component)
 * it visually nests inside — R1 never recorded that link. The dependency model below can therefore
 * only derive "this task depends on ALL tasks at the immediately-preceding rank within the SAME
 * page" (a structural, page+rank-scoped relationship) — never a specific single semantic parent,
 * since that data does not exist. See §4/§8 of the report.
 */
import type { ReviewAnalysis } from './review-analysis.js';
import type { ReviewNote, ReviewSession, ReviewSeverity, ReviewState, ReviewTarget, ReviewTargetType } from './review-session.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_PLANNING_VERSION_TAG = 'r3-review-planning@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_PLANNING_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type ReviewPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface ReviewDependency {
  readonly taskId: string;
}

export interface ReviewTaskGroup {
  readonly pageId: string;
  readonly targetType: ReviewTargetType;
  /** Deterministic composite key: `${pageId}::${targetType}`. */
  readonly key: string;
}

export interface ReviewTask {
  readonly id: string;
  readonly target: ReviewTarget;
  /** The worst (most severe) severity among ALL of this task's affected notes. */
  readonly severity: ReviewSeverity;
  /** Aggregate: `OPEN` if any note is open; else `RESOLVED` if any is resolved; else `DISMISSED`. */
  readonly state: ReviewState;
  readonly group: ReviewTaskGroup;
  readonly dependencies: readonly ReviewDependency[];
  readonly priority: ReviewPriority;
  readonly affectedNotes: readonly string[];
  readonly digest: string;
}

export interface ReviewPlan {
  readonly sessionId: string;
  readonly client: string;
  readonly track: ReviewSession['track'];
  readonly tasks: readonly ReviewTask[];
  readonly groups: readonly ReviewTaskGroup[];
  readonly digest: string;
}

/** Pure rules only — no AI, no NLP, no text understanding. Injectable so a caller can adjust the
 *  severity→priority mapping without changing the planner's own grouping/dependency logic. */
export interface ReviewPlanningPolicy {
  /** `undefined` means the task has no OPEN notes at all — nothing left to act on. */
  priorityFor(worstOpenSeverity: ReviewSeverity | undefined): ReviewPriority;
}

const DEFAULT_PRIORITY_BY_SEVERITY: Record<ReviewSeverity, ReviewPriority> = {
  blocker: 'CRITICAL',
  major: 'HIGH',
  minor: 'MEDIUM',
  nit: 'LOW',
};

export function createDefaultReviewPlanningPolicy(): ReviewPlanningPolicy {
  return {
    priorityFor(worstOpenSeverity) {
      return worstOpenSeverity === undefined ? 'INFO' : DEFAULT_PRIORITY_BY_SEVERITY[worstOpenSeverity];
    },
  };
}

export interface ReviewPlanner {
  plan(session: ReviewSession, analysis: ReviewAnalysis, policy?: ReviewPlanningPolicy): ReviewPlan;
}

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ReviewSeverity, number> = { blocker: 0, major: 1, minor: 2, nit: 3 };
const TARGET_TYPE_RANK: Record<ReviewTargetType, number> = { page: 0, section: 1, component: 2, slot: 3 };
const STATE_RANK: Record<ReviewState, number> = { OPEN: 0, RESOLVED: 1, DISMISSED: 2 };
/** Fallback grouping key for a malformed target missing `pageId` — keeps grouping total/defined
 *  for any input rather than throwing on data R1 itself would not normally produce. */
const UNASSIGNED_PAGE = '__unassigned__';

function resolvePageId(target: ReviewTarget): string {
  return target.targetType === 'page' ? target.targetId : (target.pageId ?? UNASSIGNED_PAGE);
}

function targetKey(target: ReviewTarget): string {
  return `${target.targetType}::${resolvePageId(target)}::${target.targetId}`;
}

function worstOf<T extends string>(values: readonly T[], rank: Record<T, number>): T {
  let worst = values[0];
  for (const v of values) if (rank[v] < rank[worst]) worst = v;
  return worst;
}

interface RawTask {
  readonly id: string;
  readonly target: ReviewTarget;
  readonly severity: ReviewSeverity;
  readonly state: ReviewState;
  readonly group: ReviewTaskGroup;
  readonly priority: ReviewPriority;
  readonly affectedNotes: readonly string[];
}

function buildRawTask(target: ReviewTarget, notes: readonly ReviewNote[], policy: ReviewPlanningPolicy): RawTask {
  const pageId = resolvePageId(target);
  const group: ReviewTaskGroup = Object.freeze({ pageId, targetType: target.targetType, key: `${pageId}::${target.targetType}` });

  const openSeverities = notes.filter((n) => n.state === 'OPEN').map((n) => n.severity);
  const worstOpenSeverity = openSeverities.length > 0 ? worstOf(openSeverities, SEVERITY_RANK) : undefined;

  return Object.freeze({
    id: `task:${pageId}:${target.targetType}:${target.targetId}`,
    target,
    severity: worstOf(notes.map((n) => n.severity), SEVERITY_RANK),
    state: worstOf(notes.map((n) => n.state), STATE_RANK),
    group,
    priority: policy.priorityFor(worstOpenSeverity),
    affectedNotes: Object.freeze(notes.map((n) => n.id)),
  });
}

function taskOrder(a: RawTask, b: RawTask): number {
  if (a.group.pageId !== b.group.pageId) return a.group.pageId.localeCompare(b.group.pageId);
  const rankDiff = TARGET_TYPE_RANK[a.group.targetType] - TARGET_TYPE_RANK[b.group.targetType];
  if (rankDiff !== 0) return rankDiff;
  return a.target.targetId.localeCompare(b.target.targetId);
}

/** Immediate-adjacent-rank-only dependencies (page→section→component→slot), scoped to the same
 *  page: a task depends on EVERY task at the rank directly below its own within the same page. If
 *  that rank has no tasks, the dependency is simply absent — never a skip-search to an earlier
 *  rank, and never a cross-page dependency (§8 of the report names this as a deliberate,
 *  literal-to-the-brief simplification, not an oversight). */
function attachDependencies(tasks: readonly RawTask[]): ReviewTask[] {
  const idsByPageAndRank = new Map<string, string[]>();
  for (const t of tasks) {
    const key = `${t.group.pageId}::${TARGET_TYPE_RANK[t.group.targetType]}`;
    const ids = idsByPageAndRank.get(key) ?? [];
    ids.push(t.id);
    idsByPageAndRank.set(key, ids);
  }

  return tasks.map((t) => {
    const rank = TARGET_TYPE_RANK[t.group.targetType];
    const dependencies: ReviewDependency[] =
      rank > 0 ? (idsByPageAndRank.get(`${t.group.pageId}::${rank - 1}`) ?? []).map((taskId) => ({ taskId })) : [];
    const core = { ...t, dependencies: Object.freeze(dependencies) };
    return Object.freeze({ ...core, digest: digestOf(core) });
  });
}

function dedupeAndSortGroups(tasks: readonly ReviewTask[]): ReviewTaskGroup[] {
  const seen = new Map<string, ReviewTaskGroup>();
  for (const t of tasks) if (!seen.has(t.group.key)) seen.set(t.group.key, t.group);
  return [...seen.values()].sort((a, b) => {
    if (a.pageId !== b.pageId) return a.pageId.localeCompare(b.pageId);
    return TARGET_TYPE_RANK[a.targetType] - TARGET_TYPE_RANK[b.targetType];
  });
}

// ── the planner ──────────────────────────────────────────────────────────────────────────────

export function createReviewPlanner(): ReviewPlanner {
  return {
    plan(session, analysis, policy = createDefaultReviewPlanningPolicy()) {
      if (analysis.sessionId !== session.id) {
        throw new Error(
          `ReviewPlanner: ReviewAnalysis (sessionId=${analysis.sessionId}) does not belong to the given ReviewSession (id=${session.id}) — mismatch.`,
        );
      }

      // Group notes by exact target identity — every note belongs to exactly one bucket, and
      // every bucket becomes exactly one task, so every note ends up in exactly one task.
      const buckets = new Map<string, { target: ReviewTarget; notes: ReviewNote[] }>();
      for (const note of analysis.timeline) {
        const key = targetKey(note.target);
        const bucket = buckets.get(key) ?? { target: note.target, notes: [] };
        bucket.notes.push(note);
        buckets.set(key, bucket);
      }

      const rawTasks = [...buckets.values()]
        .map(({ target, notes }) => buildRawTask(target, notes, policy))
        .sort(taskOrder);

      const tasks = attachDependencies(rawTasks);
      const groups = Object.freeze(dedupeAndSortGroups(tasks));

      const core = { sessionId: session.id, client: session.client, track: session.track, tasks: Object.freeze(tasks), groups };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2's `analyzeReviewSession` composition idiom. */
export function planReviewSession(
  session: ReviewSession,
  analysis: ReviewAnalysis,
  planner: ReviewPlanner = createReviewPlanner(),
  policy?: ReviewPlanningPolicy,
): ReviewPlan {
  return planner.plan(session, analysis, policy);
}
