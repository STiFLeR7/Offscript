/**
 * Sprint W16 — Goal 2: pickFragment consumes an OPTIONAL brief-affinity score to break the
 * equal-structural tie by brief character instead of catalog order. Absent ⇒ byte-identical
 * (catalog-order tiebreak preserved). The score ranks BELOW best-fit / adjacency / within-page
 * (rail safety) and ABOVE the catalog-order tiebreak.
 */
import { describe, it, expect } from 'vitest';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';

function f(slug: string, serves: string[] = ['hero']): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: [], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}
const A = f('hero-a');
const B = f('hero-b');
const C = f('hero-c');
const candidates = [A, B, C]; // all equal-fit (serves[0]==='hero'), catalog order A,B,C

describe('W16 — pickFragment brief-aware tiebreak', () => {
  it('without a brief score → catalog-order first (byte-identical to today)', () => {
    expect(pickFragment(candidates, new Set(), new Map(), 'hero')).toBe('hero-a');
  });

  it('with a brief score → the highest-scoring equal-fit candidate wins (not catalog order)', () => {
    const score = (x: FragmentEntry): number => (x.slug === 'hero-b' ? 5 : 0);
    expect(pickFragment(candidates, new Set(), new Map(), 'hero', undefined, score)).toBe('hero-b');
  });

  it('best-fit still dominates the brief score (never picks a worse-fit variant for a higher score)', () => {
    const mixed = [f('hero-primary', ['hero']), f('cta-also-hero', ['cta', 'hero'])];
    // brief score favours the cta-primary fragment, but best-fit (serves[0]==='hero') must win.
    const score = (x: FragmentEntry): number => (x.slug === 'cta-also-hero' ? 99 : 0);
    expect(pickFragment(mixed, new Set(), new Map(), 'hero', undefined, score)).toBe('hero-primary');
  });

  it('brief score breaks ties among equal-fit candidates only (deterministic on equal scores)', () => {
    const score = (): number => 0; // all zero → falls back to catalog order
    expect(pickFragment(candidates, new Set(), new Map(), 'hero', undefined, score)).toBe('hero-a');
  });
});
