/**
 * P08 — World A build identity reader (RED-first).
 *
 * Reads `<root>/repository/.knowledge-build/manifest.json`'s `build_identity`
 * field — a value ALREADY published to disk by `npm run knowledge:build`
 * (src/knowledge/manifest.ts#buildManifest), never recomputed here. Pure IO,
 * never throws: absence or malformation returns `undefined` (World A's
 * knowledge-build manifest is a build-time artifact that may not exist in
 * every environment). `root` is parameterized so tests never touch the real
 * repository; production code calls with no argument (defaults to the real
 * `repoRoot`).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWorldABuildIdentity } from '../../src/doctor/world-a-identity.js';

function manifestDir(root: string): string {
  return join(root, 'repository', '.knowledge-build');
}

describe('P08 — readWorldABuildIdentity', () => {
  it('returns the build_identity string from a real manifest.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'offscript-world-a-'));
    try {
      mkdirSync(manifestDir(root), { recursive: true });
      writeFileSync(join(manifestDir(root), 'manifest.json'), JSON.stringify({ build_identity: 'sha256:abc123' }), 'utf8');
      expect(readWorldABuildIdentity(root)).toBe('sha256:abc123');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined when the knowledge-build directory does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'offscript-world-a-'));
    try {
      expect(readWorldABuildIdentity(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined on malformed JSON (never throws)', () => {
    const root = mkdtempSync(join(tmpdir(), 'offscript-world-a-'));
    try {
      mkdirSync(manifestDir(root), { recursive: true });
      writeFileSync(join(manifestDir(root), 'manifest.json'), '{not valid json', 'utf8');
      expect(readWorldABuildIdentity(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined when build_identity is missing or the wrong type', () => {
    const root = mkdtempSync(join(tmpdir(), 'offscript-world-a-'));
    try {
      mkdirSync(manifestDir(root), { recursive: true });
      writeFileSync(join(manifestDir(root), 'manifest.json'), JSON.stringify({ other: 'field' }), 'utf8');
      expect(readWorldABuildIdentity(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads the REAL repository manifest when called with no argument (grounding: not fabricated)', () => {
    const real = readWorldABuildIdentity();
    expect(real).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
