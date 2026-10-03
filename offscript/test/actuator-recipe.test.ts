import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  diffToRecipe,
  applyRecipe,
  writeRecipe,
  readRecipe,
  mergeRecipe,
  findPassSnapshot,
  mergePassSnapshot,
} from '../src/actuator-recipe.js';
import type { ActuatorRecipe, PassSnapshot } from '../src/actuator-recipe.js';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-recipe-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('diffToRecipe', () => {
  it('captures a single value substitution across multiple occurrences', () => {
    const before = `
      <a style="color:#fff">x</a>
      <a style="color:#fff">y</a>
      <a style="color:#fff">z</a>
      <a style="color:#fff">w</a>
      <a style="color:#fff">v</a>
    `;
    const after = before.split('color:#fff').join('color:var(--cr-bg)');
    const edits = diffToRecipe({
      before,
      after,
      pass: 'brand-fidelity',
      findingIds: ['f1'],
    });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      pass: 'brand-fidelity',
      find: 'color:#fff',
      replace: 'color:var(--cr-bg)',
      expectedOccurrences: 5,
    });
    expect(edits[0].findingIds).toEqual(['f1']);
  });

  it('returns [] when before === after', () => {
    const html = '<a style="color:#fff">x</a>';
    expect(diffToRecipe({ before: html, after: html, pass: 'p', findingIds: [] })).toEqual([]);
  });

  it('sorts findingIds for stability', () => {
    const before = '<a style="color:#fff">x</a>';
    const after = '<a style="color:#000">x</a>';
    const edits = diffToRecipe({
      before,
      after,
      pass: 'contrast',
      findingIds: ['z', 'a', 'm'],
    });
    expect(edits[0].findingIds).toEqual(['a', 'm', 'z']);
  });

  it('skips ambiguous diffs (multiple new values for same property)', () => {
    // Both #fff and #aaa disappear; both #000 and #111 appear — ambiguous mapping
    const before = '<a style="color:#fff">a</a><b style="color:#aaa">b</b>';
    const after = '<a style="color:#000">a</a><b style="color:#111">b</b>';
    const edits = diffToRecipe({
      before,
      after,
      pass: 'p',
      findingIds: [],
    });
    expect(edits).toEqual([]);
  });
});

describe('applyRecipe', () => {
  it('applies edits to reproduce the after state', () => {
    const before = `
      <a style="color:#fff">x</a>
      <a style="color:#fff">y</a>
    `;
    const after = before.split('color:#fff').join('color:var(--cr-bg)');
    const edits = diffToRecipe({
      before,
      after,
      pass: 'brand-fidelity',
      findingIds: ['f1'],
    });
    const recipe: ActuatorRecipe = { generatedAt: 'T', edits };
    const result = applyRecipe(before, recipe);
    expect(result.html).toBe(after);
    expect(result.warnings).toEqual([]);
  });

  it('emits a warning when find no longer matches; html unchanged', () => {
    const recipe: ActuatorRecipe = {
      generatedAt: 'T',
      edits: [
        {
          pass: 'contrast',
          findingIds: ['f1'],
          find: 'color:#deadbe',
          replace: 'color:#000',
          expectedOccurrences: 3,
        },
      ],
    };
    const html = '<a style="color:#000">x</a>';
    const result = applyRecipe(html, recipe);
    expect(result.html).toBe(html);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('contrast');
    expect(result.warnings[0]).toContain('f1');
  });

  it('double-apply is a no-op on the already-replayed state', () => {
    const before = `<a style="color:#fff">x</a><a style="color:#fff">y</a>`;
    const after = before.split('color:#fff').join('color:var(--cr-bg)');
    const edits = diffToRecipe({
      before,
      after,
      pass: 'p',
      findingIds: ['f1'],
    });
    const recipe: ActuatorRecipe = { generatedAt: 'T', edits };
    const once = applyRecipe(before, recipe);
    const twice = applyRecipe(once.html, recipe);
    expect(twice.html).toBe(once.html);
  });
});

describe('writeRecipe / readRecipe', () => {
  it('round-trips a recipe', () => {
    const recipe: ActuatorRecipe = {
      generatedAt: '2026-05-28T00:00:00.000Z',
      edits: [
        {
          pass: 'contrast',
          findingIds: ['a', 'b'],
          find: 'color:#fff',
          replace: 'color:#000',
          expectedOccurrences: 4,
        },
      ],
    };
    const p = path.join(tmp, 'recipe.json');
    writeRecipe(p, recipe);
    const back = readRecipe(p);
    expect(back).toEqual(recipe);
  });

  it('readRecipe returns null when the file is missing', () => {
    expect(readRecipe(path.join(tmp, 'nope.json'))).toBeNull();
  });

  it('readRecipe throws on malformed JSON', () => {
    const p = path.join(tmp, 'bad.json');
    fs.writeFileSync(p, '{not json', 'utf8');
    expect(() => readRecipe(p)).toThrow(/malformed JSON/);
  });

  it('writeRecipe is idempotent: same content does not change mtime', () => {
    const recipe: ActuatorRecipe = {
      generatedAt: 'T',
      edits: [
        {
          pass: 'p',
          findingIds: ['f1'],
          find: 'color:#fff',
          replace: 'color:#000',
          expectedOccurrences: 1,
        },
      ],
    };
    const p = path.join(tmp, 'r.json');
    writeRecipe(p, recipe);
    const m1 = fs.statSync(p).mtimeMs;
    // small wait to ensure mtime resolution would notice a real write
    const until = Date.now() + 20;
    while (Date.now() < until) { /* spin */ }
    writeRecipe(p, recipe);
    const m2 = fs.statSync(p).mtimeMs;
    expect(m2).toBe(m1);
  });

  it('writeRecipe sorts edits by (pass, find) on disk', () => {
    const recipe: ActuatorRecipe = {
      generatedAt: 'T',
      edits: [
        { pass: 'z-pass', findingIds: [], find: 'a', replace: 'b', expectedOccurrences: 1 },
        { pass: 'a-pass', findingIds: [], find: 'y', replace: 'z', expectedOccurrences: 1 },
        { pass: 'a-pass', findingIds: [], find: 'x', replace: 'z', expectedOccurrences: 1 },
      ],
    };
    const p = path.join(tmp, 'r.json');
    writeRecipe(p, recipe);
    const back = readRecipe(p)!;
    expect(back.edits.map((e) => `${e.pass}:${e.find}`)).toEqual([
      'a-pass:x',
      'a-pass:y',
      'z-pass:a',
    ]);
  });
});

