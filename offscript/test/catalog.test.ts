/**
 * Path C / P1 — fragment catalog loader + serves-based selection.
 *
 * Covers AP1.1 (loadFragmentCatalog), AP1.2 (ARCHETYPE_TO_SERVES),
 * AP1.3 (selectCandidates ≥2 by meta), AP1.4 (pickFragment rotation).
 */

import { describe, it, expect } from 'vitest';
import {
  loadFragmentCatalog,
  loadFragmentHtml,
  ARCHETYPE_TO_SERVES,
  selectCandidates,
  pickFragment,
  clashesRuleE,
  violatesAvoidAdjacent,
  adjacencyClash,
  type FragmentEntry,
} from '../src/generate/catalog.js';
import type { Archetype } from '../src/archetype.js';

// Minimal FragmentEntry factory for pure rotation tests.
const frag = (slug: string): FragmentEntry => ({
  slug,
  serves: [],
  surface: [],
  layout: [],
  interaction: [],
  blocks: [],
  direction: '',
  limits: {},
  cat: 'section',
});
const cands = (slugs: string[]): FragmentEntry[] => slugs.map(frag);

// WS1 (EA-019/EA-020): loadFragmentCatalog now sources FragmentEntry[] from the live
// website COMPOSITION.md via the adapter (the deleted manifest was a generated derivative).
describe('catalog — loadFragmentCatalog (WS1 adapter over COMPOSITION.md)', () => {
  it('loads section entries with a normalized typed shape from COMPOSITION.md', () => {
    const cat = loadFragmentCatalog();
    expect(cat.length).toBeGreaterThanOrEqual(30);
    expect(cat.every((f) => f.cat === 'section')).toBe(true);
    const hero = cat.find((f) => f.slug === 'hero-bento');
    expect(hero).toBeDefined();
    expect(Array.isArray(hero!.serves)).toBe(true);
    expect(hero!.serves).toContain('hero');
    expect(typeof hero!.limits).toBe('object');
  });

  it('parses structured limits (stat-cards → avoidAdjacentSurface:contrast)', () => {
    const stat = loadFragmentCatalog().find((f) => f.slug === 'stat-cards');
    expect(stat?.limits.avoidAdjacentSurface).toBe('contrast');
  });

  it('M-2: every entry exposes the consumed fields (serves, surface[], layout, section cat)', () => {
    const cat = loadFragmentCatalog();
    for (const f of cat) {
      expect(f.serves.length, f.slug).toBeGreaterThan(0);
      expect(Array.isArray(f.surface)).toBe(true);
      expect(Array.isArray(f.layout)).toBe(true);
      expect(f.cat).toBe('section');
    }
  });
});

describe('catalog — ARCHETYPE_TO_SERVES (AP1.2 / AP1.3 feasibility)', () => {
  it('every archetype maps to a serves token with ≥2 section candidates', () => {
    const archetypes = Object.keys(ARCHETYPE_TO_SERVES) as Archetype[];
    expect(archetypes.length).toBe(20);
    for (const a of archetypes) {
      const serves = ARCHETYPE_TO_SERVES[a];
      const got = selectCandidates(serves);
      expect(got.length, `${a} → serves "${serves}"`).toBeGreaterThanOrEqual(2);
    }
  });

  // W85 — SPRINT-W84 §3.1: catalog.ts's table had drifted to 'social-proof' for case-study
  // while website-composition.ts's separate table used 'testimonials'. Governance evidence
  // (case-carousel specializes concept:role:testimonials-case-studies; results-proof
  // specializes concept:role:social-proof-logos) makes 'testimonials' the correct value —
  // this is now the single canonical table both selectors consume.
  it('case-study resolves to "testimonials" (the canonical, governance-grounded value)', () => {
    expect(ARCHETYPE_TO_SERVES['case-study']).toBe('testimonials');
  });
});

describe('catalog — selectCandidates (AP1.3)', () => {
  it('returns ≥2 fragments that actually serve the intent (by meta, not filename)', () => {
    const got = selectCandidates('feature');
    expect(got.length).toBeGreaterThanOrEqual(2);
    expect(got.every((c) => c.serves.includes('feature'))).toBe(true);
  });

  it('fails loud when an intent has <2 serving fragments', () => {
    expect(() => selectCandidates('not-a-real-serves-token')).toThrow(/≥2/);
  });
});

describe('catalog — pickFragment rotation (AP1.4)', () => {
  it('picks the first candidate when nothing used (deterministic manifest order)', () => {
    expect(pickFragment(cands(['a', 'b', 'c']), new Set())).toBe('a');
  });

  it('prefers a primary-serves (best fit) over a secondary-serves candidate', () => {
    const withServes = (slug: string, serves: string[]): FragmentEntry => ({ ...frag(slug), serves });
    // cta-banner lists hero only secondarily; hero-actions is hero-primary → best fit wins.
    const cs = [withServes('cta-banner', ['cta', 'hero']), withServes('hero-actions', ['hero', 'cta'])];
    expect(pickFragment(cs, new Set(), new Map(), 'hero')).toBe('hero-actions');
  });

  it('avoids a fragment already used on this page (within-page diversity)', () => {
    expect(pickFragment(cands(['a', 'b']), new Set(['a']))).toBe('b');
  });

  it('rotates to the least-recently-used across pages (LRU tiebreak)', () => {
    const recent = new Map([
      ['a', 3],
      ['b', 1],
      ['c', 2],
    ]);
    expect(pickFragment(cands(['a', 'b', 'c']), new Set(), recent)).toBe('b');
  });

  it('falls back to lowest-recency reuse when all are used this page', () => {
    const recent = new Map([
      ['a', 2],
      ['b', 1],
    ]);
    expect(pickFragment(cands(['a', 'b']), new Set(['a', 'b']), recent)).toBe('b');
  });
});

