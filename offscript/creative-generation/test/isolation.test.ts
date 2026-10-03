import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

function allSourceFiles(): string[] {
  return readdirSync(srcDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(srcDir, f));
}

describe('isolation from D:/Offscript-creatives-generation', () => {
  it('no source file references Offscript-creatives-generation', () => {
    for (const file of allSourceFiles()) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/Offscript-creatives-generation/i);
    }
  });

  it('no source file contains an absolute Windows drive-letter or UNC path literal', () => {
    for (const file of allSourceFiles()) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/["'`][A-Za-z]:[\\/]/);
      expect(content).not.toMatch(/["'`]\\\\[A-Za-z]/);
    }
  });
});

describe('isolation from Website Generation', () => {
  it('no source file imports plan/author/website-composition or reaches into src/generate', () => {
    for (const file of allSourceFiles()) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from\s+['"].*\/(plan|author|website-composition)\.js['"]/);
      expect(content).not.toMatch(/from\s+['"].*src\/generate/);
      expect(content).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
    }
  });

  it('package.json declares no dependency reaching into the offscript engine or Website Generation', () => {
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const version of Object.values(deps)) {
      expect(version).not.toMatch(/Offscript-creatives-generation/i);
      expect(version).not.toMatch(/file:\.\.\/\.\.$/); // would be a dependency on the whole offscript/ engine root
    }
  });
});

describe('dependency direction — exactly two declared production dependencies', () => {
  it('declares only creative-artifact-contract and creative-intent-exporter as production dependencies', () => {
    // Sprint 10Z: creative-intent-exporter added, mirroring creative-artifact-contract's own
    // established file: sibling-package pattern — reused for its real, already-tested
    // Output/_LOG.md reader/parser (log/reader.ts, log/parser.ts), never a duplicated one.
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
      'creative-artifact-contract',
      'creative-intent-exporter',
    ]);
  });

  it('creative-intent-exporter has no dependency back on creative-generation (no cycle)', () => {
    const exporterPkgPath = join(here, '..', 'node_modules', 'creative-intent-exporter', 'package.json');
    const exporterPkg = JSON.parse(readFileSync(exporterPkgPath, 'utf8'));
    const deps = { ...exporterPkg.dependencies, ...exporterPkg.devDependencies };
    expect(Object.keys(deps)).not.toContain('creative-generation');
  });
});
