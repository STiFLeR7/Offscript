import { describe, it, expect } from 'vitest';
import { actuatePass } from '../src/actuation.js';
import type { PassSpec } from '../src/actuation.js';
import type { Actuator, ActuationResult } from '../src/actuator.js';
import { tokenNormalize } from '../src/operators/token-normalize.js';
import { loadTokens } from '../src/tokens.js';
import type { OperatorContext } from '../src/operator.js';

const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
const ctx: OperatorContext = { params: {}, tokens };

// A fake "Claude": told the brand uses --color-accent for #2563eb, it rewrites the literal
// and embeds the canonical token block — i.e. it does what token-normalize.detect demands.
const fakeClaude: Actuator = {
  async harden(): Promise<ActuationResult> {
    return {
      html:
        '<!doctype html><html><head>' +
        '<style data-offscript="offscript-tokens">:root { --color-accent: #2563eb }</style>' +
        '<style>a{color:var(--color-accent)}</style>' +
        '</head><body></body></html>',
    };
  },
};

const pass: PassSpec = {
  name: 'token-bounds',
  instruction: 'rewrite off-token colours to the brand var() and embed the token block',
  rails: [tokenNormalize],
};

describe('actuatePass against a real rail (token-normalize.detect)', () => {
  it('converges: the fake actuator satisfies the real detector and the gate clears', async () => {
    const dirty = '<!doctype html><html><head><style>a{color:#2563eb}</style></head><body></body></html>';
    const out = await actuatePass(dirty, ctx, pass, fakeClaude);
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(1);
    expect(out.log.rails).toEqual(['token-normalize']);
    expect(out.html).toContain('var(--color-accent)');
    expect(out.html).toContain(':root { --color-accent: #2563eb }');
  });
});
