import { describe, it, expect } from 'vitest';
import { parseHtml, findElement, serializeHtml } from '../../src/working-rep.js';
import { langAttr } from '../../src/operators/lang-attr.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: { lang: 'en' } };
const noLang = '<!doctype html><html><head></head><body></body></html>';

describe('lang-attr operator', () => {
  it('detects a missing lang attribute as an auto-remediated finding', () => {
    const findings = langAttr.detect(parseHtml(noLang), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('auto-remediated');
  });

  it('adds the lang attribute on apply', () => {
    const tree = parseHtml(noLang);
    const findings = langAttr.apply(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findElement(tree, 'html')?.properties?.lang).toBe('en');
  });

  it('is idempotent and verifies clean after apply', () => {
    const tree = parseHtml(noLang);
    langAttr.apply(tree, ctx);
    const after = serializeHtml(tree);
    const second = langAttr.apply(tree, ctx); // second apply must be a no-op
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    expect(langAttr.detect(tree, ctx)).toHaveLength(0); // verify = re-detect
  });

  it('leaves an existing lang attribute untouched', () => {
    const withLang = '<!doctype html><html lang="fr"><head></head><body></body></html>';
    expect(langAttr.detect(parseHtml(withLang), ctx)).toHaveLength(0);
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('lang-attr')).toBe(langAttr);
  });
});
