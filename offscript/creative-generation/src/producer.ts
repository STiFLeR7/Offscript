/**
 * Sprint 6 — the smallest real Creative Generation producer: turns an approved
 * CreativeIntent into a rendered visual + a CreativeArtifact record.
 *
 * Sprint 10AI — replaces the deterministic-placeholder SVG rectangle with a real renderer that
 * EXECUTES the decisions the rest of this package's real executors already made (Feature Mapping,
 * Camera Selection, Composition Camera Bias, and — new this sprint, threaded through as two more
 * optional `CreativeIntentInput` fields — Environment Selection's `environment` and Role
 * Assignment's `roles`). This module still performs NO semantic judgment of its own: it never
 * picks a camera, an environment, a role, or a component — every one of those is either already on
 * `CreativeIntentInput` or derived from it via an existing, unmodified real methodology module. See
 * "Rendering translation tables" below for the one thing this sprint DID add: small, deterministic,
 * explicitly-documented mappings from an already-made decision (e.g. `camera: 'macro'`) to a
 * concrete rendering parameter (e.g. "the composition panel covers 96% of the frame") — a
 * *rendering* choice, never a second Composition Intelligence / Camera Selection / Environment
 * Selection decision.
 *
 * Composition Intelligence (beyond the already-ported camera→density/breathing starting bias),
 * Material Library, and Color Intelligence remain OUT of scope, per this package's own README
 * boundary. Material's absence is handled by a single, explicit, neutral, shadow/glass-free
 * fallback surface (flat fill + 1px border, zero border-radius) — never a Material recipe, never
 * retired shadow/glass/radius vocabulary. Color reuses this module's own pre-existing
 * `hueForFeature` (a deterministic hash-derived hue) — the "existing governed color" already
 * available to this package — rather than reaching into any brand's own token file, preserving
 * Creative Generation's documented brand-independence (FEATURE-MAPPING.md's own "Brand / system
 * independence" section).
 *
 * The CreativeIntentInput shape below is duplicated locally rather than
 * depending on creative-intent-exporter, mirroring creative-intent-brief-
 * adapter's own documented choice (src/mapper/types.ts) to keep standalone
 * packages independent of one another.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { computeContentDigest } from 'creative-artifact-contract/src/artifact/digest.js';
import { describeLocationRejection } from 'creative-artifact-contract/src/artifact/location.js';
import type {
  CreativeArtifact,
  CreativeArtifactApproval,
} from 'creative-artifact-contract/src/artifact/types.js';
import { componentsForFeature } from './feature-mapping.js';
import { selectCamera, type Camera } from './camera-selection.js';
import { getCompositionCameraBias } from './composition-camera-bias.js';
import { isEnvironmentSlug, resolveEnvironmentAsset, type EnvironmentSlug } from './environment-library.js';
import type { RoleAssignment } from './role-assignment.js';

/** Sprint 10A — identifies the Feature Mapping methodology version consulted at render time. */
export const FEATURE_MAPPING_VERSION = 'feature-mapping-v1';

/**
 * Sprint 10B — identifies the Camera Selection methodology version consulted at render time.
 * Carried in `artifact.provenance`, not `generation.methodologyVersion` — that field is a single
 * string and already carries Feature Mapping's identity; it cannot honestly represent two
 * independent methodology versions at once without inventing a compound format. See
 * CAMERA-SELECTION-IMPLEMENTATION-REPORT.md §10.
 */
export const CAMERA_SELECTION_VERSION = 'camera-selection-v1';

/**
 * Sprint 10D — identifies the camera -> density/breathing starting-bias methodology version
 * consulted at render time. Follows the same precedent as CAMERA_SELECTION_VERSION: carried in
 * `artifact.provenance`, never folded into `generation.methodologyVersion` or a new compound
 * version string. See COMPOSITION-CAMERA-BIAS-IMPLEMENTATION-REPORT.md §6.
 */
export const COMPOSITION_CAMERA_BIAS_VERSION = 'composition-camera-bias-v1';

