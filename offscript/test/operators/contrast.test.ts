import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadTokens } from '../../src/tokens.js';
import { contrast } from '../../src/operators/contrast.js';
import { defaultRegistry } from '../../src/operators/index.js';

const tokens = loadTokens('{ "color": { "accent": "#ff0000" } }');
const ctx = { params: {}, tokens };

const body = (inline: string) =>
  `<!doctype html><html><head></head><body><p style="${inline}">hi</p></body></html>`;

describe('contrast operator (detector/rail)', () => {
  it('reports a foreground/background pair that fails AA normal text (4.5)', () => {
    const findings = contrast.detect(parseHtml(body('color:#ff0000;background-color:#ffffff')), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('contrast:#ff0000-on-#ffffff');
    expect(findings[0].outcome).toBe('warning');
  });

  it('does not flag a pair that passes AA (black on white)', () => {
    expect(
      contrast.detect(parseHtml(body('color:#000000;background-color:#ffffff')), ctx),
    ).toHaveLength(0);
  });

  it('resolves a var(--token) foreground through the token model', () => {
    const findings = contrast.detect(parseHtml(body('color:var(--color-accent);background-color:#ffffff')), ctx);
    expect(findings.map((f) => f.id)).toEqual(['contrast:#ff0000-on-#ffffff']);
  });

  it('reads the background from the background shorthand', () => {
    const findings = contrast.detect(parseHtml(body('color:#ff0000;background:#ffffff')), ctx);
    expect(findings.map((f) => f.id)).toEqual(['contrast:#ff0000-on-#ffffff']);
  });

  it('uses the large-text threshold (3:1) when font-size is large', () => {
    // #ff0000 on #ffffff is ~4.0 — fails normal (4.5) but passes large (3.0)
    expect(
      contrast.detect(parseHtml(body('color:#ff0000;background-color:#ffffff;font-size:30px')), ctx),
    ).toHaveLength(0);
  });

  it('skips an element that declares only a foreground (no background to compare)', () => {
    expect(contrast.detect(parseHtml(body('color:#ff0000')), ctx)).toHaveLength(0);
  });

  it('skips an unresolvable var() when no token model is provided', () => {
    expect(
      contrast.detect(parseHtml(body('color:var(--color-accent);background-color:#ffffff')), { params: {} }),
    ).toHaveLength(0);
  });

  it('dedupes identical failing pairs across multiple elements', () => {
    const two =
      '<!doctype html><html><body>' +
      '<p style="color:#ff0000;background-color:#ffffff">a</p>' +
      '<span style="color:#ff0000;background-color:#ffffff">b</span>' +
      '</body></html>';
    expect(contrast.detect(parseHtml(two), ctx)).toHaveLength(1);
  });

  it('never mutates the tree and is idempotent (the fix is Claude’s — verify = re-detect)', () => {
    const tree = parseHtml(body('color:#ff0000;background-color:#ffffff'));
    const before = serializeHtml(tree);
    const first = contrast.apply(tree, ctx);
    expect(serializeHtml(tree)).toBe(before); // detector/rail: no mutation
    const second = contrast.apply(tree, ctx);
    expect(second).toEqual(first); // idempotent findings
    expect(contrast.detect(tree, ctx)).toEqual(first); // detector keeps reporting
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('contrast')).toBe(contrast);
  });
});
