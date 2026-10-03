/**
 * D3-S2 — Runtime Lifecycle (RED-first).
 *
 * Formalizes the RuntimeNode lifecycle that D3-S1 already exercised implicitly
 * (`resolveRenderTree` → `resolveRuntimeTree`) into an explicit, deterministic three-stage state
 * machine — `resolved → prepared → renderable` — driven ONLY by Runtime data (a RuntimeNode +
 * a RendererRegistry). No framework callback, no DOM, no browser API, no React, no hydration, and
 * no interaction semantics are introduced anywhere in this file.
 *
 * See docs/offscript/D3-S2-RUNTIME-LIFECYCLE.md for the grounding + ownership findings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  resolveLifecycle,
  prepareLifecycle,
  activateLifecycle,
  progressLifecycle,
  resolveLifecycleTree,
  type LifecycleRecord,
} from '../../src/runtime/runtime-lifecycle.js';
import {
  resolveRenderTree,
  createRendererRegistry,
  createRuntimeProvider,
  type RuntimeNode,
} from '../../src/runtime/offscript-runtime.js';
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
  return tree.root.children[0].children[0]; // the hero section node
}

// ── purity ────────────────────────────────────────────────────────────────────
describe('D3-S2 — runtime-lifecycle purity (no framework/browser/Generation dependency)', () => {
  it('imports only offscript-runtime.js types + node:crypto', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'runtime', 'runtime-lifecycle.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      const allowed = spec === './offscript-runtime.js' || spec === './offscript-runtime.ts' || spec === 'node:crypto';
      expect(allowed, `unexpected import: ${spec}`).toBe(true);
    }
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it('never accesses a browser global (window./document./navigator.) anywhere in the source', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'runtime', 'runtime-lifecycle.ts'), 'utf8');
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bnavigator\./);
  });
});

// ── resolved ──────────────────────────────────────────────────────────────────
describe('D3-S2 — resolveLifecycle (the initial stage)', () => {
  it('produces a "resolved" record for any RuntimeNode, with a digest', () => {
    const record = resolveLifecycle(heroNode());
    expect(record.stage).toBe('resolved');
    expect(typeof record.digest).toBe('string');
    expect(record.digest.length).toBeGreaterThan(16);
  });
});

// ── prepared ──────────────────────────────────────────────────────────────────
describe('D3-S2 — prepareLifecycle (resolved → prepared)', () => {
  it('transitions a resolved record to prepared, bound=true, when the registry has a matching renderer', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const record = prepareLifecycle(resolveLifecycle(heroNode()), registry);
    expect(record.stage).toBe('prepared');
    expect(record.bound).toBe(true);
    expect(record.renderer).toBeDefined();
  });

  it('transitions to prepared, bound=false, when nothing in the registry matches — this is a valid terminal outcome, not an error', () => {
    const registry = createRendererRegistry();
    const record = prepareLifecycle(resolveLifecycle(heroNode()), registry);
    expect(record.stage).toBe('prepared');
    expect(record.bound).toBe(false);
    expect(record.renderer).toBeUndefined();
  });

  it('rejects preparing an already-prepared record (invalid transition, fails loudly)', () => {
    const registry = createRendererRegistry();
    const prepared = prepareLifecycle(resolveLifecycle(heroNode()), registry);
    expect(() => prepareLifecycle(prepared, registry)).toThrow(/resolved.*prepared|invalid transition/i);
  });

  it('rejects preparing a renderable record (invalid transition, fails loudly)', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), registry));
    expect(() => prepareLifecycle(renderable, registry)).toThrow(/resolved.*prepared|invalid transition/i);
  });
});

// ── renderable ────────────────────────────────────────────────────────────────
describe('D3-S2 — activateLifecycle (prepared → renderable)', () => {
  it('transitions a bound prepared record to renderable, carrying the SAME renderer reference', () => {
    const renderer = () => 'H';
    const registry = createRendererRegistry().register('section:hero', renderer);
    const prepared = prepareLifecycle(resolveLifecycle(heroNode()), registry);
    const record = activateLifecycle(prepared);
    expect(record.stage).toBe('renderable');
    expect(record.renderer).toBe(renderer);
  });

  it('rejects activating an unbound prepared record (invalid transition — no renderer to activate)', () => {
    const registry = createRendererRegistry();
    const prepared = prepareLifecycle(resolveLifecycle(heroNode()), registry);
    expect(() => activateLifecycle(prepared)).toThrow(/no renderer|not bound|invalid transition/i);
  });

  it('rejects activating a bare resolved record (must be prepared first, fails loudly)', () => {
    expect(() => activateLifecycle(resolveLifecycle(heroNode()))).toThrow(/prepared.*renderable|invalid transition/i);
  });

  it('rejects re-activating an already-renderable record (terminal state, fails loudly)', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const renderable = activateLifecycle(prepareLifecycle(resolveLifecycle(heroNode()), registry));
    expect(() => activateLifecycle(renderable)).toThrow(/prepared.*renderable|invalid transition/i);
  });
});

// ── progressLifecycle — go as far as the data allows ─────────────────────────────
describe('D3-S2 — progressLifecycle (drives a node as far through the lifecycle as its data allows)', () => {
  it('reaches "renderable" when a renderer is bound', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const record = progressLifecycle(heroNode(), registry);
    expect(record.stage).toBe('renderable');
  });

  it('stops at "prepared" when no renderer is bound — never fabricates a renderable state', () => {
    const registry = createRendererRegistry();
    const record = progressLifecycle(heroNode(), registry);
    expect(record.stage).toBe('prepared');
    expect((record as Extract<LifecycleRecord, { stage: 'prepared' }>).bound).toBe(false);
  });
});

// ── determinism & replay ───────────────────────────────────────────────────────
describe('D3-S2 — determinism & replay', () => {
  it('is deterministic: progressing the same node twice through the same registry yields an identical digest', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const a = progressLifecycle(heroNode(), registry);
    const b = progressLifecycle(heroNode(), registry);
    expect(b.digest).toBe(a.digest);
  });

  it('changes the digest between an unbound and a bound outcome for the identical node', () => {
    const unbound = progressLifecycle(heroNode(), createRendererRegistry());
    const bound = progressLifecycle(heroNode(), createRendererRegistry().register('section:hero', () => 'H'));
    expect(unbound.digest).not.toBe(bound.digest);
  });
});

// ── the full chain: RIR → RenderTree → Lifecycle progression → stable tree ─────────────────────
describe('D3-S2 — resolveLifecycleTree (RIR → RenderTree → Lifecycle progression → stable tree)', () => {
  it('mirrors the RenderTree shape, one lifecycle record per node', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H').register('slot', (n: RuntimeNode) => n.props.content);
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir, registry);
    const tree = resolveLifecycleTree(ctx);
    expect(tree.record.stage).toBe('prepared'); // document node: no renderer registered for it
    const page = tree.children[0];
    const hero = page.children[0];
    const faq = page.children[1];
    expect(hero.record.stage).toBe('renderable'); // 'section:hero' registered
    expect(faq.record.stage).toBe('prepared'); // no 'section:faq' or 'section' fallback registered
    expect(hero.children[0].record.stage).toBe('renderable'); // 'slot' fallback registered
  });

  it('is stable: two independent resolutions of the same (rir, registry-shape) produce an identical top-level digest', () => {
    const buildTree = () => {
      const registry = createRendererRegistry().register('section:hero', () => 'H');
      const rir = buildRenderingIR(websitePlan(), brief());
      return resolveLifecycleTree(createRuntimeProvider(rir, registry));
    };
    expect(buildTree().digest).toBe(buildTree().digest);
  });

  it('replays: rebuilding the RIR from a serialized round-trip produces the identical lifecycle digest', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const rir = buildRenderingIR(websitePlan(), brief());
    const a = resolveLifecycleTree(createRuntimeProvider(rir, registry));
    const roundTripped = JSON.parse(JSON.stringify(rir));
    const b = resolveLifecycleTree(createRuntimeProvider(roundTripped, registry));
    expect(b.digest).toBe(a.digest);
  });
});
