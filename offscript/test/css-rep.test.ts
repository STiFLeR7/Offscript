import { describe, it, expect } from 'vitest';
import {
  parseCss,
  parseCssStrict,
  serializeCss,
  replaceLiterals,
  rewriteInlineStyle,
  rewriteInlineDecls,
} from '../src/css-rep.js';

const v2v = new Map<string, string>([
  ['#2563eb', '--color-accent'],
  ['8px', '--space-sm'],
]);

describe('css-rep', () => {
  it('round-trips css through parse and serialize', () => {
    expect(serializeCss(parseCss('a{color:red}'))).toContain('color:red');
  });

  // P3 robustness: a malformed INPUT <style> block (8 vendored v2 fragments ship a broken
  // "no shared CSS" placeholder block) must NOT crash the rail run — parseCss tolerates it
  // by yielding an empty AST, while parseCssStrict (the brand-sheet parse) still fails loud.
  it('parseCss tolerates malformed CSS (empty AST, no throw)', () => {
    const malformed = '\n[data-crf="cta-band"] ; no shared CSS.\n-->';
    expect(() => parseCss(malformed)).not.toThrow();
    const root = parseCss(malformed);
    let decls = 0;
    root.walkDecls(() => decls++);
    expect(decls).toBe(0); // nothing analyzable, but no crash
  });

  it('parseCssStrict throws on the same malformed CSS (load-bearing sheets fail loud)', () => {
    expect(() => parseCssStrict('\n[data-crf="x"] ; no shared CSS.\n-->')).toThrow();
  });

  it('replaces a whole-value literal with var()', () => {
    expect(replaceLiterals('#2563eb', v2v)).toEqual({ value: 'var(--color-accent)', changed: 1 });
  });

  it('replaces a literal embedded in a multi-part value (case-insensitive)', () => {
    expect(replaceLiterals('1px solid #2563EB', v2v).value).toBe('1px solid var(--color-accent)');
  });

  it('does not match a literal that is a substring of a longer token', () => {
    expect(replaceLiterals('#2563ebff', v2v)).toEqual({ value: '#2563ebff', changed: 0 });
    expect(replaceLiterals('18px', v2v)).toEqual({ value: '18px', changed: 0 });
  });

  it('rewrites inline style declarations but skips custom properties', () => {
    const r = rewriteInlineStyle('color:#2563eb;--x:#2563eb', v2v);
    expect(r.style).toBe('color:var(--color-accent);--x:#2563eb');
    expect(r.changed).toBe(1);
  });
});

describe('rewriteInlineDecls', () => {
  it('passes each declaration to the callback and rebuilds the rewritten value', () => {
    const r = rewriteInlineDecls('color:red;border-radius:5px', (prop, val) =>
      prop.trim() === 'border-radius' ? '8px' : undefined,
    );
    expect(r.style).toBe('color:red;border-radius:8px');
    expect(r.changed).toBe(1);
  });

  it('leaves a declaration verbatim when the callback returns undefined', () => {
    const r = rewriteInlineDecls('color:red;--x:1', () => undefined);
    expect(r.style).toBe('color:red;--x:1');
    expect(r.changed).toBe(0);
  });

  it('ignores parts with no colon and preserves the original property text', () => {
    const r = rewriteInlineDecls('  color  :  red ;garbage', (prop, val) =>
      prop.trim() === 'color' ? val.trim().toUpperCase() : undefined,
    );
    expect(r.style).toBe('  color  :RED;garbage');
    expect(r.changed).toBe(1);
  });
});
