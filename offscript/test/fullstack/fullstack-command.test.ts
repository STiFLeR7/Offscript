/**
 * F7 — Fullstack Command (RED-first).
 *
 * The first public entry point into Program F: Load (F2) → ProjectModel (F4, which reuses F3
 * internally, unchanged) → Next.js Generator (F6) → GeneratedProject. Pure orchestration —
 * introduces no new transformation/validation logic; every assertion below is really testing the
 * WIRING, since each subsystem already has its own full suite.
 */
import { describe, it, expect } from 'vitest';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';
import { runProjectModelPipeline } from '../../src/fullstack/project-model.js';
import { generateProject, createDescriptorGenerator } from '../../src/fullstack/project-generator.js';
import { createNextJsGenerator } from '../../src/fullstack/nextjs-generator.js';
import type { TransformationProject } from '../../src/fullstack/transformation-loader.js';
import { runFullstackPipeline, runFullstackCommand } from '../../src/fullstack/fullstack-command.js';

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

function project(rir?: RenderingIR): TransformationProject {
  return { rir: rir ?? buildRenderingIR(websitePlan(), brief()), client: 'helix', track: 'website', sourcePath: 'n/a' };
}

describe('F7 — runFullstackPipeline', () => {
  it('defaults to the Next.js generator and matches manual composition of the reused subsystems exactly', () => {
    const p = project();
    const viaCommand = runFullstackPipeline(p);
    const viaManualComposition = generateProject(runProjectModelPipeline(p), createNextJsGenerator());
    expect(viaCommand).toEqual(viaManualComposition);
  });

  it('accepts a generator override — proves no Next.js-specific logic is hard-coded into the orchestration itself', () => {
    const p = project();
    const viaCommand = runFullstackPipeline(p, createDescriptorGenerator());
    const viaManualComposition = generateProject(runProjectModelPipeline(p), createDescriptorGenerator());
    expect(viaCommand).toEqual(viaManualComposition);
    expect(viaCommand.files.every((f) => f.kind === 'descriptor')).toBe(true); // no Next.js artifacts leaked in
  });

  it('propagates ProjectModel/Runtime validation failures verbatim — no duplicated validation in this module', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered = { ...rir, digest: 'deadbeef' } as RenderingIR;
    expect(() => runFullstackPipeline(project(tampered))).toThrow(/digest/i);
  });

  it('is deterministic — two independent runs over the same TransformationProject are byte-identical', () => {
    const p = project();
    const a = runFullstackPipeline(p);
    const b = runFullstackPipeline(p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.digest).toBe(b.digest);
  });

  it('replays — two independently-constructed TransformationProjects for the same source produce identical output', () => {
    const a = runFullstackPipeline(project());
    const b = runFullstackPipeline(project());
    expect(a).toEqual(b);
  });
});

describe('F7 — runFullstackCommand', () => {
  it('propagates the Transformation Loader (F2) error verbatim when no rendering-ir.json exists for the client', () => {
    expect(() => runFullstackCommand('__f7-nonexistent-fixture__', 'website')).toThrow(
      /no rendering-ir\.json found/i,
    );
  });
});
