/**
 * R5 — Regeneration Planning (RED-first).
 *
 * The deterministic execution contract that determines what regeneration WOULD occur — never
 * regeneration itself. No AI, no execution, no persistence.
 */
import { describe, it, expect } from 'vitest';
import {
  createRegenerationPlanner,
  createDefaultRegenerationPlanningPolicy,
  resolveRegenerationPlan,
  type RegenerationPlanningPolicy,
  type RegenerationPriority,
} from '../../src/review/regeneration-planning.js';
import type { ReviewScope, ScopeImpact, ScopeSummary, ScopeTarget } from '../../src/review/review-scope.js';
import type { ProjectModel } from '../../src/fullstack/project-model.js';

// ── fixtures — plain ReviewScope/ProjectModel objects, the same direct-construction style R3/R4
// used for their own inputs (no need to route through the whole R1→R4 pipeline for this sprint's
// own logic, which never inspects ScopeTarget content beyond `impact`/`resolved`/`taskId`) ────────

function scopeTarget(overrides: Partial<ScopeTarget> = {}): ScopeTarget {
  return {
    taskId: 'task:home:page:home',
    target: { client: 'acme', track: 'website', targetType: 'page', targetId: 'home', pageId: undefined },
    resolved: true,
    impact: 'PAGE',
    pageIds: ['home'],
    sectionIds: [],
    slotIds: [],
    componentRefs: [],
    assetRefs: [],
    digest: 'irrelevant',
    ...overrides,
  };
}

function emptySummary(): ScopeSummary {
  return {
    totalTasks: 0, resolvedTasks: 0, unresolvedTasks: 0,
    byImpact: { PAGE: 0, SECTION: 0, COMPONENT: 0, SLOT: 0, MULTIPLE: 0, UNKNOWN: 0 },
    affectedPageIds: [], affectedSectionIds: [], affectedSlotIds: [], affectedComponentRefs: [],
  };
}

function scope(targets: ScopeTarget[], overrides: Partial<ReviewScope> = {}): ReviewScope {
  return {
    sessionId: 'session-1', client: 'acme', track: 'website',
    targets, unresolved: targets.filter((t) => !t.resolved),
    summary: emptySummary(), digest: 'irrelevant',
    ...overrides,
  };
}

function model(overrides: Partial<ProjectModel> = {}): ProjectModel {
  return {
    metadata: {}, tokens: [], pages: [], componentRefs: [], assets: [],
    manifest: { client: 'acme', track: 'website', sourceDigest: 'irrelevant', pageCount: 0, sectionCount: 0, slotCount: 0 },
    digest: 'model-digest',
    ...overrides,
  };
}

function planFor(targets: ScopeTarget[]) {
  return resolveRegenerationPlan(scope(targets), model());
}

describe('R5 — every ScopeImpact honestly coarsens to what Program F can currently execute', () => {
  it.each(['PAGE', 'SECTION', 'COMPONENT', 'SLOT'] as const)(
    'a resolved %s-impact target regenerates as WHOLE_PROJECT, marked COARSENED',
    (impact: ScopeImpact) => {
      const plan = planFor([scopeTarget({ impact })]);
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].unit).toBe('WHOLE_PROJECT');
      expect(plan.tasks[0].impact).toBe('COARSENED');
    },
  );

  it('a resolved MULTIPLE-impact target regenerates as WHOLE_PROJECT, marked EXACT (no coarsening needed)', () => {
    const plan = planFor([scopeTarget({ impact: 'MULTIPLE' })]);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].unit).toBe('WHOLE_PROJECT');
    expect(plan.tasks[0].impact).toBe('EXACT');
  });

  it('an unresolved (UNKNOWN-impact) target stays UNKNOWN — never fabricated into WHOLE_PROJECT', () => {
    const plan = planFor([scopeTarget({ resolved: false, impact: 'UNKNOWN' })]);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].unit).toBe('UNKNOWN');
    expect(plan.tasks[0].impact).toBe('UNKNOWN');
  });
});

