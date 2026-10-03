import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadTokensFromCss } from '../../src/tokens.js';
import { fontFidelity } from '../../src/operators/font-fidelity.js';
import { defaultRegistry } from '../../src/operators/index.js';

// brand font tokens mirroring the real Example Brand colors_and_type.css
const fontCss = `:root {
  --cr-font-display: "Manrope", "Inter", system-ui, sans-serif;
  --cr-font-body:    "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --cr-font-mono:    ui-monospace, "JetBrains Mono", Menlo, monospace;
}`;
const tokens = loadTokensFromCss(fontCss);
const ctx = { params: {}, tokens };

const doc = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('font-fidelity operator', () => {
  it('is registered in the default registry under its name (tier 0)', () => {
    expect(defaultRegistry().get('font-fidelity')).toBe(fontFidelity);
    expect(fontFidelity.tier).toBe(0);
  });

  it('flags a literal brand-face font-family and rewrites it to the matching var', () => {
    const tree = parseHtml(doc('<p style="font-family:Inter">a</p>'));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('font-fidelity:literal:Inter');
    expect(findings[0].outcome).toBe('auto-remediated');

    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-body)');
  });

  it('maps Manrope -> var(--cr-font-display)', () => {
    const tree = parseHtml(doc('<h1 style="font-family:Manrope">a</h1>'));
    expect(fontFidelity.detect(tree, ctx)[0].id).toBe('font-fidelity:literal:Manrope');
    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-display)');
  });

  it('rewrites a literal brand face inside an embedded <style> block', () => {
    const tree = parseHtml(doc('', '<style>.b{font-family:Manrope}</style>'));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toEqual(['font-fidelity:literal:Manrope']);
    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-display)');
  });

  it('handles a quoted literal face value', () => {
    const tree = parseHtml(doc('<p style=\'font-family:"Inter"\'>a</p>'));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toEqual(['font-fidelity:literal:Inter']);
    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-body)');
  });

  it('leaves an already-tokenized font-family untouched (no finding)', () => {
    const tree = parseHtml(doc('<p style="font-family:var(--cr-font-body)">a</p>'));
    expect(fontFidelity.detect(tree, ctx)).toHaveLength(0);
    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-body)');
  });

  it('removes a Google-Fonts @import from an embedded <style>', () => {
    const css =
      '@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans&display=swap");.x{color:red}';
    const tree = parseHtml(doc('', `<style>${css}</style>`));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toContain('font-fidelity:nonlocal-import');
    fontFidelity.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('fonts.googleapis.com');
    expect(out).toContain('color:red');
  });

  it('removes a bare-string Google-Fonts @import (no url())', () => {
    const css = '@import "https://fonts.googleapis.com/css2?family=Instrument+Sans";.x{color:red}';
    const tree = parseHtml(doc('', `<style>${css}</style>`));
    expect(fontFidelity.detect(tree, ctx).map((f) => f.id)).toContain(
      'font-fidelity:nonlocal-import',
    );
    fontFidelity.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('fonts.googleapis.com');
    expect(out).toContain('color:red');
  });

  it('removes a bare-string remote @import from a non-google host', () => {
    const css = '@import "https://cdn.example.com/f.css";.x{color:red}';
    const tree = parseHtml(doc('', `<style>${css}</style>`));
    expect(fontFidelity.detect(tree, ctx).map((f) => f.id)).toContain(
      'font-fidelity:nonlocal-import',
    );
    fontFidelity.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('cdn.example.com');
    expect(out).toContain('color:red');
  });

  it('keeps a relative / data: @import (treated as local)', () => {
    const css = '@import "./base.css";@import url(data:text/css,.y{});.x{color:red}';
    const tree = parseHtml(doc('', `<style>${css}</style>`));
    expect(fontFidelity.detect(tree, ctx).map((f) => f.id)).not.toContain(
      'font-fidelity:nonlocal-import',
    );
    fontFidelity.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('./base.css');
    expect(out).toContain('data:text/css');
  });

  it('tokenizes a multi-family literal stack on the PRIMARY family (primary-first)', () => {
    const tree = parseHtml(doc('<h1 style=\'font-family:"Manrope", Georgia\'>a</h1>'));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toEqual(['font-fidelity:literal:Manrope']);
    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:var(--cr-font-display)');
  });

  it('removes a non-local @font-face (remote src), keeps a local @font-face', () => {
    const css =
      '@font-face{font-family:"Evil";src:url(https://cdn.example.com/evil.woff2)}' +
      '@font-face{font-family:"Manrope";src:url("./fonts/Manrope-Regular.ttf")}';
    const tree = parseHtml(doc('', `<style>${css}</style>`));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings.map((f) => f.id)).toContain('font-fidelity:nonlocal-import');
    fontFidelity.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('cdn.example.com');
    expect(out).toContain('./fonts/Manrope-Regular.ttf');
  });

  it('warns (does not mutate) on an off-brand font-family', () => {
    const tree = parseHtml(doc('<p style="font-family:Comic Sans">a</p>'));
    const findings = fontFidelity.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('font-fidelity:offbrand:Comic Sans');
    expect(findings[0].outcome).toBe('warning');

    fontFidelity.apply(tree, ctx);
    expect(serializeHtml(tree)).toContain('font-family:Comic Sans');
    expect(serializeHtml(tree)).not.toContain('var(--cr-font');
  });

  it('emits no finding for a bare generic keyword font-family', () => {
    const tree = parseHtml(doc('<p style="font-family:sans-serif">a</p>'));
    expect(fontFidelity.detect(tree, ctx)).toHaveLength(0);
  });

  it('is idempotent on the auto-remediated parts; re-detect clean', () => {
    const tree = parseHtml(
      doc(
        '<p style="font-family:Inter">a</p>',
        '<style>@import url("https://fonts.googleapis.com/x");.b{font-family:Manrope}</style>',
      ),
    );
    fontFidelity.apply(tree, ctx);
    const after = serializeHtml(tree);
    const second = fontFidelity.apply(tree, ctx);
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    // only the off-brand warning (none here) would remain on re-detect
    expect(fontFidelity.detect(tree, ctx)).toHaveLength(0);
  });

  it('returns [] when no token model is provided', () => {
    const tree = parseHtml(doc('<p style="font-family:Inter">a</p>'));
    expect(fontFidelity.detect(tree, { params: {} })).toHaveLength(0);
  });

  it('returns [] when the token model has no --cr-font-* props', () => {
    const noFont = loadTokensFromCss(':root { --cr-color-accent: #2563eb; }');
    const tree = parseHtml(doc('<p style="font-family:Inter">a</p>'));
    expect(fontFidelity.detect(tree, { params: {}, tokens: noFont })).toHaveLength(0);
  });
});
