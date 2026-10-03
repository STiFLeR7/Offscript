import { describe, it, expect } from 'vitest';
import { loadBundle } from '../src/bundle.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'fixtures', 'sample-bundle');

describe('loadBundle', () => {
  it('loads a valid bundle with one website deliverable', () => {
    const bundle = loadBundle(sample);
    expect(bundle.deliverables).toHaveLength(1);
    expect(bundle.deliverables[0].type).toBe('website');
    expect(bundle.deliverables[0].sourceHtml).toContain('<html');
    expect(bundle.deliverables[0].rulebookMd).toContain('lang-attr');
  });

  it('rejects a bundle missing brand-kit/tokens.json with a specific reason', () => {
    expect(() => loadBundle(here)).toThrow(/tokens\.json/);
  });
});
