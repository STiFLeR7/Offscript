import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { responsiveNeed } from '../../src/operators/responsive-need.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };
const VP = '<meta name="viewport" content="width=device-width, initial-scale=1">';

/** Build a doc; viewport meta included unless viewport:false. */
const doc = (opts: { viewport?: boolean; style?: string; body?: string }) =>
  `<!doctype html><html><head>${opts.viewport === false ? '' : VP}` +
  `${opts.style ? `<style>${opts.style}</style>` : ''}</head>` +
  `<body>${opts.body ?? ''}</body></html>`;

describe('responsive-need operator (detector/rail)', () => {
  it('flags a document missing its viewport meta', () => {
    const findings = responsiveNeed.detect(parseHtml(doc({ viewport: false })), ctx);
    expect(findings.map((f) => f.id)).toContain('responsive-need:viewport-meta');
    expect(findings.find((f) => f.id === 'responsive-need:viewport-meta')?.outcome).toBe('warning');
  });

  it('does not flag viewport when the meta is present', () => {
    const findings = responsiveNeed.detect(parseHtml(doc({ viewport: true })), ctx);
    expect(findings.map((f) => f.id)).not.toContain('responsive-need:viewport-meta');
  });

  it('flags a fixed min-width (px) wider than the mobile viewport in a <style> block', () => {
    const findings = responsiveNeed.detect(parseHtml(doc({ style: '.x{min-width:1200px}' })), ctx);
    expect(findings.map((f) => f.id)).toEqual(['responsive-need:min-width:1200px']);
    expect(findings[0].outcome).toBe('warning');
  });

  it('flags a fixed width (px) wider than the mobile viewport in an inline style', () => {
    const findings = responsiveNeed.detect(parseHtml(doc({ body: '<div style="width:1000px">x</div>' })), ctx);
    expect(findings.map((f) => f.id)).toEqual(['responsive-need:width:1000px']);
  });

  it('does not flag a fixed width within the viewport', () => {
    expect(responsiveNeed.detect(parseHtml(doc({ style: '.x{width:320px}' })), ctx)).toHaveLength(0);
  });

  it('does not flag fluid widths (%, vw, calc, auto)', () => {
    const findings = responsiveNeed.detect(
      parseHtml(doc({ style: '.a{width:100%}.b{width:100vw}.c{width:calc(100% - 2rem)}.d{width:auto}' })),
      ctx,
    );
    expect(findings).toHaveLength(0);
  });

  it('dedupes identical fixed-width signals across elements', () => {
    const findings = responsiveNeed.detect(
      parseHtml(doc({ body: '<div style="width:1000px">a</div><section style="width:1000px">b</section>' })),
      ctx,
    );
    expect(findings.map((f) => f.id)).toEqual(['responsive-need:width:1000px']);
  });

  it('respects a custom viewport threshold from params', () => {
    const wide = { params: { viewportPx: 1300 } };
    // 1200px is within a 1300px assumed viewport, so it is not flagged
    expect(responsiveNeed.detect(parseHtml(doc({ style: '.x{min-width:1200px}' })), wide)).toHaveLength(0);
  });

  it('never mutates the tree and is idempotent (the fix is Claude’s — verify = re-detect)', () => {
    const tree = parseHtml(doc({ viewport: false, body: '<div style="width:1000px">x</div>' }));
    const before = serializeHtml(tree);
    const first = responsiveNeed.apply(tree, ctx);
    expect(serializeHtml(tree)).toBe(before); // detector/rail: no mutation
    const second = responsiveNeed.apply(tree, ctx);
    expect(second).toEqual(first); // idempotent findings
    expect(responsiveNeed.detect(tree, ctx)).toEqual(first); // detector keeps reporting
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('responsive-need')).toBe(responsiveNeed);
  });
});
