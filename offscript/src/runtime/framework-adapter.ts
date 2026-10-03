/**
 * D3-S3 — Framework Adapter contract: translating a `RuntimeNode` + its `LifecycleRecord` into a
 * framework-native representation, WITHOUT the Runtime, the Lifecycle, or the Rendering IR ever
 * knowing which framework — or whether one exists at all.
 *
 * Ownership split (`D3-S3-FRAMEWORK-ADAPTER-CONTRACT.md` §1):
 *   - Runtime owns EXECUTION SEMANTICS — whether a node is eligible to render at all
 *     (`RendererRegistry`, `offscript-runtime.ts`) and its lifecycle stage (`runtime-lifecycle.ts`).
 *     This module never overrides either: `FrameworkAdapter.adapt` REFUSES to translate a node
 *     whose lifecycle has not reached `renderable` — it respects the Runtime's decision, it does
 *     not recompute or second-guess it.
 *   - Framework adapters own FRAMEWORK TRANSLATION — a SEPARATE registry
 *     (`AdapterRegistry`, this file) decides HOW a renderable node becomes a specific framework's
 *     native object. This is deliberately independent of the Runtime's own `RendererRegistry`:
 *     "does a renderer exist at all" (Runtime) and "how does React/Vue/Svelte represent it"
 *     (Framework adapter) are different questions with different owners.
 *   - React is merely one adapter — nothing in this file, its types, or its tests references
 *     React, JSX, the DOM, or any browser API (enforced by test).
 *
 * Purity: imports ONLY types from `./offscript-runtime.js` and `./runtime-lifecycle.js` + `node:crypto`
 * — no Rendering IR, no Generation, no React. Pure and deterministic throughout: `adapt` never
 * mutates its `RuntimeNode`/`LifecycleRecord` arguments and never touches the Runtime's own
 * `RendererRegistry` (it takes a `LifecycleRecord`, already resolved, as a read-only input).
 *
 * See docs/offscript/D3-S3-FRAMEWORK-ADAPTER-CONTRACT.md for the grounding, the translation
 * contract, and the validation run against real production Runtime trees.
 */
import { createHash } from 'node:crypto';
import type { RuntimeNode, RuntimeNodeKind } from './offscript-runtime.js';
import type { LifecycleRecord, LifecycleStage, LifecycleTreeNode } from './runtime-lifecycle.js';

// ── canonicalization + digest (same doctrine as offscript-runtime.ts / runtime-lifecycle.ts,
// reimplemented for isolation — this module needs nothing beyond its own two sibling modules'
// published types). ──────────────────────────────────────────────────────────────────────────

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

const ADAPTER_VERSION_TAG = 'd3-s3-framework-adapter@1';

function digestOf(value: unknown): string {
  return createHash('sha256').update(ADAPTER_VERSION_TAG).update('\n').update(JSON.stringify(canonical(value))).digest('hex');
}

// ── NodeAdapter — the per-node-type translation function ────────────────────────

/**
 * Translates one `RuntimeNode` into a framework-native value. The return type is intentionally
 * `unknown` to this contract — a React adapter's `NodeAdapter` would return `React.ReactElement`;
 * this module never inspects, constrains, or interprets what comes back.
 */
export type NodeAdapter<TOutput = unknown> = (node: RuntimeNode, lifecycle: LifecycleRecord, ctx: AdapterContext) => TOutput;

// ── AdapterRegistry — framework-owned dispatch, separate from the Runtime's RendererRegistry ────