export interface CreativeIntentInput {
  id: string;
  digest: string;
  belief: string;
  feature: string;
  ratio: string;
  camera: string;
  mustInclude: string[];
  contentProvenance: string;
  section?: string;
  /** Sprint 10AI — the already-selected governed environment identity (Environment Selection,
   * `environment-selection.ts`, unmodified), passed through unchanged. Optional: the renderer
   * draws a documented, deterministic neutral fallback surface when absent — it never selects an
   * environment itself (Environment Selection's own job, not the renderer's). */
  environment?: EnvironmentSlug;
  /** Sprint 10AI — the already-decided Role Assignment (`role-assignment.ts`, unmodified) for this
   * creative's own Feature Mapping component list. Optional: every component renders with the
   * documented fallback treatment when absent — the renderer never invents a role assignment. */
  roles?: RoleAssignment;
}

export interface ProduceOptions {
  client: string;
  sourceSystem?: string;
  runId?: string;
  /** Injectable for deterministic tests; defaults to the real current time. */
  createdAt?: string;
  /** Overrides the artifact's own id (defaults to intent.id) — lets a second, distinct
   * artifact be produced for the SAME intent (same intentDigest), a shape the contract
   * already permits (Sprint 1). */
  artifactId?: string;
  /** Creative Authoring Layer seam — injectable HTML source, defaulting to the deterministic
   * placeholder `renderCreativeVisual`. Lets a caller (the rethink loop, when given a real
   * `CreativeAuthoringExecutor`) substitute an already-authored, already-validated composition
   * without duplicating this function's own artifact-assembly logic (digest, location, approval,
   * provenance — all unchanged either way). */
  render?: (intent: CreativeIntentInput) => string;
  /** Overrides `generation.generatorVersion`, defaulting to `'v1-deterministic-placeholder'`.
   * Never invented independently of `render` above — a caller substituting the render source is
   * expected to also state which generator actually produced it. */
  generatorVersion?: string;
}

const RATIO_DIMENSIONS: Record<string, [number, number]> = {
  '1:1': [480, 480],
  '4:3': [480, 360],
  '3:4': [360, 480],
  '16:9': [640, 360],
};

/** The single authoritative ratio->pixel source for this package (Target Ratio / Canvas Geometry
 * sprint) — the same table `renderCreativeVisual` has always used, now exported so the Creative
 * Authoring Layer (`creative-authoring.ts`) can reuse it rather than inventing a second ratio
 * vocabulary. `RATIO_DIMENSIONS` itself stays private; this is the one sanctioned read path. */
export function dimensionsForRatio(ratio: string): readonly [number, number] {
  return RATIO_DIMENSIONS[ratio] ?? [480, 360];
}

