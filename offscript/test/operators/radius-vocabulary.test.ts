import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadTokensFromCss } from '../../src/tokens.js';
import { radiusVocabulary } from '../../src/operators/radius-vocabulary.js';
import { defaultRegistry } from '../../src/operators/index.js';

// brand radius vocabulary as CSS custom properties
const radiusCss = `:root {
  --cr-radius-xs: 6px;
  --cr-radius-sm: 8px;
  --cr-radius-md: 12px;
  --cr-radius-lg: 20px;
  --cr-radius-xl: 24px;
  --cr-radius-pill: 500px;
}`;
const tokens = loadTokensFromCss(radiusCss);
const ctx = { params: {}, tokens };

const doc = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('radius-vocabulary operator', () => {
  it('is registered in the default registry under its name', () => {
    expect(defaultRegistry().get('radius-vocabulary')).toBe(radiusVocabulary);
    expect(radiusVocabulary.tier).toBe(0);
  });

  it('flags an off-vocab inline border-radius and snaps to nearest (1px -> xs/6px)', () => {
    const tree = parseHtml(doc('<div style="border-radius:1px">a</div>'));
    const findings = radiusVocabulary.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('radius-vocabulary:1px');
    expect(findings[0].outcome).toBe('auto-remediated');

    radiusVocabulary.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('border-radius:var(--cr-radius-xs)');
  });

  it('snaps 16px to md (12px) on the tie rule: 16-12=4, 20-16=4 -> smaller wins', () => {
    const tree = parseHtml(doc('<div style="border-radius:16px">a</div>'));
    radiusVocabulary.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('border-radius:var(--cr-radius-md)');
  });

  it('snaps 10px to sm (8px) on the tie rule: 10-8=2, 12-10=2 -> smaller wins', () => {
    const tree = parseHtml(doc('<div style="border-radius:10px">a</div>'));
    radiusVocabulary.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('border-radius:var(--cr-radius-sm)');
  });

  it('leaves in-vocab literal px untouched (token-normalize owns literal->var)', () => {
    const tree = parseHtml(doc('<div style="border-radius:12px">a</div>'));
    expect(radiusVocabulary.detect(tree, ctx)).toHaveLength(0);
    radiusVocabulary.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('border-radius:12px');
  });

  it('leaves 0, 0px and 50% untouched', () => {
    const tree = parseHtml(
      doc(
        '<div style="border-radius:0">a</div><div style="border-radius:0px">b</div><div style="border-radius:50%">c</div>',
      ),
    );
    expect(radiusVocabulary.detect(tree, ctx)).toHaveLength(0);
    radiusVocabulary.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('border-radius:0');
    expect(out).toContain('border-radius:0px');
    expect(out).toContain('border-radius:50%');
    expect(out).not.toContain('var(--cr-radius');
  });

  it('handles off-vocab radius inside an embedded <style> block', () => {
    const tree = parseHtml(doc('', '<style>.card{border-radius:1px}</style>'));
    const findings = radiusVocabulary.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toEqual(['radius-vocabulary:1px']);
    radiusVocabulary.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('border-radius:var(--cr-radius-xs)');
  });

  it('emits one finding per distinct off-vocab value (dedup)', () => {
    const tree = parseHtml(
      doc(
        '<div style="border-radius:1px">a</div><div style="border-radius:1px">b</div><div style="border-radius:10px">c</div>',
      ),
    );
    const ids = radiusVocabulary.detect(tree, ctx).map((f) => f.id).sort();
    expect(ids).toEqual(['radius-vocabulary:10px', 'radius-vocabulary:1px']);
  });

  it('is idempotent: apply twice == apply once, and verify (re-detect) is clean', () => {
    const tree = parseHtml(
      doc('<div style="border-radius:1px">a</div>', '<style>.c{border-radius:10px}</style>'),
    );
    radiusVocabulary.apply(tree, ctx);
    const after = serializeHtml(tree);
    const second = radiusVocabulary.apply(tree, ctx);
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    expect(radiusVocabulary.detect(tree, ctx)).toHaveLength(0);
  });

  it('skips multi-value shorthands and non-px units (single px length only)', () => {
    const tree = parseHtml(
      doc(
        '<div style="border-radius:8px 8px 1px 1px">a</div><div style="border-radius:1rem">b</div>',
      ),
    );
    expect(radiusVocabulary.detect(tree, ctx)).toHaveLength(0);
    radiusVocabulary.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('border-radius:8px 8px 1px 1px');
    expect(out).toContain('border-radius:1rem');
    expect(out).not.toContain('var(--cr-radius');
  });

  it('returns no findings when no token model is provided', () => {
    const tree = parseHtml(doc('<div style="border-radius:1px">a</div>'));
    expect(radiusVocabulary.detect(tree, { params: {} })).toHaveLength(0);
  });

  it('returns no findings when the token model has no radius props', () => {
    const noRadius = loadTokensFromCss(':root { --cr-color-accent: #2563eb; }');
    const tree = parseHtml(doc('<div style="border-radius:1px">a</div>'));
    expect(radiusVocabulary.detect(tree, { params: {}, tokens: noRadius })).toHaveLength(0);
  });
});
