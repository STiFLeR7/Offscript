import { describe, it, expect, afterEach } from 'vitest';
import { loadBundle } from '../src/bundle.js';
import { runDeliverable } from '../src/engine.js';
import { packageOutput } from '../src/package.js';
import { defaultRegistry } from '../src/operators/index.js';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'fixtures', 'sample-bundle');
const outDir = join(sample, 'deliverables', 'website', 'output');

afterEach(() => rmSync(outDir, { recursive: true, force: true }));

describe('end-to-end: intake → replay → package', () => {
  it('writes a packaged output file with the clean-up applied', () => {
    const bundle = loadBundle(sample);
    const result = runDeliverable(bundle.deliverables[0], defaultRegistry());
    const outPath = packageOutput(bundle.dir, result);
    const written = readFileSync(outPath, 'utf8');
    expect(written).toContain('lang="en"');
    expect(outPath).toContain(join('website', 'output', 'index.html'));
  });
});