function hueForFeature(feature: string): number {
  return createHash('sha256').update(feature).digest()[0] % 360;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Component rendering (Phase 3) — every Feature Mapping component, deterministically ───

type ComponentKind = 'sequence' | 'status' | 'log' | 'panel' | 'control';

/**
 * A closed, per-component table covering every one of FEATURE-MAPPING.md's 31 documented
 * components across all seven features — deterministic, never a fuzzy keyword match. A component
 * outside this table fails closed (`componentRenderKind` throws) rather than silently rendering a
 * generic box: FEATURE-MAPPING.md is the sole source of truth for the vocabulary, so an unknown
 * component here means either a governance-doc edit this table hasn't caught up with, or a caller
 * bypassing Feature Mapping — both real problems, never something to paper over silently.
 */
const COMPONENT_KIND: Readonly<Record<string, ComponentKind>> = {
  // automation
  'workflow builder': 'sequence',
  'execution status': 'status',
  'automation timeline': 'sequence',
  'success notification': 'status',
  // search
  'search bar': 'control',
  results: 'log',
  filters: 'control',
  suggestions: 'log',
  // analytics
  charts: 'panel',
  'KPI cards': 'panel',
  'trend lines': 'log',
  comparisons: 'log',
  // security
  permissions: 'control',
  'audit logs': 'log',
  'verification status': 'status',
  alerts: 'status',
  // collaboration
  comments: 'log',
  assignments: 'sequence',
  mentions: 'status',
  'activity feed': 'log',
  presence: 'status',
  // ai-intelligence
  'insight card': 'panel',
  'recommendation panel': 'panel',
  'AI summary': 'panel',
  'confidence score': 'status',
  'suggested actions': 'sequence',
  // configuration
  'settings panel': 'panel',
  'toggle / segmented control': 'control',
  'form fields': 'control',
  'scope selector': 'control',
  'a preview of the effect': 'panel',
};

/** Resolves a Feature Mapping component to its render kind. Fails closed (throws) for anything
 * outside the closed table above — never silently drops or generically renders an unknown
 * component (Phase 3's own "if a component cannot be rendered safely: fail closed" rule). */
export function componentRenderKind(component: string): ComponentKind {
  const kind = COMPONENT_KIND[component];
  if (!kind) {
    throw new Error(
      `creative-generation producer: unrenderable component "${component}" — not in the documented ` +
        `FEATURE-MAPPING.md vocabulary this renderer's COMPONENT_KIND table covers.`,
    );
  }
  return kind;
}

/** Per-kind fill/stroke lightness (same hue throughout — one creative, one identity) — a rendering
 * translation, not a Color Intelligence decision (Phase 10: no capability→accent logic invented). */
const KIND_STYLE: Readonly<Record<ComponentKind, { fillL: number; strokeL: number }>> = {
  panel: { fillL: 92, strokeL: 35 },
  sequence: { fillL: 88, strokeL: 40 },
  status: { fillL: 90, strokeL: 45 },
  log: { fillL: 94, strokeL: 30 },
  control: { fillL: 86, strokeL: 38 },
};

/** Renders the kind-specific inner glyph inside a component's already-positioned (x,y,w,h) box —
 * the "workflow-style region" / "status/progress region" / "evidence-log region" Phase 3 asks for,
 * expressed as real (not debug-attribute-only) SVG shapes. Deterministic, no randomness. */
function renderKindGlyph(kind: ComponentKind, x: number, y: number, w: number, h: number, hue: number): string {
  const stroke = `hsl(${hue},40%,30%)`;
  switch (kind) {
    case 'sequence': {
      const n = 3;
      const gap = w / (n + 1);
      const cy = y + h * 0.55;
      let dots = '';
      for (let i = 0; i < n; i++) {
        const cx = x + gap * (i + 1);
        dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(h * 0.08).toFixed(1)}" fill="${stroke}"/>`;
      }
      return `<line x1="${(x + gap).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(x + gap * n).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${stroke}" stroke-width="1.5"/>${dots}`;
    }
    case 'status': {
      const r = h * 0.1;
      return `<circle cx="${(x + w * 0.12).toFixed(1)}" cy="${(y + h * 0.3).toFixed(1)}" r="${r.toFixed(1)}" fill="${stroke}"/>`;
    }
    case 'log': {
      const rowH = h * 0.14;
      let rows = '';
      for (let i = 0; i < 3; i++) {
        const ry = y + h * 0.35 + i * (rowH + 4);
        const rw = w * (0.7 - i * 0.15);
        rows += `<rect x="${(x + w * 0.1).toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${(rowH * 0.4).toFixed(1)}" fill="${stroke}"/>`;
      }
      return rows;
    }
    case 'panel': {
      const headerH = h * 0.22;
      return (
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${headerH.toFixed(1)}" fill="${stroke}"/>` +
        `<rect x="${(x + w * 0.1).toFixed(1)}" y="${(y + headerH + 8).toFixed(1)}" width="${(w * 0.7).toFixed(1)}" height="${(h * 0.08).toFixed(1)}" fill="${stroke}" opacity="0.6"/>`
      );
    }
    case 'control': {
      const trackW = w * 0.4;
      const trackH = h * 0.14;
      const tx = x + w * 0.1;
      const ty = y + h * 0.35;
      return (
        `<rect x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" width="${trackW.toFixed(1)}" height="${trackH.toFixed(1)}" fill="${stroke}" opacity="0.4"/>` +
        `<circle cx="${(tx + trackW * 0.75).toFixed(1)}" cy="${(ty + trackH / 2).toFixed(1)}" r="${(trackH * 0.8).toFixed(1)}" fill="${stroke}"/>`
      );
    }
  }
}

// ─── Role hierarchy rendering (Phase 4) ───

