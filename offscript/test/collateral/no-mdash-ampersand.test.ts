import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { noMdashAmpersand } from '../../src/operators/collateral/no-mdash-ampersand.js';
import type { OperatorContext } from '../../src/operator.js';
const ctx: OperatorContext = { params: {} };

describe('noMdashAmpersand', () => {
  it('flags an em-dash in copy', () => {
    const f = noMdashAmpersand.detect(parseHtml(`<h1>Pipeline That Builds Itself — While You Stay in Control</h1>`), ctx);
    expect(f.some((x) => x.id.startsWith('no-mdash'))).toBe(true);
  });
  it('flags an ampersand in copy', () => {
    const f = noMdashAmpersand.detect(parseHtml(`<p>Approve &amp; Send</p>`), ctx);
    expect(f.some((x) => x.id.startsWith('no-ampersand'))).toBe(true);
  });
  it('flags both in one pass with per-kind findings', () => {
    const f = noMdashAmpersand.detect(parseHtml(`<p>Scale &amp; Quality — no compromise</p>`), ctx);
    expect(f.length).toBe(2);
  });
  it('passes clean copy (hyphen + spelled-out "and")', () => {
    expect(noMdashAmpersand.detect(parseHtml(`<p>Approve and send. A direct, low-risk line.</p>`), ctx)).toEqual([]);
  });
  it('allows the → arrow glyph (only em-dash + ampersand are caught)', () => {
    expect(noMdashAmpersand.detect(parseHtml(`<a>Let's Talk →</a>`), ctx)).toEqual([]);
  });
  it('ignores ampersands inside <style>/<script> and attributes (copy only)', () => {
    const t = parseHtml(`<style>.a::before{content:"&"}</style><a href="?a=1&amp;b=2">link text</a>`);
    expect(noMdashAmpersand.detect(t, ctx)).toEqual([]);
  });
});
