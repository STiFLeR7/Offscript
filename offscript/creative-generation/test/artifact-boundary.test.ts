import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreativeArtifactValidator } from 'creative-artifact-contract/src/artifact/validate.js';
import { computeContentDigest } from 'creative-artifact-contract/src/artifact/digest.js';
import type { FutureCreativeArtifact } from '../src/artifact-boundary.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('one-way dependency on creative-artifact-contract', () => {
  it('can construct and validate a stub CreativeArtifact-shaped object via the real contract package', () => {
    const validator = new CreativeArtifactValidator();
    const stub: FutureCreativeArtifact = {
      contractVersion: 1,
      id: 'future-creative-generation-stub',
      intentDigest: computeContentDigest('placeholder-intent'),
      artifactType: 'html',
      location: 'projects/example/creative-assets/run-1/stub.html',
      artifactDigest: computeContentDigest('<html>stub</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'pending', source: 'creative-generation' },
    };
    expect(validator.validate(stub).ok).toBe(true);
  });

  it('creative-artifact-contract has no dependency back on creative-generation (no cycle)', () => {
    const contractPkgPath = join(here, '..', 'node_modules', 'creative-artifact-contract', 'package.json');
    const contractPkg = JSON.parse(readFileSync(contractPkgPath, 'utf8'));
    const deps = { ...contractPkg.dependencies, ...contractPkg.devDependencies };
    expect(Object.keys(deps)).not.toContain('creative-generation');
  });
});