type RoleBucket = 'hero' | 'support' | 'signal' | 'subordinateContext' | 'unassigned' | 'fallback';

/** Prominence multiplier applied to a component's rendered box size — position/grouping are
 * expressed by the flow-pack order below (hero placed first), size by this table, and
 * subordinate/unassigned prominence additionally by opacity and stroke (see ROLE_STYLE). A
 * component with no role assignment at all (`roles` absent) uses 'fallback' — the documented,
 * uniform, no-hierarchy treatment Phase 4 requires. */
const ROLE_SIZE_MULTIPLIER: Readonly<Record<RoleBucket, number>> = {
  hero: 1.8,
  support: 1.2,
  signal: 0.8,
  subordinateContext: 0.65,
  unassigned: 0.55,
  fallback: 1,
};

const ROLE_STYLE: Readonly<Record<RoleBucket, { opacity: number; strokeWidth: number; dashed: boolean }>> = {
  hero: { opacity: 1, strokeWidth: 3, dashed: false },
  support: { opacity: 1, strokeWidth: 2, dashed: false },
  signal: { opacity: 1, strokeWidth: 1.5, dashed: false },
  subordinateContext: { opacity: 0.75, strokeWidth: 1, dashed: false },
  unassigned: { opacity: 0.55, strokeWidth: 1, dashed: true },
  fallback: { opacity: 1, strokeWidth: 1.5, dashed: false },
};

/** Orders `components` by role prominence (hero first, then support/signal/subordinateContext in
 * given order, then unassigned) when `roles` is given; preserves Feature Mapping's own documented
 * order, unmodified, when it is absent (the fallback case — no reordering invented). Never drops a
 * component; fails closed if `roles` references a component outside `components` (a caller/feature
 * mismatch, not a legitimate "cut it" case — those are validated upstream by
 * `validateRoleAssignment` and arrive here already consistent). */
function orderByRole(components: readonly string[], roles: RoleAssignment | undefined): { component: string; role: RoleBucket }[] {
  if (!roles) return components.map((component) => ({ component, role: 'fallback' as const }));

  const bucketOf = new Map<string, RoleBucket>();
  bucketOf.set(roles.hero, 'hero');
  for (const c of roles.support) bucketOf.set(c, 'support');
  for (const c of roles.signal) bucketOf.set(c, 'signal');
  for (const c of roles.subordinateContext) bucketOf.set(c, 'subordinateContext');
  for (const c of roles.unassigned) bucketOf.set(c, 'unassigned');

  const componentSet = new Set(components);
  for (const named of bucketOf.keys()) {
    if (!componentSet.has(named)) {
      throw new Error(
        `creative-generation producer: role assignment names "${named}", which is not one of this ` +
          `creative's own Feature Mapping components — roles must be validated against the same ` +
          `component list they render over.`,
      );
    }
  }

  const order: RoleBucket[] = ['hero', 'support', 'signal', 'subordinateContext', 'unassigned'];
  const byBucket = new Map<RoleBucket, string[]>(order.map((r) => [r, []]));
  for (const component of components) {
    const role = bucketOf.get(component);
    if (!role) {
      throw new Error(
        `creative-generation producer: component "${component}" is not accounted for in the given ` +
          `role assignment — every component must resolve to a real role bucket.`,
      );
    }
    byBucket.get(role)!.push(component);
  }
  return order.flatMap((role) => byBucket.get(role)!.map((component) => ({ component, role })));
}

// ─── Camera framing (Phase 5) — rendering translation, source: CAMERA-SELECTION.md's own meaning
// table ("high environment visibility" for `establishing` vs. "maximum clarity, minimum surface"
// for `macro`). This is the fraction of the frame the composition panel covers — never a new
// camera decision, only how the already-selected camera value is drawn. ───
const PANEL_COVERAGE: Readonly<Record<Camera, number>> = {
  establishing: 0.46,
  product: 0.66,
  workflow: 0.78,
  component: 0.88,
  macro: 0.96,
};
const DEFAULT_PANEL_COVERAGE = 0.75; // engineering fallback for an unresolved camera, not a sourced value

