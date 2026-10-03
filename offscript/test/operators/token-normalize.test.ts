import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadTokens } from '../../src/tokens.js';
import { tokenNormalize } from '../../src/operators/token-normalize.js';
import { defaultRegistry } from '../../src/operators/index.js';

const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
const ctx = { params: {}, tokens };

const doc = (body: string) =>
  `<!doctype html><html><head><style>a{color:#2563eb}</style></head><body>${body}</body></html>`;

describe('token-normalize operator', () => {
  it('detects literal token values and a missing embed as auto-remediated findings', () => {
    const findings = tokenNormalize.detect(parseHtml(doc('')), ctx);
    expect(findings.map((f) => f.id).sort()).toEqual([
      'token-normalize:embed',
      'token-normalize:literals',
    ]);
    expect(findings.every((f) => f.outcome === 'auto-remediated')).toBe(true);
  });

  it('rewrites literals to var() and embeds the canonical token block on apply', () => {
    const tree = parseHtml(doc('<p style="color:#2563eb">hi</p>'));
    tokenNormalize.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('color:var(--color-accent)');
    expect(out).toContain('data-offscript="offscript-tokens"');
    expect(out).toContain(':root { --color-accent: #2563eb }');
  });

  it('is idempotent and verifies clean after apply (verify = re-detect)', () => {
    const tree = parseHtml(doc('<p style="color:#2563eb">hi</p>'));
    tokenNormalize.apply(tree, ctx);
    const after = serializeHtml(tree);
    const second = tokenNormalize.apply(tree, ctx); // second apply must be a no-op
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    expect(tokenNormalize.detect(tree, ctx)).toHaveLength(0); // verify = re-detect
  });

  it('returns no findings when no token model is provided', () => {
    expect(tokenNormalize.detect(parseHtml(doc('')), { params: {} })).toHaveLength(0);
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('token-normalize')).toBe(tokenNormalize);
  });
});
