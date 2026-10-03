/**
 * F2 — Transformation Loader (RED-first).
 *
 * The single entry point into the Full-Stack Engine: locate → load → deserialize → validate →
 * TransformationProject. Reuses `validateRenderingIR` verbatim (`rendering-ir.ts`) — no new
 * validation logic. Performs no interpretation, no transformation, no framework work — it is
 * purely a disk-to-typed-model boundary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRenderingIR, serializeRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';
import { loadTransformationProjectFromFile } from '../../src/fullstack/transformation-loader.js';

const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number): PlanItem {
  return {
    anchor: { id, anchor: id, landmark: id === 'hero' ? 'main' : undefined },
    archetype: 'hero',
    tokenRoles: ['--cr-bg', '--cr-accent'],
    intent: 'Land the one-liner',
    content: order === 0 ? 'Close the books in days.' : undefined,
    fragmentId: 'component-hero-split-01',
    composition: 'Feature trio — split — base',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0), websiteItem('features', 1)], warnings: [] };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'offscript-f2-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeFixture(rir: RenderingIR, filename = 'rendering-ir.json'): string {
  const path = join(dir, filename);
  writeFileSync(path, serializeRenderingIR(rir), 'utf8');
  return path;
}

describe('F2 — loadTransformationProjectFromFile — success path', () => {
  it('loads a valid rendering-ir.json into a TransformationProject carrying the RIR, client, track, and source path', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const path = writeFixture(rir);
    const project = loadTransformationProjectFromFile(path, 'helix', 'website');
    expect(project.rir).toEqual(rir);
    expect(project.client).toBe('helix');
    expect(project.track).toBe('website');
    expect(project.sourcePath).toBe(path);
  });

  it('replays identically — loading the same file twice produces deep-equal projects with matching digests', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const path = writeFixture(rir);
    const a = loadTransformationProjectFromFile(path, 'helix', 'website');
    const b = loadTransformationProjectFromFile(path, 'helix', 'website');
    expect(a).toEqual(b);
    expect(a.rir.digest).toBe(b.rir.digest);
  });

  it('is deterministic — loading the same file N times never diverges', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const path = writeFixture(rir);
    const loads = Array.from({ length: 5 }, () => loadTransformationProjectFromFile(path, 'helix', 'website'));
    for (const p of loads) expect(p).toEqual(loads[0]);
  });

  it('produces an immutable project — mutation attempts throw', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const path = writeFixture(rir);
    const project = loadTransformationProjectFromFile(path, 'helix', 'website');
    expect(Object.isFrozen(project)).toBe(true);
    expect(() => {
      (project as unknown as { client: string }).client = 'tampered';
    }).toThrow(TypeError);
  });
});

describe('F2 — loadTransformationProjectFromFile — failure cases', () => {
  it('throws a clear error when rendering-ir.json is missing', () => {
    const missing = join(dir, 'rendering-ir.json');
    expect(() => loadTransformationProjectFromFile(missing, 'helix', 'website')).toThrow(/no rendering-ir\.json|not found/i);
  });

  it('throws a clear error on invalid JSON', () => {
    const path = join(dir, 'rendering-ir.json');
    writeFileSync(path, '{ this is not json', 'utf8');
    expect(() => loadTransformationProjectFromFile(path, 'helix', 'website')).toThrow(/JSON/i);
  });

  it('throws — via the reused validator — on an unsupported irVersion', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered = { ...rir, irVersion: 999 };
    const path = writeFixture(tampered as unknown as RenderingIR, 'rendering-ir.json');
    expect(() => loadTransformationProjectFromFile(path, 'helix', 'website')).toThrow(/irVersion/i);
  });

  it('throws — via the reused validator — on an invalid/tampered digest', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered = { ...rir, digest: 'deadbeef' };
    const path = writeFixture(tampered as unknown as RenderingIR, 'rendering-ir.json');
    expect(() => loadTransformationProjectFromFile(path, 'helix', 'website')).toThrow(/digest/i);
  });
});
