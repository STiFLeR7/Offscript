/**
 * R1 — Review Session (RED-first).
 *
 * A persistent, human-authored design-review record, addressed by stable semantic targets
 * (page/section/component/slot — the same vocabulary `ProjectModel`, F4, already uses) — never
 * browser coordinates, never HTML. Persisted separately from Workspace State (F13); Program F
 * itself is never called or imported except for its TYPES.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createReviewStore,
  createReviewManager,
  type ReviewTarget,
  type ReviewSession,
} from '../../src/review/review-session.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-r1-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function reviewsDir(client: string, track: string): string {
  return join(root, client, track, 'reviews');
}

function testStore() {
  return createReviewStore((client, track) => reviewsDir(client, track));
}

function pageTarget(client: string, track: 'website' | 'collateral' = 'website', pageId = 'page'): ReviewTarget {
  return { client, track, targetType: 'page', targetId: pageId, pageId: undefined };
}

function sectionTarget(client: string, pageId = 'page', sectionId = 'hero'): ReviewTarget {
  return { client, track: 'website', targetType: 'section', targetId: sectionId, pageId };
}

describe('R1 — ReviewManager — create + load', () => {
  it('createSession() produces an empty, persisted session', () => {
    const manager = createReviewManager(testStore());
    const session = manager.createSession('acme', 'website');
    expect(session.notes).toEqual([]);
    expect(session.client).toBe('acme');
    expect(session.track).toBe('website');
    expect(typeof session.id).toBe('string');
    expect(session.id.length).toBeGreaterThan(0);
  });

  it('get() returns the persisted session by id', () => {
    const manager = createReviewManager(testStore());
    const created = manager.createSession('acme', 'website');
    const loaded = manager.get('acme', 'website', created.id);
    expect(loaded).toEqual(created);
  });

  it('get() on an unknown session id returns undefined', () => {
    const manager = createReviewManager(testStore());
    expect(manager.get('acme', 'website', 'does-not-exist')).toBeUndefined();
  });

  it('two createSession() calls produce two distinct session ids', () => {
    const manager = createReviewManager(testStore());
    const a = manager.createSession('acme', 'website');
    const b = manager.createSession('acme', 'website');
    expect(a.id).not.toBe(b.id);
  });
});

describe('R1 — ReviewManager — adding notes', () => {
  it('addNote() appends a note in OPEN state, bumps updatedAt', async () => {
    const manager = createReviewManager(testStore());
    const session = manager.createSession('acme', 'website');
    await new Promise((r) => setTimeout(r, 5));
    const updated = manager.addNote('acme', 'website', session.id, {
      target: sectionTarget('acme'),
      author: 'reviewer-1',
      text: 'The hero heading is too small.',
      severity: 'major',
    });
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].state).toBe('OPEN');
    expect(updated.notes[0].author).toBe('reviewer-1');
    expect(updated.notes[0].severity).toBe('major');
    expect(updated.notes[0].category).toBeUndefined();
    expect(updated.updatedAt).not.toBe(session.updatedAt);
  });

  it('addNote() supports page/section/component/slot target types', () => {
    const manager = createReviewManager(testStore());
    const session = manager.createSession('acme', 'website');
    let s = session;
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'page note', severity: 'minor' });
    s = manager.addNote('acme', 'website', s.id, { target: sectionTarget('acme'), author: 'r1', text: 'section note', severity: 'minor' });
    s = manager.addNote('acme', 'website', s.id, {
      target: { client: 'acme', track: 'website', targetType: 'component', targetId: 'card-grid', pageId: 'page' },
      author: 'r1', text: 'component note', severity: 'nit',
    });
    s = manager.addNote('acme', 'website', s.id, {
      target: { client: 'acme', track: 'website', targetType: 'slot', targetId: 'headline', pageId: 'page' },
      author: 'r1', text: 'slot note', severity: 'blocker',
    });
    expect(s.notes.map((n) => n.target.targetType)).toEqual(['page', 'section', 'component', 'slot']);
  });

  it('addNote() carries an optional category through when provided', () => {
    const manager = createReviewManager(testStore());
    const session = manager.createSession('acme', 'website');
    const updated = manager.addNote('acme', 'website', session.id, {
      target: pageTarget('acme'), author: 'r1', text: 'x', severity: 'minor', category: 'accessibility',
    });
    expect(updated.notes[0].category).toBe('accessibility');
  });

  it('addNote() rejects a target belonging to a different workspace than the session', () => {
    const manager = createReviewManager(testStore());
    const session = manager.createSession('acme', 'website');
    expect(() =>
      manager.addNote('acme', 'website', session.id, {
        target: pageTarget('some-other-client'),
        author: 'r1',
        text: 'x',
        severity: 'minor',
      }),
    ).toThrow(/workspace|client|track/i);
  });

  it('addNote() throws for an unknown session id', () => {
    const manager = createReviewManager(testStore());
    expect(() =>
      manager.addNote('acme', 'website', 'does-not-exist', { target: pageTarget('acme'), author: 'r1', text: 'x', severity: 'minor' }),
    ).toThrow(/unknown/i);
  });
});

describe('R1 — ReviewManager — state transitions', () => {
  it('resolveNote() transitions a note from OPEN to RESOLVED, leaving others untouched', () => {
    const manager = createReviewManager(testStore());
    let s = manager.createSession('acme', 'website');
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'a', severity: 'minor' });
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'b', severity: 'minor' });
    const [noteA, noteB] = s.notes;
    s = manager.resolveNote('acme', 'website', s.id, noteA.id);
    expect(s.notes.find((n) => n.id === noteA.id)?.state).toBe('RESOLVED');
    expect(s.notes.find((n) => n.id === noteB.id)?.state).toBe('OPEN');
  });

  it('dismissNote() transitions a note from OPEN to DISMISSED', () => {
    const manager = createReviewManager(testStore());
    let s = manager.createSession('acme', 'website');
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'a', severity: 'minor' });
    s = manager.dismissNote('acme', 'website', s.id, s.notes[0].id);
    expect(s.notes[0].state).toBe('DISMISSED');
  });

  it('resolveNote()/dismissNote() throw for an unknown note id', () => {
    const manager = createReviewManager(testStore());
    const s = manager.createSession('acme', 'website');
    expect(() => manager.resolveNote('acme', 'website', s.id, 'no-such-note')).toThrow(/unknown/i);
    expect(() => manager.dismissNote('acme', 'website', s.id, 'no-such-note')).toThrow(/unknown/i);
  });

  it('resolveNote()/dismissNote() throw for an unknown session id', () => {
    const manager = createReviewManager(testStore());
    expect(() => manager.resolveNote('acme', 'website', 'no-such-session', 'x')).toThrow(/unknown/i);
  });

  it('running the identical sequence of operations on two independent sessions produces the identical structural shape', () => {
    function run(manager: ReturnType<typeof createReviewManager>, client: string) {
      let s = manager.createSession(client, 'website');
      s = manager.addNote(client, 'website', s.id, { target: pageTarget(client), author: 'r1', text: 'a', severity: 'blocker' });
      s = manager.addNote(client, 'website', s.id, { target: sectionTarget(client), author: 'r2', text: 'b', severity: 'minor' });
      s = manager.resolveNote(client, 'website', s.id, s.notes[0].id);
      s = manager.dismissNote(client, 'website', s.id, s.notes[1].id);
      return s.notes.map((n) => ({ severity: n.severity, state: n.state, targetType: n.target.targetType }));
    }
    const manager = createReviewManager(testStore());
    const a = run(manager, 'seq-a');
    const b = run(manager, 'seq-b');
    expect(a).toEqual(b);
    expect(a).toEqual([
      { severity: 'blocker', state: 'RESOLVED', targetType: 'page' },
      { severity: 'minor', state: 'DISMISSED', targetType: 'section' },
    ]);
  });
});

describe('R1 — ReviewManager — listByWorkspace', () => {
  it('returns every session created for a (client, track), sorted deterministically', () => {
    const manager = createReviewManager(testStore());
    const a = manager.createSession('acme', 'website');
    const b = manager.createSession('acme', 'website');
    const list = manager.listByWorkspace('acme', 'website');
    expect(list.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('returns an empty array for a workspace with no review sessions at all', () => {
    const manager = createReviewManager(testStore());
    expect(manager.listByWorkspace('nobody', 'website')).toEqual([]);
  });

  it('two independent workspaces never interfere', () => {
    const manager = createReviewManager(testStore());
    manager.createSession('acme', 'website');
    manager.createSession('other', 'collateral');
    expect(manager.listByWorkspace('acme', 'website')).toHaveLength(1);
    expect(manager.listByWorkspace('other', 'collateral')).toHaveLength(1);
  });
});

describe('R1 — ReviewStore — persistence, replay, integrity', () => {
  it('a fresh store/manager instance (no shared in-memory state) recovers the exact same session', () => {
    const storeA = testStore();
    const created = createReviewManager(storeA).createSession('acme', 'website');
    const storeB = testStore();
    const recovered = createReviewManager(storeB).get('acme', 'website', created.id);
    expect(recovered).toEqual(created);
  });

  it('repeated get() calls return equal, stable sessions (replay)', () => {
    const manager = createReviewManager(testStore());
    const s = manager.createSession('acme', 'website');
    const a = manager.get('acme', 'website', s.id);
    const b = manager.get('acme', 'website', s.id);
    expect(a).toEqual(b);
  });

  it('the session digest changes when notes are added or transitioned', () => {
    const manager = createReviewManager(testStore());
    let s = manager.createSession('acme', 'website');
    const beforeDigest = s.digest;
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'x', severity: 'minor' });
    const afterAddDigest = s.digest;
    expect(afterAddDigest).not.toBe(beforeDigest);
    s = manager.resolveNote('acme', 'website', s.id, s.notes[0].id);
    expect(s.digest).not.toBe(afterAddDigest);
  });

  it('detects a tampered/corrupt review session file and throws', () => {
    const store = testStore();
    const manager = createReviewManager(store);
    const s = manager.createSession('acme', 'website');
    const path = join(reviewsDir('acme', 'website'), `${s.id}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    raw.client = 'tampered';
    writeFileSync(path, JSON.stringify(raw), 'utf8');
    expect(() => manager.get('acme', 'website', s.id)).toThrow(/integrity|digest|tamper/i);
  });

  it('returns frozen ReviewSession and ReviewNote values', () => {
    const manager = createReviewManager(testStore());
    let s = manager.createSession('acme', 'website');
    s = manager.addNote('acme', 'website', s.id, { target: pageTarget('acme'), author: 'r1', text: 'x', severity: 'minor' });
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.notes)).toBe(true);
    expect(Object.isFrozen(s.notes[0])).toBe(true);
  });
});
