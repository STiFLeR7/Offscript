import { describe, it, expect } from 'vitest';
import { assignWebsiteCompositions } from '../../src/generate/website-composition.js';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';
import type { CompositionRow } from '../../src/generate/composition-md.js';
import type { PlanItem } from '../../src/generate/types.js';

/**
 * W33 — the Soft-Band Cascade behavioural change at the W16 stage.
 * The router's W16 brief-affinity narrowing moves from exact-max (`keep score===max`)
 * to the W32 tolerance band (`keep score >= max − δ`). δ=0 reproduces exact-max
 * byte-for-byte; δ≥1 keeps near-tie candidates alive for the downstream tiebreaks.
 */

function row(slug: string, serves: string[], surface = 'base', limits = {}): CompositionRow {
  return {
    name: slug,
    slug,
    cat: 'section',
    layout: ['centered-stack'],
    surface,
    interaction: [],
    serves,
    blocks: ['headline-cluster'],
    direction: `Direction for ${slug}.`,
    limits,
  };
}
function item(archetype: string, id = archetype): PlanItem {
  return { anchor: { id, anchor: id }, archetype, tokenRoles: [], intent: `${archetype} intent` };
}

// Two hero candidates in catalog order [h1, h2]; brief favours h2 (5) over h1 (4).
const HERO_CAT: CompositionRow[] = [row('h1', ['hero']), row('h2', ['hero'])];
const briefScore = (r: CompositionRow): number => (r.slug === 'h2' ? 5 : r.slug === 'h1' ? 4 : 0);

describe('W16 soft band — δ default (0) reproduces exact-max', () => {
  it('δ omitted → picks the exact-max brief candidate (h2), unchanged behaviour', () => {
    const items = [item('hero')];
    assignWebsiteCompositions(items, HERO_CAT, [], undefined, briefScore);
    expect(items[0].componentVariant).toBe('h2');
  });

  it('δ=0 explicit → identical to omitted (exact-max)', () => {
    const items = [item('hero')];
    assignWebsiteCompositions(items, HERO_CAT, [], undefined, briefScore, undefined, undefined, undefined, 0);
    expect(items[0].componentVariant).toBe('h2');
  });

  it('no brief scorer → catalog-order tiebreak (h1), unaffected by δ', () => {
    const items = [item('hero')];
    assignWebsiteCompositions(items, HERO_CAT, [], undefined, undefined, undefined, undefined, undefined, 3);
    expect(items[0].componentVariant).toBe('h1');
  });
});

describe('W16 soft band — δ≥1 widens the band (near-ties survive to the downstream tiebreak)', () => {
  it('δ=1 keeps {h1,h2} within one point; the terminal LRU/catalog tiebreak now picks h1', () => {
    // max=5 (h2), h1 at 4 is within δ=1 → both survive W16 → no W19/W24/W30 supplied →
    // terminal prefers the first not-yet-used in catalog order → h1 (was h2 at δ=0).
    const items = [item('hero')];
    assignWebsiteCompositions(items, HERO_CAT, [], undefined, briefScore, undefined, undefined, undefined, 1);
    expect(items[0].componentVariant).toBe('h1');
  });

  it('δ too small to reach the runner-up leaves the exact-max winner unchanged', () => {
    // Spread is 3 (h2=5, h1=2); δ=1 cannot bridge it → h2 still wins.
    const cat: CompositionRow[] = [row('h1', ['hero']), row('h2', ['hero'])];
    const wideScore = (r: CompositionRow): number => (r.slug === 'h2' ? 5 : 2);
    const items = [item('hero')];
    assignWebsiteCompositions(items, cat, [], undefined, wideScore, undefined, undefined, undefined, 1);
    expect(items[0].componentVariant).toBe('h2');
  });
});