describe('mergeRecipe', () => {
  it('appends new edits when no existing recipe', () => {
    const edits = [
      { pass: 'p1', findingIds: ['f1'], find: 'a', replace: 'b', expectedOccurrences: 1 },
    ];
    const merged = mergeRecipe(null, edits, 'T');
    expect(merged.edits).toEqual(edits);
  });

  it('replaces existing entries belonging to the same (pass, findingIds) group; later wins', () => {
    const existing: ActuatorRecipe = {
      generatedAt: 'T0',
      edits: [
        { pass: 'contrast', findingIds: ['f1'], find: 'x', replace: 'y', expectedOccurrences: 1 },
        { pass: 'brand-fidelity', findingIds: ['g1'], find: 'm', replace: 'n', expectedOccurrences: 1 },
      ],
    };
    const incoming = [
      { pass: 'contrast', findingIds: ['f1'], find: 'A', replace: 'B', expectedOccurrences: 2 },
    ];
    const merged = mergeRecipe(existing, incoming, 'T1');
    // brand-fidelity entry preserved; contrast/f1 entry replaced
    expect(merged.edits).toHaveLength(2);
    const contrast = merged.edits.filter((e) => e.pass === 'contrast');
    expect(contrast).toHaveLength(1);
    expect(contrast[0].find).toBe('A');
  });
});

describe('instructionSnapshot — pass-level snapshots', () => {
  const snap = (pass: string, ids: string[], body: string): PassSnapshot => ({
    pass,
    findingIds: ids,
    instructionSnapshot: body,
    decidedAt: '2026-05-28T12:00:00.000Z',
  });

  it('findPassSnapshot returns undefined when no snapshots exist', () => {
    const recipe: ActuatorRecipe = { generatedAt: 'T0', edits: [] };
    expect(findPassSnapshot(recipe, 'contrast', ['f1'])).toBeUndefined();
  });

  it('findPassSnapshot matches on (pass, findingIds) regardless of input order', () => {
    const recipe: ActuatorRecipe = {
      generatedAt: 'T0',
      edits: [],
      snapshots: [snap('contrast', ['a', 'b'], 'INSTR-1')],
    };
    expect(findPassSnapshot(recipe, 'contrast', ['b', 'a'])?.instructionSnapshot).toBe('INSTR-1');
    expect(findPassSnapshot(recipe, 'brand-fidelity', ['a', 'b'])).toBeUndefined();
  });

  it('mergePassSnapshot replaces a same-(pass,findingIds) entry and appends new ones', () => {
    const existing: ActuatorRecipe = {
      generatedAt: 'T0',
      edits: [],
      snapshots: [snap('contrast', ['f1'], 'OLD')],
    };
    const replaced = mergePassSnapshot(existing, snap('contrast', ['f1'], 'NEW'));
    expect(replaced).toHaveLength(1);
    expect(replaced[0].instructionSnapshot).toBe('NEW');

    const appended = mergePassSnapshot(existing, snap('brand-fidelity', ['f2'], 'BF'));
    expect(appended).toHaveLength(2);
  });

  it('writeRecipe + readRecipe round-trips snapshots verbatim', () => {
    const file = path.join(tmp, 'recipe.json');
    const recipe: ActuatorRecipe = {
      generatedAt: 'T0',
      edits: [],
      snapshots: [snap('contrast', ['z', 'a'], 'INSTR\nbody')],
    };
    writeRecipe(file, recipe);
    const read = readRecipe(file)!;
    expect(read.snapshots).toBeDefined();
    expect(read.snapshots).toHaveLength(1);
    expect(read.snapshots![0].pass).toBe('contrast');
    expect(read.snapshots![0].instructionSnapshot).toBe('INSTR\nbody');
    // findingIds normalized sorted
    expect(read.snapshots![0].findingIds).toEqual(['a', 'z']);
  });

  it('readRecipe tolerates a recipe with no snapshots field (backward compat)', () => {
    const file = path.join(tmp, 'old-recipe.json');
    fs.writeFileSync(file, JSON.stringify({ generatedAt: 'T0', edits: [] }, null, 2) + '\n');
    const r = readRecipe(file)!;
    expect(r.snapshots).toBeUndefined();
  });

  it('mergeRecipe carries forward existing snapshots and merges a new one when supplied', () => {
    const existing: ActuatorRecipe = {
      generatedAt: 'T0',
      edits: [],
      snapshots: [snap('contrast', ['f1'], 'OLD')],
    };
    const merged = mergeRecipe(existing, [], 'T1', snap('contrast', ['f1'], 'NEW'));
    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots![0].instructionSnapshot).toBe('NEW');

    const carried = mergeRecipe(existing, [], 'T1');
    expect(carried.snapshots).toHaveLength(1);
    expect(carried.snapshots![0].instructionSnapshot).toBe('OLD');
  });
});
