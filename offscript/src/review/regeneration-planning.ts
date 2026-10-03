/**
 * R5 — Regeneration Planning: the deterministic execution contract that determines what
 * regeneration WOULD occur, given a `ReviewScope` (R4) and a `ProjectModel` (F4). This is NOT
 * regeneration — nothing is executed, generated, or written. No AI, no browser, no persistence.
 *
 * Ownership (`docs/review/R5-REGENERATION-PLANNING.md` §2/§4 for the full grounding):
 *   1. **The smallest independently regeneratable unit today is the WHOLE PROJECT.**
 *      `ProjectGenerator.generate(model, ctx)` (F5) always takes the COMPLETE `ProjectModel` — there
 *      is no overload, parameter, or code path anywhere in Program F (F2 load → F3 transform → F4
 *      model build → F5 generate) that accepts a subset of pages/sections. `GeneratedProject.files`
 *      happens to be organized as one descriptor artifact PER PAGE (an OUTPUT shape), but that is
 *      not an independent INVOCATION granularity — you cannot call `generate()` for just one page.
 *   2. **Generator boundaries that already exist:** exactly one, `ProjectGenerator.generate(model,
 *      ctx): GeneratedProject` (F5). A future filesystem writer COULD selectively write only some
 *      of `GeneratedProject.files` to disk (F5 §6) — but that writer is explicitly unbuilt (F5 §2
 *      row 4), so even "partial write of an already-fully-regenerated output" isn't a real
 *      capability yet, let alone partial regeneration itself.
 *   3. **No `ScopeImpact` can currently regenerate independently — not even `PAGE`.** A
 *      `PAGE`-impact `ScopeTarget` cannot trigger a page-only regeneration; the only executable
 *      action is a full `generate()` call over the whole model, which regenerates every other page
 *      too. This module's default policy honestly reflects that: every RESOLVED `ScopeImpact`
 *      (`PAGE`/`SECTION`/`COMPONENT`/`SLOT`/`MULTIPLE`) coarsens to `RegenerationUnit.WHOLE_PROJECT`
 *      — never a smaller, unbuilt unit (STOP/RULES: "Never invent smaller units than Program F can
 *      actually regenerate"). Only `UNKNOWN` (an unresolved `ScopeTarget`, R4) stays `UNKNOWN` — we
 *      do not know what, if anything, needs to happen, so nothing is claimed.
 *   4. **`RegenerationImpact` names the coarsening itself** (STOP/RULES: "If regeneration
 *      granularity is coarser than the review scope, preserve that honestly") — `EXACT` when the
 *      chosen unit already matches the target's own ideal granularity (only possible for
 *      `MULTIPLE`, whose ideal is already `WHOLE_PROJECT`), `COARSENED` when Program F's real
 *      capability forced a broader unit than the scope asked for, `UNKNOWN` when nothing could be
 *      determined at all. This is distinct from `unit` (WHAT would be regenerated) — `impact`
 *      records HOW HONEST that answer is relative to what the review scope actually asked for.
 *   5. **Tasks are grouped by the ACTUAL (coarsened) unit, never one-per-`ScopeTarget`.** Since
 *      today there are at most two real outcomes (`WHOLE_PROJECT`/`UNKNOWN`), emitting one task per
 *      `ScopeTarget` would fabricate N identical "regenerate the whole project" tasks when exactly
 *      one real action covers all of them — precisely the duplication VALIDATION forbids
 *      ("No duplicated regeneration tasks"). Every `ScopeTarget` is still accounted for via
 *      `RegenerationTask.affectedTargets`.
 */
import type { ReviewScope, ScopeImpact, ScopeTarget } from './review-scope.js';
import type { ProjectModel } from '../fullstack/project-model.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REGENERATION_PLANNING_VERSION_TAG = 'r5-regeneration-planning@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REGENERATION_PLANNING_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** The full granularity vocabulary a `ScopeTarget` could ideally map to — deliberately as rich as
 *  `ScopeImpact` (§ header note 1) so a FUTURE, more capable generator has somewhere to grow into.
 *  What Program F can actually execute TODAY is far narrower — see `RegenerationPlanningPolicy`. */
export type RegenerationUnit = 'WHOLE_PROJECT' | 'PAGE' | 'SECTION' | 'COMPONENT' | 'SLOT' | 'UNKNOWN';

/** Records the relationship between what the review scope asked for and what could actually be
 *  planned — never a semantic judgment, purely "did the unit change to satisfy real capability?" */
export type RegenerationImpact = 'EXACT' | 'COARSENED' | 'UNKNOWN';

export type RegenerationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface RegenerationDependency {
  readonly taskId: string;
}

export interface RegenerationTask {
  readonly id: string;
  readonly unit: RegenerationUnit;
  readonly impact: RegenerationImpact;
  /** `ScopeTarget.taskId` values (R4) this regeneration task covers — every one traceable back
   *  through R4 to an R3 `ReviewTask` and ultimately R1 `ReviewNote`s. */
  readonly affectedTargets: readonly string[];
  /** A real, data-driven explanation (counts are live, never a placeholder) — never AI-authored
   *  prose, never semantic interpretation of note content. */
  readonly reason: string;
  readonly dependencies: readonly RegenerationDependency[];
  readonly priority: RegenerationPriority;
  readonly digest: string;
}

export interface RegenerationPlan {
  readonly sessionId: string;
  readonly client: string;
  readonly track: ReviewScope['track'];
  readonly tasks: readonly RegenerationTask[];
  /** `ProjectModel.digest` this plan was computed against — traces every plan back to its source,
   *  the same posture `GenerationManifest.sourceDigest` (F4) and `GeneratorManifest.sourceModelDigest`
   *  (F5) already hold. */
  readonly sourceModelDigest: string;
  readonly digest: string;
}

