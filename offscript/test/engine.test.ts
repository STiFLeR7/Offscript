import { describe, it, expect } from 'vitest';
import type { Root } from 'hast';
import { runDeliverable } from '../src/engine.js';
import { findElement } from '../src/working-rep.js';
import type { Operator, Finding, OperatorContext } from '../src/operator.js';
import type { Deliverable } from '../src/bundle.js';

// A fake auto-fixing operator: stamps data-fixed on <html>; detect is clean once stamped.
const fakeFix: Operator = {
  name: 'fake-fix',
  tier: 0,
  detect(tree: Root): Finding[] {
    const html = findElement(tree, 'html');
    return html?.properties?.dataFixed === 'yes'
      ? []
      : [{ id: 'fake-fix', description: 'not fixed', outcome: 'auto-remediated' }];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    const findings = this.detect(tree, ctx);
    if (findings.length === 0) return [];
    const html = findElement(tree, 'html');
    if (html) {
      html.properties = html.properties ?? {};
      html.properties.dataFixed = 'yes';
    }
    return findings;
  },
};

const deliverable: Deliverable = {
  type: 'website',
  name: 'website',
  sourceHtml: '<!doctype html><html><head></head><body></body></html>',
  rulebookMd: ['```yaml', 'operators:', '  - operator: fake-fix', '```'].join('\n'),
};

describe('runDeliverable', () => {
  it('replays the recipe and produces output with the fix applied and verified', () => {
    const registry = new Map([[fakeFix.name, fakeFix]]);
    const result = runDeliverable(deliverable, registry);
    expect(result.outputHtml).toContain('data-fixed="yes"');
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].operator).toBe('fake-fix');
    expect(result.runs[0].verified).toBe(true);
    expect(result.runs[0].findings[0].outcome).toBe('auto-remediated');
  });

  it('throws on an unknown operator named in the recipe', () => {
    const bad: Deliverable = {
      ...deliverable,
      rulebookMd: ['```yaml', 'operators:', '  - operator: nope', '```'].join('\n'),
    };
    expect(() => runDeliverable(bad, new Map())).toThrow(/Unknown operator/);
  });
});
