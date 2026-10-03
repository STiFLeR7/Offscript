/**
 * R4 — Review Scope Resolution: the deterministic bridge between Review Planning (R3) and Program
 * F's `ProjectModel` (F4). Answers "what parts of the project are affected?" — never "how should
 * they change?". No AI, no regeneration, no browser, no HTML inspection. Pure — a `ReviewScope` is
 * recomputed from scratch on every call, never persisted (STOP/PERSISTENCE: "ReviewScope is
 * derived. Never persisted.").
 *
 * Ownership (`docs/review/R4-REVIEW-SCOPE-RESOLUTION.md` §2 for the full grounding):
 *   1. Stable identifiers shared with `ProjectModel` (F4): `ReviewTarget.targetType`/`.targetId`/
 *      `.pageId` was DEFINED (R1 §2.3) by reusing `ProjectModel`'s own vocabulary —
 *      `ProjectPage.id`/`.role`, `ViewNode.id`/`.kind`('section'|'slot')/`.componentRef`. This
 *      module is the first to actually WALK a `ProjectModel` to resolve those references; R1–R3
 *      only ever carried the identifiers, never looked them up.
 *   2. A named, honest gap: `ReviewTargetType` includes `'component'`, but `ProjectModel.ViewNode`
 *      has no `kind: 'component'` — only `'section'` and `'slot'` are structural node kinds. A
 *      "component" in this codebase is a `componentRef` STRING (e.g. `'section:hero'`), not a tree
 *      node. A component `ReviewTarget` is therefore resolved by searching for that ref string
 *      across the model (every `ProjectPage.componentRef`, every `ViewNode.componentRef`, and —
 *      only when no page/view match exists — membership in `ProjectModel.componentRefs`, the sole
 *      remaining source per F4 §3's own construction, the document/application-shell reference).
 *      Never a fabricated match — see `resolveComponentTarget` below.
 *   3. `target.pageId` scopes resolution for `'section'`/`'slot'` targets (both are only
 *      addressable within their declared page — no cross-page search, no skip-search, matching R3's
 *      own "never infer missing structure" discipline). It is deliberately NOT used to scope
 *      `'component'` targets: a `componentRef` is not owned by a single page — the same component
 *      can legitimately appear on several pages — so restricting the search to one page would risk
 *      reporting a real, existing usage as unresolved. `pageId` on a component target is carried
 *      through informationally only.
 *   4. Impact classification is purely structural (STOP: "No semantic interpretation."): how many
 *      distinct page/section/slot occurrences did this ONE task's target resolve to? Zero →
 *      `UNKNOWN`. Exactly one → the task's own target-type category. More than one (only possible
 *      for `'component'` targets, since a page/section/slot target can resolve to at most one node
 *      by identity) → `MULTIPLE`.
 */
import type { ReviewPlan, ReviewTask } from './review-planning.js';
import type { ReviewTarget, ReviewTargetType } from './review-session.js';
import type { ProjectModel, ViewNode } from '../fullstack/project-model.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_SCOPE_VERSION_TAG = 'r4-review-scope-resolution@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_SCOPE_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type ScopeImpact = 'PAGE' | 'SECTION' | 'COMPONENT' | 'SLOT' | 'MULTIPLE' | 'UNKNOWN';

export interface ScopeTarget {
  /** The `ReviewTask.id` (R3) this scope entry resolves — the stable link back to the plan. */
  readonly taskId: string;
  /** The underlying R1 target, carried through verbatim. */
  readonly target: ReviewTarget;
  readonly resolved: boolean;
  readonly impact: ScopeImpact;
  readonly pageIds: readonly string[];
  readonly sectionIds: readonly string[];
  readonly slotIds: readonly string[];
  readonly componentRefs: readonly string[];
  /** Always `[]` today — `ProjectModel.assets` is always `[]` (F4 §2: no RIR asset/media data
   *  source exists yet). Typed and carried through so a future generator's contract doesn't need
   *  to change shape when that source lands — never fabricated in the meantime. */
  readonly assetRefs: readonly string[];
  readonly digest: string;
}

export interface ScopeSummary {
  readonly totalTasks: number;
  readonly resolvedTasks: number;
  readonly unresolvedTasks: number;
  readonly byImpact: Readonly<Record<ScopeImpact, number>>;
  readonly affectedPageIds: readonly string[];
  readonly affectedSectionIds: readonly string[];
  readonly affectedSlotIds: readonly string[];
  readonly affectedComponentRefs: readonly string[];
}