describe('W16 soft band — invariants preserved', () => {
  it('structural best-fit is NEVER overridden, even by a huge brief score under a wide band', () => {
    // fbest serves feature primarily; fsec serves cta primarily (feature only secondary)
    // but has a far higher brief score. Best-fit must still win at any δ.
    const cat: CompositionRow[] = [
      row('fbest', ['feature']),
      row('fsec', ['cta', 'feature']),
    ];
    const score = (r: CompositionRow): number => (r.slug === 'fsec' ? 100 : 1);
    const items = [item('feature-grid')];
    assignWebsiteCompositions(items, cat, [], undefined, score, undefined, undefined, undefined, 9);
    expect(items[0].componentVariant).toBe('fbest');
  });

  it('never empties a role — a sole candidate is always chosen at any δ', () => {
    const cat: CompositionRow[] = [row('solo', ['faq']), row('solo2', ['faq'])];
    const items = [item('faq')];
    assignWebsiteCompositions(items, cat, [], undefined, (r) => (r.slug === 'solo' ? 3 : 0), undefined, undefined, undefined, 5);
    expect(items[0].componentVariant).toBeTruthy();
  });

  it('is deterministic under a widened band (same input → same assignment)', () => {
    const a = [item('hero', 'h')];
    const b = [item('hero', 'h')];
    assignWebsiteCompositions(a, HERO_CAT, [], undefined, briefScore, undefined, undefined, undefined, 1);
    assignWebsiteCompositions(b, HERO_CAT, [], undefined, briefScore, undefined, undefined, undefined, 1);
    expect(a[0].componentVariant).toBe(b[0].componentVariant);
  });

  it('does not change section count or order', () => {
    const items = [item('hero', 'h'), item('feature-grid', 'f'), item('faq', 'q')];
    const cat: CompositionRow[] = [...HERO_CAT, row('feat', ['feature']), row('faq1', ['faq']), row('faq2', ['faq'])];
    assignWebsiteCompositions(items, cat, [], undefined, briefScore, undefined, undefined, undefined, 2);
    expect(items.map((i) => i.anchor.id)).toEqual(['h', 'f', 'q']);
    expect(items.length).toBe(3);
  });
});

// ── pickFragment (the SHIPPED fragmentId selector) must carry the SAME band (W32 §6.6) ──
function frag(slug: string, serves: string[]): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: ['grid'], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}

describe('W16 soft band — pickFragment (shipped selector) carries the same band', () => {
  const cands = [frag('a', ['hero']), frag('b', ['hero'])];
  const bs = (f: FragmentEntry): number => (f.slug === 'b' ? 5 : 4); // b is max, a within 1

  it('δ=0 → winner-identical to the graded key: max brief (b) wins', () => {
    expect(pickFragment(cands, new Set(), new Map(), 'hero', undefined, bs, undefined, undefined, undefined, 0)).toBe('b');
  });

  it('δ omitted → default 0 → byte-identical (b wins)', () => {
    expect(pickFragment(cands, new Set(), new Map(), 'hero', undefined, bs)).toBe('b');
  });

  it('δ=1 → a and b share the band; the lower keys/catalog order now decide → a (catalog-first)', () => {
    expect(pickFragment(cands, new Set(), new Map(), 'hero', undefined, bs, undefined, undefined, undefined, 1)).toBe('a');
  });

  it('δ=1 but a below the band (gap 3) → b still wins (band does not reach a)', () => {
    const bs2 = (f: FragmentEntry): number => (f.slug === 'b' ? 5 : 2);
    expect(pickFragment(cands, new Set(), new Map(), 'hero', undefined, bs2, undefined, undefined, undefined, 1)).toBe('b');
  });

  it('structural best-fit still dominates the band at any δ', () => {
    // a is hero-primary (best-fit); b is cta-primary (hero secondary) with a huge brief score.
    const mixed = [frag('a', ['hero']), frag('b', ['cta', 'hero'])];
    const bs3 = (f: FragmentEntry): number => (f.slug === 'b' ? 100 : 1);
    expect(pickFragment(mixed, new Set(), new Map(), 'hero', undefined, bs3, undefined, undefined, undefined, 9)).toBe('a');
  });

  it('within the δ=1 band, a higher W19 semantic score decides (downstream signal un-starved)', () => {
    // a and b tie in the brief band (5 vs 4, δ=1); semantic favours b → b wins despite catalog order.
    const sem = (f: FragmentEntry): number => (f.slug === 'b' ? 10 : 0);
    expect(pickFragment(cands, new Set(), new Map(), 'hero', undefined, bs, sem, undefined, undefined, 1)).toBe('b');
  });
});