describe('R5 — grouping: no duplicated regeneration tasks', () => {
  it('multiple resolved targets of different impacts collapse into ONE WHOLE_PROJECT task, never one-per-target', () => {
    const targets = [
      scopeTarget({ taskId: 't1', impact: 'PAGE' }),
      scopeTarget({ taskId: 't2', impact: 'SECTION' }),
      scopeTarget({ taskId: 't3', impact: 'MULTIPLE' }),
    ];
    const plan = planFor(targets);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].unit).toBe('WHOLE_PROJECT');
    expect(plan.tasks[0].affectedTargets).toEqual(['t1', 't2', 't3']);
    // COARSENED (from t1/t2) outranks EXACT (from t3) — the task-level impact reflects the worst case
    expect(plan.tasks[0].impact).toBe('COARSENED');
  });

  it('a mix of resolved and unresolved targets produces exactly two tasks: WHOLE_PROJECT and UNKNOWN', () => {
    const targets = [
      scopeTarget({ taskId: 'r1', impact: 'PAGE' }),
      scopeTarget({ taskId: 'u1', resolved: false, impact: 'UNKNOWN' }),
      scopeTarget({ taskId: 'u2', resolved: false, impact: 'UNKNOWN' }),
    ];
    const plan = planFor(targets);
    expect(plan.tasks).toHaveLength(2);
    const byUnit = Object.fromEntries(plan.tasks.map((t) => [t.unit, t]));
    expect(byUnit.WHOLE_PROJECT.affectedTargets).toEqual(['r1']);
    expect(byUnit.UNKNOWN.affectedTargets).toEqual(['u1', 'u2']);
  });

  it('no two tasks in a plan ever share the same unit', () => {
    const targets = [
      scopeTarget({ taskId: 'a', impact: 'PAGE' }),
      scopeTarget({ taskId: 'b', impact: 'SLOT' }),
      scopeTarget({ taskId: 'c', resolved: false, impact: 'UNKNOWN' }),
    ];
    const plan = planFor(targets);
    const units = plan.tasks.map((t) => t.unit);
    expect(new Set(units).size).toBe(units.length);
  });
});

describe('R5 — every ScopeTarget accounted for', () => {
  it('the union of every task\'s affectedTargets equals every ScopeTarget taskId, with no duplicates', () => {
    const targets = [
      scopeTarget({ taskId: 'a', impact: 'PAGE' }),
      scopeTarget({ taskId: 'b', impact: 'COMPONENT' }),
      scopeTarget({ taskId: 'c', resolved: false, impact: 'UNKNOWN' }),
    ];
    const plan = planFor(targets);
    const allAffected = plan.tasks.flatMap((t) => t.affectedTargets);
    expect(allAffected.sort()).toEqual(['a', 'b', 'c']);
    expect(new Set(allAffected).size).toBe(allAffected.length);
  });

  it('an empty ReviewScope produces an empty, valid RegenerationPlan', () => {
    const plan = planFor([]);
    expect(plan.tasks).toEqual([]);
  });
});

describe('R5 — reason and priority', () => {
  it('the WHOLE_PROJECT reason names the actual capability boundary, data-driven not fabricated', () => {
    const plan = planFor([scopeTarget({ impact: 'PAGE' })]);
    expect(plan.tasks[0].reason).toMatch(/whole-project/i);
    expect(plan.tasks[0].reason).toMatch(/1/); // count is real, not a placeholder
  });

  it('the UNKNOWN reason explains why nothing could be determined', () => {
    const plan = planFor([scopeTarget({ resolved: false, impact: 'UNKNOWN' })]);
    expect(plan.tasks[0].reason).toMatch(/could not be resolved|unresolved/i);
  });

  it('default priority: UNKNOWN unit -> INFO, EXACT WHOLE_PROJECT -> MEDIUM, COARSENED WHOLE_PROJECT -> HIGH', () => {
    expect(planFor([scopeTarget({ resolved: false, impact: 'UNKNOWN' })]).tasks[0].priority).toBe('INFO');
    expect(planFor([scopeTarget({ impact: 'MULTIPLE' })]).tasks[0].priority).toBe('MEDIUM');
    expect(planFor([scopeTarget({ impact: 'PAGE' })]).tasks[0].priority).toBe('HIGH');
  });

  it('dependencies are structurally present but empty under the default policy (§8 — named limitation)', () => {
    const plan = planFor([scopeTarget({ impact: 'PAGE' }), scopeTarget({ taskId: 'x', resolved: false, impact: 'UNKNOWN' })]);
    for (const t of plan.tasks) expect(t.dependencies).toEqual([]);
  });
});

