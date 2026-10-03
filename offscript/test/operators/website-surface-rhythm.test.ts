import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { websiteSurfaceRhythm } from '../../src/operators/website-surface-rhythm.js';
import * as numerics from '../../src/generate/website-numerics.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { collateralRegistry } from '../../src/operators/collateral/index.js';
import { deckRegistry } from '../../src/operators/deck/index.js';

afterEach(() => vi.restoreAllMocks());
const ctx = { params: {} } as any;
const sec = (surface: string) =>
  `<section data-cr-component="x" data-cr-surface="${surface}"></section>`;
const tree = (...s: string[]) => parseHtml(`<html><body><div id="r">${s.join('')}</div></body></html>`);

// Pin the threshold so the test is independent of the governance value.
function pinN(n: number) {
  vi.spyOn(numerics, 'loadWebsiteNumerics').mockReturnValue({
    minFillPct: 55, minFocalRatio: 1.4, minBandsForRhythm: n,
  });
}

describe('website-surface-rhythm', () => {
  it('escalates when >=N bands have no contrast/figure', () => {
    pinN(4);
    const f = websiteSurfaceRhythm.detect(tree(sec('base'), sec('base'), sec('rest'), sec('base')), ctx);
    expect(f.some((x) => x.id === 'website-surface-rhythm:no-contrast-or-figure' && x.outcome === 'escalated')).toBe(true);
  });
  it('is clean when a contrast band is present', () => {
    pinN(4);
    const f = websiteSurfaceRhythm.detect(tree(sec('base'), sec('base'), sec('contrast'), sec('base')), ctx);
    expect(f).toHaveLength(0);
  });
  it('is clean when a figure band is present', () => {
    pinN(4);
    const f = websiteSurfaceRhythm.detect(tree(sec('base'), sec('base'), sec('figure'), sec('base')), ctx);
    expect(f).toHaveLength(0);
  });
  it('exempts a small page (< N bands)', () => {
    pinN(4);
    expect(websiteSurfaceRhythm.detect(tree(sec('base'), sec('rest')), ctx)).toHaveLength(0);
  });
  it('ignores unstamped sections (graceful)', () => {
    pinN(4);
    expect(websiteSurfaceRhythm.detect(tree('<section></section>'), ctx)).toHaveLength(0);
  });
  it('degrades to a warning when numerics fail to load', () => {
    vi.spyOn(numerics, 'loadWebsiteNumerics').mockImplementation(() => { throw new Error('missing'); });
    const f = websiteSurfaceRhythm.detect(tree(sec('base'), sec('base'), sec('base'), sec('base')), ctx);
    // fallback N=4 still applies, so it ALSO escalates; the warning is present too.
    expect(f.some((x) => x.id === 'website-surface-rhythm:numerics-fallback' && x.outcome === 'warning')).toBe(true);
  });
  it('apply ∘ apply is idempotent', () => {
    pinN(4);
    const t = tree(sec('base'), sec('base'), sec('base'), sec('base'));
    expect(websiteSurfaceRhythm.apply(t, ctx)).toEqual(websiteSurfaceRhythm.detect(t, ctx));
  });
});

describe('website-surface-rhythm — track isolation', () => {
  it('is website-only', () => {
    expect(defaultRegistry().get('website-surface-rhythm')).toBeDefined();
    expect(collateralRegistry().get('website-surface-rhythm')).toBeUndefined();
    expect(deckRegistry().get('website-surface-rhythm')).toBeUndefined();
  });
});
