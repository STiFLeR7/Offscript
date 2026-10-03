import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { stickyStack } from '../../src/operators/sticky-stack.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

describe('sticky-stack operator (Tier-1 escalation-only)', () => {
  it('is registered in defaultRegistry()', () => {
    expect(defaultRegistry().get('sticky-stack')).toBe(stickyStack);
  });

  it('returns no findings when nothing is sticky', () => {
    const html = doc(`<header><h1>x</h1></header><main><p>y</p></main>`);
    expect(stickyStack.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('returns no findings when only one sticky element exists on a given edge', () => {
    const html = doc(
      `<header style="position:sticky;top:0">a</header>` +
        `<footer style="position:sticky;bottom:0">b</footer>`,
    );
    // Top has one, bottom has one — no collision on either.
    expect(stickyStack.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('escalates when two elements are sticky on the same top edge', () => {
    const html = doc(
      `<header id="site-nav" style="position:sticky;top:0">nav</header>` +
        `<div id="filter-bar" style="position:sticky;top:64px">filters</div>`,
    );
    const findings = stickyStack.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('escalated');
    expect(findings[0].id).toMatch(/^sticky-stack:top:/);
    expect(findings[0].description).toMatch(/sticky.*top.*occlude/i);
  });

  it('escalates when two elements are sticky on the same bottom edge', () => {
    const html = doc(
      `<div id="cta" style="position:sticky;bottom:0">cta</div>` +
        `<div id="cookie" style="position:sticky;bottom:8px">cookie</div>`,
    );
    const findings = stickyStack.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/^sticky-stack:bottom:/);
  });

  it('emits one finding per redundant sticky beyond the first (3 same-edge → 2 findings)', () => {
    const html = doc(
      `<div id="a" style="position:sticky;top:0">a</div>` +
        `<div id="b" style="position:sticky;top:48px">b</div>` +
        `<div id="c" style="position:sticky;top:96px">c</div>`,
    );
    const findings = stickyStack.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(2);
    expect(findings[0].id).toContain('id-b');
    expect(findings[1].id).toContain('id-c');
  });

  it('does not collide top-pinned vs bottom-pinned siblings', () => {
    const html = doc(
      `<header style="position:sticky;top:0">a</header>` +
        `<footer style="position:sticky;bottom:0">b</footer>`,
    );
    expect(stickyStack.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('ignores elements with position other than sticky', () => {
    const html = doc(
      `<header style="position:fixed;top:0">a</header>` +
        `<div style="position:sticky;top:0">b</div>`,
    );
    expect(stickyStack.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('ignores sticky elements with no edge pinned (no top/bottom)', () => {
    const html = doc(
      `<div style="position:sticky">a</div>` + `<div style="position:sticky">b</div>`,
    );
    expect(stickyStack.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('uses fallback positional ids when sticky elements have no id/class', () => {
    const html = doc(
      `<header style="position:sticky;top:0">a</header>` +
        `<div style="position:sticky;top:48px">b</div>`,
    );
    const findings = stickyStack.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/sticky-stack:top:n\d+$/);
  });

  it('is idempotent (re-running detect on the same tree yields the same finding ids)', () => {
    const html = doc(
      `<header id="a" style="position:sticky;top:0">a</header>` +
        `<div id="b" style="position:sticky;top:48px">b</div>`,
    );
    const tree = parseHtml(html);
    const first = stickyStack.detect(tree, ctx).map((f) => f.id);
    const second = stickyStack.detect(tree, ctx).map((f) => f.id);
    expect(second).toEqual(first);
  });

  it('apply() does not mutate and returns the same findings as detect()', () => {
    const html = doc(
      `<header id="a" style="position:sticky;top:0">a</header>` +
        `<div id="b" style="position:sticky;top:48px">b</div>`,
    );
    const tree = parseHtml(html);
    const before = stickyStack.detect(tree, ctx).map((f) => f.id);
    const applied = stickyStack.apply(tree, ctx).map((f) => f.id);
    const after = stickyStack.detect(tree, ctx).map((f) => f.id);
    expect(applied).toEqual(before);
    expect(after).toEqual(before);
  });

  it('treats a top+bottom declaration as pinned to whichever appears last (cascade)', () => {
    // bottom appears last → treated as bottom-pinned.
    const html = doc(
      `<div style="position:sticky;top:0;bottom:0">a</div>` +
        `<div style="position:sticky;bottom:8px">b</div>`,
    );
    const findings = stickyStack.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/^sticky-stack:bottom:/);
  });
});
