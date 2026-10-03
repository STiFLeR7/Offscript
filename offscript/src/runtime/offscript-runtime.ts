/**
 * D3-S1 — Offscript Runtime: `RenderingIR → RenderTree → Resolved Runtime Nodes`.
 *
 * The Runtime is a NEW, Generation-independent plane (`RENDERING_IR_ARCHITECTURE.md` §9 —
 * `RIR → Runtime → Framework → Output`). It lives outside `src/generate/` on purpose: everything
 * in `src/generate/` is downstream of Generation (the Plan, the brief, `resources/`); the
 * Runtime must never be. It consumes ONLY `RenderingIR`.
 *
 * Purity (enforced by test — "imports only rendering-ir.js types/validator + node:crypto"):
 *   - imports ONLY types + `validateRenderingIR` from `../generate/rendering-ir.js` + `node:crypto`;
 *   - NEVER imports `AuthoringPlan`/`DesignContext`/`Brief`/the Canonical Brief, any author
 *     module, the exemplar corpus, or React;
 *   - pure and deterministic: identical `RenderingIR` in → an identical `RenderTree` +
 *     identical digest out, mirroring the RIR's own content-addressing doctrine
 *     (`rendering-ir.ts`'s `digestOf`/`canonicalJson`, reimplemented independently here for the
 *     same reason D2-S1's HTML renderer reimplements rather than reuses `website-shell.ts`: this
 *     module's job is to prove it needs NOTHING beyond the IR itself, including no coupling to
 *     `rendering-ir.ts`'s internal (unexported) digest helpers).
 *
 * No React, no DOM, no HTML is produced by anything in this file — see
 * `docs/offscript/D3-S1-OFFSCRIPT-RUNTIME.md` for the ownership findings this module implements
 * and the validation run against real Rendering IR documents.
 */
import { createHash } from 'node:crypto';
import {
  validateRenderingIR,
  type RenderingIR,
  type RenderingMetadata,
  type RenderingComposition,
  type RenderingPresentation,
} from '../generate/rendering-ir.js';

