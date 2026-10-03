import { describe, it, expect, vi } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { websiteCompositionLimits } from '../../src/operators/website-composition-limits.js';
import type { CompositionRow } from '../../src/generate/composition-md.js';

// Stub the catalog loader so the rail tests are independent of the real governance file.
vi.mock('../../src/generate/composition-md.js', async (orig) => {
  const actual = await orig<typeof import('../../src/generate/composition-md.js')>();
  const rows: CompositionRow[] = [
    mk('feature-trio', ['feature'], 'base', { maxPerPage: 1 }),
    mk('feature-bento', ['feature', 'stats'], 'base', { avoidAdjacent: 'stats' }),
    mk('stat-cards', ['stats', 'feature'], 'contrast', { avoidAdjacentSurface: 'contrast' }),
    mk('feature-stack', ['feature'], 'base', { minBands: 5 }),
    mk('hero-bento', ['hero'], 'base', {}),
    mk('combo-stack', ['feature'], 'base', { maxPerPage: 1, minBands: 5 }),
    mk('pair-min', ['feature'], 'base', { minBands: 2 }),
  ];
  return { ...actual, loadCompositionCatalog: () => rows };
});
function mk(slug: string, serves: string[], surface: string, limits: object): CompositionRow {
  return { name: slug, slug, cat: 'section', layout: [], surface, interaction: [], serves,
    blocks: [], direction: '', limits } as CompositionRow;
}

function tree(...sections: string[]) {
  return parseHtml(`<html><body><div id="root">${sections.join('')}</div></body></html>`);
}
const sec = (slug: string, surface = 'base') =>
  `<section id="${slug}" data-cr-component="${slug}" data-cr-surface="${surface}"></section>`;

const ctx = { params: {} } as any;

describe('website-composition-limits', () => {
  it('escalates maxPerPage when a slug repeats beyond its cap', () => {
    const f = websiteCompositionLimits.detect(tree(sec('feature-trio'), sec('feature-trio')), ctx);
    expect(f.some((x) => x.id.includes('feature-trio:maxPerPage') && x.outcome === 'escalated')).toBe(true);
  });

  it('escalates avoidAdjacent when next to a serving band', () => {
    const f = websiteCompositionLimits.detect(tree(sec('stat-cards'), sec('feature-bento')), ctx);
    expect(f.some((x) => x.id.includes('feature-bento:avoidAdjacent') && x.outcome === 'escalated')).toBe(true);
  });

  it('escalates avoidAdjacentSurface against a contrast neighbour', () => {
    const f = websiteCompositionLimits.detect(tree(sec('hero-bento', 'contrast'), sec('stat-cards', 'contrast')), ctx);
    expect(f.some((x) => x.id.includes('stat-cards:avoidAdjacentSurface') && x.outcome === 'escalated')).toBe(true);
  });

  it('escalates minBands on a short page', () => {
    const f = websiteCompositionLimits.detect(tree(sec('feature-stack')), ctx);
    expect(f.some((x) => x.id.includes('feature-stack:minBands') && x.outcome === 'escalated')).toBe(true);
  });

  it('fires TWO avoidAdjacent findings when a section violates on both sides', () => {
    // feature-bento {avoidAdjacent:stats} between two stats-serving bands → one finding per neighbour.
    const f = websiteCompositionLimits.detect(
      tree(sec('stat-cards'), sec('feature-bento'), sec('stat-cards')),
      ctx,
    );
    const adj = f.filter((x) => x.id.includes('feature-bento:avoidAdjacent') && x.outcome === 'escalated');
    expect(adj).toHaveLength(2);
    expect(new Set(adj.map((x) => x.id)).size).toBe(2); // distinct :i:j ids
  });

  it('fires BOTH maxPerPage and minBands for a slug carrying two limits (no short-circuit)', () => {
    // combo-stack {maxPerPage:1, minBands:5} used 2× on a 2-section page → both checks fire.
    const f = websiteCompositionLimits.detect(tree(sec('combo-stack'), sec('combo-stack')), ctx);
    expect(f.some((x) => x.id.includes('combo-stack:maxPerPage') && x.outcome === 'escalated')).toBe(true);
    expect(f.some((x) => x.id.includes('combo-stack:minBands') && x.outcome === 'escalated')).toBe(true);
  });

  it('does not fire minBands when section count equals the floor (strict <)', () => {
    // pair-min {minBands:2} on exactly 2 sections → satisfied, no finding.
    const f = websiteCompositionLimits.detect(tree(sec('pair-min'), sec('hero-bento')), ctx);
    expect(f.some((x) => x.id.includes('pair-min:minBands'))).toBe(false);
  });

  it('is clean when limits are satisfied', () => {
    const f = websiteCompositionLimits.detect(tree(sec('hero-bento'), sec('feature-trio')), ctx);
    expect(f.filter((x) => x.outcome === 'escalated')).toHaveLength(0);
  });

  it('skips sections with no data-cr-component stamp (graceful)', () => {
    const t = tree('<section id="x"></section>', '<section id="y"></section>');
    expect(websiteCompositionLimits.detect(t, ctx)).toHaveLength(0);
  });

  it('apply ∘ apply is stable (idempotent)', () => {
    const t = tree(sec('feature-trio'), sec('feature-trio'));
    const once = websiteCompositionLimits.apply(t, ctx);
    const twice = websiteCompositionLimits.apply(t, ctx);
    expect(twice).toEqual(once);
  });
});
