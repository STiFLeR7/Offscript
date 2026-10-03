import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkCapabilityClosure,
  formatGap,
  loadManifest,
  type ManifestFile,
  type Gap,
} from '../scripts/check-capability-closure.js';

// This checker's repoRoot is the OUTER offscript repo (docs/CLAUDE.md live there, not under
// offscript/) — mirror that here: __dirname is offscript/test, so '..' is offscript/, '../..' is the repo root.
const repoRoot = resolve(__dirname, '..', '..');

const TYPES = {
  'full-type': {
    contract: 'required',
    implementation: 'required',
    tests: 'required',
    cli: 'required',
    docs: 'required',
    validation: 'required',
    observability: 'required',
  },
  'internal-support': {
    contract: 'not-applicable',
    implementation: 'required',
    tests: 'required',
    cli: 'not-applicable',
    docs: 'optional',
    validation: 'optional',
    observability: 'not-applicable',
  },
  'contract-only': {
    contract: 'required',
    implementation: 'required',
    tests: 'required',
    cli: 'not-applicable',
    docs: 'required',
    validation: 'required',
    observability: 'not-applicable',
  },
} as const;

const fixturesToClean: string[] = [];

/** Builds a throwaway fixture repo (a manifest + the real files its evidence pointers name) so
 * checker behavior can be exercised without touching the real repository. */
function fixture(spec: {
  types?: Record<string, unknown>;
  capabilities: Array<Record<string, unknown>>;
  realFiles?: Record<string, string>; // path (relative to fixture root) -> content, actually written to disk
}): { root: string; manifestPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'offscript-closure-fixture-'));
  fixturesToClean.push(root);
  for (const [relPath, content] of Object.entries(spec.realFiles ?? {})) {
    const filePath = join(root, relPath);
    mkdirSync(join(filePath, '..'), { recursive: true });
    writeFileSync(filePath, content);
  }
  const manifest = { types: spec.types ?? TYPES, capabilities: spec.capabilities };
  const manifestPath = join(root, 'capability-closure.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { root, manifestPath };
}

afterEach(() => {
  while (fixturesToClean.length) rmSync(fixturesToClean.pop()!, { recursive: true, force: true });
});

describe('check-capability-closure — complete capability passes', () => {
  it('a full-type capability with every dimension backed by a real path has zero gaps', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        {
          name: 'widget',
          type: 'full-type',
          contract: ['contract.ts'],
          implementation: ['src/widget.ts'],
          tests: ['test/widget.test.ts'],
          cli: ['scripts/widget.ts'],
          docs: ['README.md'],
          validation: ['test/widget.test.ts'],
          observability: ['out/report.json'],
        },
      ],
      realFiles: {
        'contract.ts': '',
        'src/widget.ts': '',
        'test/widget.test.ts': '',
        'scripts/widget.ts': '',
        'README.md': '',
      },
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps).toEqual([]);
  });
});

describe('check-capability-closure — missing required dimensions', () => {
  const baseFiles = {
    'contract.ts': '',
    'src/widget.ts': '',
    'test/widget.test.ts': '',
    'scripts/widget.ts': '',
    'README.md': '',
  };
  const fullCap = {
    name: 'widget',
    type: 'full-type',
    contract: ['contract.ts'],
    implementation: ['src/widget.ts'],
    tests: ['test/widget.test.ts'],
    cli: ['scripts/widget.ts'],
    docs: ['README.md'],
    validation: ['test/widget.test.ts'],
    observability: ['out/report.json'],
  };

  it('missing required contract fails', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, contract: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['contract']);
  });

  it('missing required implementation fails', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, implementation: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['implementation']);
  });

  it('missing required tests fails', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, tests: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['tests']);
  });

  it('missing required CLI fails where CLI is required', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, cli: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['cli']);
  });

  it('missing docs fails where docs are required', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, docs: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['docs']);
  });

  it('missing validation fails where required', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, validation: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['validation']);
  });

  it('missing observability fails where required', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ ...fullCap, observability: [] }],
      realFiles: baseFiles,
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['observability']);
  });
});

describe('check-capability-closure — type changes requirements correctly', () => {
  it('the identical missing-CLI shape passes under internal-support but fails under full-type', () => {
    const shape = { name: 'helper', contract: [], implementation: ['src/helper.ts'], tests: ['test/helper.test.ts'], cli: [], docs: [], validation: [], observability: [] };
    const files = { 'src/helper.ts': '', 'test/helper.test.ts': '' };

    const internal = fixture({ capabilities: [{ ...shape, type: 'internal-support' }], realFiles: files });
    const internalResult = checkCapabilityClosure({ repoRoot: internal.root, manifestPath: internal.manifestPath });
    expect(internalResult.gaps).toEqual([]);

    const full = fixture({ capabilities: [{ ...shape, type: 'full-type' }], realFiles: files });
    const fullResult = checkCapabilityClosure({ repoRoot: full.root, manifestPath: full.manifestPath });
    expect(fullResult.gaps.length).toBeGreaterThan(0);
  });
});

