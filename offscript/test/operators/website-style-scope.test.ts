import { describe, it, expect } from 'vitest';
import { websiteStyleScope } from '../../src/operators/website-style-scope.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { collateralRegistry } from '../../src/operators/collateral/index.js';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';

const ctx: OperatorContext = { params: {} };
const wrap = (style: string) => parseHtml(`<html><body><section id="s1"><style>${style}</style></section></body></html>`);

describe('website-style-scope — shape & registration', () => {
  it('is a tier-1 operator', () => expect(websiteStyleScope.tier).toBe(1));
  it('is in defaultRegistry (website)', () =>
    expect(defaultRegistry().get('website-style-scope')).toBeDefined());
  it('is NOT in collateralRegistry (isolation)', () =>
    expect(collateralRegistry().get('website-style-scope')).toBeUndefined());
});

describe('website-style-scope — (a) unscoped house-class selectors', () => {
  it('escalates a bare .cr-* selector (no #id prefix)', () => {
    const f = websiteStyleScope.detect(wrap('.cr-ico { width: 22px; }'), ctx);
    expect(f.some((x) => x.id.startsWith('website-style-scope:unscoped:') && x.outcome === 'escalated')).toBe(true);
  });
  it('does NOT escalate an id-scoped .cr-* selector', () => {
    const f = websiteStyleScope.detect(wrap('#s1 .cr-h-eyebrow { margin: 0; }'), ctx);
    expect(f.some((x) => x.id.startsWith('website-style-scope:unscoped:'))).toBe(false);
  });
  it('ignores selectors that touch no house class', () => {
    const f = websiteStyleScope.detect(wrap('.gv-card { padding: 8px; }'), ctx);
    expect(f).toHaveLength(0);
  });
});

describe('website-style-scope — (b) raw type on the ramp', () => {
  it('escalates font-size on a ramp class', () => {
    const f = websiteStyleScope.detect(wrap('#s1 .cr-h-section { font-size: 21px; }'), ctx);
    expect(f.some((x) => x.id.startsWith('website-style-scope:raw-type:') && x.outcome === 'escalated')).toBe(true);
  });
  it('escalates font-weight on a ramp class', () => {
    const f = websiteStyleScope.detect(wrap('#s1 .cr-p { font-weight: 700; }'), ctx);
    expect(f.some((x) => x.id.startsWith('website-style-scope:raw-type:'))).toBe(true);
  });
  it('allows raw font on a bespoke (non-cr) class', () => {
    const f = websiteStyleScope.detect(wrap('#s1 .gv-state { font-size: 12px; font-weight: 600; }'), ctx);
    expect(f).toHaveLength(0);
  });
  it('allows raw font on a hyphenated bespoke extension of a ramp name', () => {
    const f = websiteStyleScope.detect(wrap('#s1 .cr-eyebrow-alt { font-size: 32px; }'), ctx);
    expect(f.some((x) => x.id.startsWith('website-style-scope:raw-type:'))).toBe(false);
  });
});

describe('website-style-scope — robustness', () => {
  it('idempotent: apply === detect', () => {
    const t = wrap('.cr-ico { width: 1px; }');
    expect(websiteStyleScope.apply(t, ctx)).toEqual(websiteStyleScope.detect(t, ctx));
  });
  it('tolerates a malformed <style> (no throw, no finding)', () => {
    const t = parseHtml('<html><body><style>[data-crf] ; no shared CSS.</style></body></html>');
    expect(() => websiteStyleScope.detect(t, ctx)).not.toThrow();
  });
});

describe('website-style-scope — house sheet is not a per-section block', () => {
  it('does NOT flag the global house sheet (style outside any section)', () => {
    const tree = parseHtml('<html><head><style>.cr-h-hero{font-size:40px;font-weight:800}.cr-ico{width:22px}</style></head><body><section id="s1"><h2>x</h2></section></body></html>');
    expect(websiteStyleScope.detect(tree, ctx)).toHaveLength(0);
  });
  it('still flags an unscoped .cr-* inside a section', () => {
    const tree = parseHtml('<html><body><section id="s1"><style>.cr-ico{width:1px}</style></section></body></html>');
    expect(websiteStyleScope.detect(tree, ctx).some((f) => f.id.startsWith('website-style-scope:unscoped:'))).toBe(true);
  });
});
