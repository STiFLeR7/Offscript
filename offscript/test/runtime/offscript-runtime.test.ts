/**
 * D3-S1 — Offscript Runtime (RED-first).
 *
 * The Runtime is a NEW, Generation-independent plane: `RenderingIR → RenderTree → Resolved
 * Runtime Nodes`. It consumes ONLY `RenderingIR` — never `AuthoringPlan`, `DesignContext`, the
 * Canonical Brief, or any Generation module. No React, no DOM, no markup is produced here; the
 * registered "renderer" functions used in these tests are trivial, framework-neutral, and return
 * plain values, proving the resolution mechanism works independent of any framework target.
 *
 * See docs/offscript/D3-S1-OFFSCRIPT-RUNTIME.md for the grounding + ownership findings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  resolveRenderTree,
  createRendererRegistry,
  createRuntimeProvider,
  resolveRuntimeTree,
  type RenderTree,
  type RuntimeNode,
  type RenderingContext,
} from '../../src/runtime/offscript-runtime.js';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures (same hand-built-Plan pattern as D1/D2 — never buildContext()/plan()) ─────────────
const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number, landmark?: string): PlanItem {
  return {
    anchor: { id, anchor: id, ...(landmark ? { landmark } : {}) },
    archetype: id === 'hero' ? 'hero' : 'faq',
    tokenRoles: ['--cr-bg'],
    intent: 'x',
    content: order === 0 ? 'Close the books in days.' : 'How does it work?',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0, 'main'), websiteItem('faq', 1)], warnings: [] };
}

function collateralPlan(): AuthoringPlan {
  return {
    track: 'collateral',
    items: [
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: [], intent: 'Cover', content: 'Helix.' },
      { anchor: { id: 'body', anchor: 'body' }, archetype: 'ContentPage', tokenRoles: [], intent: 'Body', content: 'Prose.' },
    ],
    warnings: [],
  };
}

// ── purity ────────────────────────────────────────────────────────────────────
describe('D3-S1 — Offscript Runtime purity (no Generation dependency)', () => {
  it('imports only rendering-ir.js types/validator + node:crypto — no AuthoringPlan, DesignContext, Brief, or any other generate module', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'runtime', 'offscript-runtime.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      const allowed = spec === './rendering-ir.js' || spec === '../generate/rendering-ir.js' || spec === 'node:crypto';
      expect(allowed, `unexpected import: ${spec}`).toBe(true);
    }
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it('resolves a RenderTree from a hand-built AuthoringPlan — never calls buildContext()/plan()', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    expect(tree.root.kind).toBe('document');
  });
});

// ── NodeResolver / RenderTree / primitive types ─────────────────────────────────
describe('D3-S1 — NodeResolver (RenderingIR → RenderTree)', () => {
  it('builds a document → pages → sections → slots tree matching the IR exactly', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    expect(tree.irVersion).toBe(rir.irVersion);
    expect(tree.track).toBe('website');
    expect(tree.root.children).toHaveLength(1); // one website page
    const page = tree.root.children[0];
    expect(page.kind).toBe('page');
    expect(page.children.map((s) => s.id)).toEqual(['hero', 'faq']);
  });

  it('derives registry-lookup "type" strings from real IR fields — document:{track}, page:{role}, section:{role}, slot:{kind}', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    expect(tree.root.type).toBe('document:website');
    const page = tree.root.children[0];
    expect(page.type).toBe(`page:${page.props.role}`);
    const hero = page.children[0];
    expect(hero.type).toBe('section:hero');
    expect(hero.children[0].type).toBe('slot:prose');
  });

  it('preserves section order in the tree', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    const ids = tree.root.children[0].children.map((s) => s.id);
    expect(ids).toEqual(['hero', 'faq']);
  });

  it('carries landmark/composition/presentation into section props verbatim, and nothing else', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    const hero = tree.root.children[0].children[0];
    expect(hero.props.landmark).toBe('main');
    expect(hero.props.composition).toEqual({ variant: 'hero-split', surface: 'base' });
  });

  it('groups collateral into one page node per RenderingPage', () => {
    const rir = buildRenderingIR(collateralPlan(), brief({ track: 'collateral' }));
    const tree = resolveRenderTree(rir);
    expect(tree.root.children).toHaveLength(2);
    expect(tree.root.children.map((p) => p.id)).toEqual(['cover', 'body']);
  });

  it('rejects an IR that fails validateRenderingIR (fail-loud, measured not claimed)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered: RenderingIR = { ...rir, digest: 'deadbeef' };
    expect(() => resolveRenderTree(tampered)).toThrow(/digest|invalid/i);
  });
});

// ── determinism & replay ───────────────────────────────────────────────────────
describe('D3-S1 — determinism & replay', () => {
  it('is deterministic: resolving the same RIR twice yields an identical tree + identical digest', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const a = resolveRenderTree(rir);
    const b = resolveRenderTree(rir);
    expect(b).toEqual(a);
    expect(b.digest).toBe(a.digest);
  });

  it('replays: resolveRenderTree(parse(serialize(rir))) === resolveRenderTree(rir)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const roundTripped = JSON.parse(JSON.stringify(rir)) as RenderingIR;
    expect(resolveRenderTree(roundTripped).digest).toBe(resolveRenderTree(rir).digest);
  });

  it('changes the digest when the underlying IR content changes', () => {
    const a = resolveRenderTree(buildRenderingIR(websitePlan(), brief()));
    const b = resolveRenderTree(buildRenderingIR(websitePlan(), brief({ oneLiner: 'Different.' })));
    expect(b.digest).not.toBe(a.digest);
  });
});

// ── Renderer registry ────────────────────────────────────────────────────────────
describe('D3-S1 — RendererRegistry', () => {
  it('resolves an exact type match', () => {
    const registry = createRendererRegistry();
    const heroRenderer = () => 'HERO';
    registry.register('section:hero', heroRenderer);
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    const hero = tree.root.children[0].children[0];
    expect(registry.resolve(hero)).toBe(heroRenderer);
  });

  it('falls back to the node kind when no exact type is registered', () => {
    const registry = createRendererRegistry();
    const fallback = () => 'SECTION_FALLBACK';
    registry.register('section', fallback);
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    const faq = tree.root.children[0].children[1]; // no exact 'section:faq' registered
    expect(registry.resolve(faq)).toBe(fallback);
  });

  it('returns undefined when nothing matches — no invented default renderer', () => {
    const registry = createRendererRegistry();
    const rir = buildRenderingIR(websitePlan(), brief());
    const tree = resolveRenderTree(rir);
    expect(registry.resolve(tree.root.children[0].children[0])).toBeUndefined();
  });

  it('has() reflects exact registrations only', () => {
    const registry = createRendererRegistry();
    registry.register('slot:prose', () => 'X');
    expect(registry.has('slot:prose')).toBe(true);
    expect(registry.has('slot:heading')).toBe(false);
  });
});

// ── RuntimeProvider / RenderingContext ───────────────────────────────────────────
describe('D3-S1 — RuntimeProvider / RenderingContext', () => {
  it('createRuntimeProvider wires a RenderTree + registry into one RenderingContext', () => {
    const registry = createRendererRegistry().register('section:hero', () => 'H');
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx: RenderingContext = createRuntimeProvider(rir, registry);
    expect(ctx.tree.digest).toBe(resolveRenderTree(rir).digest);
    const hero = ctx.tree.root.children[0].children[0];
    expect(ctx.resolveRenderer(hero)?.(hero, ctx)).toBe('H');
  });

  it('works with no registry supplied — every node resolves to undefined, never throws', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir);
    const hero = ctx.tree.root.children[0].children[0];
    expect(ctx.resolveRenderer(hero)).toBeUndefined();
  });
});

// ── the demonstration: RenderTree → Resolved Runtime Nodes (no React, no DOM) ───────────────────
describe('D3-S1 — resolveRuntimeTree (RenderTree → Resolved Runtime Nodes, no React/DOM)', () => {
  it('walks the tree, invoking each node\'s registered renderer, and mirrors the tree shape', () => {
    const registry = createRendererRegistry()
      .register('document:website', (n: RuntimeNode) => ({ doc: n.type }))
      .register('page:page', (n: RuntimeNode) => ({ page: n.type }))
      .register('section:hero', (n: RuntimeNode) => ({ section: n.id }))
      .register('slot:prose', (n: RuntimeNode) => n.props.content);
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir, registry);
    const resolved = resolveRuntimeTree(ctx);

    expect(resolved.output).toEqual({ doc: 'document:website' });
    expect(resolved.children[0].output).toEqual({ page: 'page:page' });
    const heroResolved = resolved.children[0].children[0];
    expect(heroResolved.output).toEqual({ section: 'hero' });
    expect(heroResolved.children[0].output).toBe('Close the books in days.');
  });

  it('an unresolved node (no matching renderer) yields output: undefined, and resolution still completes', () => {
    const registry = createRendererRegistry(); // empty
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir, registry);
    const resolved = resolveRuntimeTree(ctx);
    expect(resolved.output).toBeUndefined();
    expect(resolved.children.length).toBeGreaterThan(0);
  });

  it('produces no markup anywhere — the demonstration proves resolution, never rendering to HTML/React', () => {
    const registry = createRendererRegistry().register('slot:prose', (n: RuntimeNode) => n.props.content);
    const rir = buildRenderingIR(websitePlan(), brief());
    const ctx = createRuntimeProvider(rir, registry);
    const resolved = resolveRuntimeTree(ctx);
    expect(JSON.stringify(resolved)).not.toMatch(/<[a-z][\s\S]*>/i);
  });
});
