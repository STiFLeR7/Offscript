/**
 * P20 — designer review session package. RED-first. Mirrors
 * designer-workspace-package.test.ts's manifest-correctness and
 * falsification patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDesignerWorkspace } from '../../src/designer-workspace/designer-workspace.js';
import { openReviewSession } from '../../src/designer-review-session/designer-review-session.js';
import { buildSessionPackage } from '../../src/designer-review-session/designer-review-session-package.js';

function sampleSession(now = () => '2026-07-12T01:00:00.000Z') {
  const workspace = buildDesignerWorkspace({ client: 'example-brand', track: 'website' }, { now: () => '2026-07-12T00:00:00.000Z' });
  return openReviewSession({ workspace, reviewer: 'designer:hill' }, { now });
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

describe('buildSessionPackage', () => {
  it('produces a manifest with exactly one artifact indexing the session', () => {
    const session = sampleSession();
    const pkg = buildSessionPackage({ session }, { now: () => '2026-07-12T02:00:00.000Z' });
    expect(pkg.manifest.sessionId).toBe(session.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-12T02:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('designer-review-session.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged session', () => {
    const session = sampleSession();
    const pkg = buildSessionPackage({ session });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(session)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical session content produces an identical manifest hash', () => {
    const a = buildSessionPackage({ session: sampleSession() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildSessionPackage({ session: sampleSession() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.sessionId).toBe(b.manifest.sessionId);
  });

  it('embeds the session verbatim', () => {
    const session = sampleSession();
    const pkg = buildSessionPackage({ session });
    expect(pkg.session).toEqual(session);
  });

  it('is deep-frozen', () => {
    const pkg = buildSessionPackage({ session: sampleSession() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different sessions produce different manifest hashes', () => {
    const a = buildSessionPackage({ session: sampleSession(() => '2020-01-01T00:00:00.000Z') });
    const b = buildSessionPackage({ session: sampleSession(() => '2030-01-01T00:00:00.000Z') });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: designer-review-session-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-review-session/designer-review-session-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
