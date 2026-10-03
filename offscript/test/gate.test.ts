import { describe, it, expect } from 'vitest';
import { parseHtml } from '../src/working-rep.js';
import { loadTokens } from '../src/tokens.js';
import { tokenNormalize } from '../src/operators/token-normalize.js';
import { runGate } from '../src/gate.js';
import type { Rail } from '../src/gate.js';
import type { OperatorContext } from '../src/operator.js';

const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
const ctx: OperatorContext = { params: {}, tokens };
const rails: Rail[] = [tokenNormalize];

describe('runGate', () => {
  it('returns violations when a rail detects an out-of-bounds artifact', () => {
    const tree = parseHtml('<!doctype html><html><head><style>a{color:#2563eb}</style></head><body></body></html>');
    expect(runGate(tree, ctx, rails).length).toBeGreaterThan(0);
  });

  it('returns no violations when the artifact is already in bounds', () => {
    const inBounds =
      '<!doctype html><html><head>' +
      '<style data-offscript="offscript-tokens">:root { --color-accent: #2563eb }</style>' +
      '<style>a{color:var(--color-accent)}</style>' +
      '</head><body></body></html>';
    expect(runGate(parseHtml(inBounds), ctx, rails)).toHaveLength(0);
  });
});
