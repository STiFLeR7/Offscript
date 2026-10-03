import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { retiredToken } from '../../src/operators/collateral/retired-token.js';
import { flatNoShadow } from '../../src/operators/collateral/flat-no-shadow.js';
import { noEmoji } from '../../src/operators/collateral/no-emoji.js';
import type { OperatorContext } from '../../src/operator.js';
const ctx: OperatorContext = { params: {} };

describe('retiredToken', () => {
  it('flags a legacy/off-system colour used on a surface', () => {
    const t = parseHtml(`<p style="color:#A514FF">x</p>`); // orchid legacy
    expect(retiredToken.detect(t, ctx).length).toBeGreaterThan(0);
  });
  it('flags orange/ember (retired)', () => {
    expect(retiredToken.detect(parseHtml(`<div style="background:#FF7A00">x</div>`), ctx).length).toBe(1);
  });
  it('passes a brand colour', () => {
    expect(retiredToken.detect(parseHtml(`<a style="color:#149DFF">x</a>`), ctx)).toEqual([]);
  });
});
describe('flatNoShadow', () => {
  it('flags any box-shadow', () => {
    expect(flatNoShadow.detect(parseHtml(`<div style="box-shadow:0 4px 12px rgba(0,0,0,.1)">x</div>`), ctx).length).toBe(1);
  });
  it('passes box-shadow:none and absent', () => {
    expect(flatNoShadow.detect(parseHtml(`<div style="box-shadow:none">x</div>`), ctx)).toEqual([]);
    expect(flatNoShadow.detect(parseHtml(`<div>x</div>`), ctx)).toEqual([]);
  });
  // flat-no-shadow.ts:23-26 also scans <style> blocks — not only inline styles.
  it('flags a box-shadow declared inside a <style> block', () => {
    const t = parseHtml(
      `<!doctype html><html><head><style>.c{box-shadow:0 2px 8px rgba(0,0,0,.2)}</style></head><body></body></html>`,
    );
    expect(flatNoShadow.detect(t, ctx).length).toBe(1);
  });
  it('accumulates inline + <style> shadows into one finding with the total count', () => {
    const t = parseHtml(
      `<!doctype html><html><head><style>.c{box-shadow:0 1px 2px #000}</style></head>` +
      `<body><div style="box-shadow:0 4px 12px rgba(0,0,0,.1)">x</div></body></html>`,
    );
    const findings = flatNoShadow.detect(t, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('flat-no-shadow:2');
  });
});
describe('noEmoji', () => {
  it('flags an emoji in text', () => {
    expect(noEmoji.detect(parseHtml(`<h1>Hello 🚀</h1>`), ctx).length).toBe(1);
  });
  it('allows the → arrow glyph', () => {
    expect(noEmoji.detect(parseHtml(`<a>Book a call →</a>`), ctx)).toEqual([]);
  });
});
