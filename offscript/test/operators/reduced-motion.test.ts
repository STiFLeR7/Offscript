import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import { reducedMotion } from '../../src/operators/reduced-motion.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const ctx: OperatorContext = { params: {} };

describe('reduced-motion operator (Tier-0 website accessibility rail)', () => {
  it('is Tier 0', () => expect(reducedMotion.tier).toBe(0));

  it('flags @keyframes animation with no prefers-reduced-motion block (warn-only)', () => {
    const tree = parseHtml(doc(`<style>@keyframes rise{from{transform:translateY(8px)}to{transform:none}}.r{animation:rise .24s both;}</style>`));
    const f = reducedMotion.detect(tree, ctx);
    expect(f).toHaveLength(1);
    expect(f[0].id).toBe('reduced-motion:missing');
    expect(f[0].outcome).toBe('warning');
  });

  it('passes when the reduced-motion no-op is present', () => {
    const tree = parseHtml(doc(
      `<style>@keyframes rise{from{transform:translateY(8px)}to{transform:none}}` +
        `.r{animation:rise .24s both;}` +
        `@media (prefers-reduced-motion: reduce){.r{animation:none;}}</style>`,
    ));
    expect(reducedMotion.detect(tree, ctx)).toHaveLength(0);
  });

  it('does NOT flag a document with only hover transitions (no animation)', () => {
    const tree = parseHtml(doc(`<style>.btn{transition:transform .16s ease;}</style>`));
    expect(reducedMotion.detect(tree, ctx)).toHaveLength(0);
  });

  it('flags an inline style="animation:…" with no guard', () => {
    expect(reducedMotion.detect(parseHtml(doc(`<div style="animation: spin 2s linear infinite">x</div>`)), ctx)).toHaveLength(1);
  });
});
