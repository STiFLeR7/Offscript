import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  freezeFromDecisionLog,
  writeOverlay,
  readOverlay,
  filterFrozenFindings,
} from '../src/overlay.js';
import type { Frozen } from '../src/overlay.js';
import type { DecisionLogEntry } from '../src/actuation.js';
import type { Finding } from '../src/operator.js';

function makeFinding(id: string): Finding {
  return { id, description: `finding ${id}`, outcome: 'escalated' };
}

function makeEscalated(pass: string, ids: string[]): DecisionLogEntry {
  return {
    pass,
    rails: [`${pass}-rail`],
    status: 'escalated',
    loops: 3,
    residualViolations: ids.map(makeFinding),
  };
}

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-overlay-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('freezeFromDecisionLog', () => {
  it('builds a Frozen from an escalated DecisionLogEntry', () => {
    const entry = makeEscalated('typography', ['t:1', 't:2']);
    const frozen = freezeFromDecisionLog(entry, { decidedBy: 'actuator', reason: 'fonts dirty' });
    expect(frozen.pass).toBe('typography');
    expect(frozen.findingIds).toEqual(['t:1', 't:2']);
    expect(frozen.decidedBy).toBe('actuator');
    expect(frozen.reason).toBe('fonts dirty');
    // id is now content-derived: `${pass}:<12-hex-char hash of sorted findingIds>`.
    expect(frozen.id).toMatch(/^typography:[0-9a-f]{12}$/);
    // ISO 8601 timestamp sanity check.
    expect(frozen.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('produces the SAME id for the same findingIds across calls (content-derived, order-insensitive)', () => {
    const a = freezeFromDecisionLog(makeEscalated('typography', ['t:1', 't:2']), {
      decidedBy: 'actuator',
    });
    const b = freezeFromDecisionLog(makeEscalated('typography', ['t:2', 't:1']), {
      decidedBy: 'reviewer',
    });
    expect(a.id).toBe(b.id);
    // The decidedAt timestamps may differ (two separate `new Date()` calls)
    // but identity does not depend on them.
  });

  it('produces a DIFFERENT id when the findingIds change', () => {
    const a = freezeFromDecisionLog(makeEscalated('typography', ['t:1']), { decidedBy: 'x' });
    const b = freezeFromDecisionLog(makeEscalated('typography', ['t:1', 't:2']), {
      decidedBy: 'x',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('attaches an optional snapshotHtml', () => {
    const entry = makeEscalated('p', ['f:1']);
    const frozen = freezeFromDecisionLog(entry, {
      decidedBy: 'actuator',
      snapshotHtml: '<html><body>x</body></html>',
    });
    expect(frozen.snapshotHtml).toBe('<html><body>x</body></html>');
  });

  it('throws on a passed entry', () => {
    const entry: DecisionLogEntry = {
      pass: 'p',
      rails: ['r'],
      status: 'passed',
      loops: 1,
      residualViolations: [],
    };
    expect(() => freezeFromDecisionLog(entry, { decidedBy: 'actuator' })).toThrow(/escalated/);
  });
});

describe('writeOverlay / readOverlay', () => {
  it('writes JSON and snapshot, round-trips through readOverlay', () => {
    const entry = makeEscalated('typography', ['t:1', 't:2']);
    const frozen = freezeFromDecisionLog(entry, {
      decidedBy: 'actuator',
      snapshotHtml: '<html><body>snap</body></html>',
    });
    const jsonPath = writeOverlay(tmp, frozen);
    expect(fs.existsSync(jsonPath)).toBe(true);
    const htmlPath = jsonPath.replace(/\.json$/, '.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe('<html><body>snap</body></html>');

    const read = readOverlay(tmp);
    expect(read).toHaveLength(1);
    expect(read[0]).toEqual(frozen);
  });

  it('omits the .html sibling when snapshotHtml is absent', () => {
    const frozen = freezeFromDecisionLog(makeEscalated('p', ['x:1']), { decidedBy: 'actuator' });
    const jsonPath = writeOverlay(tmp, frozen);
    const htmlPath = jsonPath.replace(/\.json$/, '.html');
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(false);
  });

  it('preserves the FIRST decidedAt when re-written with the same id but a fresher timestamp', () => {
    // Use injected clocks so the timestamps are deterministically different —
    // removing the same-millisecond flake where two back-to-back new Date()
    // calls could return the same value and break the guard below.
    const T1 = '2024-01-01T00:00:00.000Z';
    const T2 = '2024-01-02T00:00:00.000Z';

    const first = freezeFromDecisionLog(makeEscalated('typography', ['t:1', 't:2']), {
      decidedBy: 'actuator',
      now: () => T1,
    });
    writeOverlay(tmp, first);

    // Second call: same findingIds → same id, but a different decidedAt. The
    // on-disk entry must keep the original decidedAt (identity is content;
    // first-decided is the truth).
    const second = freezeFromDecisionLog(makeEscalated('typography', ['t:2', 't:1']), {
      decidedBy: 'actuator',
      now: () => T2,
    });
    expect(second.id).toBe(first.id);
    expect(second.decidedAt).not.toBe(first.decidedAt); // guard: deterministically distinct
    writeOverlay(tmp, second);

    const read = readOverlay(tmp);
    expect(read).toHaveLength(1);
    expect(read[0].decidedAt).toBe(first.decidedAt);
  });

  it('is idempotent: writing identical content does not bump mtime', async () => {
    const frozen = freezeFromDecisionLog(makeEscalated('p', ['x:1']), { decidedBy: 'actuator' });
    const jsonPath = writeOverlay(tmp, frozen);
    const firstMtime = fs.statSync(jsonPath).mtimeMs;
    // Wait a touch so the FS clock could in principle move.
    await new Promise((r) => setTimeout(r, 25));
    writeOverlay(tmp, frozen);
    const secondMtime = fs.statSync(jsonPath).mtimeMs;
    expect(secondMtime).toBe(firstMtime);
  });

  it('serializes JSON deterministically (sorted keys)', () => {
    const frozen = freezeFromDecisionLog(makeEscalated('p', ['x:1']), {
      decidedBy: 'actuator',
      reason: 'r',
    });
    const jsonPath = writeOverlay(tmp, frozen);
    const raw = fs.readFileSync(jsonPath, 'utf8');
    // Keys in the serialized file should appear in alphabetical order.
    const keyOrder = [...raw.matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]);
    const sorted = [...keyOrder].sort();
    expect(keyOrder).toEqual(sorted);
  });

  it('readOverlay returns [] for a missing directory', () => {
    const missing = path.join(tmp, 'does-not-exist');
    expect(readOverlay(missing)).toEqual([]);
  });

  it('readOverlay skips non-JSON files and malformed JSON, returns only valid Frozen', () => {
    const good = freezeFromDecisionLog(makeEscalated('p', ['x:1']), { decidedBy: 'actuator' });
    writeOverlay(tmp, good);
    fs.writeFileSync(path.join(tmp, 'note.txt'), 'not json');
    fs.writeFileSync(path.join(tmp, 'broken.json'), '{not json');
    fs.writeFileSync(path.join(tmp, 'wrong-shape.json'), JSON.stringify({ foo: 'bar' }));
    const read = readOverlay(tmp);
    expect(read).toHaveLength(1);
    expect(read[0].pass).toBe('p');
  });

  it('readOverlay sorts entries ascending by decidedAt', () => {
    const a: Frozen = {
      id: 'p:2020-01-01T00:00:00.000Z',
      pass: 'p',
      findingIds: ['a'],
      decidedAt: '2020-01-01T00:00:00.000Z',
      decidedBy: 'x',
    };
    const b: Frozen = {
      id: 'p:2021-01-01T00:00:00.000Z',
      pass: 'p',
      findingIds: ['b'],
      decidedAt: '2021-01-01T00:00:00.000Z',
      decidedBy: 'x',
    };
    const c: Frozen = {
      id: 'p:2022-01-01T00:00:00.000Z',
      pass: 'p',
      findingIds: ['c'],
      decidedAt: '2022-01-01T00:00:00.000Z',
      decidedBy: 'x',
    };
    // Write out-of-order.
    writeOverlay(tmp, c);
    writeOverlay(tmp, a);
    writeOverlay(tmp, b);
    const read = readOverlay(tmp);
    expect(read.map((f) => f.decidedAt)).toEqual([a.decidedAt, b.decidedAt, c.decidedAt]);
  });
});

describe('filterFrozenFindings', () => {
  const frozen: Frozen[] = [
    {
      id: 'p:2020',
      pass: 'p',
      findingIds: ['claimed-1', 'claimed-2'],
      decidedAt: '2020-01-01T00:00:00.000Z',
      decidedBy: 'x',
    },
  ];

  it('partitions claimed findings into frozen and the rest into live', () => {
    const findings: Finding[] = [
      makeFinding('claimed-1'),
      makeFinding('live-1'),
      makeFinding('claimed-2'),
      makeFinding('live-2'),
    ];
    const { live, frozen: frozenFindings, orphaned } = filterFrozenFindings(findings, frozen);
    expect(live.map((f) => f.id)).toEqual(['live-1', 'live-2']);
    expect(frozenFindings.map((f) => f.id)).toEqual(['claimed-1', 'claimed-2']);
    expect(orphaned).toEqual([]);
  });

  it('marks an entry orphaned when none of its findingIds remain in current findings', () => {
    const findings: Finding[] = [makeFinding('something-new')];
    const { live, frozen: frozenFindings, orphaned } = filterFrozenFindings(findings, frozen);
    expect(live.map((f) => f.id)).toEqual(['something-new']);
    expect(frozenFindings).toEqual([]);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].id).toBe('p:2020');
  });

  it('does NOT mark an entry orphaned when at least one of its findingIds is still present', () => {
    const findings: Finding[] = [makeFinding('claimed-1')]; // claimed-2 missing, but claimed-1 still there
    const { orphaned } = filterFrozenFindings(findings, frozen);
    expect(orphaned).toEqual([]);
  });
});
