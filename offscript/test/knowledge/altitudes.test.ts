/**
 * PKG-2 — altitude ownership model tests.
 * Pure model: order, downward-only inheritance, and location-based source ownership.
 */
import { describe, it, expect } from 'vitest';
import {
  ALTITUDE_ORDER,
  altitudeRank,
  ancestorsOf,
  inheritsDownward,
  resolveSourceAltitude,
} from '../../src/knowledge/altitudes.js';

describe('PKG-2 altitudes — the ratified ownership order', () => {
  it('is the seven altitudes, top → bottom (Y2: constitutional added above universal)', () => {
    expect([...ALTITUDE_ORDER]).toEqual([
      'constitutional',
      'universal',
      'brand',
      'family',
      'variant',
      'block',
      'runtime',
    ]);
  });

  it('rank increases downward (constitutional highest)', () => {
    expect(altitudeRank('constitutional')).toBe(0);
    expect(altitudeRank('universal')).toBe(1);
    expect(altitudeRank('runtime')).toBe(6);
    expect(altitudeRank('family')).toBeLessThan(altitudeRank('variant'));
  });
});

describe('PKG-2 altitudes — inheritance is downward-only (no upward, no cycle)', () => {
  it('constitutional inherits from nothing; runtime inherits from all above', () => {
    expect(ancestorsOf('constitutional')).toEqual([]);
    expect(ancestorsOf('universal')).toEqual(['constitutional']);
    expect(ancestorsOf('runtime')).toEqual([
      'constitutional',
      'universal',
      'brand',
      'family',
      'variant',
      'block',
    ]);
  });

  it('a variant inherits constitutional, universal, brand, family (in order) — never block/runtime', () => {
    expect(ancestorsOf('variant')).toEqual(['constitutional', 'universal', 'brand', 'family']);
    expect(ancestorsOf('variant')).not.toContain('block');
    expect(ancestorsOf('variant')).not.toContain('runtime');
  });

  it('inheritsDownward: only strictly-higher altitudes may be inherited from', () => {
    expect(inheritsDownward('variant', 'family')).toBe(true); // up is allowed
    expect(inheritsDownward('family', 'variant')).toBe(false); // downward inheritance forbidden
    expect(inheritsDownward('family', 'family')).toBe(false); // self forbidden (no cycle)
  });
});

describe('PKG-2 altitudes — source ownership by location (growth-safe, not per-asset)', () => {
  const W = 'resources/design_processes/website';
  it('assigns each canonical knowledge source its owning altitude', () => {
    expect(resolveSourceAltitude(`${W}/component-governance/components.md`)).toBe('family');
    expect(resolveSourceAltitude(`${W}/component-governance/COMPOSITION.md`)).toBe('variant');
    expect(resolveSourceAltitude(`${W}/component-governance/COMPOSE.md`)).toBe('block');
    expect(resolveSourceAltitude(`${W}/component-governance/COMPOSITION-REASONING.md`)).toBe('universal');
    expect(resolveSourceAltitude(`${W}/rulebooks/numerics.md`)).toBe('runtime');
    expect(resolveSourceAltitude(`${W}/rulebooks/visual-language.md`)).toBe('universal');
    expect(resolveSourceAltitude(`${W}/PHILOSOPHY.md`)).toBe('universal');
    expect(resolveSourceAltitude(`${W}/colors_and_type.css`)).toBe('brand');
    expect(resolveSourceAltitude(`${W}/voice.md`)).toBe('brand');
    expect(resolveSourceAltitude('resources/design_principles/voice.md')).toBe('brand');
  });

  it('works with Windows-style separators', () => {
    expect(resolveSourceAltitude(`${W}\\component-governance\\components.md`.replace(/\//g, '\\'))).toBe('family');
  });

  it('returns undefined for non-knowledge sources (fonts, images, exemplars)', () => {
    expect(resolveSourceAltitude(`${W}/fonts/Inter-Bold.ttf`)).toBeUndefined();
    expect(resolveSourceAltitude(`${W}/exemplars/sections/component-hero-bento.html`)).toBeUndefined();
  });

  it('fails loud when a source would be owned by two different altitudes (ambiguity)', () => {
    // A contrived path under design_principles (brand) AND rulebooks/numerics.md (runtime).
    expect(() =>
      resolveSourceAltitude('resources/design_principles/rulebooks/numerics.md'),
    ).toThrow(/ambiguous ownership/i);
  });
});

describe('PKG-2 altitudes — Y2: the constitutional altitude (cross-track governance)', () => {
  const P = 'resources/design_principles';

  it('assigns CREATIVE_DIRECTION.md and INHERITED_CREATIVE_CONSTITUTION.md to constitutional', () => {
    expect(resolveSourceAltitude(`${P}/CREATIVE_DIRECTION.md`)).toBe('constitutional');
    expect(resolveSourceAltitude(`${P}/INHERITED_CREATIVE_CONSTITUTION.md`)).toBe('constitutional');
  });

  it('does not collide with the existing design_principles → brand catch-all (no ambiguity)', () => {
    expect(() => resolveSourceAltitude(`${P}/CREATIVE_DIRECTION.md`)).not.toThrow();
    expect(() => resolveSourceAltitude(`${P}/INHERITED_CREATIVE_CONSTITUTION.md`)).not.toThrow();
  });

  it('every other design_principles file is still brand-owned, unaffected', () => {
    expect(resolveSourceAltitude(`${P}/voice.md`)).toBe('brand');
    expect(resolveSourceAltitude(`${P}/colors_and_type.css`)).toBe('brand');
  });

  it('works with Windows-style separators', () => {
    expect(resolveSourceAltitude(`${P}\\CREATIVE_DIRECTION.md`.replace(/\//g, '\\'))).toBe('constitutional');
  });
});
