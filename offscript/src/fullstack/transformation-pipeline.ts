/**
 * F3 — First Transformation Pipeline: the minimum orchestration connecting the existing,
 * UNMODIFIED Runtime (D3-S1) / Lifecycle (D3-S2) / Framework Adapter (D3-S3) contract into one
 * deterministic call, driven by a Transformation Loader (F2) `TransformationProject`.
 *
 *   TransformationProject.rir
 *     → resolveRenderTree (inside createRuntimeProvider, D3-S1 — fails loud, reused)
 *     → resolveLifecycleTree (D3-S2 — reused)
 *     → adaptLifecycleTree (D3-S3 — reused)
 *     → AdaptedTreeNode (framework-neutral)
 *
 * No subsystem's own logic is reimplemented — every step below is a single call into an
 * already-tested export. `runTransformationPipeline` itself is the only new orchestration code.
 *
 * The dual-registration seam F1-S1 §7.1 flagged — Runtime's own `RendererRegistry` needs an
 * "existence" entry per type, the Framework's `AdapterRegistry` needs a real `NodeAdapter` per
 * type, for the SAME type keys, or a `renderable` node resolves to `unsupported` — is resolved
 * here WITHOUT a second hand-maintained list: the Runtime-level registrations are DERIVED from
 * the `FrameworkAdapter`'s own `capabilities.declaredTypes` (a live introspection primitive D3-S3
 * already built for exactly this purpose, never previously exercised). One source of truth.
 */
import { createRendererRegistry, createRuntimeProvider, type RuntimeNode, type RendererFn } from '../runtime/offscript-runtime.js';
import { resolveLifecycleTree } from '../runtime/runtime-lifecycle.js';
import {
  createAdapterRegistry,
  createFrameworkAdapter,
  adaptLifecycleTree,
  type AdapterRegistry,
  type FrameworkAdapter,
  type NodeAdapter,
  type AdaptedTreeNode,
} from '../runtime/framework-adapter.js';
import type { TransformationProject } from './transformation-loader.js';

// ── The first concrete NodeAdapter — deliberately NOT React. A pure, deterministic echo of
// exactly what a RuntimeNode already carries; invents no UI concept. ───────────────────────────

export interface InspectionOutput {
  readonly id: string;
  readonly kind: RuntimeNode['kind'];
  readonly type: string;
  readonly digest: string;
  readonly props: RuntimeNode['props'];
}

/**
 * Lifecycle stage is deliberately NOT repeated inside this output — `AdapterResult.lifecycleStage`
 * (`framework-adapter.ts`) already carries it one level up; duplicating it here would be exactly
 * the kind of hand-duplication this module otherwise avoids.
 */
export const inspectionNodeAdapter: NodeAdapter<InspectionOutput> = (node) => ({
  id: node.id,
  kind: node.kind,
  type: node.type,
  digest: node.digest,
  props: node.props,
});

/** The closed RuntimeNodeKind vocabulary (`offscript-runtime.ts`) — bare-kind registration only,
 *  the same two-tier fallback policy D3-S1 §5/§6 already proved sufficient on real production
 *  data (no per-archetype entry needed). */
const INSPECTABLE_KINDS = ['document', 'page', 'section', 'slot'] as const;

export function createInspectionAdapterRegistry(): AdapterRegistry {
  const registry = createAdapterRegistry();
  for (const kind of INSPECTABLE_KINDS) registry.register(kind, inspectionNodeAdapter);
  return registry;
}

export function createInspectionFrameworkAdapter(name = 'inspection'): FrameworkAdapter {
  return createFrameworkAdapter(name, createInspectionAdapterRegistry());
}

/**
 * Runtime-registry existence binding. Never actually executed: `prepareLifecycle` only checks a
 * bound function is present (`bound: renderer !== undefined`); `activateLifecycle` carries the
 * reference forward without calling it; `FrameworkAdapter.adapt` re-resolves its OWN
 * `AdapterRegistry` and never touches `LifecycleRecord.renderer` either. Its body is intentionally
 * inert — a presence marker, not a renderer.
 */
const EXISTENCE_ONLY_RENDERER: RendererFn = () => undefined;

// ── Orchestration — the minimum glue; consume TransformationProject, resolve Runtime, progress
// Lifecycle, invoke the Framework Adapter, return one deterministic result. ─────────────────────

export function runTransformationPipeline(
  project: TransformationProject,
  adapter: FrameworkAdapter = createInspectionFrameworkAdapter(),
): AdaptedTreeNode {
  const rendererRegistry = createRendererRegistry();
  for (const type of adapter.capabilities.declaredTypes) {
    rendererRegistry.register(type, EXISTENCE_ONLY_RENDERER);
  }
  // resolveRenderTree runs inside createRuntimeProvider (D3-S1) and fails loud via the reused
  // validateRenderingIR (rendering-ir.ts) — no validation logic is duplicated in this module.
  const runtimeContext = createRuntimeProvider(project.rir, rendererRegistry);
  const lifecycleTree = resolveLifecycleTree(runtimeContext);
  return adaptLifecycleTree(lifecycleTree, adapter);
}
