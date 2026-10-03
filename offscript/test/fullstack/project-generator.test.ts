/**
 * F5 — Project Generator Contract (RED-first).
 *
 * ProjectModel → GeneratedProject, entirely in memory. No filesystem, no framework rendering, no
 * component/route generation — the reference `createDescriptorGenerator` produces only pure JSON
 * re-serializations of data `ProjectModel` already carries (mirrors F3's `inspectionNodeAdapter`:
 * "not React, invents nothing").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';
import { runProjectModelPipeline, type ProjectModel } from '../../src/fullstack/project-model.js';
import type { TransformationProject } from '../../src/fullstack/transformation-loader.js';
import {
  createDescriptorGenerator,
  generateProject,
  type GeneratedProject,
} from '../../src/fullstack/project-generator.js';

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

function model(): ProjectModel {
  return runProjectModelPipeline(project());
}

describe('F5 — purity', () => {
  it('imports no node:fs, node:child_process, React, or Next.js — the contract is I/O-free', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/fullstack/project-generator.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]node:fs['"]/);
    expect(src).not.toMatch(/from\s+['"]node:child_process['"]/);
    expect(src).not.toMatch(/from\s+['"]react/i);
    expect(src).not.toMatch(/from\s+['"]next/i);
  });
});

describe('F5 — createDescriptorGenerator / generateProject', () => {
  it('produces one descriptor artifact per page, path-sorted', () => {
    const g: GeneratedProject = generateProject(model());
    expect(g.files.length).toBe(1); // one page in the fixture
    expect(g.files[0].path).toBe('pages/page.json');
    expect(g.files[0].kind).toBe('descriptor');
    const sortedPaths = g.files.map((f) => f.path);
    expect(sortedPaths).toEqual([...sortedPaths].sort());
  });

  it('artifact content is a pure re-serialization of ProjectPage data — nothing invented', () => {
    const m = model();
    const g = generateProject(m);
    const parsed = JSON.parse(g.files[0].content);
    expect(parsed).toEqual({
      id: m.pages[0].id,
      role: m.pages[0].role,
      componentRef: m.pages[0].componentRef,
      view: m.pages[0].view,
    });
  });

  it('derives directories from artifact paths, deduped and sorted', () => {
    const g = generateProject(model());
    expect(g.directories).toEqual(['pages']);
  });

  it('emits an info diagnostic noting empty assets (never invents asset data)', () => {
    const g = generateProject(model());
    expect(g.diagnostics.some((d) => d.level === 'info' && /asset/i.test(d.message))).toBe(true);
  });

  it('manifest matches the actual artifact/directory/diagnostic counts and traces back to the source ProjectModel', () => {
    const m = model();
    const g = generateProject(m);
    expect(g.manifest.sourceModelDigest).toBe(m.digest);
    expect(g.manifest.fileCount).toBe(g.files.length);
    expect(g.manifest.directoryCount).toBe(g.directories.length);
    expect(g.manifest.diagnosticCount).toBe(g.diagnostics.length);
  });

  it('is deterministic — two independent generations from the same ProjectModel are byte-identical', () => {
    const m = model();
    const a = generateProject(m);
    const b = generateProject(m);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.digest).toBe(b.digest);
  });

  it('replays — two independently-computed ProjectModels for the same project generate identical GeneratedProjects', () => {
    const p = project();
    const a = generateProject(runProjectModelPipeline(p));
    const b = generateProject(runProjectModelPipeline(p));
    expect(a).toEqual(b);
  });

  it('never mutates the ProjectModel it reads', () => {
    const m = model();
    const before = JSON.stringify(m);
    generateProject(m);
    expect(JSON.stringify(m)).toBe(before);
  });

  it('returns a frozen GeneratedProject', () => {
    expect(Object.isFrozen(generateProject(model()))).toBe(true);
  });

  it('artifact ordering is stable even when ProjectModel pages arrive in a different order', () => {
    const m = model();
    const reordered: ProjectModel = { ...m, pages: [...m.pages].reverse() };
    const g = generateProject(reordered);
    expect(g.files.map((f) => f.path)).toEqual([...g.files.map((f) => f.path)].sort());
  });
});

describe('F5 — createDescriptorGenerator with a multi-page model', () => {
  it('sorts multiple descriptor artifacts by path, not by insertion order', () => {
    const m = model();
    const twoPages: ProjectModel = {
      ...m,
      pages: [
        { ...m.pages[0], id: 'zzz-last' },
        { ...m.pages[0], id: 'aaa-first' },
      ],
    };
    const g = generateProject(twoPages);
    expect(g.files.map((f) => f.path)).toEqual(['pages/aaa-first.json', 'pages/zzz-last.json']);
  });
});
