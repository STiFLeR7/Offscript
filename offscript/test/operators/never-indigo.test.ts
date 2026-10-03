import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import { neverIndigo } from '../../src/operators/never-indigo.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const ctx: OperatorContext = { params: {} };

describe('never-indigo operator (Tier-0 website charter rail)', () => {
  it('is Tier 0', () => expect(neverIndigo.tier).toBe(0));

  it('flags indigo as a background surface (warn-only)', () => {
    const tree = parseHtml(doc(`<style>.cta{background:var(--cr-wordmark-indigo);}</style>`));
    const f = neverIndigo.detect(tree, ctx);
    expect(f).toHaveLength(1);
    expect(f[0].outcome).toBe('warning');
  });

  it('flags indigo as a border accent and as an icon fill', () => {
    expect(neverIndigo.detect(parseHtml(doc(`<div style="border:1px solid var(--cr-wordmark-indigo)">x</div>`)), ctx)).toHaveLength(1);
    expect(neverIndigo.detect(parseHtml(doc(`<style>.ic{fill:var(--cr-wordmark-indigo);}</style>`)), ctx)).toHaveLength(1);
  });

  it('flags the raw #150580 literal on a surface (brand-fidelity-scan cannot — it is a valid token value)', () => {
    expect(neverIndigo.detect(parseHtml(doc(`<div style="background-color:#150580">x</div>`)), ctx)).toHaveLength(1);
  });

  it('flags an SVG fill="" presentation attribute carrying indigo', () => {
    expect(neverIndigo.detect(parseHtml(doc(`<svg><path fill="#150580"/></svg>`)), ctx)).toHaveLength(1);
  });

  it('does NOT flag indigo as text color (the sanctioned wordmark use)', () => {
    const tree = parseHtml(doc(`<span class="wordmark" style="color:var(--cr-wordmark-indigo)">Example Brand</span>`));
    expect(neverIndigo.detect(tree, ctx)).toHaveLength(0);
  });

  it('passes a brand-blue action surface', () => {
    expect(neverIndigo.detect(parseHtml(doc(`<style>.cta{background:var(--cr-brand);}</style>`)), ctx)).toHaveLength(0);
  });
});
