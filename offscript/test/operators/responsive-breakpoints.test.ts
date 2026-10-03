import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { responsiveBreakpoints } from '../../src/operators/responsive-breakpoints.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { MECHANICAL_OPERATORS } from '../../src/flatten/harden.js';

const ctx = { params: {} };

const doc = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('responsive-breakpoints operator', () => {
  it('is registered in the default registry under its name', () => {
    expect(defaultRegistry().get('responsive-breakpoints')).toBe(responsiveBreakpoints);
    expect(responsiveBreakpoints.tier).toBe(1);
  });

  it('is in MECHANICAL_OPERATORS after token-normalize and before lang-attr', () => {
    const idx = (n: string) => MECHANICAL_OPERATORS.indexOf(n as never);
    expect(idx('responsive-breakpoints')).toBeGreaterThan(idx('token-normalize'));
    expect(idx('responsive-breakpoints')).toBeLessThan(idx('lang-attr'));
    expect(idx('responsive-breakpoints')).toBeLessThan(idx('landmark-semantics'));
  });

  it('detects a multi-column grid + a fixed-width div (2 findings)', () => {
    const tree = parseHtml(
      doc(
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr">a</div>' +
          '<div style="width:1200px">b</div>',
      ),
    );
    const findings = responsiveBreakpoints.detect(tree, ctx);
    expect(findings).toHaveLength(2);
    for (const f of findings) {
      expect(f.outcome).toBe('auto-remediated');
      expect(f.id.startsWith('responsive-breakpoints:')).toBe(true);
    }
  });

  it('apply embeds a <style id="offscript-responsive"> with TWO @media blocks and tags each site with a unique class', () => {
    const tree = parseHtml(
      doc(
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr">a</div>' +
          '<div style="width:1200px">b</div>',
      ),
    );
    responsiveBreakpoints.apply(tree, ctx);
    const out = serializeHtml(tree);

    // style block embedded
    expect(out).toContain('<style id="offscript-responsive">');
    // both @media blocks
    expect(out).toContain('@media (max-width:768px)');
    expect(out).toContain('@media (max-width:480px)');
    // distinct stable class names by document order
    expect(out).toContain('offscript-resp-0');
    expect(out).toContain('offscript-resp-1');
    // original inline styles preserved
    expect(out).toContain('display:grid;grid-template-columns:1fr 1fr 1fr');
    expect(out).toContain('width:1200px');
    // mobile collapse rules
    expect(out).toContain('.offscript-resp-0{grid-template-columns:1fr}');
    expect(out).toContain('.offscript-resp-1{width:100%;max-width:100%}');
  });

  it('flex-direction:row also triggers a responsive site (stacks at mobile)', () => {
    const tree = parseHtml(
      doc('<div style="display:flex;flex-direction:row">a</div>'),
    );
    const findings = responsiveBreakpoints.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    responsiveBreakpoints.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('.offscript-resp-0{flex-direction:column}');
  });

  it('a fluid layout produces 0 findings and no style block', () => {
    const tree = parseHtml(
      doc(
        '<div style="display:grid;grid-template-columns:1fr">a</div>' +
          '<div style="width:100%">b</div>' +
          '<div style="display:flex;flex-direction:column">c</div>',
      ),
    );
    expect(responsiveBreakpoints.detect(tree, ctx)).toHaveLength(0);
    const findings = responsiveBreakpoints.apply(tree, ctx);
    expect(findings).toHaveLength(0);
    expect(serializeHtml(tree)).not.toContain('offscript-responsive');
    expect(serializeHtml(tree)).not.toContain('offscript-resp-');
  });

  it('idempotency: apply twice is byte-identical to apply once; re-detect after apply is clean', () => {
    const tree = parseHtml(
      doc(
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr">a</div>' +
          '<div style="width:1200px">b</div>',
      ),
    );
    responsiveBreakpoints.apply(tree, ctx);
    const after = serializeHtml(tree);

    const second = responsiveBreakpoints.apply(tree, ctx);
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    expect(responsiveBreakpoints.detect(tree, ctx)).toHaveLength(0);
  });

  it('the original inline grid style stays byte-identical (desktop view intact); class is appended', () => {
    const tree = parseHtml(
      doc('<div class="card" style="display:grid;grid-template-columns:1fr 1fr 1fr">a</div>'),
    );
    responsiveBreakpoints.apply(tree, ctx);
    const out = serializeHtml(tree);
    // original inline style preserved
    expect(out).toContain('style="display:grid;grid-template-columns:1fr 1fr 1fr"');
    // class appended alongside existing class
    expect(out).toMatch(/class="card offscript-resp-0"|class="offscript-resp-0 card"/);
  });

  it('deterministic output: same input → identical serialized output', () => {
    const input = doc(
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr">a</div>' +
        '<div style="display:flex;flex-direction:row">b</div>' +
        '<div style="width:1200px">c</div>',
    );
    const a = parseHtml(input);
    const b = parseHtml(input);
    responsiveBreakpoints.apply(a, ctx);
    responsiveBreakpoints.apply(b, ctx);
    expect(serializeHtml(a)).toBe(serializeHtml(b));
  });

  it('fixed width below threshold (e.g. 600px) does NOT trigger', () => {
    const tree = parseHtml(doc('<div style="width:600px">a</div>'));
    expect(responsiveBreakpoints.detect(tree, ctx)).toHaveLength(0);
  });

  it('fixed width at threshold (720px) DOES trigger', () => {
    const tree = parseHtml(doc('<div style="width:720px">a</div>'));
    expect(responsiveBreakpoints.detect(tree, ctx)).toHaveLength(1);
  });
});
