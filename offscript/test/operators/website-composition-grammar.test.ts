import { describe, it, expect } from 'vitest';
import { websiteCompositionGrammar } from '../../src/operators/website-composition-grammar.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { collateralRegistry } from '../../src/operators/collateral/index.js';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';

const ctx: OperatorContext = { params: {} };
const sec = (inner: string) => parseHtml(`<html><body><section id="s1">${inner}</section></body></html>`);

describe('website-composition-grammar — shape & isolation', () => {
  it('is tier-1', () => expect(websiteCompositionGrammar.tier).toBe(1));
  it('is in defaultRegistry', () =>
    expect(defaultRegistry().get('website-composition-grammar')).toBeDefined());
  it('is NOT in collateralRegistry', () =>
    expect(collateralRegistry().get('website-composition-grammar')).toBeUndefined());
});

describe('rule 7 — one display tier', () => {
  it('escalates two co-equal cr-h-section headings in one band', () => {
    const f = websiteCompositionGrammar.detect(sec('<h2 class="cr-h-section">A</h2><h2 class="cr-h-section">B</h2>'), ctx);
    expect(f.some((x) => x.id.startsWith('website-composition-grammar:display-tier:') && x.outcome === 'escalated')).toBe(true);
  });
  it('allows one section title + framing eyebrow/card tiers', () => {
    const f = websiteCompositionGrammar.detect(sec('<span class="cr-h-eyebrow">k</span><h2 class="cr-h-section">A</h2><h3 class="cr-h-card">b</h3>'), ctx);
    expect(f.some((x) => x.id.startsWith('website-composition-grammar:display-tier:'))).toBe(false);
  });
});

describe('project-owned glyph choices', () => {
  it('allows an emoji in section text', () => {
    const f = websiteCompositionGrammar.detect(sec('<p class="cr-p">Fast 🚀 launch</p>'), ctx);
    expect(f).toEqual([]);
  });
  it('allows the → arrow glyph', () => {
    const f = websiteCompositionGrammar.detect(sec('<a class="cr-btn">Start →</a>'), ctx);
    expect(f.some((x) => x.id.startsWith('website-composition-grammar:glyph:'))).toBe(false);
  });
});

describe('robustness', () => {
  it('idempotent', () => {
    const t = sec('<h2 class="cr-h-section">A</h2><h2 class="cr-h-section">B</h2>');
    expect(websiteCompositionGrammar.apply(t, ctx)).toEqual(websiteCompositionGrammar.detect(t, ctx));
  });
});

describe('finding-id stability', () => {
  it('gives id-less sections distinct finding ids (no dedup collision)', () => {
    const tree = parseHtml('<html><body>' +
      '<section><h2 class="cr-h-section">A</h2><h2 class="cr-h-section">B</h2></section>' +
      '<section><h2 class="cr-h-section">C</h2><h2 class="cr-h-section">D</h2></section>' +
      '</body></html>');
    const ids = websiteCompositionGrammar.detect(tree, ctx)
      .filter((f) => f.id.startsWith('website-composition-grammar:display-tier:')).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids.length).toBe(2);
  });
});
