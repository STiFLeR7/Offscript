/**
 * R2 — Review Analysis (RED-first).
 *
 * A pure, deterministic, structural summarizer over a `ReviewSession` (R1). No I/O, no
 * persistence, no AI, no intent inference, no text classification — only counting and sorting
 * fields `ReviewNote` already carries.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  analyzeReviewSession,
  createReviewAnalysisBuilder,
} from '../../src/review/review-analysis.js';
import type { ReviewNote, ReviewSession, ReviewTarget } from '../../src/review/review-session.js';

function target(overrides: Partial<ReviewTarget> = {}): ReviewTarget {
  return { client: 'acme', track: 'website', targetType: 'page', targetId: 'home', pageId: undefined, ...overrides };
}

function note(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: randomUUID(),
    target: target(),
    timestamp: '2026-01-01T00:00:00.000Z',
    author: 'r1',
    text: 'x',
    severity: 'minor',
    state: 'OPEN',
    category: undefined,
    ...overrides,
  };
}

function session(notes: ReviewNote[], overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    id: 'session-1', client: 'acme', track: 'website',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    notes, digest: 'irrelevant-for-analysis',
    ...overrides,
  };
}

describe('R2 — analyzeReviewSession — empty session', () => {
  it('reports all-zero statistics, empty timeline, and undefined first/latest timestamps', () => {
    const analysis = analyzeReviewSession(session([]));
    expect(analysis.statistics.totalNotes).toBe(0);
    expect(analysis.statistics.state).toEqual({ open: 0, resolved: 0, dismissed: 0 });
    expect(analysis.statistics.severity).toEqual({ blocker: 0, major: 0, minor: 0, nit: 0 });
    expect(analysis.statistics.category).toEqual({ byCategory: {}, uncategorized: 0 });
    expect(analysis.statistics.target.byType).toEqual({ page: 0, section: 0, component: 0, slot: 0 });
    expect(analysis.timeline).toEqual([]);
    expect(analysis.firstReviewedAt).toBeUndefined();
    expect(analysis.latestReviewedAt).toBeUndefined();
  });
});

describe('R2 — analyzeReviewSession — single note', () => {
  it('counts a single OPEN, minor, uncategorized page note correctly', () => {
    const n = note({ target: target({ targetType: 'page', targetId: 'home' }) });
    const analysis = analyzeReviewSession(session([n]));
    expect(analysis.statistics.totalNotes).toBe(1);
    expect(analysis.statistics.state.open).toBe(1);
    expect(analysis.statistics.severity.minor).toBe(1);
    expect(analysis.statistics.category.uncategorized).toBe(1);
    expect(analysis.statistics.target.byType.page).toBe(1);
    expect(analysis.statistics.target.byPage).toEqual({ home: 1 });
    expect(analysis.firstReviewedAt).toBe(n.timestamp);
    expect(analysis.latestReviewedAt).toBe(n.timestamp);
  });
});

describe('R2 — analyzeReviewSession — mixed severities, states, categories, targets', () => {
  const notes = [
    note({ id: 'n1', target: target({ targetType: 'page', targetId: 'home' }), severity: 'blocker', state: 'OPEN', category: 'copy', timestamp: '2026-01-03T00:00:00.000Z' }),
    note({ id: 'n2', target: target({ targetType: 'section', targetId: 'hero', pageId: 'home' }), severity: 'major', state: 'RESOLVED', category: 'contrast', timestamp: '2026-01-01T00:00:00.000Z' }),
    note({ id: 'n3', target: target({ targetType: 'component', targetId: 'card-grid', pageId: 'home' }), severity: 'minor', state: 'DISMISSED', category: undefined, timestamp: '2026-01-02T00:00:00.000Z' }),
    note({ id: 'n4', target: target({ targetType: 'slot', targetId: 'headline', pageId: 'about' }), severity: 'nit', state: 'OPEN', category: 'copy', timestamp: '2026-01-04T00:00:00.000Z' }),
    note({ id: 'n5', target: target({ targetType: 'section', targetId: 'hero', pageId: 'about' }), severity: 'major', state: 'OPEN', category: undefined, timestamp: '2026-01-05T00:00:00.000Z' }),
  ];

  it('derives every documented statistic correctly', () => {
    const analysis = analyzeReviewSession(session(notes));
    const s = analysis.statistics;
    expect(s.totalNotes).toBe(5);
    expect(s.state).toEqual({ open: 3, resolved: 1, dismissed: 1 });
    expect(s.severity).toEqual({ blocker: 1, major: 2, minor: 1, nit: 1 });
    expect(s.category.byCategory).toEqual({ copy: 2, contrast: 1 });
    expect(s.category.uncategorized).toBe(2);
    expect(s.target.byType).toEqual({ page: 1, section: 2, component: 1, slot: 1 });
    expect(s.target.byPage).toEqual({ home: 3, about: 2 }); // home: n1,n2,n3 ; about: n4,n5
    expect(s.target.bySection).toEqual({ hero: 2 }); // n2 + n5, same section id across two pages
    expect(s.target.byComponent).toEqual({ 'card-grid': 1 });
    expect(s.target.bySlot).toEqual({ headline: 1 });
  });

  it('produces a chronological timeline sorted by timestamp ascending, independent of input array order', () => {
    const analysis = analyzeReviewSession(session(notes));
    expect(analysis.timeline.map((n) => n.id)).toEqual(['n2', 'n3', 'n1', 'n4', 'n5']);
    expect(analysis.firstReviewedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(analysis.latestReviewedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it('breaks timestamp ties deterministically by note id', () => {
    const tied = [
      note({ id: 'zzz', timestamp: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'aaa', timestamp: '2026-01-01T00:00:00.000Z' }),
    ];
    const analysis = analyzeReviewSession(session(tied));
    expect(analysis.timeline.map((n) => n.id)).toEqual(['aaa', 'zzz']);
  });
});

describe('R2 — analyzeReviewSession — determinism and replay', () => {
  it('repeated analysis of the same session is byte-identical (same digest, deep-equal output)', () => {
    const notes = [note({ id: 'a', severity: 'major' }), note({ id: 'b', severity: 'minor', state: 'RESOLVED' })];
    const s = session(notes);
    const first = analyzeReviewSession(s);
    const second = analyzeReviewSession(s);
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('analyzing the same logical note set in a different array order produces identical statistics, timeline, and digest', () => {
    const notes = [
      note({ id: 'a', severity: 'major', timestamp: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'b', severity: 'minor', timestamp: '2026-01-02T00:00:00.000Z' }),
      note({ id: 'c', severity: 'blocker', timestamp: '2026-01-03T00:00:00.000Z' }),
    ];
    const forward = analyzeReviewSession(session(notes));
    const shuffled = analyzeReviewSession(session([notes[2], notes[0], notes[1]]));
    expect(forward.statistics).toEqual(shuffled.statistics);
    expect(forward.timeline.map((n) => n.id)).toEqual(shuffled.timeline.map((n) => n.id));
    expect(forward.digest).toBe(shuffled.digest);
  });

  it('the category record and target-id records have deterministically sorted keys', () => {
    const notes = [
      note({ category: 'zeta' }),
      note({ category: 'alpha' }),
      note({ category: 'mu' }),
    ];
    const analysis = analyzeReviewSession(session(notes));
    expect(Object.keys(analysis.statistics.category.byCategory)).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('a different digest is produced for a genuinely different note set', () => {
    const a = analyzeReviewSession(session([note({ id: 'a' })]));
    const b = analyzeReviewSession(session([note({ id: 'a' }), note({ id: 'b' })]));
    expect(a.digest).not.toBe(b.digest);
  });

  it('returns a frozen ReviewAnalysis', () => {
    const analysis = analyzeReviewSession(session([note()]));
    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.statistics)).toBe(true);
    expect(Object.isFrozen(analysis.timeline)).toBe(true);
  });
});

describe('R2 — analyzeReviewSession — large session', () => {
  it('handles 200 notes across every target type, severity, state, and several categories without error', () => {
    const targetTypes = ['page', 'section', 'component', 'slot'] as const;
    const severities = ['blocker', 'major', 'minor', 'nit'] as const;
    const states = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
    const categories = ['copy', 'contrast', 'spacing', undefined];
    const notes: ReviewNote[] = [];
    for (let i = 0; i < 200; i++) {
      const targetType = targetTypes[i % targetTypes.length];
      notes.push(
        note({
          id: `note-${i}`,
          target: target({
            targetType,
            targetId: `${targetType}-${i % 7}`,
            pageId: targetType === 'page' ? undefined : `page-${i % 3}`,
          }),
          severity: severities[i % severities.length],
          state: states[i % states.length],
          category: categories[i % categories.length],
          timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        }),
      );
    }
    const analysis = analyzeReviewSession(session(notes));
    expect(analysis.statistics.totalNotes).toBe(200);
    const sumBy = Object.values(analysis.statistics.severity).reduce((a, b) => a + b, 0);
    expect(sumBy).toBe(200);
    const sumState = Object.values(analysis.statistics.state).reduce((a, b) => a + b, 0);
    expect(sumState).toBe(200);
    const sumType = Object.values(analysis.statistics.target.byType).reduce((a, b) => a + b, 0);
    expect(sumType).toBe(200);
    expect(analysis.timeline).toHaveLength(200);
    // strictly ascending
    for (let i = 1; i < analysis.timeline.length; i++) {
      expect(analysis.timeline[i].timestamp >= analysis.timeline[i - 1].timestamp).toBe(true);
    }
  });
});

describe('R2 — ReviewAnalysisBuilder', () => {
  it('createReviewAnalysisBuilder().analyze() produces the same result as the convenience function', () => {
    const s = session([note()]);
    const builder = createReviewAnalysisBuilder();
    const viaBuilder = builder.analyze(s);
    const viaFunction = analyzeReviewSession(s, builder);
    expect(viaBuilder).toEqual(viaFunction);
  });
});