// ─── Density / breathing realization (Phase 6) — rendering translation of
// COMPOSITION-CAMERA-BIAS.md's own five-row starting-bias table into concrete layout parameters.
// Density drives how many components fit side by side (columns → block compactness); breathing
// drives the whitespace around and between them (outer margin + inter-block gap) — a deliberate,
// documented split of the two source-distinct bands into two distinct rendering effects, never a
// single collapsed number. Source values are preserved verbatim as data attributes elsewhere; this
// table only decides how those already-chosen bands affect pixel layout. ───
interface DensityLayout {
  readonly columns: number;
}
const DENSITY_LAYOUT: Readonly<Record<string, DensityLayout>> = {
  minimal: { columns: 1 },
  'minimal–moderate': { columns: 2 },
  moderate: { columns: 2 },
  'moderate–populated': { columns: 3 },
};
const DEFAULT_DENSITY_LAYOUT: DensityLayout = { columns: 2 };

interface BreathingLayout {
  readonly margin: number;
  readonly gap: number;
}
const BREATHING_LAYOUT: Readonly<Record<string, BreathingLayout>> = {
  generous: { margin: 40, gap: 28 },
  standard: { margin: 24, gap: 16 },
};
const DEFAULT_BREATHING_LAYOUT: BreathingLayout = { margin: 24, gap: 16 };