describe('check-capability-closure — internal support module CLI', () => {
  it('an internal-support module with no cli array declared is never flagged for missing CLI', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        {
          name: 'parser-helper',
          type: 'internal-support',
          implementation: ['src/parser.ts'],
          tests: ['test/parser.test.ts'],
        },
      ],
      realFiles: { 'src/parser.ts': '', 'test/parser.test.ts': '' },
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.some((g) => g.dimension === 'cli')).toBe(false);
    expect(result.gaps).toEqual([]);
  });
});

describe('check-capability-closure — contract-only reduced requirements', () => {
  it('a contract-only package needs contract/impl/tests/docs/validation but never CLI or observability', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        {
          name: 'schema-pkg',
          type: 'contract-only',
          contract: ['src/types.ts'],
          implementation: ['src/types.ts'],
          tests: ['test/types.test.ts'],
          docs: ['README.md'],
          validation: ['test/types.test.ts'],
        },
      ],
      realFiles: { 'src/types.ts': '', 'test/types.test.ts': '', 'README.md': '' },
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps).toEqual([]);
  });

  it('a contract-only package still fails on missing docs (docs stay required for this type)', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        {
          name: 'schema-pkg',
          type: 'contract-only',
          contract: ['src/types.ts'],
          implementation: ['src/types.ts'],
          tests: ['test/types.test.ts'],
          docs: [],
          validation: ['test/types.test.ts'],
        },
      ],
      realFiles: { 'src/types.ts': '', 'test/types.test.ts': '' },
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps.map((g) => g.dimension)).toEqual(['docs']);
  });
});

describe('check-capability-closure — deterministic output', () => {
  it('running the check twice against the same fixture yields identical results', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        { name: 'widget', type: 'full-type', contract: [], implementation: ['src/w.ts'], tests: ['test/w.test.ts'], cli: [], docs: [], validation: [], observability: [] },
      ],
      realFiles: { 'src/w.ts': '', 'test/w.test.ts': '' },
    });
    const r1 = checkCapabilityClosure({ repoRoot: root, manifestPath });
    const r2 = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(JSON.stringify(r1.gaps)).toBe(JSON.stringify(r2.gaps));
  });
});

describe('check-capability-closure — actionable diagnostics', () => {
  it('formatGap names capability, type, missing dimension, expected, found, evidence, and next action', () => {
    const { root, manifestPath } = fixture({
      capabilities: [
        { name: 'widget', type: 'full-type', contract: [], implementation: ['src/w.ts'], tests: ['test/w.test.ts'], cli: ['scripts/w.ts'], docs: ['README.md'], validation: ['test/w.test.ts'], observability: ['out.json'] },
      ],
      realFiles: { 'src/w.ts': '', 'test/w.test.ts': '', 'scripts/w.ts': '', 'README.md': '' },
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.gaps).toHaveLength(1);
    const message = formatGap(result.gaps[0]);
    expect(message).toContain('widget');
    expect(message).toContain('full-type');
    expect(message).toMatch(/missing/i);
    expect(message).toMatch(/expected/i);
    expect(message).toMatch(/found/i);
    expect(message).toMatch(/evidence/i);
    expect(message).toMatch(/next action/i);
  });
});

describe('check-capability-closure — unknown type', () => {
  it('a capability declaring a type absent from the manifest is reported, not silently ignored', () => {
    const { root, manifestPath } = fixture({
      capabilities: [{ name: 'mystery', type: 'not-a-real-type', implementation: ['x.ts'] }],
      realFiles: {},
    });
    const result = checkCapabilityClosure({ repoRoot: root, manifestPath });
    expect(result.unknownTypes).toContain('mystery');
  });
});

describe('check-capability-closure — real repository (locked findings)', () => {
  it('checks the REAL manifest and reports zero gaps (both P1 findings closed)', () => {
    const manifestPath = join(repoRoot, 'offscript', 'scripts', 'capability-closure.json');
    const result = checkCapabilityClosure({ repoRoot, manifestPath });

    // Both P1 findings were closed by .experiments/2026-08-20-capability-closure/
    // CAPABILITY-GAPS-CLOSED-REPORT.md:
    // - creative-generation now has a canonical CLI entrypoint (creative-generation/src/cli.ts).
    // - creative-intent-brief-adapter now has a README.
    // This test is the regression lock: if either capability's evidence disappears again, or a new
    // gap appears anywhere else, this fails.
    expect(result.gaps).toEqual([]);
    expect(result.unknownTypes).toEqual([]);
  });
});

describe('loadManifest', () => {
  it('reads and parses the real repository capability manifest', () => {
    const manifestPath = join(repoRoot, 'offscript', 'scripts', 'capability-closure.json');
    const manifest: ManifestFile = loadManifest(manifestPath);
    const names = manifest.capabilities.map((c) => c.name);
    expect(names).toContain('website-generation');
    expect(names).toContain('creative-generation');
    expect(Object.keys(manifest.types)).toContain('engine-operator');
  });
});
