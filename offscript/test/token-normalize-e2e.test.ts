import { describe, it, expect, afterEach } from 'vitest';
import { loadBundle } from '../src/bundle.js';
import { loadTokens } from '../src/tokens.js';
import { runDeliverable } from '../src/engine.js';
import { packageOutput } from '../src/package.js';
import { defaultRegistry } from '../src/operators/index.js';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'fixtures', 'token-bundle');
const outDir = join(sample, 'deliverables', 'website', 'output');

afterEach(() => rmSync(outDir, { recursive: true, force: true }));

describe('token-normalize end-to-end', () => {
  it('threads brand tokens through the engine and rewrites the deliverable', () => {
    const bundle = loadBundle(sample);
    const tokens = loadTokens(bundle.tokensJson);
    const result = runDeliverable(bundle.deliverables[0], defaultRegistry(), { tokens });

    const run = result.runs.find((r) => r.operator === 'token-normalize');
    expect(run?.verified).toBe(true);
    expect(run?.findings.length).toBeGreaterThan(0);

    const outPath = packageOutput(bundle.dir, result);
    const written = readFileSync(outPath, 'utf8');
    expect(written).toContain('color:var(--color-accent)');     // <style> rewritten
    expect(written).toContain('background:var(--color-accent)'); // inline style rewritten
    expect(written).toContain(':root { --color-accent: #2563eb }'); // canonical embed
  });
});
