/**
 * F4 — Project Model: the new final stage of Program F's transformation pipeline. Converts F3's
 * existing, UNMODIFIED `AdaptedTreeNode` output into a canonical, framework-independent
 * description of a generated application — the input every future project generator (Next.js,
 * Astro, Remix, static export) will consume. Never a filesystem layout, a routing framework, or a
 * UI framework.
 *
 * Ownership (see docs/fullstack/F4-PROJECT-MODEL.md §2 for the full grounding):
 *   - Belongs HERE (application-level): metadata, tokens (role names), pages, the section/slot
 *     view hierarchy, component REFERENCES (a lookup key, never an implementation), a generation
 *     manifest. All of it copied verbatim from data Runtime/Lifecycle/Framework-Adapter already
 *     resolved — nothing is computed or invented.
 *   - Stays Runtime-only, never surfaces here: LifecycleStage, registries, bound renderer/adapter
 *     FUNCTIONS (not serializable, not an application concept — the same posture
 *     `runtime-lifecycle.ts` already holds for its own `renderer` field).
 *   - Belongs only to a future generator, never modeled here: filesystem paths, concrete
 *     component implementations, routing-framework conventions, build tooling.
 *
 * Building this model requires a FULLY adapted tree (every node `kind: 'adapted'`, shaped like
 * `InspectionOutput` — F3's non-React NodeAdapter) — fails loud otherwise (project integrity: a
 * generated application with silently-missing pages is worse than an explicit failure).
 */
import type { Track } from '../paths.js';
import type { RenderingMetadata } from '../generate/rendering-ir.js';
import type { DocumentPrimitiveProps, PagePrimitiveProps } from '../runtime/offscript-runtime.js';
import type { AdaptedTreeNode, FrameworkAdapter } from '../runtime/framework-adapter.js';
import type { TransformationProject } from './transformation-loader.js';
import { runTransformationPipeline, createInspectionFrameworkAdapter, type InspectionOutput } from './transformation-pipeline.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const PROJECT_MODEL_VERSION_TAG = 'f4-project-model@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, PROJECT_MODEL_VERSION_TAG);
}

// ── Owned concepts ───────────────────────────────────────────────────────────────────────────

/** Reserved for a future RIR asset/media data source — always empty today (D1-S4 rejected
 *  fine-grained media fields for lack of a real, non-invented source; this model never fabricates
 *  one). Typed now so a future generator's contract doesn't need to change shape when it lands. */
export interface AssetReference {
  readonly role: string;
  readonly ref?: string;
}

/** One section or slot in a page's view hierarchy. `componentRef` is the SAME `RuntimeNode.type`
 *  lookup key a `NodeAdapter`/component registry already dispatches on (`section:hero`) — a
 *  reference to "whichever component implements this," never a concrete implementation. */
export interface ViewNode {
  readonly id: string;
  readonly kind: 'section' | 'slot';
  readonly componentRef: string;
  readonly props: unknown;
  readonly digest: string;
  readonly children: readonly ViewNode[];
}

export interface ProjectPage {
  readonly id: string;
  readonly role: string;
  readonly componentRef: string;
  readonly view: readonly ViewNode[];
  readonly digest: string;
}

export interface GenerationManifest {
  readonly client: string;
  readonly track: Track;
  /** The RenderingIR digest this model was derived from — traces every ProjectModel back to its source. */
  readonly sourceDigest: string;
  readonly pageCount: number;
  readonly sectionCount: number;
  readonly slotCount: number;
}

export interface ProjectModel {
  readonly metadata: RenderingMetadata;
  readonly tokens: readonly string[];
  readonly pages: readonly ProjectPage[];
  /** Every distinct component reference used anywhere in the model, deduped and sorted. */
  readonly componentRefs: readonly string[];
  readonly assets: readonly AssetReference[];
  readonly manifest: GenerationManifest;
  readonly digest: string;
}

// ── AdaptedTreeNode → ProjectModel (fails loud on anything not fully adapted) ───────────────────

