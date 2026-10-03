/**
 * R4 — Review Scope Resolution (see note on TDD ordering in the report — implementation was
 * written before this test file; RED was retroactively verified by moving `review-scope.ts` aside
 * and confirming a real "module not found" failure before restoring it, mirroring F12/R3's own
 * documented precedent for this exact deviation).
 *
 * The deterministic bridge between a `ReviewPlan` (R3) and a `ProjectModel` (F4): resolves every
 * `ReviewTask`'s target onto real project structure. No AI, no regeneration, no browser, no HTML.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createScopeResolver,
  resolveReviewScope,
  type ScopeImpact,
  type ScopeResolutionPolicy,
} from '../../src/review/review-scope.js';
import { planReviewSession } from '../../src/review/review-planning.js';
import { analyzeReviewSession } from '../../src/review/review-analysis.js';
import type { ReviewNote, ReviewPlan, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';
import type { ProjectModel, ProjectPage, ViewNode } from '../../src/fullstack/project-model.js';

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────

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

function planFor(notes: ReviewNote[]): ReviewPlan {
  const s = session(notes);
  return planReviewSession(s, analyzeReviewSession(s));
}

function viewNode(kind: 'section' | 'slot', id: string, componentRef = `${kind}:${id}`, children: ViewNode[] = []): ViewNode {
  return { id, kind, componentRef, props: {}, digest: 'irrelevant', children };
}

function collectRefs(nodes: readonly ViewNode[]): string[] {
  return nodes.flatMap((n) => [n.componentRef, ...collectRefs(n.children)]);
}

function page(id: string, view: ViewNode[] = [], componentRef = 'page:generic'): ProjectPage {
  return { id, role: 'page', componentRef, view, digest: 'irrelevant' };
}

function model(pages: ProjectPage[], overrides: Partial<ProjectModel> = {}): ProjectModel {
  const componentRefs = [...new Set(['document:website', ...pages.map((p) => p.componentRef), ...pages.flatMap((p) => collectRefs(p.view))])].sort();
  return {
    metadata: { title: 'Acme' },
    tokens: [],
    pages,
    componentRefs,
    assets: [],
    manifest: { client: 'acme', track: 'website', sourceDigest: 'irrelevant', pageCount: pages.length, sectionCount: 0, slotCount: 0 },
    digest: 'irrelevant',
    ...overrides,
  };
}

// ── the 'home' page fixture used across most tests: page > section:hero > slot:headline ────────

function homeModel(): ProjectModel {
  return model([page('home', [viewNode('section', 'hero', 'section:hero', [viewNode('slot', 'headline', 'slot:headline')])])]);
}

describe('R4 — resolution: page targets', () => {
  it('a page target resolves to its matching ProjectPage — impact PAGE', () => {
    const plan = planFor([note({ target: target({ targetType: 'page', targetId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets).toHaveLength(1);
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('PAGE');
    expect(scope.targets[0].pageIds).toEqual(['home']);
  });

  it('an unknown page id is unresolved — impact UNKNOWN, never fabricated', () => {
    const plan = planFor([note({ target: target({ targetType: 'page', targetId: 'ghost' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(false);
    expect(scope.targets[0].impact).toBe('UNKNOWN');
    expect(scope.targets[0].pageIds).toEqual([]);
    expect(scope.unresolved).toEqual([scope.targets[0]]);
  });
});

describe('R4 — resolution: section/slot targets', () => {
  it('a section target resolves within its declared page — impact SECTION', () => {
    const plan = planFor([note({ target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('SECTION');
    expect(scope.targets[0].pageIds).toEqual(['home']);
    expect(scope.targets[0].sectionIds).toEqual(['hero']);
  });

  it('a slot target resolves even when nested inside a section — impact SLOT', () => {
    const plan = planFor([note({ target: target({ targetType: 'slot', targetId: 'headline', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('SLOT');
    expect(scope.targets[0].slotIds).toEqual(['headline']);
  });

  it('a section/slot target with no pageId is unresolved — never guesses which page', () => {
    const plan = planFor([note({ target: target({ targetType: 'section', targetId: 'hero', pageId: undefined }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(false);
    expect(scope.targets[0].impact).toBe('UNKNOWN');
  });

  it('a section/slot target with an unknown pageId is unresolved', () => {
    const plan = planFor([note({ target: target({ targetType: 'section', targetId: 'hero', pageId: 'ghost' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(false);
  });

  it('a section/slot target with the right page but an unknown targetId is unresolved — never a cross-page search', () => {
    const plan = planFor([note({ target: target({ targetType: 'section', targetId: 'ghost-section', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(false);
  });
});

describe('R4 — resolution: component targets', () => {
  it('a component target used exactly once resolves — impact COMPONENT', () => {
    const plan = planFor([note({ target: target({ targetType: 'component', targetId: 'section:hero', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('COMPONENT');
    expect(scope.targets[0].componentRefs).toEqual(['section:hero']);
    expect(scope.targets[0].pageIds).toEqual(['home']);
    expect(scope.targets[0].sectionIds).toEqual(['hero']);
  });

  it('a component target used in two places (same page) resolves — impact MULTIPLE', () => {
    const m = model([page('home', [viewNode('section', 'hero', 'shared:card'), viewNode('section', 'footer', 'shared:card')])]);
    const plan = planFor([note({ target: target({ targetType: 'component', targetId: 'shared:card', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, m);
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('MULTIPLE');
    expect(scope.targets[0].sectionIds).toEqual(['footer', 'hero']);
  });

  it('a component target used on a DIFFERENT page than its own pageId still resolves — pageId is informational only', () => {
    const m = model([
      page('home', [viewNode('section', 'hero', 'shared:card')]),
      page('about', []),
    ]);
    // note claims pageId 'about', but the ref actually lives on 'home' — must still resolve
    const plan = planFor([note({ target: target({ targetType: 'component', targetId: 'shared:card', pageId: 'about' }) })]);
    const scope = resolveReviewScope(plan, m);
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].pageIds).toEqual(['home']);
  });

  it('a component target matching only the document-level ref resolves — impact COMPONENT, no page attribution', () => {
    const plan = planFor([note({ target: target({ targetType: 'component', targetId: 'document:website', pageId: undefined }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(true);
    expect(scope.targets[0].impact).toBe('COMPONENT');
    expect(scope.targets[0].pageIds).toEqual([]);
    expect(scope.targets[0].componentRefs).toEqual(['document:website']);
  });

  it('a component target with no matching ref anywhere is unresolved — never fabricated', () => {
    const plan = planFor([note({ target: target({ targetType: 'component', targetId: 'nonexistent:thing', pageId: 'home' }) })]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets[0].resolved).toBe(false);
    expect(scope.targets[0].impact).toBe('UNKNOWN');
  });
});

describe('R4 — coverage and accounting', () => {
  const notes = [
    note({ id: 'p1', target: target({ targetType: 'page', targetId: 'home' }) }),
    note({ id: 's1', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) }),
    note({ id: 'sl1', target: target({ targetType: 'slot', targetId: 'headline', pageId: 'home' }) }),
    note({ id: 'g1', target: target({ targetType: 'section', targetId: 'ghost', pageId: 'home' }) }),
  ];

  it('every ReviewTask is accounted for — one ScopeTarget per task, no duplicates', () => {
    const plan = planFor(notes);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets).toHaveLength(plan.tasks.length);
    expect(new Set(scope.targets.map((t) => t.taskId)).size).toBe(scope.targets.length);
    expect(scope.targets.map((t) => t.taskId)).toEqual(plan.tasks.map((t) => t.id));
  });

  it('assetRefs is always [] — no RIR asset/media source exists yet, never fabricated', () => {
    const plan = planFor(notes);
    const scope = resolveReviewScope(plan, homeModel());
    for (const t of scope.targets) expect(t.assetRefs).toEqual([]);
  });

  it('coverage summary counts resolved vs unresolved tasks correctly', () => {
    const plan = planFor(notes);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.summary.totalTasks).toBe(4);
    expect(scope.summary.unresolvedTasks).toBe(1); // the 'ghost' section
    expect(scope.summary.resolvedTasks).toBe(3);
    expect(scope.unresolved).toHaveLength(1);
  });

  it('coverage summary tallies byImpact structurally', () => {
    const plan = planFor(notes);
    const scope = resolveReviewScope(plan, homeModel());
    const byImpact: Record<ScopeImpact, number> = { PAGE: 1, SECTION: 1, COMPONENT: 0, SLOT: 1, MULTIPLE: 0, UNKNOWN: 1 };
    expect(scope.summary.byImpact).toEqual(byImpact);
  });

  it('coverage summary aggregates deduped, sorted affected-id unions across all tasks', () => {
    const plan = planFor(notes);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.summary.affectedPageIds).toEqual(['home']);
    expect(scope.summary.affectedSectionIds).toEqual(['hero']);
    expect(scope.summary.affectedSlotIds).toEqual(['headline']);
  });
});

describe('R4 — determinism, replay, and shape', () => {
  it('targets are ordered identically to plan.tasks — deterministic ordering', () => {
    const plan = planFor([
      note({ target: target({ targetType: 'slot', targetId: 'headline', pageId: 'home' }) }),
      note({ target: target({ targetType: 'page', targetId: 'home' }) }),
    ]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets.map((t) => t.taskId)).toEqual(plan.tasks.map((t) => t.id));
  });

  it('repeated resolution over the same plan+model is byte-identical', () => {
    const plan = planFor([note({ target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }) })]);
    const m = homeModel();
    const first = resolveReviewScope(plan, m);
    const second = resolveReviewScope(plan, m);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('throws when the ReviewPlan does not belong to the given ProjectModel (client/track mismatch)', () => {
    const plan = planFor([note()]);
    const other = model([page('home')], { manifest: { client: 'other-co', track: 'website', sourceDigest: 'x', pageCount: 1, sectionCount: 0, slotCount: 0 } });
    expect(() => resolveReviewScope(plan, other)).toThrow(/client|track|mismatch/i);
  });

  it('returns a frozen ReviewScope, targets, unresolved, and summary', () => {
    const plan = planFor([note()]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.targets)).toBe(true);
    expect(Object.isFrozen(scope.targets[0])).toBe(true);
    expect(Object.isFrozen(scope.unresolved)).toBe(true);
    expect(Object.isFrozen(scope.summary)).toBe(true);
  });

  it('an empty plan produces an empty, valid ReviewScope', () => {
    const plan = planFor([]);
    const scope = resolveReviewScope(plan, homeModel());
    expect(scope.targets).toEqual([]);
    expect(scope.summary.totalTasks).toBe(0);
  });

  it('a custom ScopeResolutionPolicy overrides the default classification', () => {
    const policy: ScopeResolutionPolicy = { classifyImpact: () => 'MULTIPLE' };
    const plan = planFor([note({ target: target({ targetType: 'page', targetId: 'home' }) })]);
    const scope = createScopeResolver().resolve(plan, homeModel(), policy);
    expect(scope.targets[0].impact).toBe('MULTIPLE');
  });

  it('createScopeResolver().resolve() matches the resolveReviewScope() convenience function', () => {
    const plan = planFor([note()]);
    const m = homeModel();
    const resolver = createScopeResolver();
    expect(resolver.resolve(plan, m)).toEqual(resolveReviewScope(plan, m, resolver));
  });
});
