import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadTokens } from '../../src/tokens.js';
import { brandFidelityScan } from '../../src/operators/brand-fidelity-scan.js';
import { defaultRegistry } from '../../src/operators/index.js';

const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
const ctx = { params: {}, tokens };

const doc = (styleCss: string, body = '') =>
  `<!doctype html><html><head><style>${styleCss}</style></head><body>${body}</body></html>`;

describe('brand-fidelity-scan operator', () => {
  it('reports an off-token hex color in a <style> block as a warning', () => {
    const findings = brandFidelityScan.detect(parseHtml(doc('a{color:#ff0000}')), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('brand-fidelity-scan:#ff0000');
    expect(findings[0].outcome).toBe('warning');
  });

  it('reports an off-token hex color in an inline style attribute', () => {
    const findings = brandFidelityScan.detect(
      parseHtml(doc('', '<p style="color:#00ff00">x</p>')),
      ctx,
    );
    expect(findings.map((f) => f.id)).toEqual(['brand-fidelity-scan:#00ff00']);
  });

  it('does not flag a color that is traceable to a brand token', () => {
    expect(brandFidelityScan.detect(parseHtml(doc('a{color:#2563EB}')), ctx)).toHaveLength(0);
  });

  it('does not flag var() references or the embedded token block', () => {
    const withBlock =
      '<!doctype html><html><head>' +
      '<style data-offscript="offscript-tokens">:root{--color-accent:#2563eb}</style>' +
      '<style>a{color:var(--color-accent)}</style>' +
      '</head><body></body></html>';
    expect(brandFidelityScan.detect(parseHtml(withBlock), ctx)).toHaveLength(0);
  });

  it('returns no findings when no token model is provided', () => {
    expect(brandFidelityScan.detect(parseHtml(doc('a{color:#ff0000}')), { params: {} })).toHaveLength(0);
  });

  it('never mutates the tree and is idempotent (warnings persist — verify = re-detect)', () => {
    const tree = parseHtml(doc('a{color:#ff0000}'));
    const before = serializeHtml(tree);
    const first = brandFidelityScan.apply(tree, ctx);
    expect(serializeHtml(tree)).toBe(before); // warn-only: no mutation
    const second = brandFidelityScan.apply(tree, ctx);
    expect(second).toEqual(first); // idempotent findings
    expect(brandFidelityScan.detect(tree, ctx)).toEqual(first); // oracle keeps reporting
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('brand-fidelity-scan')).toBe(brandFidelityScan);
  });

  // C-1: decorative-artwork colour rules (scoped under .cr-decor / [data-decor]) are
  // governed as artwork, not brand-surface colour, and are exempt from the off-token scan.
  describe('decorative-artwork exemption (C-1)', () => {
    it('does not flag an off-token hex under a .cr-decor selector', () => {
      expect(brandFidelityScan.detect(parseHtml(doc('.cr-decor .b1{background:#15316e}')), ctx)).toHaveLength(0);
    });

    it('does not flag an off-token hex under a [data-decor] selector', () => {
      expect(brandFidelityScan.detect(parseHtml(doc('[data-decor] .b1{background:#15316e}')), ctx)).toHaveLength(0);
    });

    it('still flags the identical hex under a plain selector (exemption is not a blanket bypass)', () => {
      const findings = brandFidelityScan.detect(parseHtml(doc('.orbit .b1{background:#15316e}')), ctx);
      expect(findings.map((f) => f.id)).toEqual(['brand-fidelity-scan:#15316e']);
    });

    it('exempts an inline style on a .cr-decor element but still flags an unmarked sibling', () => {
      const body =
        '<div class="cr-decor" style="background:#15316e"></div>' +
        '<div style="background:#abcdef"></div>';
      const findings = brandFidelityScan.detect(parseHtml(doc('', body)), ctx);
      expect(findings.map((f) => f.id)).toEqual(['brand-fidelity-scan:#abcdef']);
    });

    it('exempts an inline style on a [data-decor] element', () => {
      const findings = brandFidelityScan.detect(
        parseHtml(doc('', '<div data-decor style="background:#15316e"></div>')),
        ctx,
      );
      expect(findings).toHaveLength(0);
    });

    it('exempts only the decorative rule, not unrelated off-token colours in the same document', () => {
      const findings = brandFidelityScan.detect(
        parseHtml(doc('.cr-decor .b1{background:#15316e}.btn{color:#ff0000}')),
        ctx,
      );
      expect(findings.map((f) => f.id)).toEqual(['brand-fidelity-scan:#ff0000']);
    });
  });
});