export interface ReviewScope {
  readonly sessionId: string;
  readonly client: string;
  readonly track: ReviewPlan['track'];
  /** One entry per `ReviewTask`, same order as `plan.tasks`. */
  readonly targets: readonly ScopeTarget[];
  /** The subset of `targets` where `resolved === false` — reported explicitly, never dropped. */
  readonly unresolved: readonly ScopeTarget[];
  readonly summary: ScopeSummary;
  readonly digest: string;
}

/** Pure, structural classification only — no AI, no NLP, no semantic interpretation. Injectable so
 *  a caller can adjust the classification rule without changing the resolver's own matching logic. */
export interface ScopeResolutionPolicy {
  classifyImpact(targetType: ReviewTargetType, occurrenceCount: number, resolved: boolean): ScopeImpact;
}

const IMPACT_BY_TARGET_TYPE: Record<ReviewTargetType, ScopeImpact> = {
  page: 'PAGE',
  section: 'SECTION',
  component: 'COMPONENT',
  slot: 'SLOT',
};

export function createDefaultScopeResolutionPolicy(): ScopeResolutionPolicy {
  return {
    classifyImpact(targetType, occurrenceCount, resolved) {
      if (!resolved) return 'UNKNOWN';
      return occurrenceCount > 1 ? 'MULTIPLE' : IMPACT_BY_TARGET_TYPE[targetType];
    },
  };
}

export interface ScopeResolver {
  resolve(plan: ReviewPlan, model: ProjectModel, policy?: ScopeResolutionPolicy): ReviewScope;
}

// ── pure resolution helpers ─────────────────────────────────────────────────────────────────────

interface RawMatch {
  readonly resolved: boolean;
  readonly pageIds: readonly string[];
  readonly sectionIds: readonly string[];
  readonly slotIds: readonly string[];
  readonly componentRefs: readonly string[];
  readonly occurrenceCount: number;
}

const UNRESOLVED_MATCH: RawMatch = { resolved: false, pageIds: [], sectionIds: [], slotIds: [], componentRefs: [], occurrenceCount: 0 };

function resolvePageTarget(target: ReviewTarget, model: ProjectModel): RawMatch {
  const page = model.pages.find((p) => p.id === target.targetId);
  if (!page) return UNRESOLVED_MATCH;
  return { resolved: true, pageIds: [page.id], sectionIds: [], slotIds: [], componentRefs: [], occurrenceCount: 1 };
}

function findViewNode(nodes: readonly ViewNode[], kind: 'section' | 'slot', id: string): ViewNode | undefined {
  for (const n of nodes) {
    if (n.kind === kind && n.id === id) return n;
    const found = findViewNode(n.children, kind, id);
    if (found) return found;
  }
  return undefined;
}

function resolveSectionOrSlotTarget(target: ReviewTarget, model: ProjectModel, kind: 'section' | 'slot'): RawMatch {
  // A section/slot is only addressable within its declared page — never guessed across pages
  // (STOP: "Never infer missing structure"). Missing pageId or an unknown page is unresolved, not
  // a fallback search over every page.
  if (target.pageId === undefined) return UNRESOLVED_MATCH;
  const page = model.pages.find((p) => p.id === target.pageId);
  if (!page) return UNRESOLVED_MATCH;
  const node = findViewNode(page.view, kind, target.targetId);
  if (!node) return UNRESOLVED_MATCH;
  return {
    resolved: true,
    pageIds: [page.id],
    sectionIds: kind === 'section' ? [node.id] : [],
    slotIds: kind === 'slot' ? [node.id] : [],
    componentRefs: [],
    occurrenceCount: 1,
  };
}

function collectComponentOccurrences(model: ProjectModel, ref: string): { pageIds: string[]; sectionIds: string[]; slotIds: string[]; occurrenceCount: number } {
  const pageComponentMatches: string[] = [];
  const containingPageIds = new Set<string>();
  const sectionIds: string[] = [];
  const slotIds: string[] = [];

  const walk = (pageId: string, nodes: readonly ViewNode[]): void => {
    for (const n of nodes) {
      if (n.componentRef === ref) {
        containingPageIds.add(pageId);
        (n.kind === 'section' ? sectionIds : slotIds).push(n.id);
      }
      walk(pageId, n.children);
    }
  };

  for (const page of model.pages) {
    if (page.componentRef === ref) pageComponentMatches.push(page.id);
    walk(page.id, page.view);
  }

  return {
    pageIds: [...new Set([...pageComponentMatches, ...containingPageIds])],
    sectionIds,
    slotIds,
    occurrenceCount: pageComponentMatches.length + sectionIds.length + slotIds.length,
  };
}

