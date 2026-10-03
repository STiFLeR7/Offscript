/**
 * F4 — Project Model (RED-first).
 *
 * Converts F3's existing, unmodified transformation pipeline output (AdaptedTreeNode) into a
 * canonical, framework-independent description of a generated application. Pure — never mutates
 * the TransformationProject or AdaptedTreeNode it reads.
 */
import { describe, it, expect } from 'vitest';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';
import { createAdapterRegistry, createFrameworkAdapter } from '../../src/runtime/framework-adapter.js';
import { inspectionNodeAdapter, runTransformationPipeline } from '../../src/fullstack/transformation-pipeline.js';
import type { TransformationProject } from '../../src/fullstack/transformation-loader.js';
import { buildProjectModel, runProjectModelPipeline, type ProjectModel } from '../../src/fullstack/project-model.js';

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

describe('F4 — buildProjectModel / runProjectModelPipeline', () => {
  it('describes the application: metadata + tokens from the document node, one page, a section/slot view hierarchy', () => {
    const p = project();
    const model = runProjectModelPipeline(p);
    expect(model.metadata.title).toBe('Close the books in days, not weeks.');
    expect(model.tokens).toEqual(expect.arrayContaining(['--cr-bg', '--cr-accent']));
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].role).toBe('page');
    expect(model.pages[0].view.length).toBeGreaterThan(0); // 2 sections
    const hero = model.pages[0].view.find((v) => v.id === 'hero')!;
    expect(hero.kind).toBe('section');
    expect(hero.componentRef).toBe('section:hero');
    expect(hero.children.length).toBe(1); // one content slot
  });

  it('componentRefs is a deduped, sorted list of every distinct RuntimeNode.type in the tree', () => {
    const model = runProjectModelPipeline(project());
    expect(model.componentRefs).toEqual([...model.componentRefs].sort());
    expect(new Set(model.componentRefs).size).toBe(model.componentRefs.length);
    expect(model.componentRefs).toContain('section:hero');
    expect(model.componentRefs).toContain('document:website');
  });

  it('assets is empty — no RenderingIR asset/media data source exists yet; never invented', () => {
    const model = runProjectModelPipeline(project());
    expect(model.assets).toEqual([]);
  });

  it('manifest carries client/track/sourceDigest and matches the actual page/section/slot counts', () => {
    const p = project();
    const model = runProjectModelPipeline(p);
    expect(model.manifest.client).toBe('helix');
    expect(model.manifest.track).toBe('website');
    expect(model.manifest.sourceDigest).toBe(p.rir.digest);
    expect(model.manifest.pageCount).toBe(model.pages.length);
    expect(model.manifest.sectionCount).toBe(model.pages.flatMap((pg) => pg.view).length);
  });

  it('is deterministic — two independent runs over the same project are byte-identical and share a digest', () => {
    const p = project();
    const a = runProjectModelPipeline(p);
    const b = runProjectModelPipeline(p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.digest).toBe(b.digest);
  });

  it('replays — building from two independently-computed AdaptedTreeNodes for the same project produces the same model', () => {
    const p = project();
    const treeA = runTransformationPipeline(p);
    const treeB = runTransformationPipeline(p);
    const a = buildProjectModel(p, treeA);
    const b = buildProjectModel(p, treeB);
    expect(a).toEqual(b);
  });

  it('never mutates the TransformationProject or AdaptedTreeNode it reads', () => {
    const p = project();
    const tree = runTransformationPipeline(p);
    const beforeProject = JSON.stringify(p);
    const beforeTree = JSON.stringify(tree);
    buildProjectModel(p, tree);
    expect(JSON.stringify(p)).toBe(beforeProject);
    expect(JSON.stringify(tree)).toBe(beforeTree);
  });

  it('is frozen — the returned ProjectModel cannot be mutated', () => {
    const model = runProjectModelPipeline(project());
    expect(Object.isFrozen(model)).toBe(true);
  });

  it('fails closed (project integrity) when the adapted tree is not fully adapted', () => {
    // a deliberately partial adapter (section only) — document/page/slot are not-renderable
    const partial = createAdapterRegistry().register('section', inspectionNodeAdapter);
    const adapter = createFrameworkAdapter('partial', partial);
    const p = project();
    const tree = runTransformationPipeline(p, adapter);
    expect(() => buildProjectModel(p, tree)).toThrow(/not.?renderable|adapted/i);
  });
});

describe('F4 — ProjectModel type shape sanity', () => {
  it('every ViewNode and ProjectPage carries its own content digest', () => {
    const model: ProjectModel = runProjectModelPipeline(project());
    for (const page of model.pages) {
      expect(page.digest).toMatch(/^[a-f0-9]{64}$/);
      for (const v of page.view) expect(v.digest).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
