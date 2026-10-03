/**
 * D3-S3 — Framework Adapter Contract (RED-first).
 *
 * Defines HOW a framework (React, eventually) translates a `RuntimeNode` into its own
 * framework-native representation, WITHOUT the Runtime, the Lifecycle, or the Rendering IR ever
 * knowing which framework — or whether one exists at all. This module consumes ONLY `RuntimeNode`
 * (`offscript-runtime.ts`) and `LifecycleRecord`/`LifecycleTreeNode` (`runtime-lifecycle.ts`). No
 * React, no JSX, no DOM, no browser API, and no Generation/Rendering-IR module is imported or
 * referenced anywhere in this file — every test in the "output must remain abstract" block uses
 * plain objects/strings as stand-ins for what a real framework would eventually produce.
 *
 * See docs/offscript/D3-S3-FRAMEWORK-ADAPTER-CONTRACT.md for the grounding + ownership split.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  createAdapterRegistry,
  createFrameworkAdapter,
  adaptLifecycleTree,
  type AdapterResult,
} from '../../src/runtime/framework-adapter.js';
import {
  resolveRenderTree,
  createRendererRegistry,
  createRuntimeProvider,
  type RuntimeNode,
} from '../../src/runtime/offscript-runtime.js';
import {
  resolveLifecycle,
  prepareLifecycle,
  activateLifecycle,
  resolveLifecycleTree,
  type LifecycleRecord,
} from '../../src/runtime/runtime-lifecycle.js';
import { buildRenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures (hand-built AuthoringPlan — never buildContext()/plan(), matching D1-D3 convention) ─
const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number): PlanItem {
  return {
    anchor: { id, anchor: id },
    archetype: id === 'hero' ? 'hero' : 'faq',
    tokenRoles: [],
    intent: 'x',
    content: order === 0 ? 'Close the books in days.' : 'How does it work?',
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0), websiteItem('faq', 1)], warnings: [] };
}

function heroNode(): RuntimeNode {
  const rir = buildRenderingIR(websitePlan(), brief());
  const tree = resolveRenderTree(rir);
  return tree.root.children[0].children[0];
}

// ── purity ────────────────────────────────────────────────────────────────────
describe('D3-S3 — framework-adapter purity (no React/DOM/Generation/Rendering-IR dependency)', () => {
  it('imports only offscript-runtime.js + runtime-lifecycle.js types + node:crypto', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'runtime', 'framework-adapter.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      const allowed = ['./offscript-runtime.js', './offscript-runtime.ts', './runtime-lifecycle.js', './runtime-lifecycle.ts', 'node:crypto'].includes(spec);
      expect(allowed, `unexpected import: ${spec}`).toBe(true);
    }
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it('never IMPORTS or CODE-references React/JSX/a browser global — prose mentioning "React" in an architecture comment is fine, an actual dependency is not', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'runtime', 'framework-adapter.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]react/i);
    // JSX cannot compile in a .ts file at all (only .tsx) — a tooling-enforced guarantee, not a
    // regex heuristic (a naive tag-shaped regex false-positives on ordinary TS generics like
    // `NodeAdapter<TOutput = unknown>`).
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bnavigator\./);
  });
});

// ── AdapterRegistry ───────────────────────────────────────────────────────────
describe('D3-S3 — AdapterRegistry', () => {
  it('resolves an exact type match, falling back to the node kind', () => {
    const registry = createAdapterRegistry();
    const exact = () => 'EXACT';
    const fallback = () => 'FALLBACK';
    registry.register('section:hero', exact);
    registry.register('section', fallback);
    expect(registry.resolve(heroNode())).toBe(exact);

    const registry2 = createAdapterRegistry().register('section', fallback);
    expect(registry2.resolve(heroNode())).toBe(fallback);
  });

  it('returns undefined when nothing matches', () => {
    expect(createAdapterRegistry().resolve(heroNode())).toBeUndefined();
  });

  it('has() reflects exact registrations only; registeredTypes is live', () => {
    const registry = createAdapterRegistry();
    expect(registry.registeredTypes).toEqual([]);
    registry.register('section:hero', () => 'X');
    expect(registry.has('section:hero')).toBe(true);
    expect(registry.has('section')).toBe(false);
    expect(registry.registeredTypes).toEqual(['section:hero']);
  });
});

// ── AdapterCapabilities (live, derived from the registry — measured, not claimed) ────────────────
describe('D3-S3 — AdapterCapabilities', () => {
  it('reports declaredTypes/supportsType/supportsKind from the registry\'s actual current state', () => {
    const registry = createAdapterRegistry();
    const adapter = createFrameworkAdapter('test-framework', registry);
    expect(adapter.capabilities.supportsType('section:hero')).toBe(false);
    expect(adapter.capabilities.supportsKind('section')).toBe(false);

    // registered AFTER adapter creation — capabilities must reflect this LIVE, not a stale snapshot.
    registry.register('section:hero', () => 'X');
    expect(adapter.capabilities.supportsType('section:hero')).toBe(true);
    expect(adapter.capabilities.supportsKind('section')).toBe(true);
    expect(adapter.capabilities.declaredTypes).toEqual(['section:hero']);
  });
});

// ── FrameworkAdapter.adapt — the translation contract ────────────────────────────
describe('D3-S3 — FrameworkAdapter.adapt (RuntimeNode + LifecycleRecord → AdapterResult)', () => {
  it('produces kind="not-renderable" for a node whose lifecycle has not reached "renderable" — the adapter respects, never overrides, the Runtime\'s own lifecycle decision', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', () => 'X'));
    const resolved = resolveLifecycle(heroNode());
    const result = adapter.adapt(heroNode(), resolved);
    expect(result.kind).toBe('not-renderable');
    expect(result.output).toBeUndefined();
    expect(result.lifecycleStage).toBe('resolved');
  });

  it('produces kind="unsupported" for a renderable node this adapter has no NodeAdapter for', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry());
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), createRendererRegistry().register('section:hero', () => 'runtime-level renderer')));
    const result = adapter.adapt(heroNode(), renderable);
    expect(result.kind).toBe('unsupported');
    expect(result.output).toBeUndefined();
    expect(result.lifecycleStage).toBe('renderable');
  });

  it('produces kind="adapted" with the NodeAdapter\'s framework-neutral output for a renderable, supported node', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', (node: RuntimeNode) => ({ translated: node.type })));
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), createRendererRegistry().register('section:hero', () => 'runtime-level renderer')));
    const result = adapter.adapt(heroNode(), renderable);
    expect(result.kind).toBe('adapted');
    expect(result.output).toEqual({ translated: 'section:hero' });
    expect(result.lifecycleStage).toBe('renderable');
  });

  it('the NodeAdapter\'s output is never JSX/a React Element/DOM — plain data only, proven by absence of markup', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', (node: RuntimeNode) => ({ role: node.props.role ?? node.type })));
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), createRendererRegistry().register('section:hero', () => 'x')));
    const result = adapter.adapt(heroNode(), renderable);
    expect(JSON.stringify(result)).not.toMatch(/<[a-z][\s\S]*>/i);
  });
});

// ── determinism, replay, no mutation ─────────────────────────────────────────────
describe('D3-S3 — determinism, replay & no runtime mutation', () => {
  it('is deterministic: adapting the same (node, lifecycle) twice yields an identical digest', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', () => 'X'));
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), createRendererRegistry().register('section:hero', () => 'x')));
    const a = adapter.adapt(heroNode(), renderable);
    const b = adapter.adapt(heroNode(), renderable);
    expect(b.digest).toBe(a.digest);
  });

  it('replays: adapting a node rebuilt from a serialized RIR round-trip yields the identical digest', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', () => 'X'));
    const rir = buildRenderingIR(websitePlan(), brief());
    const roundTripped = JSON.parse(JSON.stringify(rir));
    const nodeA = resolveRenderTree(rir).root.children[0].children[0];
    const nodeB = resolveRenderTree(roundTripped).root.children[0].children[0];
    const registry = createRendererRegistry().register('section:hero', () => 'x');
    const a = adapter.adapt(nodeA, activateLifecycle(prepareLifecycle(resolveLifecycle(nodeA), registry)));
    const b = adapter.adapt(nodeB, activateLifecycle(prepareLifecycle(resolveLifecycle(nodeB), registry)));
    expect(b.digest).toBe(a.digest);
  });

  it('never mutates the RuntimeNode or LifecycleRecord it is given', () => {
    const adapter = createFrameworkAdapter('test-framework', createAdapterRegistry().register('section:hero', (n: RuntimeNode) => ({ x: n.type })));
    const node = heroNode();
    const lifecycle: LifecycleRecord = activateLifecycle(prepareLifecycle(resolveLifecycle(node), createRendererRegistry().register('section:hero', () => 'x')));
    const nodeBefore = JSON.stringify(node);
    const lifecycleBefore = JSON.stringify({ stage: lifecycle.stage, nodeDigest: lifecycle.node.digest });
    adapter.adapt(node, lifecycle);
    expect(JSON.stringify(node)).toBe(nodeBefore);
    expect(JSON.stringify({ stage: lifecycle.stage, nodeDigest: lifecycle.node.digest })).toBe(lifecycleBefore);
  });
});

// ── the full chain: RuntimeNode → FrameworkAdapter → framework-neutral output ────────────────────
describe('D3-S3 — adaptLifecycleTree (RuntimeNode → FrameworkAdapter → abstract output, whole tree)', () => {
  it('mirrors the LifecycleTree shape, adapting only renderable nodes', () => {
    const runtimeRegistry = createRendererRegistry().register('section:hero', () => 'r').register('slot', () => 'r');
    const adapterRegistry = createAdapterRegistry().register('section:hero', (n: RuntimeNode) => ({ hero: n.id })).register('slot', (n: RuntimeNode) => n.props.content);
    const framework = createFrameworkAdapter('test-framework', adapterRegistry);
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir, runtimeRegistry);
    const lifecycleTree = resolveLifecycleTree(ctx);
    const adapted = adaptLifecycleTree(lifecycleTree, framework);

    expect(adapted.result.kind).toBe('not-renderable'); // document node: no runtime-level renderer bound -> lifecycle stays 'prepared'
    const page = adapted.children[0];
    const hero = page.children[0];
    const faq = page.children[1];
    expect(hero.result.kind).toBe('adapted');
    expect(hero.result.output).toEqual({ hero: 'hero' });
    expect(faq.result.kind).toBe('not-renderable'); // no runtime-level renderer bound for 'section:faq'/'section'
    expect(hero.children[0].result.kind).toBe('adapted');
    expect(hero.children[0].result.output).toBe('Close the books in days.');
  });

  it('is stable across two independent adaptations of the same tree', () => {
    const build = () => {
      const runtimeRegistry = createRendererRegistry().register('section:hero', () => 'r').register('slot', () => 'r');
      const adapterRegistry = createAdapterRegistry().register('section:hero', (n: RuntimeNode) => ({ hero: n.id })).register('slot', (n: RuntimeNode) => n.props.content);
      const framework = createFrameworkAdapter('test-framework', adapterRegistry);
      const rir = buildRenderingIR(websitePlan(), brief());
      return adaptLifecycleTree(resolveLifecycleTree(createRuntimeProvider(rir, runtimeRegistry)), framework);
    };
    expect(build().digest).toBe(build().digest);
  });

  it('the whole adapted tree carries no markup anywhere — output stays abstract end to end', () => {
    const runtimeRegistry = createRendererRegistry().register('section:hero', () => 'r').register('slot', () => 'r');
    const adapterRegistry = createAdapterRegistry().register('section:hero', (n: RuntimeNode) => ({ hero: n.id })).register('slot', (n: RuntimeNode) => n.props.content);
    const framework = createFrameworkAdapter('test-framework', adapterRegistry);
    const rir = buildRenderingIR(websitePlan(), brief());
    const adapted = adaptLifecycleTree(resolveLifecycleTree(createRuntimeProvider(rir, runtimeRegistry)), framework);
    expect(JSON.stringify(adapted)).not.toMatch(/<[a-z][\s\S]*>/i);
  });
});
