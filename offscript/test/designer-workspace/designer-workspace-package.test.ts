/**
 * P19 — designer workspace package. RED-first. Mirrors
 * overlay-approval-package.test.ts's manifest-correctness and falsification
 * patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDesignerWorkspace } from '../../src/designer-workspace/designer-workspace.js';
import { buildWorkspacePackage } from '../../src/designer-workspace/designer-workspace-package.js';

function sampleWorkspace(now = () => '2026-07-11T01:00:00.000Z') {
  return buildDesignerWorkspace({ client: 'example-brand', track: 'website' }, { now });
}

function stableStringifyForTest(value: unknown): string {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(value);
  return JSON.stringify(value, Array.from(keys).sort(), 2) + '\n';
}

describe('buildWorkspacePackage', () => {
  it('produces a manifest with exactly one artifact indexing the workspace', () => {
    const workspace = sampleWorkspace();
    const pkg = buildWorkspacePackage({ workspace }, { now: () => '2026-07-11T02:00:00.000Z' });
    expect(pkg.manifest.workspaceId).toBe(workspace.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-11T02:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('designer-workspace.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged workspace', () => {
    const workspace = sampleWorkspace();
    const pkg = buildWorkspacePackage({ workspace });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(workspace)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical workspace content produces an identical manifest hash', () => {
    const a = buildWorkspacePackage({ workspace: sampleWorkspace() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildWorkspacePackage({ workspace: sampleWorkspace() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.workspaceId).toBe(b.manifest.workspaceId);
  });

  it('embeds the workspace verbatim', () => {
    const workspace = sampleWorkspace();
    const pkg = buildWorkspacePackage({ workspace });
    expect(pkg.workspace).toEqual(workspace);
  });

  it('is deep-frozen', () => {
    const pkg = buildWorkspacePackage({ workspace: sampleWorkspace() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different workspaces produce different manifest hashes', () => {
    const a = buildWorkspacePackage({ workspace: buildDesignerWorkspace({ client: 'example-brand', track: 'website' }) });
    const b = buildWorkspacePackage({ workspace: buildDesignerWorkspace({ client: 'example-brand', track: 'collateral' }) });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: designer-workspace-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-workspace/designer-workspace-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
