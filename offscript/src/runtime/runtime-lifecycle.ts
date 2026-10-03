/**
 * D3-S2 — Runtime Lifecycle: a deterministic, three-stage state machine for `RuntimeNode`s —
 * `resolved → prepared → renderable`.
 *
 * This is an ARCHITECTURAL runtime concern, not React state, not hydration, not browser behavior.
 * Every transition is a pure function of Runtime data alone (a `RuntimeNode` + a
 * `RendererRegistry`, both from `offscript-runtime.ts`) — no framework callback, no DOM, no browser
 * API, no React, and no interaction semantics appear anywhere in this file. The Rendering IR still
 * owns semantics (this module reads no RIR field it did not already reach through a resolved
 * `RuntimeNode`); the Runtime owns lifecycle (this file); a framework adapter owns *execution* —
 * actually invoking the bound renderer a "renderable" record carries — which happens strictly
 * outside this module (`D3-S1-OFFSCRIPT-RUNTIME.md` §7).
 *
 * Stage names are architecture-justified, not an invented browser lifecycle
 * (`docs/offscript/D3-S2-RUNTIME-LIFECYCLE.md` §1):
 *   - `resolved`   — the node exists as part of a `RenderTree`, structurally derived from the IR.
 *                    This is exactly what `resolveRenderTree` (D3-S1) already produces.
 *   - `prepared`   — the node has been matched against a `RendererRegistry`: a renderer binding
 *                    (found, or explicitly absent) is now known. A DETERMINISTIC lookup, not an
 *                    execution — no renderer is called at this stage.
 *   - `renderable` — the node is bound to a renderer and is eligible to be handed to a framework
 *                    adapter. A `prepared` record with no bound renderer is a valid, STABLE
 *                    terminal outcome (dispatch was attempted; nothing claimed it) — it never
 *                    silently advances to `renderable`.
 *
 * See docs/offscript/D3-S2-RUNTIME-LIFECYCLE.md for the full grounding, ownership findings,
 * and the validation run against real Rendering IR documents.
 */
import { createHash } from 'node:crypto';
import type { RuntimeNode, RendererRegistry, RenderingContext, RendererFn } from './offscript-runtime.js';

// ── canonicalization + digest (same doctrine as rendering-ir.ts / offscript-runtime.ts, reimplemented
// for isolation — this module needs nothing beyond offscript-runtime.ts's own published types). ──────

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

const LIFECYCLE_VERSION_TAG = 'd3-s2-runtime-lifecycle@1';

/** Digests only JSON-safe, comparable fields — a bound `renderer` FUNCTION is never hashed (not
 *  serializable, and function identity is not a meaningful replay signal — see the report §1). */
function lifecycleDigest(value: unknown): string {
  return createHash('sha256').update(LIFECYCLE_VERSION_TAG).update('\n').update(JSON.stringify(canonical(value))).digest('hex');
}

// ── lifecycle stages ──────────────────────────────────────────────────────────

export type LifecycleStage = 'resolved' | 'prepared' | 'renderable';

interface BaseLifecycleRecord {
  readonly node: RuntimeNode;
  readonly digest: string;
}

export interface ResolvedLifecycleRecord extends BaseLifecycleRecord {
  readonly stage: 'resolved';
}

export interface PreparedLifecycleRecord extends BaseLifecycleRecord {
  readonly stage: 'prepared';
  /** Whether a renderer was found for this node — `false` is a valid, stable terminal outcome. */
  readonly bound: boolean;
  /** The registry lookup key that was tried (`node.type`, falling back to `node.kind` —
   *  `RendererRegistry.resolve`'s own policy, `offscript-runtime.ts`) — audit-only. */
  readonly rendererType: string;
  /** Present iff `bound`. */
  readonly renderer: RendererFn | undefined;
}

export interface RenderableLifecycleRecord extends BaseLifecycleRecord {
  readonly stage: 'renderable';
  readonly rendererType: string;
  readonly renderer: RendererFn;
}

export type LifecycleRecord = ResolvedLifecycleRecord | PreparedLifecycleRecord | RenderableLifecycleRecord;

// ── transitions (pure; invalid transitions throw — measured, not claimed) ──────────────────────

/** The initial stage every RuntimeNode starts in — mirrors what `resolveRenderTree` already
 *  establishes; this function just makes that fact an explicit, typed lifecycle record. */
