/**
 * R3 — Review Intent Planning (RED-first).
 *
 * A pure, deterministic layer converting a `ReviewSession` (R1) + its `ReviewAnalysis` (R2) into
 * an executable `ReviewPlan`. No AI, no persistence, no regeneration, no HTML/browser access.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createReviewPlanner,
  createDefaultReviewPlanningPolicy,
  planReviewSession,
  type ReviewPriority,
} from '../../src/review/review-planning.js';
import { analyzeReviewSession } from '../../src/review/review-analysis.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';

function target(overrides: Partial<ReviewTarget> = {}): ReviewTarget {
  return { client: 'acme', track: 'website', targetType: 'page', targetId: 'home', pageId: undefined, ...overrides };
}

function note(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: randomUUID(), target: target(), timestamp: '2026-01-01T00:00:00.000Z', author: 'r1',
    text: 'x', severity: 'minor', state: 'OPEN', category: undefined, ...overrides,
  };
}

function session(notes: ReviewNote[], id = 'session-1'): ReviewSession {
  return {
    id, client: 'acme', track: 'website',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    notes, digest: 'irrelevant',
  };
}

function planFor(notes: ReviewNote[]) {
  const s = session(notes);
  return planReviewSession(s, analyzeReviewSession(s));
}

describe('R3 — planReviewSession — every note appears exactly once', () => {
  it('an empty session produces an empty plan without error', () => {
    const plan = planFor([]);
    expect(plan.tasks).toEqual([]);
    expect(plan.groups).toEqual([]);
  });

  it('a single note produces a single task listing exactly that note', () => {
    const n = note();
    const plan = planFor([n]);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].affectedNotes).toEqual([n.id]);
    expect(plan.tasks[0].severity).toBe('minor');
    expect(plan.tasks[0].state).toBe('OPEN');
  });

  it('multiple notes on the exact same target merge into ONE task, never duplicated', () => {
    const t = target({ targetType: 'section', targetId: 'hero', pageId: 'home' });
    const a = note({ id: 'a', target: t, severity: 'nit' });
    const b = note({ id: 'b', target: t, severity: 'blocker' });
    const plan = planFor([a, b]);
    expect(plan.tasks).toHaveLength(1);
    expect([...plan.tasks[0].affectedNotes].sort()).toEqual(['a', 'b']);
    expect(plan.tasks[0].severity).toBe('blocker'); // worst severity across all notes on this target
  });

  it('every note across a realistic multi-target session appears in exactly one task, with no duplicates', () => {
    const notes = [
      note({ id: 'n1', target: target({ targetType: 'page', targetId: 'home' }) }),
      note({ id: 'n2', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
      note({ id: 'n3', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }), // same target as n2
      note({ id: 'n4', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'home' }) }),
      note({ id: 'n5', target: target({ targetType: 'slot', targetId: 'headline', pageId: 'about' }) }),
    ];
    const plan = planFor(notes);
    const allAffected = plan.tasks.flatMap((t) => t.affectedNotes);
    expect(allAffected.sort()).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    expect(new Set(allAffected).size).toBe(allAffected.length); // no duplicates
    expect(plan.tasks).toHaveLength(4); // home/page, home/section:hero, home/component:card-grid, about/slot:headline
    const taskIds = plan.tasks.map((t) => t.id);
    expect(new Set(taskIds).size).toBe(taskIds.length); // no duplicate task ids
  });
});

describe('R3 — grouping hierarchy', () => {
  const notes = [
    note({ id: 'p1', target: target({ targetType: 'page', targetId: 'home' }) }),
    note({ id: 's1', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
    note({ id: 'c1', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'home' }) }),
    note({ id: 'sl1', target: target({ targetType: 'slot', targetId: 'headline', pageId: 'home' }) }),
  ];

  it('groups tasks by page, then target type, with a stable composite key', () => {
    const plan = planFor(notes);
    const byId = Object.fromEntries(plan.tasks.map((t) => [t.affectedNotes[0], t]));
    expect(byId.p1.group).toEqual({ pageId: 'home', targetType: 'page', key: 'home::page' });
    expect(byId.s1.group).toEqual({ pageId: 'home', targetType: 'section', key: 'home::section' });
    expect(byId.c1.group).toEqual({ pageId: 'home', targetType: 'component', key: 'home::component' });
    expect(byId.sl1.group).toEqual({ pageId: 'home', targetType: 'slot', key: 'home::slot' });
    expect(plan.groups).toHaveLength(4);
  });

  it('orders tasks deterministically: page before section before component before slot within a page', () => {
    // feed notes in reverse/shuffled order to prove sort, not insertion order
    const plan = planFor([notes[3], notes[1], notes[2], notes[0]]);
    expect(plan.tasks.map((t) => t.group.targetType)).toEqual(['page', 'section', 'component', 'slot']);
  });

  it('orders pages alphabetically, and breaks ties within a rank by targetId', () => {
    const n = [
      note({ id: 'z-sec', target: target({ targetType: 'section', targetId: 'zeta', pageId: 'about' }) }),
      note({ id: 'a-sec', target: target({ targetType: 'section', targetId: 'alpha', pageId: 'about' }) }),
      note({ id: 'home-page', target: target({ targetType: 'page', targetId: 'home' }) }),
    ];
    const plan = planFor(n);
    expect(plan.tasks.map((t) => t.group.pageId)).toEqual(['about', 'about', 'home']);
    expect(plan.tasks.slice(0, 2).map((t) => t.target.targetId)).toEqual(['alpha', 'zeta']);
  });
});

describe('R3 — dependency model', () => {
  it('a section task depends on the page task of the same page', () => {
    const notes = [
      note({ id: 'p', target: target({ targetType: 'page', targetId: 'home' }) }),
      note({ id: 's', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
    ];
    const plan = planFor(notes);
    const pageTask = plan.tasks.find((t) => t.group.targetType === 'page')!;
    const sectionTask = plan.tasks.find((t) => t.group.targetType === 'section')!;
    expect(sectionTask.dependencies).toEqual([{ taskId: pageTask.id }]);
    expect(pageTask.dependencies).toEqual([]);
  });

  it('a component task depends on ALL section tasks in the same page; a slot task depends on ALL component tasks', () => {
    const notes = [
      note({ id: 's1', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
      note({ id: 's2', target: target({ targetType: 'section', targetId: 'footer', pageId: 'home' }) }),
      note({ id: 'c1', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'home' }) }),
      note({ id: 'sl1', target: target({ targetType: 'slot', targetId: 'headline', pageId: 'home' }) }),
    ];
    const plan = planFor(notes);
    const sectionTaskIds = plan.tasks.filter((t) => t.group.targetType === 'section').map((t) => t.id).sort();
    const componentTask = plan.tasks.find((t) => t.group.targetType === 'component')!;
    const slotTask = plan.tasks.find((t) => t.group.targetType === 'slot')!;
    expect(componentTask.dependencies.map((d) => d.taskId).sort()).toEqual(sectionTaskIds);
    expect(slotTask.dependencies.map((d) => d.taskId)).toEqual([componentTask.id]);
  });

  it('when the immediately-preceding rank has no tasks in a page, the dependency is simply absent (no skip-search)', () => {
    // a page with a component note but NO section note and NO page note
    const notes = [note({ id: 'c1', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'lonely' }) })];
    const plan = planFor(notes);
    expect(plan.tasks[0].dependencies).toEqual([]);
  });

  it('never derives a cross-page dependency', () => {
    const notes = [
      note({ id: 'p-home', target: target({ targetType: 'page', targetId: 'home' }) }),
      note({ id: 's-about', target: target({ targetType: 'section', targetId: 'hero', pageId: 'about' }) }),
    ];
    const plan = planFor(notes);
    const sectionTask = plan.tasks.find((t) => t.group.targetType === 'section')!;
    expect(sectionTask.dependencies).toEqual([]); // 'about' has no page-level task of its own
  });
});

describe('R3 — priority (pure rules only)', () => {
  it.each([
    ['blocker', 'CRITICAL'],
    ['major', 'HIGH'],
    ['minor', 'MEDIUM'],
    ['nit', 'LOW'],
  ] as const)('an OPEN %s note maps to %s priority', (severity, expected: ReviewPriority) => {
    const plan = planFor([note({ severity, state: 'OPEN' })]);
    expect(plan.tasks[0].priority).toBe(expected);
  });

  it('a task with no OPEN notes (all resolved/dismissed) maps to INFO regardless of severity', () => {
    const plan = planFor([note({ severity: 'blocker', state: 'RESOLVED' })]);
    expect(plan.tasks[0].priority).toBe('INFO');
  });

  it('priority reflects only OPEN notes\' worst severity — a dismissed blocker never outranks an open nit', () => {
    const t = target({ targetType: 'section', targetId: 'hero', pageId: 'home' });
    const plan = planFor([
      note({ target: t, severity: 'blocker', state: 'DISMISSED' }),
      note({ target: t, severity: 'nit', state: 'OPEN' }),
    ]);
    expect(plan.tasks[0].priority).toBe('LOW');
  });

  it('a custom ReviewPlanningPolicy overrides the default mapping', () => {
    const policy = { priorityFor: () => 'CRITICAL' as ReviewPriority };
    const s = session([note({ severity: 'nit', state: 'OPEN' })]);
    const plan = createReviewPlanner().plan(s, analyzeReviewSession(s), policy);
    expect(plan.tasks[0].priority).toBe('CRITICAL');
  });
});

describe('R3 — determinism and replay', () => {
  it('repeated planning of the same session+analysis is byte-identical', () => {
    const notes = [note({ id: 'a' }), note({ id: 'b', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) })];
    const s = session(notes);
    const a = analyzeReviewSession(s);
    const first = planReviewSession(s, a);
    const second = planReviewSession(s, a);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('planning the same logical session fed via a differently-ordered notes array is identical', () => {
    const notes = [
      note({ id: 'a', target: target({ targetType: 'page', targetId: 'home' }) }),
      note({ id: 'b', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
      note({ id: 'c', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'home' }) }),
    ];
    const forward = planFor(notes);
    const shuffled = planFor([notes[2], notes[0], notes[1]]);
    expect(forward.tasks.map((t) => t.id)).toEqual(shuffled.tasks.map((t) => t.id));
    expect(forward.digest).toBe(shuffled.digest);
  });

  it('each task carries a stable digest that changes only when its own content changes', () => {
    const plan1 = planFor([note({ id: 'a', severity: 'minor' })]);
    const plan2 = planFor([note({ id: 'a', severity: 'major' })]);
    expect(plan1.tasks[0].digest).not.toBe(plan2.tasks[0].digest);
  });

  it('throws if the given ReviewAnalysis does not belong to the given ReviewSession', () => {
    const s1 = session([note({ id: 'a' })], 'session-1');
    const s2 = session([note({ id: 'b' })], 'session-2');
    expect(() => planReviewSession(s1, analyzeReviewSession(s2))).toThrow(/session|mismatch/i);
  });

  it('returns a frozen ReviewPlan, tasks, and groups', () => {
    const plan = planFor([note()]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.tasks)).toBe(true);
    expect(Object.isFrozen(plan.tasks[0])).toBe(true);
    expect(Object.isFrozen(plan.groups)).toBe(true);
  });

  it('createReviewPlanner().plan() matches the planReviewSession() convenience function', () => {
    const s = session([note()]);
    const a = analyzeReviewSession(s);
    const planner = createReviewPlanner();
    expect(planner.plan(s, a)).toEqual(planReviewSession(s, a, planner));
  });
});