/** Pure rules only — no AI, no NLP, no filesystem/browser access. Injectable so a FUTURE, more
 *  capable generator can claim finer real capability without changing this module's grouping logic. */
export interface RegenerationPlanningPolicy {
  /** Never return a unit finer than what Program F can currently execute (STOP/RULES) — the
   *  default policy floors every known impact at `WHOLE_PROJECT`; only `UNKNOWN` passes through. */
  resolveUnit(idealUnit: RegenerationUnit): RegenerationUnit;
  priorityFor(unit: RegenerationUnit, impact: RegenerationImpact): RegenerationPriority;
}

const IDEAL_UNIT_BY_SCOPE_IMPACT: Record<ScopeImpact, RegenerationUnit> = {
  PAGE: 'PAGE',
  SECTION: 'SECTION',
  COMPONENT: 'COMPONENT',
  SLOT: 'SLOT',
  MULTIPLE: 'WHOLE_PROJECT',
  UNKNOWN: 'UNKNOWN',
};

export function createDefaultRegenerationPlanningPolicy(): RegenerationPlanningPolicy {
  return {
    resolveUnit(idealUnit) {
      // Program F's ONLY executable regeneration entry point is a whole-model `generate()` call
      // (F5) — see header note 1. Nothing finer is real capability today.
      return idealUnit === 'UNKNOWN' ? 'UNKNOWN' : 'WHOLE_PROJECT';
    },
    priorityFor(unit, impact) {
      if (unit === 'UNKNOWN') return 'INFO';
      return impact === 'COARSENED' ? 'HIGH' : 'MEDIUM';
    },
  };
}

export interface RegenerationPlanner {
  plan(scope: ReviewScope, model: ProjectModel, policy?: RegenerationPlanningPolicy): RegenerationPlan;
}

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────

const IMPACT_RANK: Record<RegenerationImpact, number> = { UNKNOWN: 0, COARSENED: 1, EXACT: 2 };

function worstOf<T extends string>(values: readonly T[], rank: Record<T, number>): T {
  let worst = values[0];
  for (const v of values) if (rank[v] < rank[worst]) worst = v;
  return worst;
}

function reasonFor(unit: RegenerationUnit, count: number): string {
  if (unit === 'UNKNOWN') {
    return `${count} scope target(s) could not be resolved onto real project structure — no regeneration can be determined.`;
  }
  return (
    `${count} scope target(s) require regeneration; Program F's current generator (F5) only supports ` +
    `whole-project regeneration — no independent page/section/component/slot regeneration exists yet.`
  );
}

interface Member {
  readonly taskId: string;
  readonly impact: RegenerationImpact;
}

function computeImpact(idealUnit: RegenerationUnit, actualUnit: RegenerationUnit): RegenerationImpact {
  if (actualUnit === 'UNKNOWN') return 'UNKNOWN';
  return idealUnit === actualUnit ? 'EXACT' : 'COARSENED';
}

// ── the planner ──────────────────────────────────────────────────────────────────────────────

export function createRegenerationPlanner(): RegenerationPlanner {
  return {
    plan(scope, model, policy = createDefaultRegenerationPlanningPolicy()) {
      if (scope.client !== model.manifest.client || scope.track !== model.manifest.track) {
        throw new Error(
          `RegenerationPlanner: ReviewScope (client=${scope.client}, track=${scope.track}) does not belong to the given ` +
            `ProjectModel (client=${model.manifest.client}, track=${model.manifest.track}) — mismatch.`,
        );
      }

      // Group by ACTUAL unit — never one task per ScopeTarget (header note 5) — so N targets that
      // all coarsen to the same real action collapse into exactly one task, never duplicated.
      const buckets = new Map<RegenerationUnit, Member[]>();
      for (const target of scope.targets) {
        const idealUnit = IDEAL_UNIT_BY_SCOPE_IMPACT[target.impact];
        const actualUnit = policy.resolveUnit(idealUnit);
        const impact = computeImpact(idealUnit, actualUnit);
        const bucket = buckets.get(actualUnit) ?? [];
        bucket.push({ taskId: target.taskId, impact });
        buckets.set(actualUnit, bucket);
      }

      const units = [...buckets.keys()].sort();
      const tasks: RegenerationTask[] = units.map((unit) => {
        const members = buckets.get(unit)!;
        const affectedTargets = Object.freeze(members.map((m) => m.taskId).sort());
        const impact = worstOf(members.map((m) => m.impact), IMPACT_RANK);
        const core = {
          id: `regen:${unit}`,
          unit,
          impact,
          affectedTargets,
          reason: reasonFor(unit, members.length),
          dependencies: Object.freeze([] as RegenerationDependency[]),
          priority: policy.priorityFor(unit, impact),
        };
        return Object.freeze({ ...core, digest: digestOf(core) });
      });

      const core = {
        sessionId: scope.sessionId,
        client: scope.client,
        track: scope.track,
        tasks: Object.freeze(tasks),
        sourceModelDigest: model.digest,
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2/R3/R4's own `analyze`/`plan`/`resolve` convenience idiom. */
export function resolveRegenerationPlan(
  scope: ReviewScope,
  model: ProjectModel,
  planner: RegenerationPlanner = createRegenerationPlanner(),
  policy?: RegenerationPlanningPolicy,
): RegenerationPlan {
  return planner.plan(scope, model, policy);
}