export function resolveLifecycle(node: RuntimeNode): ResolvedLifecycleRecord {
  const core = { node, stage: 'resolved' as const };
  return { ...core, digest: lifecycleDigest({ nodeDigest: node.digest, stage: core.stage }) };
}

/**
 * `resolved → prepared`. Looks the node up in `registry` exactly once (the same two-tier
 * exact-type/kind-fallback policy `RendererRegistry.resolve` already defines) and records the
 * outcome — bound or not — as data. Never executes the renderer. Throws if `record` is not
 * currently `resolved` (an invalid transition).
 */
export function prepareLifecycle(record: LifecycleRecord, registry: RendererRegistry): PreparedLifecycleRecord {
  if (record.stage !== 'resolved') {
    throw new Error(
      `prepareLifecycle: invalid transition 'resolved' → 'prepared' attempted from stage '${record.stage}' — ` +
        `a node must be 'resolved' before it can be prepared.`,
    );
  }
  const renderer = registry.resolve(record.node);
  const core = {
    node: record.node,
    stage: 'prepared' as const,
    bound: renderer !== undefined,
    rendererType: record.node.type,
  };
  return {
    ...core,
    renderer,
    digest: lifecycleDigest({ nodeDigest: core.node.digest, stage: core.stage, bound: core.bound, rendererType: core.rendererType }),
  };
}

/**
 * `prepared → renderable`. Lifts the already-bound renderer (found once, during `prepareLifecycle`
 * — this function does NOT re-consult a registry) into a terminal, executable-ready record. Throws
 * if `record` is not currently `prepared`, or is `prepared` but unbound (there is nothing to
 * activate — "no renderer found" is a valid outcome of `prepareLifecycle`, but it is not a state
 * `renderable` may be fabricated from).
 */
export function activateLifecycle(record: LifecycleRecord): RenderableLifecycleRecord {
  if (record.stage !== 'prepared') {
    throw new Error(
      `activateLifecycle: invalid transition 'prepared' → 'renderable' attempted from stage '${record.stage}' — ` +
        `a node must be 'prepared' before it can become renderable.`,
    );
  }
  if (!record.bound || !record.renderer) {
    throw new Error(
      `activateLifecycle: cannot transition to 'renderable' — no renderer is bound for type '${record.rendererType}'.`,
    );
  }
  const core = { node: record.node, stage: 'renderable' as const, rendererType: record.rendererType };
  return {
    ...core,
    renderer: record.renderer,
    digest: lifecycleDigest({ nodeDigest: core.node.digest, stage: core.stage, rendererType: core.rendererType }),
  };
}

/**
 * Drives a node as far through the lifecycle as its data allows: always reaches `prepared`;
 * reaches `renderable` only when a renderer was actually bound. Never fabricates a `renderable`
 * outcome for an unbound node — the terminal state for that branch is `prepared` (`bound: false`).
 */
export function progressLifecycle(node: RuntimeNode, registry: RendererRegistry): PreparedLifecycleRecord | RenderableLifecycleRecord {
  const prepared = prepareLifecycle(resolveLifecycle(node), registry);
  return prepared.bound ? activateLifecycle(prepared) : prepared;
}

// ── the full chain: RenderTree → lifecycle-progressed tree ─────────────────────────────────────

export interface LifecycleTreeNode {
  readonly record: LifecycleRecord;
  readonly children: readonly LifecycleTreeNode[];
  readonly digest: string;
}

/**
 * Walk a RenderingContext's RenderTree, progressing every node through the lifecycle
 * (`progressLifecycle`) and mirroring the tree shape. This is "Rendering IR → Runtime resolution
 * → Lifecycle progression → Stable RenderTree" in full: pure, framework-neutral, and — since
 * `progressLifecycle` never executes a bound renderer, only records that it COULD be — produces no
 * side effects of any kind.
 */
export function resolveLifecycleTree(ctx: RenderingContext): LifecycleTreeNode {
  const walk = (node: RuntimeNode): LifecycleTreeNode => {
    const record = progressLifecycle(node, ctx.registry);
    const children = node.children.map(walk);
    const core = { record, children };
    return { ...core, digest: lifecycleDigest({ recordDigest: record.digest, childDigests: children.map((c) => c.digest) }) };
  };
  return walk(ctx.tree.root);
}