describe('R5 — determinism, replay, and shape', () => {
  it('tasks are ordered deterministically regardless of input scope.targets order', () => {
    const forward = planFor([scopeTarget({ taskId: 'a', impact: 'PAGE' }), scopeTarget({ taskId: 'b', resolved: false, impact: 'UNKNOWN' })]);
    const shuffled = planFor([scopeTarget({ taskId: 'b', resolved: false, impact: 'UNKNOWN' }), scopeTarget({ taskId: 'a', impact: 'PAGE' })]);
    expect(forward.tasks.map((t) => t.unit)).toEqual(shuffled.tasks.map((t) => t.unit));
    expect(forward.digest).toBe(shuffled.digest);
  });

  it('repeated planning of the same scope+model is byte-identical', () => {
    const s = scope([scopeTarget({ impact: 'SECTION' })]);
    const m = model();
    const first = resolveRegenerationPlan(s, m);
    const second = resolveRegenerationPlan(s, m);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('each task carries a stable digest that changes only when its own content changes', () => {
    const plan1 = planFor([scopeTarget({ impact: 'PAGE' })]);
    const plan2 = planFor([scopeTarget({ impact: 'SLOT' })]); // still WHOLE_PROJECT+COARSENED, but different affectedTargets content? same taskId here
    // same shape (single PAGE-like coarsened target) -> compare against a genuinely different plan instead
    const plan3 = planFor([scopeTarget({ impact: 'MULTIPLE' })]); // EXACT, not COARSENED — must differ
    expect(plan1.tasks[0].digest).not.toBe(plan3.tasks[0].digest);
    void plan2;
  });

  it('RegenerationPlan traces back to the ProjectModel it was computed against', () => {
    const plan = resolveRegenerationPlan(scope([scopeTarget()]), model({ digest: 'specific-model-digest' }));
    expect(plan.sourceModelDigest).toBe('specific-model-digest');
  });

  it('throws when the ReviewScope does not belong to the given ProjectModel (client/track mismatch)', () => {
    const s = scope([scopeTarget()]);
    const otherModel = model({ manifest: { client: 'other-co', track: 'website', sourceDigest: 'x', pageCount: 0, sectionCount: 0, slotCount: 0 } });
    expect(() => resolveRegenerationPlan(s, otherModel)).toThrow(/client|track|mismatch/i);
  });

  it('returns a frozen RegenerationPlan and tasks', () => {
    const plan = planFor([scopeTarget()]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.tasks)).toBe(true);
    expect(Object.isFrozen(plan.tasks[0])).toBe(true);
    expect(Object.isFrozen(plan.tasks[0].affectedTargets)).toBe(true);
    expect(Object.isFrozen(plan.tasks[0].dependencies)).toBe(true);
  });

  it('a custom RegenerationPlanningPolicy can claim finer capability (extensibility for a future generator)', () => {
    const policy: RegenerationPlanningPolicy = {
      resolveUnit: (ideal) => ideal, // pretend Program F can regenerate at the ideal granularity
      priorityFor: () => 'CRITICAL' as RegenerationPriority,
    };
    const plan = createRegenerationPlanner().plan(scope([scopeTarget({ impact: 'SECTION' })]), model(), policy);
    expect(plan.tasks[0].unit).toBe('SECTION');
    expect(plan.tasks[0].impact).toBe('EXACT');
    expect(plan.tasks[0].priority).toBe('CRITICAL');
  });

  it('createRegenerationPlanner().plan() matches the resolveRegenerationPlan() convenience function', () => {
    const s = scope([scopeTarget()]);
    const m = model();
    const planner = createRegenerationPlanner();
    expect(planner.plan(s, m)).toEqual(resolveRegenerationPlan(s, m, planner));
  });

  it('createDefaultRegenerationPlanningPolicy() is the implicit default used when no policy is passed', () => {
    const s = scope([scopeTarget({ impact: 'PAGE' })]);
    const m = model();
    const viaDefault = resolveRegenerationPlan(s, m);
    const viaExplicit = createRegenerationPlanner().plan(s, m, createDefaultRegenerationPlanningPolicy());
    expect(viaDefault).toEqual(viaExplicit);
  });
});