export interface AdapterRegistry {
  /** Register a translator under an exact `type` (e.g. `section:hero`) or a bare `kind` (e.g.
   *  `section`, the fallback when no exact type is registered). Returns `this` for chaining. */
  register(type: string, adapter: NodeAdapter): AdapterRegistry;
  /** Exact-`type` match first, else the node's bare `kind` as a fallback, else `undefined` — the
   *  same two-tier policy `RendererRegistry.resolve` uses (`offscript-runtime.ts`), independently
   *  reimplemented here since this is a SEPARATE, framework-owned registry. */
  resolve(node: RuntimeNode): NodeAdapter | undefined;
  /** Reflects EXACT registrations only — an introspection primitive, not a resolution primitive. */
  has(type: string): boolean;
  /** Live — always reflects the registry's CURRENT state, never a snapshot taken at creation. */
  readonly registeredTypes: readonly string[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const entries = new Map<string, NodeAdapter>();
  const registry: AdapterRegistry = {
    register(type, adapter) {
      entries.set(type, adapter);
      return registry;
    },
    resolve(node) {
      return entries.get(node.type) ?? entries.get(node.kind);
    },
    has(type) {
      return entries.has(type);
    },
    get registeredTypes() {
      return [...entries.keys()];
    },
  };
  return registry;
}

// ── AdapterCapabilities — derived LIVE from the registry, never a hand-maintained duplicate ─────

export interface AdapterCapabilities {
  /** Live — every exact type currently registered. */
  readonly declaredTypes: readonly string[];
  /** Exact-type registration check (mirrors `AdapterRegistry.has`). */
  supportsType(type: string): boolean;
  /** True when EITHER the bare kind itself is registered OR at least one exact `${kind}:...`
   *  type is — i.e. "this adapter can translate at least one node of this kind, one way or
   *  another." */
  supportsKind(kind: RuntimeNodeKind): boolean;
}

function createCapabilities(registry: AdapterRegistry): AdapterCapabilities {
  return {
    get declaredTypes() {
      return registry.registeredTypes;
    },
    supportsType: (type) => registry.has(type),
    supportsKind: (kind) => registry.registeredTypes.some((t) => t === kind || t.startsWith(`${kind}:`)),
  };
}

// ── AdapterContext / AdapterResult / FrameworkAdapter ────────────────────────────

/** The read-only context a `NodeAdapter` receives — Runtime data only, never a framework object. */
export interface AdapterContext {
  readonly registry: AdapterRegistry;
  readonly capabilities: AdapterCapabilities;
}

export type AdapterResultKind = 'adapted' | 'not-renderable' | 'unsupported';

export interface AdapterResult {
  readonly nodeId: string;
  readonly nodeType: string;
  /** The lifecycle stage the input was in — proves lifecycle information is PRESERVED through
   *  translation, not discarded (`D3-S3-FRAMEWORK-ADAPTER-CONTRACT.md` §5). */
  readonly lifecycleStage: LifecycleStage;
  readonly kind: AdapterResultKind;
  /** Framework-neutral, opaque to this contract; `undefined` for `not-renderable`/`unsupported`
   *  (never a fabricated placeholder). */
  readonly output: unknown;
  /** sha256 content-address over `{nodeId, nodeType, lifecycleStage, kind}` — `output` is
   *  deliberately excluded (it may be non-serializable framework-specific data; the same posture
   *  `runtime-lifecycle.ts` holds for a bound `renderer` function). */
  readonly digest: string;
}

export interface FrameworkAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  readonly registry: AdapterRegistry;
  /**
   * Translate one node. Refuses (`kind: 'not-renderable'`) when `lifecycle.stage !== 'renderable'`
   * — the Runtime's own lifecycle decision is respected, never recomputed or overridden. A
   * `renderable` node this adapter has no `NodeAdapter` for yields `kind: 'unsupported'` — a
   * different, honestly distinct outcome from "the Runtime says it isn't ready yet." Pure: never
   * mutates `node` or `lifecycle`.
   */
  adapt(node: RuntimeNode, lifecycle: LifecycleRecord): AdapterResult;
}

/**
 * `createFrameworkAdapter` is the framework-neutral entry point — a React/Vue/Svelte adapter is
 * whatever `AdapterRegistry` gets registered into it plus a `name`; nothing about this factory or
 * the resulting `FrameworkAdapter` shape is React-specific.
 */
export function createFrameworkAdapter(name: string, registry: AdapterRegistry = createAdapterRegistry()): FrameworkAdapter {
  const capabilities = createCapabilities(registry);
  const ctx: AdapterContext = { registry, capabilities };

  const adapter: FrameworkAdapter = {
    name,
    capabilities,
    registry,
    adapt(node, lifecycle) {
      const base = { nodeId: node.id, nodeType: node.type, lifecycleStage: lifecycle.stage };

      if (lifecycle.stage !== 'renderable') {
        const core = { ...base, kind: 'not-renderable' as const };
        return { ...core, output: undefined, digest: digestOf(core) };
      }

      const nodeAdapter = registry.resolve(node);
      if (!nodeAdapter) {
        const core = { ...base, kind: 'unsupported' as const };
        return { ...core, output: undefined, digest: digestOf(core) };
      }

      const output = nodeAdapter(node, lifecycle, ctx);
      const core = { ...base, kind: 'adapted' as const };
      return { ...core, output, digest: digestOf(core) };
    },
  };
  return adapter;
}

// ── the full chain: RuntimeNode → FrameworkAdapter → framework-neutral output, whole tree ────────

export interface AdaptedTreeNode {
  readonly result: AdapterResult;
  readonly children: readonly AdaptedTreeNode[];
  readonly digest: string;
}

/**
 * Walk a `LifecycleTreeNode` (D3-S2), adapting every node via the given `FrameworkAdapter` and
 * mirroring the tree shape. This is "RuntimeNode → FrameworkAdapter → Framework-neutral adapter
 * output" in full — pure, produces no markup of any kind (verified by test), and never executes
 * anything beyond calling the registered `NodeAdapter` functions.
 */
export function adaptLifecycleTree(tree: LifecycleTreeNode, adapter: FrameworkAdapter): AdaptedTreeNode {
  const walk = (t: LifecycleTreeNode): AdaptedTreeNode => {
    const result = adapter.adapt(t.record.node, t.record);
    const children = t.children.map(walk);
    const core = { result, children };
    return { ...core, digest: digestOf({ resultDigest: result.digest, childDigests: children.map((c) => c.digest) }) };
  };
  return walk(tree);
}
