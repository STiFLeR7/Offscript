import { describe, it, expect } from 'vitest';
import { collateralRegistry } from '../../src/operators/collateral/index.js';
describe('collateralRegistry', () => {
  it('includes the collateral static rails + reused hygiene, excludes website-only ops', () => {
    const names = new Set([...collateralRegistry().keys()]);
    for (const n of ['square-page-corners','column-count','brand-fidelity-scan','contrast','landmark-semantics','token-normalize','font-fidelity']) expect(names.has(n)).toBe(true);
    for (const n of ['retired-token','flat-no-shadow','no-emoji','no-mdash-ampersand','no-callout-box','metrics-in-dark','responsive-breakpoints','interactivity-accordion','archetype-tag','sticky-stack']) expect(names.has(n)).toBe(false);
  });
});

describe('collateral registry — page-fill', () => {
  it('registers the page-fill advisory rail', () => {
    expect(collateralRegistry().has('page-fill')).toBe(true);
  });
});
