/**
 * Sprint 2.1 — Stage 1 selection-fact migration: the pure band-mapper.
 *
 * Maps an authored COMPOSITION row's selection cells (serves / surface / limits) onto
 * the FROZEN four-band model fields — serves+surface → capabilities.satisfies (prefixed,
 * obligations namespace), limits → validation.expects. Pure, deterministic, fail-loud on
 * malformed values; never invents a fact.
 */
import { describe, it, expect } from 'vitest';
import {
  SERVES_PREFIX,
  SURFACE_PREFIX,
  toSelectionFacts,
  resolveVariantFacts,
  assertCompleteVariantFacts,
  type RawSelection,
} from '../../src/knowledge/selection-facts.js';

const row = (over: Partial<RawSelection> = {}): RawSelection => ({
  serves: ['hero', 'feature'],
  surface: ['base'],
  limits: {},
  ...over,
});

describe('toSelectionFacts — band mapping', () => {
  it('maps serves → capabilities.satisfies with the serves: prefix', () => {
    const f = toSelectionFacts(row({ serves: ['hero', 'cta'], surface: [] }));
    expect(f.satisfies).toContain(`${SERVES_PREFIX}hero`);
    expect(f.satisfies).toContain(`${SERVES_PREFIX}cta`);
  });

  it('maps surface → capabilities.satisfies with the surface: prefix (all authored surfaces)', () => {
    const f = toSelectionFacts(row({ serves: [], surface: ['base', 'contrast'] }));
    expect(f.satisfies).toEqual([`${SURFACE_PREFIX}base`, `${SURFACE_PREFIX}contrast`]);
  });

  it('serializes limits → validation.expects tokens', () => {
    const f = toSelectionFacts(
      row({ limits: { maxPerPage: 1, minBands: 6, avoidAdjacent: 'hero', avoidAdjacentSurface: 'base' } }),
    );
    expect(f.expects).toEqual([
      'avoidAdjacent:hero',
      'avoidAdjacentSurface:base',
      'maxPerPage:1',
      'minBands:6',
    ]);
  });

  it('is canonical: satisfies + expects are sorted and deduped', () => {
    const f = toSelectionFacts(row({ serves: ['feature', 'hero', 'feature'], surface: ['base', 'base'] }));
    expect(f.satisfies).toEqual([`${SERVES_PREFIX}feature`, `${SERVES_PREFIX}hero`, `${SURFACE_PREFIX}base`]);
  });

  it('absence is meaning: empty serves/surface/limits → empty fact lists (no fabrication)', () => {
    const f = toSelectionFacts(row({ serves: [], surface: [], limits: {} }));
    expect(f.satisfies).toEqual([]);
    expect(f.expects).toEqual([]);
  });

  it('normalizes messy authored tokens deterministically (never guesses meaning)', () => {
    const f = toSelectionFacts(row({ serves: ['(any — cta-row source)'], surface: [] }));
    expect(f.satisfies).toEqual([`${SERVES_PREFIX}any-cta-row-source`]);
  });

  it('fails loud on a non-empty value that normalizes to nothing (invalid value)', () => {
    expect(() => toSelectionFacts(row({ serves: ['***'], surface: [] }))).toThrow();
  });
});

describe('resolveVariantFacts — join + fail-loud', () => {
  const map = new Map<string, RawSelection>([['hero-bento', row({ serves: ['hero'], surface: ['base'] })]]);

  it('resolves an authored variant', () => {
    expect(resolveVariantFacts('hero-bento', map).satisfies).toEqual([
      `${SERVES_PREFIX}hero`,
      `${SURFACE_PREFIX}base`,
    ]);
  });

  it('throws when a variant has no authored COMPOSITION row (never guesses)', () => {
    expect(() => resolveVariantFacts('ghost-variant', map)).toThrow(/ghost-variant/);
  });
});

describe('assertCompleteVariantFacts — required metadata present', () => {
  it('passes when both a serves: and a surface: fact exist', () => {
    expect(() =>
      assertCompleteVariantFacts('hero-bento', toSelectionFacts(row({ serves: ['hero'], surface: ['base'] }))),
    ).not.toThrow();
  });

  it('throws when serves is missing', () => {
    expect(() =>
      assertCompleteVariantFacts('x', toSelectionFacts(row({ serves: [], surface: ['base'] }))),
    ).toThrow(/serves/);
  });

  it('throws when surface is missing', () => {
    expect(() =>
      assertCompleteVariantFacts('x', toSelectionFacts(row({ serves: ['hero'], surface: [] }))),
    ).toThrow(/surface/);
  });
});
