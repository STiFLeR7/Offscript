import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkPackageIsolation,
  formatViolation,
  loadManifest,
  type Violation,
} from '../scripts/check-package-isolation.js';

const repoRoot = resolve(__dirname, '..');

/** Builds a throwaway fixture tree of fake sibling packages under a temp dir, each with its
 * own package.json + declared scanDirs, so guard rules can be exercised without touching the
 * real repository. Mirrors the real manifest shape 1:1. */
function makeFixture(spec: {
  packages: Array<{
    name: string;
    fileDeps?: string[]; // sibling package names declared as "file:../<name>" deps
    files: Record<string, string>; // relative path (within scanDirs) -> file content
  }>;
}): { root: string; manifestPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'offscript-isolation-fixture-'));
  const manifest = {
    packages: spec.packages.map((p) => ({ name: p.name, root: p.name, scanDirs: ['src', 'test'] })),
  };
  const manifestPath = join(root, 'package-boundaries.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  for (const pkg of spec.packages) {
    const pkgDir = join(root, pkg.name);
    mkdirSync(pkgDir, { recursive: true });
    const deps: Record<string, string> = {};
    for (const dep of pkg.fileDeps ?? []) deps[dep] = `file:../${dep}`;
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: pkg.name, version: '1.0.0', dependencies: deps }, null, 2),
    );
    for (const [relPath, content] of Object.entries(pkg.files)) {
      const filePath = join(pkgDir, relPath);
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, content);
    }
  }
  return { root, manifestPath };
}

const fixturesToClean: string[] = [];
function fixture(spec: Parameters<typeof makeFixture>[0]) {
  const f = makeFixture(spec);
  fixturesToClean.push(f.root);
  return f;
}

afterEach(() => {
  while (fixturesToClean.length) rmSync(fixturesToClean.pop()!, { recursive: true, force: true });
});

describe('check-package-isolation — allowed import', () => {
  it('a declared file: dependency import produces zero violations', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          fileDeps: ['provider'],
          files: { 'src/index.ts': `import { thing } from 'provider/src/thing.js';\n` },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toEqual([]);
  });
});

describe('check-package-isolation — forbidden import', () => {
  it('an import into a sibling NOT declared as a file: dependency is a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: { 'src/index.ts': `import { thing } from '../../provider/src/thing.js';\n` },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].targetPackage).toBe('provider');
    expect(result.violations[0].packageName).toBe('consumer');
  });
});

describe('check-package-isolation — sibling-package forbidden import (bare specifier)', () => {
  it('a bare-specifier import naming an undeclared sibling package is a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        { name: 'a', files: { 'src/index.ts': `import { x } from 'b';\n` } },
        { name: 'b', files: { 'src/index.ts': `export const x = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].targetPackage).toBe('b');
  });
});

describe('check-package-isolation — offscript/src (engine) boundary', () => {
  it('a standalone package importing the engine package is a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'creative-generation',
          files: { 'src/index.ts': `import { plan } from '../../offscript/src/generate/plan.js';\n` },
        },
        { name: 'offscript', files: { 'src/generate/plan.ts': `export const plan = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].targetPackage).toBe('offscript');
    expect(result.violations[0].packageName).toBe('creative-generation');
  });
});

describe('check-package-isolation — reverse dependency (engine importing a standalone package)', () => {
  it('the engine package importing a standalone package is also a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        { name: 'offscript', files: { 'src/generate/x.ts': `import { y } from '../../../creative-generation/src/y.js';\n` } },
        { name: 'creative-generation', files: { 'src/y.ts': `export const y = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].packageName).toBe('offscript');
    expect(result.violations[0].targetPackage).toBe('creative-generation');
  });
});

describe('check-package-isolation — type-only import', () => {
  it('an `import type` reaching into an undeclared sibling is still a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: { 'src/index.ts': `import type { Thing } from '../../provider/src/thing.js';\n` },
        },
        { name: 'provider', files: { 'src/thing.ts': `export type Thing = { id: string };\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].importSpecifier).toContain('provider/src/thing.js');
  });
});

describe('check-package-isolation — dynamic import', () => {
  it('a dynamic import() reaching into an undeclared sibling is a violation', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: {
            'src/index.ts': `export async function load() {\n  return import('../../provider/src/thing.js');\n}\n`,
          },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].targetPackage).toBe('provider');
  });
});

describe('check-package-isolation — relative import traversal', () => {
  it('resolves ../../ traversal via real path resolution, not string prefix matching', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: {
            // deliberately nested so a naive string-prefix check on the specifier alone
            // ("../../provider") would resolve to the wrong absolute directory
            'src/deep/nested/index.ts': `import { thing } from '../../../../provider/src/thing.js';\n`,
          },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].targetPackage).toBe('provider');
  });
});

