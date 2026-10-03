import { describe, it, expect } from 'vitest';
import {
  hard,
  band,
  identity,
  keepMax,
  keepMaxFloorExclude,
  terminal,
} from '../../src/generate/selection-policy.js';

// A minimal candidate shape for the policy contract tests. Policies are generic over T
// and consume only the caller-supplied scorers/predicates — never candidate internals.
interface C {
  slug: string;
  score: number;
  excluded?: boolean;
}
const c = (slug: string, score: number, excluded = false): C => ({ slug, score, excluded });
const scoreOf = (x: C): number => x.score;
const slugs = (xs: C[]): string[] => xs.map((x) => x.slug);

// ── band(δ) — the W33 behavioural change (W32 §6.3) ───────────────────────────
describe('selection-policy — band(δ) tolerance narrowing', () => {
  it('δ=0 keeps ONLY the exact maximum (≡ hard / keep-max)', () => {
    const xs = [c('a', 5), c('b', 4), c('c', 5)];
    expect(slugs(band(xs, scoreOf, 0))).toEqual(['a', 'c']);
  });

  it('band(_, _, 0) is byte-identical to hard() and keepMax() (the baseline property)', () => {
    const xs = [c('a', 3), c('b', 3), c('c', 1), c('d', 0)];
    expect(band(xs, scoreOf, 0)).toEqual(hard(xs, scoreOf));
    expect(band(xs, scoreOf, 0)).toEqual(keepMax(xs, scoreOf));
  });

  it('δ=1 keeps candidates within one point of the max (near-ties survive)', () => {
    const xs = [c('a', 5), c('b', 4), c('c', 3), c('d', 5)];
    // max=5 → keep score >= 4 → a,b,d (c at 3 drops)
    expect(slugs(band(xs, scoreOf, 1))).toEqual(['a', 'b', 'd']);
  });

  it('δ larger than the spread keeps the whole band (no narrowing)', () => {
    const xs = [c('a', 2), c('b', 1), c('c', 0)];
    expect(slugs(band(xs, scoreOf, 9))).toEqual(['a', 'b', 'c']);
  });

  it('preserves input (catalog) order among survivors', () => {
    const xs = [c('z', 5), c('m', 5), c('a', 5)];
    expect(slugs(band(xs, scoreOf, 0))).toEqual(['z', 'm', 'a']);
  });

  it('is floor-protected — a single candidate is always kept, never emptied', () => {
    expect(slugs(band([c('only', 0)], scoreOf, 0))).toEqual(['only']);
  });

  it('an empty input yields an empty band (degenerate)', () => {
    expect(band([] as C[], scoreOf, 0)).toEqual([]);
  });

  it('coerces a negative or fractional δ to a safe non-negative integer (no float scoring)', () => {
    const xs = [c('a', 5), c('b', 4)];
    expect(slugs(band(xs, scoreOf, -3))).toEqual(['a']); // negative → 0 → exact-max
    expect(slugs(band(xs, scoreOf, 1.9))).toEqual(['a', 'b']); // trunc → 1
  });

  it('is deterministic — same input yields an equal band', () => {
    const xs = [c('a', 5), c('b', 4), c('c', 5)];
    expect(band(xs, scoreOf, 1)).toEqual(band(xs, scoreOf, 1));
  });
});

// ── hard / keep-max — exact-max keep (W32 §6.3) ───────────────────────────────
describe('selection-policy — hard / keepMax', () => {
  it('keeps the argmax set, order-preserved', () => {
    const xs = [c('a', 2), c('b', 7), c('c', 7), c('d', 1)];
    expect(slugs(keepMax(xs, scoreOf))).toEqual(['b', 'c']);
  });
  it('hard is the same operation as keepMax', () => {
    const xs = [c('a', 2), c('b', 7), c('c', 7)];
    expect(hard(xs, scoreOf)).toEqual(keepMax(xs, scoreOf));
  });
  it('is floor-protected and empty-safe', () => {
    expect(slugs(keepMax([c('only', 0)], scoreOf))).toEqual(['only']);
    expect(keepMax([] as C[], scoreOf)).toEqual([]);
  });
});

// ── identity — no narrowing (disabled/absent signal) ──────────────────────────
describe('selection-policy — identity', () => {
  it('returns the band unchanged (order + membership)', () => {
    const xs = [c('a', 1), c('b', 2), c('c', 3)];
    expect(slugs(identity(xs))).toEqual(['a', 'b', 'c']);
  });
  it('returns a copy, not the same reference (pure)', () => {
    const xs = [c('a', 1)];
    expect(identity(xs)).not.toBe(xs);
  });
});

// ── keep-max + floor-exclude (W19/W24 exclusion semantics) ────────────────────
describe('selection-policy — keepMaxFloorExclude', () => {
  const isExcluded = (x: C): boolean => x.excluded === true;

  it('drops excluded candidates, then keeps the max of the remainder', () => {
    const xs = [c('a', 9, true), c('b', 5), c('c', 5)];
    // a is excluded (despite top score) → keep-max over {b,c} → b,c
    expect(slugs(keepMaxFloorExclude(xs, scoreOf, isExcluded))).toEqual(['b', 'c']);
  });

  it('is floor-protected — when ALL are excluded it keeps-max over all (demotion, not deletion)', () => {
    const xs = [c('a', 4, true), c('b', 6, true), c('c', 6, true)];
    expect(slugs(keepMaxFloorExclude(xs, scoreOf, isExcluded))).toEqual(['b', 'c']);
  });

  it('with no exclusions behaves as keep-max', () => {
    const xs = [c('a', 3), c('b', 8), c('c', 8)];
    expect(keepMaxFloorExclude(xs, scoreOf, isExcluded)).toEqual(keepMax(xs, scoreOf));
  });
});

// ── terminal — collapse to one winner (LRU → catalog order) ───────────────────
describe('selection-policy — terminal', () => {
  it('prefers the first candidate not in the recent window', () => {
    const xs = [c('a', 0), c('b', 0), c('c', 0)];
    const recent = new Set(['a']);
    expect(terminal(xs, { inRecentWindow: (x) => recent.has(x.slug) })?.slug).toBe('b');
  });

  it('falls back to the lowest use-count when all are recent', () => {
    const xs = [c('a', 0), c('b', 0)];
    const use = new Map([['a', 3], ['b', 1]]);
    expect(
      terminal(xs, {
        inRecentWindow: () => true,
        useCount: (x) => use.get(x.slug) ?? 0,
      })?.slug,
    ).toBe('b');
  });

  it('falls back to catalog (band) order when no memory is supplied', () => {
    const xs = [c('a', 0), c('b', 0)];
    expect(terminal(xs)?.slug).toBe('a');
  });

  it('returns undefined for an empty band', () => {
    expect(terminal([] as C[])).toBeUndefined();
  });

  it('is deterministic', () => {
    const xs = [c('a', 0), c('b', 0), c('c', 0)];
    const recent = new Set(['a']);
    const pick = (): string | undefined =>
      terminal(xs, { inRecentWindow: (x) => recent.has(x.slug) })?.slug;
    expect(pick()).toBe(pick());
  });
});