// ── canonicalization + digest (same doctrine as rendering-ir.ts, reimplemented for isolation) ──

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
function canonical(value: unknown): Json | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((v) => canonical(v) ?? null);
  if (value !== null && typeof value === 'object') {
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const cv = canonical((value as Record<string, unknown>)[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return value as Json;
}

const RUNTIME_VERSION_TAG = 'd3-offscript-runtime@1';

function digestOf(value: unknown): string {
  return createHash('sha256').update(RUNTIME_VERSION_TAG).update('\n').update(JSON.stringify(canonical(value))).digest('hex');
}

// ── Primitive interfaces — the closed runtime-node vocabulary, one per RIR tree level ──────────
// Every prop is copied verbatim from RenderingIR; nothing here is invented or derived beyond the
// IR's own fields (Track/RenderingMetadata/RenderingComposition/RenderingPresentation come
// straight from rendering-ir.ts).

export interface DocumentPrimitiveProps {
  readonly track: RenderingIR['track'];
  readonly metadata: RenderingMetadata;
  readonly tokens: readonly string[];
}

export interface PagePrimitiveProps {
  readonly role: string;
}

export interface SectionPrimitiveProps {
  readonly role: string;
  readonly order: number;
  readonly intent: string;
  readonly landmark?: string;
  readonly composition?: RenderingComposition;
  readonly presentation?: RenderingPresentation;
}

export interface SlotPrimitiveProps {
  readonly kind: string;
  readonly content: string;
}

export type RuntimeNodeKind = 'document' | 'page' | 'section' | 'slot';

interface BaseRuntimeNode {
  /** Stable identity — reconciliation/replay key (mirrors RenderingSection.id / RenderingPage.id). */
  readonly id: string;
  /**
   * The Renderer registry's lookup key — `${kind}:${discriminator}` derived ONLY from real IR
   * fields (track/role/kind). Never invented; a framework adapter registers renderers against
   * this string (an exact archetype match, e.g. `section:hero`) with graceful fallback to the
   * bare `kind` (e.g. `section`) when no exact registration exists (see `RendererRegistry`).
   */
  readonly type: string;
  /** sha256 content-address of this node (computed over every field except `digest`). */
  readonly digest: string;
}

export interface SlotRuntimeNode extends BaseRuntimeNode {
  readonly kind: 'slot';
  readonly props: SlotPrimitiveProps;
  readonly children: readonly [];
}

export interface SectionRuntimeNode extends BaseRuntimeNode {
  readonly kind: 'section';
  readonly props: SectionPrimitiveProps;
  readonly children: readonly SlotRuntimeNode[];
}

export interface PageRuntimeNode extends BaseRuntimeNode {
  readonly kind: 'page';
  readonly props: PagePrimitiveProps;
  readonly children: readonly SectionRuntimeNode[];
}

export interface DocumentRuntimeNode extends BaseRuntimeNode {
  readonly kind: 'document';
  readonly props: DocumentPrimitiveProps;
  readonly children: readonly PageRuntimeNode[];
}

/** The closed union every resolved node belongs to — one of the four RIR tree levels, never a fifth. */
export type RuntimeNode = DocumentRuntimeNode | PageRuntimeNode | SectionRuntimeNode | SlotRuntimeNode;

// ── RenderTree ────────────────────────────────────────────────────────────────
export interface RenderTree {
  readonly irVersion: number;
  readonly track: RenderingIR['track'];
  readonly root: DocumentRuntimeNode;
  /** sha256 content-address of the whole tree (computed over every field except `digest`). */
  readonly digest: string;
}

// ── NodeResolver — RenderingIR → RenderTree (pure) ──────────────────────────────

function slotNode(slot: { name: string; kind: string; content: string }): SlotRuntimeNode {
  const type = `slot:${slot.kind}`;
  const core = { id: slot.name, type, kind: 'slot' as const, props: { kind: slot.kind, content: slot.content }, children: [] as const };
  return { ...core, digest: digestOf(core) };
}

function sectionNode(section: RenderingIR['document']['pages'][number]['sections'][number]): SectionRuntimeNode {
  const type = `section:${section.role}`;
  const children = section.slots.map(slotNode);
  const core = {
    id: section.id,
    type,
    kind: 'section' as const,
    props: {
      role: section.role,
      order: section.order,
      intent: section.intent,
      ...(section.landmark ? { landmark: section.landmark } : {}),
      ...(section.composition ? { composition: section.composition } : {}),
      ...(section.presentation ? { presentation: section.presentation } : {}),
    },
    children,
  };
  return { ...core, digest: digestOf(core) };
}

function pageNode(page: RenderingIR['document']['pages'][number]): PageRuntimeNode {
  const type = `page:${page.role}`;
  const children = page.sections.map(sectionNode);
  const core = { id: page.id, type, kind: 'page' as const, props: { role: page.role }, children };
  return { ...core, digest: digestOf(core) };
}

function documentNode(rir: RenderingIR): DocumentRuntimeNode {
  const type = `document:${rir.track}`;
  const children = rir.document.pages.map(pageNode);
  const core = {
    id: 'document',
    type,
    kind: 'document' as const,
    props: { track: rir.track, metadata: rir.document.metadata, tokens: rir.document.tokens },
    children,
  };
  return { ...core, digest: digestOf(core) };
}

/**
 * Resolve a validated RenderingIR into a RenderTree. Pure and deterministic: no I/O, no clock, no
 * randomness. Fails loud (does not silently resolve) when the IR itself does not validate — the
 * same "measured, not claimed" posture the D2-S1 HTML renderer holds; a runtime that trusted
 * unverified input would defeat the point of having a validated contract at all.
 */
export function resolveRenderTree(rir: RenderingIR): RenderTree {
  const check = validateRenderingIR(rir);
  if (!check.valid) {
    throw new Error(`resolveRenderTree: invalid RenderingIR — ${check.errors.join('; ')}`);
  }
  const root = documentNode(rir);
  const core = { irVersion: rir.irVersion, track: rir.track, root };
  return { ...core, digest: digestOf(core) };
}

// ── Renderer registry ─────────────────────────────────────────────────────────

export type RendererFn<TOutput = unknown> = (node: RuntimeNode, ctx: RenderingContext) => TOutput;

export interface RendererRegistry {
  /** Register a renderer under an exact `type` (e.g. `section:hero`) or a bare `kind` (e.g.
   *  `section`, used as the fallback when no exact type is registered). Returns `this` for
   *  chaining. Mutable by design — a registry is renderer-owned setup-time configuration, not
   *  RIR-derived data; it carries none of the RIR's own determinism obligations. */
  register(type: string, renderer: RendererFn): RendererRegistry;
  /** Exact-`type` match first, else the node's bare `kind` as a fallback, else `undefined` —
   *  never an invented default renderer. */
  resolve(node: RuntimeNode): RendererFn | undefined;
  /** Reflects EXACT registrations only (never the fallback path) — a registry-introspection
   *  primitive, not a resolution primitive. */
  has(type: string): boolean;
}

export function createRendererRegistry(): RendererRegistry {
  const entries = new Map<string, RendererFn>();
  const registry: RendererRegistry = {
    register(type, renderer) {
      entries.set(type, renderer);
      return registry;
    },
    resolve(node) {
      return entries.get(node.type) ?? entries.get(node.kind);
    },
    has(type) {
      return entries.has(type);
    },
  };
  return registry;
}

// ── RenderingContext / RuntimeProvider ────────────────────────────────────────

/**
 * The object a framework adapter consumes: the resolved tree + the registry + a bound resolver.
 * Framework-neutral by construction — nothing here is React, Vue, or any other framework's own
 * context mechanism. A future React adapter wraps THIS in an actual `<RuntimeProvider>` component
 * that calls `createRuntimeProvider` once and threads the result through `React.createContext`
 * (`docs/offscript/D3-S1-OFFSCRIPT-RUNTIME.md` §7 "Framework relationship").
 */
export interface RenderingContext {
  readonly tree: RenderTree;
  readonly registry: RendererRegistry;
  resolveRenderer(node: RuntimeNode): RendererFn | undefined;
}

/**
 * `createRuntimeProvider` IS "RuntimeProvider" for this sprint: the framework-neutral entry point
 * that resolves a RenderingIR into a RenderTree and wires it to a registry, producing one
 * RenderingContext. No JSX/React `<Provider>` component exists yet — that is future, framework-
 * specific work (STOP: "Do not build React components").
 */
export function createRuntimeProvider(rir: RenderingIR, registry: RendererRegistry = createRendererRegistry()): RenderingContext {
  const tree = resolveRenderTree(rir);
  const ctx: RenderingContext = {
    tree,
    registry,
    resolveRenderer: (node) => registry.resolve(node),
  };
  return ctx;
}

// ── the demonstration: RenderTree → Resolved Runtime Nodes (no React, no DOM) ───────────────────

export interface ResolvedRuntimeNode {
  readonly node: RuntimeNode;
  /** Whatever the resolved renderer produced — framework-neutral `unknown`; `undefined` when no
   *  renderer matched (never a fabricated placeholder). */
  readonly output: unknown;
  readonly children: readonly ResolvedRuntimeNode[];
}

/**
 * Walk a RenderingContext's tree, invoking each node's registered renderer (if any) and mirroring
 * the tree shape into resolved output. This is the "Rendering IR → Render Tree → Resolved Runtime
 * Nodes" chain in full — pure, framework-neutral, and produces no markup: the renderer functions
 * registered against a `RendererRegistry` may return anything (a React element, a plain object, a
 * string) — this function never inspects or constrains that output beyond passing it through.
 */
export function resolveRuntimeTree(ctx: RenderingContext): ResolvedRuntimeNode {
  const walk = (node: RuntimeNode): ResolvedRuntimeNode => {
    const renderer = ctx.resolveRenderer(node);
    const output = renderer ? renderer(node, ctx) : undefined;
    return { node, output, children: node.children.map(walk) };
  };
  return walk(ctx.tree.root);
}
