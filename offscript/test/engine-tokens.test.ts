import { describe, it, expect } from 'vitest';
import type { Root } from 'hast';
import { runDeliverable } from '../src/engine.js';
import { loadTokens } from '../src/tokens.js';
import { findElement } from '../src/working-rep.js';
import type { Operator, Finding, OperatorContext } from '../src/operator.js';
import type { Deliverable } from '../src/bundle.js';

// A fake token-aware operator: stamps data-saw-tokens on <html> iff ctx.tokens is present.
const fakeTokenAware: Operator = {
  name: 'fake-token-aware',
  tier: 0,
  detect: () => [],
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    if (!ctx.tokens) return [];
    const html = findElement(tree, 'html');
    if (html) {
      html.properties = html.properties ?? {};
      html.properties.dataSawTokens = 'yes';
    }
    return [{ id: 'fake:saw', description: 'operator received ctx.tokens', outcome: 'auto-remediated' }];
  },
};

const deliverable: Deliverable = {
  type: 'website',
  name: 'website',
  sourceHtml: '<!doctype html><html><head></head><body></body></html>',
  rulebookMd: ['```yaml', 'operators:', '  - operator: fake-token-aware', '```'].join('\n'),
};

describe('runDeliverable threads RunEnv.tokens into operator context', () => {
  it('passes bundle tokens through to operators', () => {
    const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
    const registry = new Map([[fakeTokenAware.name, fakeTokenAware]]);
    const result = runDeliverable(deliverable, registry, { tokens });
    expect(result.outputHtml).toContain('data-saw-tokens="yes"');
    expect(result.runs[0].findings[0].id).toBe('fake:saw');
  });

  it('passes undefined tokens when no env is given (back-compat with the skeleton)', () => {
    const registry = new Map([[fakeTokenAware.name, fakeTokenAware]]);
    const result = runDeliverable(deliverable, registry);
    expect(result.outputHtml).not.toContain('data-saw-tokens');
  });
});