function resolveComponentTarget(target: ReviewTarget, model: ProjectModel): RawMatch {
  // pageId is deliberately NOT used to scope this search — see header §3.
  const occ = collectComponentOccurrences(model, target.targetId);
  if (occ.occurrenceCount > 0) {
    return { resolved: true, pageIds: occ.pageIds, sectionIds: occ.sectionIds, slotIds: occ.slotIds, componentRefs: [target.targetId], occurrenceCount: occ.occurrenceCount };
  }
  // No page/view carries this ref. The only other source of a componentRef in a ProjectModel is the
  // document (application-shell) reference folded into `componentRefs` by F4's own
  // `collectComponentRefs` (F4-PROJECT-MODEL.md §3) — matched here by set membership in data the
  // model already carries, never guessed or invented.
  if (model.componentRefs.includes(target.targetId)) {
    return { resolved: true, pageIds: [], sectionIds: [], slotIds: [], componentRefs: [target.targetId], occurrenceCount: 1 };
  }
  return UNRESOLVED_MATCH;
}

function resolveMatch(target: ReviewTarget, model: ProjectModel): RawMatch {
  switch (target.targetType) {
    case 'page':
      return resolvePageTarget(target, model);
    case 'section':
      return resolveSectionOrSlotTarget(target, model, 'section');
    case 'slot':
      return resolveSectionOrSlotTarget(target, model, 'slot');
    case 'component':
      return resolveComponentTarget(target, model);
  }
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function resolveTaskScope(task: ReviewTask, model: ProjectModel, policy: ScopeResolutionPolicy): ScopeTarget {
  const raw = resolveMatch(task.target, model);
  const impact = policy.classifyImpact(task.target.targetType, raw.occurrenceCount, raw.resolved);
  const core = {
    taskId: task.id,
    target: task.target,
    resolved: raw.resolved,
    impact,
    pageIds: Object.freeze(sortedUnique(raw.pageIds)),
    sectionIds: Object.freeze(sortedUnique(raw.sectionIds)),
    slotIds: Object.freeze(sortedUnique(raw.slotIds)),
    componentRefs: Object.freeze(sortedUnique(raw.componentRefs)),
    assetRefs: Object.freeze([] as string[]),
  };
  return Object.freeze({ ...core, digest: digestOf(core) });
}

// ── the resolver ─────────────────────────────────────────────────────────────────────────────

export function createScopeResolver(): ScopeResolver {
  return {
    resolve(plan, model, policy = createDefaultScopeResolutionPolicy()) {
      if (plan.client !== model.manifest.client || plan.track !== model.manifest.track) {
        throw new Error(
          `ScopeResolver: ReviewPlan (client=${plan.client}, track=${plan.track}) does not belong to the given ` +
            `ProjectModel (client=${model.manifest.client}, track=${model.manifest.track}) — mismatch.`,
        );
      }

      const targets = plan.tasks.map((task) => resolveTaskScope(task, model, policy));
      const unresolved = targets.filter((t) => !t.resolved);

      const byImpact: Record<ScopeImpact, number> = { PAGE: 0, SECTION: 0, COMPONENT: 0, SLOT: 0, MULTIPLE: 0, UNKNOWN: 0 };
      for (const t of targets) byImpact[t.impact]++;

      const summary: ScopeSummary = Object.freeze({
        totalTasks: targets.length,
        resolvedTasks: targets.length - unresolved.length,
        unresolvedTasks: unresolved.length,
        byImpact: Object.freeze(byImpact),
        affectedPageIds: Object.freeze(sortedUnique(targets.flatMap((t) => t.pageIds))),
        affectedSectionIds: Object.freeze(sortedUnique(targets.flatMap((t) => t.sectionIds))),
        affectedSlotIds: Object.freeze(sortedUnique(targets.flatMap((t) => t.slotIds))),
        affectedComponentRefs: Object.freeze(sortedUnique(targets.flatMap((t) => t.componentRefs))),
      });

      const core = {
        sessionId: plan.sessionId,
        client: plan.client,
        track: plan.track,
        targets: Object.freeze(targets),
        unresolved: Object.freeze(unresolved),
        summary,
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2/R3's `analyzeReviewSession`/`planReviewSession` idiom. */
export function resolveReviewScope(
  plan: ReviewPlan,
  model: ProjectModel,
  resolver: ScopeResolver = createScopeResolver(),
  policy?: ScopeResolutionPolicy,
): ReviewScope {
  return resolver.resolve(plan, model, policy);
}