function isInspectionOutput(value: unknown): value is InspectionOutput {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'kind' in value &&
    'type' in value &&
    'digest' in value &&
    'props' in value
  );
}

function inspectionOf(node: AdaptedTreeNode): InspectionOutput {
  if (node.result.kind !== 'adapted' || !isInspectionOutput(node.result.output)) {
    throw new Error(
      `buildProjectModel: node ${node.result.nodeId} (${node.result.nodeType}) is '${node.result.kind}', not a ` +
        `fully-adapted InspectionOutput node — buildProjectModel requires a tree produced by an adapter that ` +
        `covers every RuntimeNodeKind (e.g. createInspectionFrameworkAdapter()).`,
    );
  }
  return node.result.output;
}

function buildViewNode(node: AdaptedTreeNode, counts: { section: number; slot: number }): ViewNode {
  const out = inspectionOf(node);
  if (out.kind !== 'section' && out.kind !== 'slot') {
    throw new Error(`buildProjectModel: expected a section/slot node, got '${out.kind}' (${out.id}).`);
  }
  counts[out.kind]++;
  const children = node.children.map((c) => buildViewNode(c, counts));
  const core = { id: out.id, kind: out.kind, componentRef: out.type, props: out.props, children };
  return { ...core, digest: digestOf(core) };
}

function buildPage(node: AdaptedTreeNode, counts: { section: number; slot: number }): ProjectPage {
  const out = inspectionOf(node);
  if (out.kind !== 'page') throw new Error(`buildProjectModel: expected a page node, got '${out.kind}' (${out.id}).`);
  const props = out.props as PagePrimitiveProps;
  const view = node.children.map((c) => buildViewNode(c, counts));
  const core = { id: out.id, role: props.role, componentRef: out.type, view };
  return { ...core, digest: digestOf(core) };
}

function collectComponentRefs(model: { pages: readonly ProjectPage[] }, documentRef: string): string[] {
  const refs = new Set<string>([documentRef]);
  const walkView = (v: ViewNode): void => {
    refs.add(v.componentRef);
    v.children.forEach(walkView);
  };
  for (const page of model.pages) {
    refs.add(page.componentRef);
    page.view.forEach(walkView);
  }
  return [...refs].sort();
}

/**
 * Convert one fully-adapted `AdaptedTreeNode` (F3) into a `ProjectModel`. Pure — never mutates
 * `project` or `tree`. Fails loud (never silently drops a page/section/slot) if any node in the
 * tree is not `'adapted'` with `InspectionOutput`-shaped output.
 */
export function buildProjectModel(project: TransformationProject, tree: AdaptedTreeNode): ProjectModel {
  const root = inspectionOf(tree);
  if (root.kind !== 'document') throw new Error(`buildProjectModel: root node must be 'document', got '${root.kind}'.`);
  const docProps = root.props as DocumentPrimitiveProps;

  const counts = { section: 0, slot: 0 };
  const pages = tree.children.map((c) => buildPage(c, counts));

  const withoutRefs = { metadata: docProps.metadata, tokens: docProps.tokens, pages, assets: [] as AssetReference[] };
  const componentRefs = collectComponentRefs(withoutRefs, root.type);

  const manifest: GenerationManifest = {
    client: project.client,
    track: project.track,
    sourceDigest: project.rir.digest,
    pageCount: pages.length,
    sectionCount: counts.section,
    slotCount: counts.slot,
  };

  const core = { ...withoutRefs, componentRefs, manifest };
  return Object.freeze({ ...core, digest: digestOf(core) });
}

/**
 * `TransformationProject → ProjectModel` — the extension the brief asks for. Composes
 * `runTransformationPipeline` (F3, imported verbatim, never modified) with `buildProjectModel`
 * above; the existing pipeline's own behavior (Runtime resolution → Lifecycle progression →
 * Framework Adapter translation) is completely unchanged.
 */
export function runProjectModelPipeline(
  project: TransformationProject,
  adapter: FrameworkAdapter = createInspectionFrameworkAdapter(),
): ProjectModel {
  const tree = runTransformationPipeline(project, adapter);
  return buildProjectModel(project, tree);
}
