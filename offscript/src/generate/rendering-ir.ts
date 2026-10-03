/**
 * D1-S2 — Rendering IR Builder (DERIVE ONLY; Phase 0 of RENDERING_IR_ARCHITECTURE.md).
 *
 * Derives a rendering-neutral Rendering IR from the existing semantic model (AuthoringPlan /
 * PlanItem). This is a PURE, DETERMINISTIC translation layer:
 *
 *   - Generation is UNCHANGED. The planner still produces AuthoringPlan exactly as today; nothing in
 *     the generate pipeline imports or consumes this module, so `index.html` stays byte-identical
 *     (δ=0, the proven W-transport landing shape — cf. presentation-intent.ts).
 *   - The builder OWNS the translation. It reads only the semantic Plan fields; it NEVER inspects HTML
 *     fragments, CSS, or React (this module imports no fs, no reconstruct-band/website-shell/-assembly,
 *     no catalog).
 *   - The one presentational leak — `PlanItem.fragmentId` (the on-disk exemplar slug) — and its
 *     curation trail (`candidates`, `reason`, `sectionGuidance`, `componentKnowledge`) are EXCLUDED.
 *     The rendering-neutral realization identity that IS carried is `componentVariant` (a family name,
 *     not a file) and `surfaceRole` (a closed enum).
 *   - Content-addressed digests make the IR replayable and diffable; a measured validator enforces
 *     version, structural enums, id uniqueness, rendering-neutrality, and digest integrity.
 *
 * See docs/offscript/RENDERING_IR_ARCHITECTURE.md (§5 schema, §6 lifecycle, §7 validation) and
 * docs/offscript/D1-S2-RIR-BUILDER.md (this sprint's report).
 */
import type { Track } from '../paths.js';
import type { AuthoringPlan, PlanItem } from './types.js';
import type { Brief } from './brief.js';
import { canonicalizeStructural, versionedStructuralDigest } from '../canonical-digest.js';

/** Contract major version. Additive optional fields do NOT bump this; breaking changes do — same
 *  policy as SUPPORTED_BRIEF_VERSIONS (brief.ts). Participates in every digest identity. */
export const RIR_VERSION = 1;
export const SUPPORTED_IR_VERSIONS: ReadonlySet<number> = new Set([1]);
/** Version tag mixed into digests so a schema change re-keys content addresses (cf. presentation-intent). */
export const RENDERING_IR_VERSION_TAG = 'd1-rendering-ir@1';

// ── Types (RenderingIR / RenderingPage / RenderingSection / RenderingSlot) ──────

/** The chosen surface role — a closed, rendering-neutral enum (from PlanItem.surfaceRole). */
export type RenderingSurface = 'base' | 'rest' | 'contrast' | 'figure';
const SURFACES: ReadonlySet<string> = new Set<RenderingSurface>(['base', 'rest', 'contrast', 'figure']);

/** Governed visual medium (from PresentationIntent.intentClass). */
export type RenderingMedium = 'none' | 'chart' | 'diagram' | 'spatial';
const MEDIA: ReadonlySet<string> = new Set<RenderingMedium>(['none', 'chart', 'diagram', 'spatial']);

/** Visual commitment (from PresentationIntent.commitment). */
export type RenderingCommitment = 'none' | 'inline' | 'dominant';
const COMMITMENTS: ReadonlySet<string> = new Set<RenderingCommitment>(['none', 'inline', 'dominant']);

/**
 * Slot kind. Phase 0 can only derive the undifferentiated content blob PlanItem carries, so the sole
 * kind is `prose`. Fine-grained slots (heading / action / media) live inside the HTML fragment, which
 * the builder must not inspect — see D1-S2-RIR-BUILDER.md §Mapping "cannot currently be represented".
 */
export type RenderingSlotKind = 'prose';

export interface RenderingSlot {
  readonly name: string;
  readonly kind: RenderingSlotKind;
  readonly content: string;
}

/** The WHY — audit/traceability, never rendered (from SectionReasoning). */
export interface RenderingReasoning {
  readonly role?: string;
  readonly selectionRationale?: string;
  readonly orderingRationale?: string;
  readonly transition?: string;
  readonly relationships?: string;
  readonly communicationObjective?: string;
}

/** Realization identity — the rendering-neutral component family + surface, NOT the HTML fragment. */
export interface RenderingComposition {
  readonly variant?: string;
  readonly surface?: RenderingSurface;
}

export interface RenderingPresentation {
  readonly medium: RenderingMedium;
  readonly commitment: RenderingCommitment;
}

export interface RenderingSection {
  readonly id: string;
  readonly role: string;
  readonly order: number;
  readonly intent: string;
  readonly landmark?: string;
  readonly composition?: RenderingComposition;
  readonly presentation?: RenderingPresentation;
  readonly reasoning?: RenderingReasoning;
  readonly slots: readonly RenderingSlot[];
  /** sha256 content-address of this section (computed over every field except `digest`). */
  readonly digest: string;
}

