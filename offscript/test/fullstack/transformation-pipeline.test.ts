/**
 * F3 — First Transformation Pipeline (RED-first).
 *
 * The minimum orchestration wiring Runtime (D3-S1) / Lifecycle (D3-S2) / Framework Adapter
 * (D3-S3) into one deterministic call over a Transformation Loader (F2) project. No subsystem
 * logic is reimplemented here — every assertion below is really testing the WIRING, not the
 * subsystems (each of which already has its own full suite).
 */
import { describe, it, expect } from 'vitest';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';
import { createAdapterRegistry, createFrameworkAdapter } from '../../src/runtime/framework-adapter.js';
import type { TransformationProject } from '../../src/fullstack/transformation-loader.js';
import {
  inspectionNodeAdapter,
  createInspectionAdapterRegistry,
  createInspectionFrameworkAdapter,
  runTransformationPipeline,
  type InspectionOutput,
} from '../../src/fullstack/transformation-pipeline.js';

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

// count every node in the produced tree (document + pages + sections + slots)
function countAll(tree: { children: readonly unknown[] }): number {
  return 1 + (tree.children as { children: readonly unknown[] }[]).reduce((n, c) => n + countAll(c), 0);
}
function flatten<T extends { children: readonly T[] }>(tree: T): T[] {
  return [tree, ...tree.children.flatMap(flatten)];
}

describe('F3 — inspectionNodeAdapter (the first concrete NodeAdapter)', () => {
  it('exposes only id/kind/type/digest/props — a pure echo of what the RuntimeNode already carries, nothing invented', () => {
    const p = project();
    const adapter = createInspectionFrameworkAdapter();
    const tree = runTransformationPipeline(p, adapter);
    const out = tree.result.output as InspectionOutput;
    expect(Object.keys(out).sort()).toEqual(['digest', 'id', 'kind', 'props', 'type']);
    expect(out.kind).toBe('document');
    expect(out.id).toBe('document');
  });
});

describe('F3 — runTransformationPipeline (orchestration)', () => {
  it('drives a full RenderingIR through Runtime → Lifecycle → Framework Adapter, adapting every node with the default inspection adapter', () => {
    const tree = runTransformationPipeline(project());
    const all = flatten(tree);
    // document(1) + page(1) + section(2) + slot(1, only 'hero' has content) = 5
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const node of all) {
      expect(node.result.kind).toBe('adapted');
      expect(node.result.lifecycleStage).toBe('renderable');
    }
  });

  it('is deterministic — repeated executions on the same project are byte-identical (JSON-stable) and share the same digest', () => {
    const p = project();
    const a = runTransformationPipeline(p);
    const b = runTransformationPipeline(p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.digest).toBe(b.digest);
  });

  it('never produces `unsupported` — Runtime registrations are DERIVED from the adapter\'s own declaredTypes, not a second hand-kept list', () => {
    // a deliberately partial adapter (section only) — document/page/slot get no NodeAdapter
    const partial = createAdapterRegistry().register('section', inspectionNodeAdapter);
    const adapter = createFrameworkAdapter('partial', partial);
    const tree = runTransformationPipeline(project(), adapter);
    const all = flatten(tree);
    const kinds = new Set(all.map((n) => n.result.kind));
    expect(kinds.has('unsupported')).toBe(false); // structurally unreachable via this orchestrator
    expect(all.some((n) => n.result.kind === 'not-renderable')).toBe(true); // document/page/slot
    expect(all.some((n) => n.result.kind === 'adapted')).toBe(true); // section
  });

  it('propagates RenderingIR validation failure — reused, not reimplemented (a tampered digest throws)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered = { ...rir, digest: 'deadbeef' } as RenderingIR;
    expect(() => runTransformationPipeline(project(tampered))).toThrow(/digest/i);
  });

  it('propagates the same validator for an unsupported irVersion, without a second version check in this module', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered = { ...rir, irVersion: 999 } as unknown as RenderingIR;
    expect(() => runTransformationPipeline(project(tampered))).toThrow(/irVersion/i);
  });
});

describe('F3 — createInspectionAdapterRegistry', () => {
  it('registers the inspection adapter against every closed RuntimeNodeKind, bare-kind fallback only', () => {
    const registry = createInspectionAdapterRegistry();
    for (const kind of ['document', 'page', 'section', 'slot']) expect(registry.has(kind)).toBe(true);
    expect(registry.registeredTypes.length).toBe(4);
  });
});