describe('check-package-isolation — package-local import', () => {
  it('a relative import within the same package is never flagged', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: {
            'src/index.ts': `import { helper } from './helper.js';\n`,
            'src/helper.ts': `export const helper = 1;\n`,
          },
        },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toEqual([]);
  });
});

describe('check-package-isolation — test-file handling', () => {
  it('files under a declared test/ scanDir are scanned exactly like src/', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: { 'test/index.test.ts': `import { thing } from '../../provider/src/thing.js';\n` },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toContain('test/index.test.ts');
  });
});

describe('check-package-isolation — ignored directories', () => {
  it('never scans node_modules, dist, or other non-scanDir directories even if they contain a matching violation shape', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: {
            'src/index.ts': `export const ok = 1;\n`,
            'node_modules/vendored/index.ts': `import { thing } from '../../../provider/src/thing.js';\n`,
            'dist/index.ts': `import { thing } from '../../provider/src/thing.js';\n`,
          },
        },
        { name: 'provider', files: { 'src/thing.ts': `export const thing = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toEqual([]);
  });
});

describe('check-package-isolation — deterministic output', () => {
  it('running the check twice against the same fixture yields identical results', () => {
    const { root, manifestPath } = fixture({
      packages: [
        { name: 'consumer', files: { 'src/index.ts': `import { x } from '../../provider/src/x.js';\n` } },
        { name: 'provider', files: { 'src/x.ts': `export const x = 1;\n` } },
      ],
    });
    const r1 = checkPackageIsolation({ repoRoot: root, manifestPath });
    const r2 = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(JSON.stringify(r1.violations)).toBe(JSON.stringify(r2.violations));
  });
});

describe('check-package-isolation — multiple violations', () => {
  it('reports every violation found, not just the first', () => {
    const { root, manifestPath } = fixture({
      packages: [
        {
          name: 'consumer',
          files: {
            'src/a.ts': `import { x } from '../../provider/src/x.js';\n`,
            'src/b.ts': `import { y } from '../../other/src/y.js';\n`,
          },
        },
        { name: 'provider', files: { 'src/x.ts': `export const x = 1;\n` } },
        { name: 'other', files: { 'src/y.ts': `export const y = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(2);
    const targets = result.violations.map((v: Violation) => v.targetPackage).sort();
    expect(targets).toEqual(['other', 'provider']);
  });
});

describe('check-package-isolation — useful error message', () => {
  it('formatViolation names package, file, line, import, target, and rule', () => {
    const { root, manifestPath } = fixture({
      packages: [
        { name: 'consumer', files: { 'src/index.ts': `\n\nimport { x } from '../../provider/src/x.js';\n` } },
        { name: 'provider', files: { 'src/x.ts': `export const x = 1;\n` } },
      ],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toHaveLength(1);
    const message = formatViolation(result.violations[0]);
    expect(message).toContain('consumer');
    expect(message).toContain('src/index.ts:3');
    expect(message).toContain('../../provider/src/x.js');
    expect(message).toContain('provider');
    expect(message).toMatch(/rule/i);
  });
});

describe('check-package-isolation — undeclared package discovery', () => {
  it('flags a package.json directory under the engine root that is not registered in the manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'offscript-isolation-fixture-'));
    fixturesToClean.push(root);
    const manifestPath = join(root, 'package-boundaries.json');
    writeFileSync(manifestPath, JSON.stringify({ packages: [] }, null, 2));
    mkdirSync(join(root, 'mystery-package', 'src'), { recursive: true });
    writeFileSync(join(root, 'mystery-package', 'package.json'), JSON.stringify({ name: 'mystery-package' }));
    writeFileSync(join(root, 'mystery-package', 'src', 'index.ts'), `export const ok = 1;\n`);

    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.undeclaredPackages).toContain('mystery-package');
  });
});

describe('check-package-isolation — clean repository returns success', () => {
  it('checkPackageIsolation() with no violations returns an empty violations array', () => {
    const { root, manifestPath } = fixture({
      packages: [{ name: 'consumer', files: { 'src/index.ts': `export const ok = 1;\n` } }],
    });
    const result = checkPackageIsolation({ repoRoot: root, manifestPath });
    expect(result.violations).toEqual([]);
  });

  it('the REAL offscript repository, checked against its own real manifest, has zero boundary violations today', () => {
    const manifestPath = join(repoRoot, 'scripts', 'package-boundaries.json');
    const result = checkPackageIsolation({ repoRoot, manifestPath });
    expect(result.violations).toEqual([]);
  });
});

describe('loadManifest', () => {
  it('reads and parses the real repository manifest', () => {
    const manifestPath = join(repoRoot, 'scripts', 'package-boundaries.json');
    const manifest = loadManifest(manifestPath);
    const names = manifest.packages.map((p) => p.name);
    expect(names).toContain('offscript');
    expect(names).toContain('creative-generation');
    expect(names).toContain('creative-artifact-contract');
  });
});