export interface RenderingPage {
  readonly id: string;
  readonly role: string;
  readonly sections: readonly RenderingSection[];
}

/**
 * D1-S4 — a project's declared SEO/social/PWA identity (mirrors `SiteMetadata`,
 * site-metadata.ts:22-44, without importing it — the builder stays self-contained and does zero
 * I/O; a caller that already loaded `site-metadata.json` passes the parsed object in, exactly the
 * same pattern `brief` already uses). Every field is a reference/intent value (a URL, a color, a
 * locale code, an org name) — never markup; `validateRenderingIR`'s neutrality scan still guards
 * every one of them.
 */
export interface RenderingSiteMetadataInput {
  readonly title?: string;
  readonly description?: string;
  readonly siteName?: string;
  readonly locale?: string;
  readonly canonicalUrl?: string;
  readonly robots?: string;
  readonly themeColor?: string;
  readonly ogType?: string;
  readonly ogImage?: string;
  readonly twitterCard?: string;
  readonly twitterSite?: string;
  readonly favicon?: string;
  readonly appleTouchIcon?: string;
  readonly manifest?: string;
  readonly organization?: {
    readonly name?: string;
    readonly url?: string;
    readonly logo?: string;
    readonly sameAs?: readonly string[];
  };
}

export interface RenderingMetadata {
  readonly title?: string;
  readonly description?: string;
  readonly siteName?: string;
  /** D1-S4 — brief.tone (already flows to every AuthoringRequest; authoring-seam.ts:48-49). */
  readonly tone?: string;
  readonly locale?: string;
  readonly canonicalUrl?: string;
  readonly robots?: string;
  readonly themeColor?: string;
  readonly ogType?: string;
  readonly ogImage?: string;
  readonly twitterCard?: string;
  readonly twitterSite?: string;
  readonly favicon?: string;
  readonly appleTouchIcon?: string;
  readonly manifest?: string;
  readonly organization?: {
    readonly name?: string;
    readonly url?: string;
    readonly logo?: string;
    readonly sameAs?: readonly string[];
  };
}

export interface RenderingDocument {
  readonly metadata: RenderingMetadata;
  /** Referenced token ROLE names (values are the renderer's theme), deduped + sorted. */
  readonly tokens: readonly string[];
  readonly pages: readonly RenderingPage[];
}

export interface RenderingIR {
  readonly irVersion: number;
  readonly track: Track;
  readonly document: RenderingDocument;
  /** sha256 content-address of the whole IR (computed over every field except `digest`). */
  readonly digest: string;
}

// ── Canonicalization + digest (deterministic, content-addressed) ────────────────
// Shared with every sibling program (Review, Execution, Fullstack, Runtime) via
// canonical-digest.ts — see that module's header for the full equivalence proof.

/** Digest a node with its own `digest` field stripped: sha256(TAG + '\n' + JSON.stringify(canonicalizeStructural(node))). */
function digestOf(nodeWithoutDigest: unknown): string {
  return versionedStructuralDigest(nodeWithoutDigest, RENDERING_IR_VERSION_TAG);
}

// ── Builder ─────────────────────────────────────────────────────────────────

/** Section id = the track-neutral governance reference when set, else the declared anchor id. */
function sectionId(item: PlanItem): string {
  return item.governanceReferenceId ?? item.anchor.id;
}

/** Build the realization identity — variant (family name) + surface — or undefined when neither exists. */
function compositionOf(item: PlanItem): RenderingComposition | undefined {
  const variant = item.componentVariant?.trim() || undefined;
  const surface = item.surfaceRole && SURFACES.has(item.surfaceRole) ? (item.surfaceRole as RenderingSurface) : undefined;
  if (!variant && !surface) return undefined;
  return { ...(variant ? { variant } : {}), ...(surface ? { surface } : {}) };
}

function presentationOf(item: PlanItem): RenderingPresentation | undefined {
  const pi = item.presentationIntent;
  if (!pi) return undefined;
  return { medium: pi.intentClass, commitment: pi.commitment };
}