// ── P2 / AP2.1 — adjacency + band limits ──────────────────────────────────────

describe('catalog — adjacency predicates (AP2.1, mirror validate-page §7)', () => {
  const f = (slug: string, surface: string[], layout: string[], limits = {}): FragmentEntry => ({
    slug,
    serves: [],
    surface,
    layout,
    interaction: [],
    blocks: [],
    direction: '',
    limits,
    cat: 'section',
  });

  it('clashesRuleE: same surface + a shared layout primitive → clash', () => {
    expect(clashesRuleE(f('a', ['ink'], ['grid']), f('b', ['ink'], ['grid']))).toBe(true);
  });

  it('clashesRuleE: different surface → never a clash (even with shared layout)', () => {
    expect(clashesRuleE(f('a', ['ink'], ['grid']), f('b', ['light'], ['grid']))).toBe(false);
  });

  it('clashesRuleE: same surface but disjoint layouts → no clash', () => {
    expect(clashesRuleE(f('a', ['ink'], ['grid']), f('b', ['ink'], ['stack']))).toBe(false);
  });

  it('clashesRuleE: same surface + a band with NO layout → clash (cannot distinguish)', () => {
    expect(clashesRuleE(f('a', ['ink'], ['grid']), f('b', ['ink'], []))).toBe(true);
  });

  it('violatesAvoidAdjacent: self forbids a neighbour that serves the avoided intent', () => {
    const self = f('hero', ['ink'], ['split'], { avoidAdjacent: 'cta' });
    const nbr: FragmentEntry = { ...f('cta', ['warm'], ['band']), serves: ['cta'] };
    expect(violatesAvoidAdjacent(self, nbr)).toBe(true);
    expect(violatesAvoidAdjacent(nbr, self)).toBe(false); // one-directional
  });

  it('violatesAvoidAdjacent: avoidAdjacentSurface fires only when both surfaces match', () => {
    const self = f('a', ['ink'], ['grid'], { avoidAdjacentSurface: 'ink' });
    expect(violatesAvoidAdjacent(self, f('b', ['ink'], ['stack']))).toBe(true);
    expect(violatesAvoidAdjacent(self, f('b', ['light'], ['stack']))).toBe(false);
  });

  it('adjacencyClash is symmetric over rule e + both avoidAdjacent directions', () => {
    const a = f('a', ['ink'], ['grid']);
    const b = f('b', ['ink'], ['grid']);
    expect(adjacencyClash(a, b)).toBe(true);
    expect(adjacencyClash(b, a)).toBe(true);
  });
});

// ── WS3b / loadFragmentHtml — the reconstructed data-crf band (extract→scope→wrap) ──
// WS3b (EA-018) repoints loadFragmentHtml to the reconstruction pipeline: read the surviving
// exemplar (WS3a) → scope its CSS + wrap in <div data-crf="<slug>"> (WS3b). Un-skipped per
// EA-019 Phase 6 ("un-skip + extend"). Still dormant (no live caller).
describe('catalog — loadFragmentHtml (WS3b reconstructed band)', () => {
  it('loads a real fragment body with its data-crf wrapper + scoped <style> intact', () => {
    const html = loadFragmentHtml('hero-actions');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/data-crf="hero-actions"/);
    expect(html).toContain('<style');
  });

  it('throws loud on a slug with no exemplar file (WS3 F1)', () => {
    expect(() => loadFragmentHtml('not-a-real-slug')).toThrow(/no exemplar|F1/);
  });

  it('every catalog section slug resolves to a readable fragment body', () => {
    const sections = loadFragmentCatalog().filter((f) => f.cat === 'section');
    for (const f of sections) {
      expect(loadFragmentHtml(f.slug).length, f.slug).toBeGreaterThan(0);
    }
  });
});

describe('catalog — pickFragment adjacency awareness (AP2.1)', () => {
  const withMeta = (slug: string, serves: string[], surface: string[], layout: string[]): FragmentEntry => ({
    slug,
    serves,
    surface,
    layout,
    interaction: [],
    blocks: [],
    direction: '',
    limits: {},
    cat: 'section',
  });

  it('avoids a candidate that clashes with the previous band when an equal-fit alternative exists', () => {
    const prev = withMeta('prev', ['hero'], ['ink'], ['grid']);
    // both serve "feature" primarily; clean differs in surface, clash shares ink+grid.
    const clash = withMeta('feat-clash', ['feature'], ['ink'], ['grid']);
    const clean = withMeta('feat-clean', ['feature'], ['light'], ['grid']);
    expect(pickFragment([clash, clean], new Set(), new Map(), 'feature', prev)).toBe('feat-clean');
  });

  it('best-fit still dominates adjacency — never picks a worse-fit fragment to dodge a clash', () => {
    const prev = withMeta('prev', ['hero'], ['ink'], ['grid']);
    const bestButClash = withMeta('feat-primary', ['feature'], ['ink'], ['grid']); // primary feature, clashes
    const worseButClean = withMeta('cta-secondary', ['cta', 'feature'], ['light'], ['stack']); // feature secondary
    expect(pickFragment([bestButClash, worseButClean], new Set(), new Map(), 'feature', prev)).toBe(
      'feat-primary',
    );
  });
});
