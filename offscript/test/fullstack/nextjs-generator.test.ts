/**
 * F6 — Next.js Generator MVP (RED-first).
 *
 * The first concrete ProjectGenerator, targeting Next.js App Router. Entirely in memory — no
 * filesystem writes, no npm, no execution. Uses ONLY ProjectModel data; never inspects HTML.
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
import { generateProject } from '../../src/fullstack/project-generator.js';
import { createNextJsGenerator } from '../../src/fullstack/nextjs-generator.js';

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

describe('F6 — purity', () => {
  it('imports no node:fs, node:child_process, or a real `next`/`react` package — MVP output is virtual text only', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/fullstack/nextjs-generator.ts'), 'utf8');
    // Extract only REAL import-statement specifiers (bounded per-statement by `[^;]*?` — cannot
    // cross the terminating `;`, so it can never reach into this module's own indented
    // template-literal strings representing GENERATED Next.js source text, e.g.
    // `    \`import type { Metadata } from 'next';\`,`, which live in later, unrelated statements).
    const importSpecifiers = [...src.matchAll(/^import\b[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(importSpecifiers).not.toContain('node:fs');
    expect(importSpecifiers).not.toContain('node:child_process');
    expect(importSpecifiers).not.toContain('next');
    expect(importSpecifiers).not.toContain('react');
  });
});

describe('F6 — createNextJsGenerator — MVP artifact set', () => {
  it('produces exactly the minimum artifact set for a single-page project, path-sorted', () => {
    const g = generateProject(model(), createNextJsGenerator());
    const paths = g.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b))); // same ordering rule the generator itself uses
    expect(new Set(paths)).toEqual(
      new Set([
        'README.md',
        'app/globals.css',
        'app/layout.tsx',
        'app/page.tsx',
        'next.config.ts',
        'package.json',
        'tsconfig.json',
      ]),
    );
  });

  it('tags every artifact with a non-descriptor kind appropriate to its role', () => {
    const g = generateProject(model(), createNextJsGenerator());
    const kindOf = (path: string) => g.files.find((f) => f.path === path)!.kind;
    expect(kindOf('package.json')).toBe('config');
    expect(kindOf('next.config.ts')).toBe('config');
    expect(kindOf('tsconfig.json')).toBe('config');
    expect(kindOf('app/layout.tsx')).toBe('component');
    expect(kindOf('app/page.tsx')).toBe('component');
    expect(kindOf('app/globals.css')).toBe('style');
    expect(kindOf('README.md')).toBe('doc');
  });

  it('layout.tsx metadata is sourced verbatim from ProjectModel.metadata, nothing invented', () => {
    const m = model();
    const g = generateProject(m, createNextJsGenerator());
    const layout = g.files.find((f) => f.path === 'app/layout.tsx')!.content;
    expect(layout).toContain(JSON.stringify(m.metadata.title));
  });

  it('page.tsx threads real ProjectModel view-hierarchy data through (component refs, ids, slot content) without inspecting HTML', () => {
    const m = model();
    const g = generateProject(m, createNextJsGenerator());
    const page = g.files.find((f) => f.path === 'app/page.tsx')!.content;
    expect(page).toContain(JSON.stringify(m.pages[0].view[0].componentRef));
    expect(page).toContain(JSON.stringify(m.pages[0].view[0].id));
    // the hero section's one content slot ("Close the books in days.") must appear verbatim
    const slot = m.pages[0].view[0].children[0];
    expect(page).toContain(JSON.stringify((slot.props as { content: string }).content));
  });

  it('package.json is valid JSON, private, and named from the project client', () => {
    const g = generateProject(model(), createNextJsGenerator());
    const pkg = JSON.parse(g.files.find((f) => f.path === 'package.json')!.content);
    expect(pkg.private).toBe(true);
    expect(pkg.name).toBe('helix');
    expect(pkg.dependencies.next).toBeDefined();
  });

  it('maps additional pages beyond the first to their own nested app/<id>/page.tsx route', () => {
    const m = model();
    const extraPage = { ...m.pages[0], id: 'second-page' };
    const multiPage: ProjectModel = { ...m, pages: [m.pages[0], extraPage] };
    const g = generateProject(multiPage, createNextJsGenerator());
    const paths = g.files.map((f) => f.path);
    expect(paths).toContain('app/page.tsx');
    expect(paths).toContain('app/second-page/page.tsx');
  });

  it('emits a warning diagnostic and no page.tsx when the model has zero pages', () => {
    const m = { ...model(), pages: [] };
    const g = generateProject(m, createNextJsGenerator());
    expect(g.files.some((f) => f.path.endsWith('page.tsx'))).toBe(false);
    expect(g.diagnostics.some((d) => d.level === 'warning' && /zero pages/i.test(d.message))).toBe(true);
  });

  it('manifest matches the actual output', () => {
    const m = model();
    const g = generateProject(m, createNextJsGenerator());
    expect(g.manifest.sourceModelDigest).toBe(m.digest);
    expect(g.manifest.fileCount).toBe(g.files.length);
    expect(g.manifest.directoryCount).toBe(g.directories.length);
  });

  it('is deterministic — repeated generation from the same model is byte-identical', () => {
    const m = model();
    const a = generateProject(m, createNextJsGenerator());
    const b = generateProject(m, createNextJsGenerator());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.digest).toBe(b.digest);
  });

  it('replays — two independently-computed ProjectModels for the same project generate identical GeneratedProjects', () => {
    const p = project();
    const a = generateProject(runProjectModelPipeline(p), createNextJsGenerator());
    const b = generateProject(runProjectModelPipeline(p), createNextJsGenerator());
    expect(a).toEqual(b);
  });

  it('never mutates the ProjectModel it reads', () => {
    const m = model();
    const before = JSON.stringify(m);
    generateProject(m, createNextJsGenerator());
    expect(JSON.stringify(m)).toBe(before);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(generateProject(model(), createNextJsGenerator()))).toBe(true);
  });
});