function reasoningOf(item: PlanItem): RenderingReasoning | undefined {
  const r = item.reasoning;
  if (!r) return undefined;
  const out: RenderingReasoning = {
    ...(r.role ? { role: r.role } : {}),
    ...(r.selectionRationale ? { selectionRationale: r.selectionRationale } : {}),
    ...(r.orderingRationale ? { orderingRationale: r.orderingRationale } : {}),
    ...(r.transition ? { transition: r.transition } : {}),
    ...(r.relationships ? { relationships: r.relationships } : {}),
    ...(r.communicationObjective ? { communicationObjective: r.communicationObjective } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Phase 0: the only derivable slot is the section's own content blob (absent → no slots). */
function slotsOf(item: PlanItem): RenderingSlot[] {
  const content = item.content?.trim();
  return content ? [{ name: 'content', kind: 'prose', content: item.content as string }] : [];
}

function toSection(item: PlanItem, order: number): RenderingSection {
  const composition = compositionOf(item);
  const presentation = presentationOf(item);
  const reasoning = reasoningOf(item);
  const core = {
    id: sectionId(item),
    role: String(item.archetype),
    order,
    intent: item.intent,
    ...(item.anchor.landmark ? { landmark: item.anchor.landmark } : {}),
    ...(composition ? { composition } : {}),
    ...(presentation ? { presentation } : {}),
    ...(reasoning ? { reasoning } : {}),
    slots: slotsOf(item),
  };
  return { ...core, digest: digestOf(core) };
}

/** Group items into pages: website = one page of many sections; other tracks = one page per item. */
function pagesOf(plan: AuthoringPlan): RenderingPage[] {
  const sections = plan.items.map((item, i) => toSection(item, i));
  if (plan.track === 'website') {
    return [{ id: 'page', role: 'page', sections }];
  }
  const pageRole = plan.track === 'deck' ? 'slide' : 'page';
  return sections.map((s) => ({ id: s.id, role: pageRole, sections: [s] }));
}

/**
 * D1-S4 — title/description/siteName precedence FIXED to match the real renderers exactly:
 * `resolveMetadata`'s `meta.title ?? brief.oneLiner ?? brief.brand` (site-metadata.ts:75) and
 * `assembleDocument({ title: context.brief.oneLiner })` (author.ts:485) both resolve the title
 * from oneLiner FIRST — the D1-S2 builder set it from `brief.brand`, a verified mapping bug
 * (D1-S3-RIR-COMPLETENESS.md §4). `siteMetadata` (when supplied) is the project's own explicit
 * override, taking precedence over both — same precedence `resolveMetadata` gives its own `meta`.
 */
function metadataOf(brief?: Brief, siteMetadata?: RenderingSiteMetadataInput): RenderingMetadata {
  const title = siteMetadata?.title?.trim() || brief?.oneLiner?.trim() || brief?.brand?.trim() || undefined;
  const description = siteMetadata?.description?.trim() || brief?.oneLiner?.trim() || undefined;
  const siteName = siteMetadata?.siteName?.trim() || brief?.brand?.trim() || undefined;
  const tone = brief?.tone?.trim() || undefined;
  const org = siteMetadata?.organization;
  const organization =
    org?.name?.trim() || org?.url?.trim() || org?.logo?.trim() || (org?.sameAs && org.sameAs.length > 0)
      ? {
          ...(org?.name?.trim() ? { name: org.name.trim() } : {}),
          ...(org?.url?.trim() ? { url: org.url.trim() } : {}),
          ...(org?.logo?.trim() ? { logo: org.logo.trim() } : {}),
          ...(org?.sameAs && org.sameAs.length > 0 ? { sameAs: [...org.sameAs] } : {}),
        }
      : undefined;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
    ...(tone ? { tone } : {}),
    ...(siteMetadata?.locale?.trim() ? { locale: siteMetadata.locale.trim() } : {}),
    ...(siteMetadata?.canonicalUrl?.trim() ? { canonicalUrl: siteMetadata.canonicalUrl.trim() } : {}),
    ...(siteMetadata?.robots?.trim() ? { robots: siteMetadata.robots.trim() } : {}),
    ...(siteMetadata?.themeColor?.trim() ? { themeColor: siteMetadata.themeColor.trim() } : {}),
    ...(siteMetadata?.ogType?.trim() ? { ogType: siteMetadata.ogType.trim() } : {}),
    ...(siteMetadata?.ogImage?.trim() ? { ogImage: siteMetadata.ogImage.trim() } : {}),
    ...(siteMetadata?.twitterCard?.trim() ? { twitterCard: siteMetadata.twitterCard.trim() } : {}),
    ...(siteMetadata?.twitterSite?.trim() ? { twitterSite: siteMetadata.twitterSite.trim() } : {}),
    ...(siteMetadata?.favicon?.trim() ? { favicon: siteMetadata.favicon.trim() } : {}),
    ...(siteMetadata?.appleTouchIcon?.trim() ? { appleTouchIcon: siteMetadata.appleTouchIcon.trim() } : {}),
    ...(siteMetadata?.manifest?.trim() ? { manifest: siteMetadata.manifest.trim() } : {}),
    ...(organization ? { organization } : {}),
  };
}

function tokensOf(plan: AuthoringPlan): string[] {
  const roles = new Set<string>();
  for (const item of plan.items) for (const r of item.tokenRoles) if (r) roles.add(r);
  return [...roles].sort();
}

/**
 * Derive the Rendering IR from an AuthoringPlan (+ the brief, for document metadata intent, and
 * D1-S4's optional `siteMetadata` — a project's declared SEO/social identity, caller-supplied so
 * the builder still performs zero I/O). Pure and deterministic: no clock, no randomness, stable
 * ordering — identical inputs yield a byte-identical IR and an identical digest. Additive:
 * omitting `siteMetadata` (or a brief with an empty `tone`) reproduces the exact IR shape a
 * 2-argument D1-S2 call produced. Generation is not touched; this is a downstream derivation only.
 */
export function buildRenderingIR(plan: AuthoringPlan, brief?: Brief, siteMetadata?: RenderingSiteMetadataInput): RenderingIR {
  const document: RenderingDocument = {
    metadata: metadataOf(brief, siteMetadata),
    tokens: tokensOf(plan),
    pages: pagesOf(plan),
  };
  const core = { irVersion: RIR_VERSION, track: plan.track, document };
  return { ...core, digest: digestOf(core) };
}

/** Canonical, byte-stable serialization (sorted keys, trailing newline) — the persisted `rir.json`. */
export function serializeRenderingIR(ir: RenderingIR): string {
  return `${JSON.stringify(canonicalizeStructural(ir), null, 2)}\n`;
}

// ── Validation (measured, not claimed) ─────────────────────────────────────────

/** Keys that must never appear anywhere in the IR — the presentational leak + framework handles. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'fragmentId', 'candidates', 'reason', 'sectionGuidance', 'componentKnowledge',
  'html', 'css', 'className', 'style', 'jsx',
]);

/** Field names whose string values are opaque human copy (exempt from the markup scan). */
const COPY_KEYS: ReadonlySet<string> = new Set(['content', 'title', 'description', 'siteName', 'intent']);

const MARKUP_RE = /[<>]|@media|class=/;

export interface RenderingIRValidation {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validate a Rendering IR: version support, structural enums, per-page id uniqueness, rendering
 * neutrality (no forbidden keys, no markup in structural fields), and digest integrity (recomputing
 * every content address must reproduce the stored digest — replay is measured, not trusted).
 */
export function validateRenderingIR(ir: RenderingIR): RenderingIRValidation {
  const errors: string[] = [];

  // 1. Version.
  if (!Number.isInteger(ir.irVersion) || !SUPPORTED_IR_VERSIONS.has(ir.irVersion)) {
    errors.push(`unsupported irVersion ${String(ir.irVersion)} (supported: ${[...SUPPORTED_IR_VERSIONS].join(', ')})`);
  }

  // 2. Neutrality — forbidden keys anywhere; markup in any non-copy string field.
  const walk = (value: unknown, key: string, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, key, `${path}[${i}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.has(k)) errors.push(`forbidden key '${k}' at ${path} — not rendering-neutral`);
        walk(v, k, `${path}.${k}`);
      }
      return;
    }
    if (typeof value === 'string' && !COPY_KEYS.has(key) && MARKUP_RE.test(value)) {
      errors.push(`markup/HTML in structural field '${key}' at ${path} — not rendering-neutral`);
    }
  };
  walk(ir.document, 'document', 'document');

  // 3. Structural enums + id uniqueness + digest integrity.
  for (const page of ir.document.pages) {
    const ids = new Set<string>();
    for (const s of page.sections) {
      if (ids.has(s.id)) errors.push(`duplicate section id '${s.id}' in page '${page.id}'`);
      ids.add(s.id);
      if (!s.role) errors.push(`section '${s.id}' has empty role`);
      if (s.composition?.surface && !SURFACES.has(s.composition.surface)) {
        errors.push(`section '${s.id}' has invalid surface '${s.composition.surface}'`);
      }
      if (s.presentation) {
        if (!MEDIA.has(s.presentation.medium)) errors.push(`section '${s.id}' has invalid medium '${s.presentation.medium}'`);
        if (!COMMITMENTS.has(s.presentation.commitment)) errors.push(`section '${s.id}' has invalid commitment '${s.presentation.commitment}'`);
      }
      for (const slot of s.slots) {
        if (slot.kind !== 'prose') errors.push(`section '${s.id}' slot '${slot.name}' has invalid kind '${slot.kind}'`);
        if (typeof slot.content !== 'string') errors.push(`section '${s.id}' slot '${slot.name}' content is not a string`);
      }
      const { digest, ...core } = s;
      if (digestOf(core) !== digest) errors.push(`section '${s.id}' digest mismatch — replay integrity broken`);
    }
  }

  // 4. Top-level digest integrity.
  const { digest, ...core } = ir;
  if (digestOf(core) !== digest) errors.push('IR digest mismatch — replay integrity broken');

  return { valid: errors.length === 0, errors };
}