interface PlacedComponent {
  readonly component: string;
  readonly role: RoleBucket;
  readonly kind: ComponentKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The simple, deterministic flow-pack: places each ordered component left-to-right, wrapping to a
 * new row inside the panel, sized by its role multiplier and spaced by the density/breathing
 * translation above. Not a CSS grid emulation — a small, real, auditable packing algorithm. */
function packComponents(
  ordered: { component: string; role: RoleBucket }[],
  panel: { x: number; y: number; w: number; h: number },
  density: DensityLayout,
  breathing: BreathingLayout,
): PlacedComponent[] {
  const clampedMargin = Math.min(breathing.margin, panel.w * 0.12, panel.h * 0.12);
  const baseCell = (panel.w - clampedMargin * 2) / density.columns;
  const gap = breathing.gap;
  const maxX = panel.x + panel.w - clampedMargin;

  let cursorX = panel.x + clampedMargin;
  let cursorY = panel.y + clampedMargin;
  let rowHeight = 0;
  const placed: PlacedComponent[] = [];

  for (const { component, role } of ordered) {
    const w = Math.max(24, baseCell * ROLE_SIZE_MULTIPLIER[role] - gap);
    const h = w * 0.62;
    if (cursorX + w > maxX && cursorX > panel.x + clampedMargin) {
      cursorX = panel.x + clampedMargin;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }
    placed.push({ component, role, kind: componentRenderKind(component), x: cursorX, y: cursorY, w, h });
    cursorX += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }
  return placed;
}

/**
 * Renders a self-contained HTML "visual" for one Creative Intent — deterministic (same intent ->
 * same bytes), and, as of Sprint 10AI, a REAL composition expressing the decisions already made
 * upstream: Feature Mapping's components (as distinct, kind-specific shapes), Camera Selection's
 * framing (the composition panel's size), Composition Camera Bias's density/breathing (the panel's
 * internal grid), Role Assignment's hierarchy (component size/position/grouping), and Environment
 * Selection's chosen photo (a real embedded image, structurally separable from the composition
 * layer so "what happens when the environment is removed" — Q6's own test — stays answerable by
 * inspecting `.cr-composition-layer` alone). This module still performs no semantic judgment of its
 * own — see the module header for the full boundary.
 */
export function renderCreativeVisual(intent: CreativeIntentInput): string {
  const [w, h] = dimensionsForRatio(intent.ratio);
  const hue = hueForFeature(intent.feature);
  const components = componentsForFeature(intent.feature);
  const camera = selectCamera(intent);
  const compositionBias = getCompositionCameraBias(camera.selected ?? intent.camera);

  // ── Environment layer (Phase 7/8/9) — real embedded photo, or an explicit neutral fallback. ──
  let environmentLayer: string;
  let environmentSlug = 'none';
  if (intent.environment !== undefined) {
    if (!isEnvironmentSlug(intent.environment)) {
      throw new Error(`creative-generation producer: unrecognized environment "${intent.environment}" — not one of the seven governed EnvironmentSlug values.`);
    }
    const assetPath = resolveEnvironmentAsset(intent.environment);
    if (!assetPath || !existsSync(assetPath)) {
      throw new Error(`creative-generation producer: environment "${intent.environment}" has no real asset on disk at the resolved path.`);
    }
    const jpegBase64 = readFileSync(assetPath).toString('base64');
    environmentSlug = intent.environment;
    environmentLayer = `<image x="0" y="0" width="${w}" height="${h}" href="data:image/jpeg;base64,${jpegBase64}" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    // Material Boundary (Phase 9): a flat, neutral, shadow/glass-free fallback fill — never a
    // Material Library recipe, never retired shadow/glass/radius vocabulary, zero border-radius.
    environmentLayer = `<rect x="0" y="0" width="${w}" height="${h}" fill="hsl(${hue},20%,93%)"/>`;
  }

  // ── Composition panel (Phase 5) — camera-driven framing. ──
  const coverage = camera.selected ? PANEL_COVERAGE[camera.selected] : DEFAULT_PANEL_COVERAGE;
  const panelW = w * coverage;
  const panelH = h * coverage;
  const panelX = (w - panelW) / 2;
  const panelY = (h - panelH) / 2;
  const panel = { x: panelX, y: panelY, w: panelW, h: panelH };

  // ── Density / breathing (Phase 6). ──
  const density = compositionBias ? DENSITY_LAYOUT[compositionBias.density] ?? DEFAULT_DENSITY_LAYOUT : DEFAULT_DENSITY_LAYOUT;
  const breathing = compositionBias ? BREATHING_LAYOUT[compositionBias.breathing] ?? DEFAULT_BREATHING_LAYOUT : DEFAULT_BREATHING_LAYOUT;

  // ── Role ordering + packing (Phase 4). ──
  const ordered = orderByRole(components, intent.roles);
  const placed = packComponents(ordered, panel, density, breathing);

  const panelRect =
    `<rect class="cr-composition-panel" x="${panel.x.toFixed(1)}" y="${panel.y.toFixed(1)}" ` +
    `width="${panel.w.toFixed(1)}" height="${panel.h.toFixed(1)}" fill="hsl(${hue},45%,97%)" ` +
    `stroke="hsl(${hue},30%,25%)" stroke-width="1" data-breathing-gap="${breathing.gap}" ` +
    `data-density-columns="${density.columns}"/>`;

  const componentEls = placed
    .map(({ component, role, kind, x, y, w: cw, h: ch }) => {
      const style = KIND_STYLE[kind];
      const roleStyle = ROLE_STYLE[role];
      const dash = roleStyle.dashed ? ` stroke-dasharray="4 3"` : '';
      const rect =
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="0" ` +
        `fill="hsl(${hue},50%,${style.fillL}%)" stroke="hsl(${hue},40%,${style.strokeL}%)" ` +
        `stroke-width="${roleStyle.strokeWidth}" opacity="${roleStyle.opacity}"${dash}/>`;
      const glyph = renderKindGlyph(kind, x, y, cw, ch, hue);
      const label = `<text x="${(x + 4).toFixed(1)}" y="${(y + ch - 6).toFixed(1)}" font-size="9" fill="hsl(${hue},40%,20%)" font-family="sans-serif">${escapeXml(component)}</text>`;
      return (
        `<g class="cr-component" data-component="${escapeXml(component)}" data-role="${role}" data-kind="${kind}">` +
        `${rect}${glyph}${label}</g>`
      );
    })
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<title>${escapeXml(intent.id)}</title><desc>${escapeXml([intent.belief, ...intent.mustInclude].join(' | '))}</desc>` +
    `<g class="cr-environment-layer" data-environment-slug="${escapeXml(environmentSlug)}">${environmentLayer}</g>` +
    `<g class="cr-composition-layer" data-role-source="${intent.roles ? 'assigned' : 'fallback'}">${panelRect}${componentEls}</g></svg>`;
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

  // Sprint 10A — the Feature Mapping component list, in plain (non-base64) HTML so it stays
  // transparent/greppable for validation, distinct from the SVG's own opaque encoded content.
  const componentsAttr = components.length
    ? ` data-feature-components="${escapeXml(components.join(' | '))}"`
    : '';
  // Sprint 10B — the Camera Selection decision trace, exposed the same way: transparent,
  // greppable HTML attributes, never added to the CreativeArtifact schema (see Phase 7 boundary).
  const cameraTraceAttr =
    ` data-camera-declared="${escapeXml(String(camera.declared))}"` +
    ` data-camera-section-bias="${escapeXml(camera.sectionBias.join(' | '))}"` +
    ` data-camera-bias-match="${escapeXml(String(camera.matchesSectionBias))}"`;
  // Sprint 10D — the camera -> density/breathing STARTING bias, exposed the same transparent way.
  // Never a final density/breathing decision (see COMPOSITION-CAMERA-BIAS.md's "Deferred" section).
  const compositionBiasAttr = compositionBias
    ? ` data-composition-camera-density-bias="${escapeXml(compositionBias.density)}"` +
      ` data-composition-camera-breathing-bias="${escapeXml(compositionBias.breathing)}"`
    : '';
  // Sprint 10AI — environment + role-source traces, the same transparent convention.
  const environmentAttr = ` data-environment-slug="${escapeXml(environmentSlug)}"`;
  const roleSourceAttr = ` data-role-source="${intent.roles ? 'assigned' : 'fallback'}"`;
  return (
    `<!doctype html>\n<html><head><meta charset="utf-8"><title>${escapeXml(intent.id)}</title></head>\n` +
    `<body>\n<!-- creative-generation v2 real renderer: intent=${escapeXml(intent.id)} -->\n` +
    `<img id="cr-artifact-visual" src="${dataUri}" alt="${escapeXml(intent.belief)}" ` +
    `data-camera="${escapeXml(intent.camera)}" data-ratio="${escapeXml(intent.ratio)}"` +
    `${componentsAttr}${cameraTraceAttr}${compositionBiasAttr}${environmentAttr}${roleSourceAttr}>\n</body></html>\n`
  );
}

/** Builds a real, schema-valid CreativeArtifact for `intent`. Approval defaults to
 * 'pending' — a freshly rendered visual is never auto-approved; see approveArtifact. */
export function produceCreativeArtifact(
  intent: CreativeIntentInput,
  opts: ProduceOptions,
): { artifact: CreativeArtifact; html: string } {
  const html = (opts.render ?? renderCreativeVisual)(intent);
  const artifactId = opts.artifactId ?? intent.id;
  const location = `projects/${opts.client}/creative-assets/${artifactId}/visual.html`;
  const rejection = describeLocationRejection(location);
  if (rejection) throw new Error(`creative-generation producer: ${rejection}`);

  const artifact: CreativeArtifact = {
    contractVersion: 1,
    id: artifactId,
    intentDigest: intent.digest,
    artifactType: 'html',
    location,
    artifactDigest: computeContentDigest(html),
    createdAt: opts.createdAt ?? new Date().toISOString(),
    generation: {
      sourceSystem: opts.sourceSystem ?? 'creative-generation',
      ...(opts.runId ? { runId: opts.runId } : {}),
      generatorVersion: opts.generatorVersion ?? 'v1-deterministic-placeholder',
      methodologyVersion: FEATURE_MAPPING_VERSION,
    },
    approval: { status: 'pending', source: opts.sourceSystem ?? 'creative-generation' },
    provenance: {
      cameraSelectionMethodologyVersion: CAMERA_SELECTION_VERSION,
      compositionCameraBiasMethodologyVersion: COMPOSITION_CAMERA_BIAS_VERSION,
    },
  };
  return { artifact, html };
}

/** Pure: returns a NEW artifact record with approval flipped to 'approved'. Never mutates `artifact`. */
export function approveArtifact(
  artifact: CreativeArtifact,
  source: string,
  evidence?: string,
): CreativeArtifact {
  const approval: CreativeArtifactApproval = { status: 'approved', source, ...(evidence ? { evidence } : {}) };
  return { ...artifact, approval };
}
