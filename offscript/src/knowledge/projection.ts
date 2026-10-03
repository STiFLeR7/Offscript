/**
 * PKG-3 — Canonical Repository Knowledge Layer: the DERIVED PLANNER PROJECTION.
 *
 * Ratified by the Repository Knowledge Architecture (RKA ADR §4 — canonical vs derived)
 * and EP-1 §4 / EP-2 PKG-3. This module builds the planner-facing read model by DERIVING
 * it from canonical knowledge — never authoring it. It JOINS two canonical sources:
 *
 *   • the variant→family inheritance bridge (PKG-2 / components.md "Variant appendix")
 *     — the inherited role (family altitude) + the distinguishing angle, and
 *   • the realized composition facts (COMPOSITION.md, the variant SELECT index)
 *     — serves / surface / layout / blocks / interaction / limits / direction (variant altitude).
 *
 * Architectural contract (RKA §4):
 *   • The projection is DERIVED. It owns nothing; canonical owns everything.
 *   • Deleting + regenerating produces the IDENTICAL planner surface (no persisted artifact —
 *     it is built on demand from canonical, so it can never go stale).
 *   • It never contains knowledge unavailable in canonical sources.
 *   • Every projected element carries PROVENANCE back to exactly one canonical owner.
 *   • It fails loud when the canonical join is broken (an orphan / duplicate variant).
 *
 * This layer is STANDALONE and UNCONSUMED by the generate path: it is the surface PKG-4
 * (planner traversal) will read. PKG-3 does NOT wire the planner to it (planner traversal is
 * a PKG-4 / forbidden surface here). Growth-safe by construction — variants and families are
 * derived from the canonical sources, never enumerated; a `deps` override lets callers (and
 * tests) inject alternative canonical text to prove that growth-safety and the fail-loud paths.
 */

import { join } from 'node:path';
import { designProcessesDir, type Track } from '../paths.js';
import { resolveSourceAltitude, altitudeRank, type Altitude } from './altitudes.js';
import { parseFamilyModel, type FamilyModel } from './inheritance.js';
import {
  loadCompositionCatalog,
  compositionMdPath,
  type CompositionRow,
  type CompositionLimits,
} from '../generate/composition-md.js';

/** The fact groups a projected variant carries, each owned by exactly one canonical source. */
export type ProjectedFact = 'role' | 'differentiation' | 'composition';

/** One provenance edge: a projected fact → its single canonical owner (source + altitude). */
export interface ProvenanceEntry {
  readonly fact: ProjectedFact;
  /** Repo-relative, forward-slash canonical source path (OS-stable). */
  readonly source: string;
  /** The altitude that OWNS that source (PKG-2 location-based ownership). */
  readonly altitude: Altitude;
}

/**
 * One planner candidate, derived from canonical: the variant's inherited role (family) +
 * its distinguishing angle + its realized composition facts, with full provenance. Every
 * field is copied verbatim from a canonical source — nothing is invented here.
 */
export interface ProjectedVariant {
  readonly variant: string;
  /** The canonical display name (COMPOSITION.md Component column) — a variant-altitude fact. */
  readonly name: string;
  /** Inherited role (family altitude). '' only on a broken join (flagged by validateProjection). */
  readonly family: string;
  /** The variant-owned distinguishing angle (from the inheritance bridge). */
  readonly angle: string;
  readonly serves: string[];
  /** Surface tokens, first = primary (array form, matching the planner catalog). */
  readonly surface: string[];
  readonly layout: string[];
  readonly blocks: string[];
  readonly interaction: string[];
  readonly limits: CompositionLimits;
  readonly direction: string;
  readonly provenance: ProvenanceEntry[];
}

/** The derived planner-facing read model for one track. */
export interface PlannerProjection {
  readonly track: Track;
  /** One node per selectable section variant, in canonical (COMPOSITION.md) order. */
  readonly variants: ProjectedVariant[];
  /** Distinct inherited families present, first-appearance order. */
  readonly families: string[];
}

/** Injectable canonical inputs — defaults read the real repository; tests inject alternatives. */
export interface ProjectionDeps {
  /** The PKG-2 family/variant model (default: parseFamilyModel(track)). */
  readonly model?: FamilyModel;
  /** The COMPOSITION.md variant rows (default: loadCompositionCatalog()). */
  readonly rows?: CompositionRow[];
  /** Override the COMPOSITION.md source path used for composition provenance. */
  readonly compositionSource?: string;
}

/** Normalize an absolute path to a repo-relative, forward-slash form (OS-stable provenance). */
function repoRelative(absPath: string): string {
  const fwd = absPath.replace(/\\/g, '/');
  const idx = fwd.indexOf('resources/');
  return idx >= 0 ? fwd.slice(idx) : fwd;
}

function componentsSourceFor(track: Track): string {
  return repoRelative(join(designProcessesDir(track), 'component-governance', 'components.md'));
}

function compositionSourceFor(track: Track, override?: string): string {
  return repoRelative(override ?? compositionMdPath());
}

/** The altitude that owns a canonical source, fail-loud (a knowledge source must be owned). */
function ownerAltitude(source: string): Altitude {
  const altitude = resolveSourceAltitude(source);
  if (altitude === undefined) {
    throw new Error(
      `projection: canonical source "${source}" resolves to no altitude — ` +
        `it must be a knowledge source owned by exactly one altitude (PKG-2 altitudes.ts).`,
    );
  }
  return altitude;
}

/**
 * Build the derived planner projection for a track by JOINING canonical knowledge:
 * each COMPOSITION.md section variant is enriched with the family it inherits (and its
 * angle) from the PKG-2 bridge, with provenance attributing every fact to one owner.
 *
 * Tolerant by construction so validateProjection can REPORT a broken join: a COMPOSITION
 * variant absent from the bridge is still projected (family ''), and surfaces as an
 * orphan-variant violation rather than throwing here. assertProjection is the fail-loud
 * wrapper. Pure + deterministic given the canonical inputs (no disk write, no caching here).
 */
export function buildProjection(track: Track = 'website', deps?: ProjectionDeps): PlannerProjection {
  const model = deps?.model ?? parseFamilyModel(track);
  const rows = deps?.rows ?? loadCompositionCatalog();

  const componentsSource = componentsSourceFor(track);
  const compositionSource = compositionSourceFor(track, deps?.compositionSource);
  const familyAltitude = ownerAltitude(componentsSource);
  const compositionAltitude = ownerAltitude(compositionSource);

  const angleOf = new Map<string, string>();
  for (const v of model.variants) angleOf.set(v.variant, v.angle);

  const variants: ProjectedVariant[] = [];
  const families: string[] = [];
  const seenFamily = new Set<string>();

  for (const row of rows) {
    const family = model.variantToFamily.get(row.slug) ?? '';
    const angle = angleOf.get(row.slug) ?? '';

    // Provenance: role + differentiation come from the bridge (components.md @ family);
    // the composition facts come from COMPOSITION.md @ variant. A broken join (no family)
    // omits the bridge-sourced facts so the missing owner is visible to validation.
    const provenance: ProvenanceEntry[] = [];
    if (family) {
      provenance.push({ fact: 'role', source: componentsSource, altitude: familyAltitude });
      provenance.push({ fact: 'differentiation', source: componentsSource, altitude: familyAltitude });
    }
    provenance.push({ fact: 'composition', source: compositionSource, altitude: compositionAltitude });

    variants.push({
      variant: row.slug,
      name: row.name,
      family,
      angle,
      serves: row.serves,
      surface: row.surface ? [row.surface] : [],
      layout: row.layout,
      blocks: row.blocks,
      interaction: row.interaction,
      limits: row.limits,
      direction: row.direction,
      provenance,
    });

    if (family && !seenFamily.has(family)) {
      seenFamily.add(family);
      families.push(family);
    }
  }

  return { track, variants, families };
}

let cache: PlannerProjection | undefined;

/** Load the projection for the default repository read, cached. */
export function loadProjection(track: Track = 'website'): PlannerProjection {
  if (cache && cache.track === track) return cache;
  const built = buildProjection(track);
  cache = built;
  return built;
}

/** Regenerate the projection from canonical, bypassing the cache (delete + rebuild). */
export function regenerateProjection(track: Track = 'website'): PlannerProjection {
  cache = undefined;
  return loadProjection(track);
}

/** Test-only: drop the cached projection. */
export function _resetProjectionCache(): void {
  cache = undefined;
}

/**
 * PKG-4A — reconstruct one variant's full CompositionRow view from the projection.
 * Field-complete for the composition router: every CompositionRow field is a projected
 * fact (name + composition facts @ variant; cat is always 'section' for selectable
 * variants). `surface` collapses the projected array back to its primary string.
 */
function projectedVariantToCompositionRow(v: ProjectedVariant): CompositionRow {
  return {
    name: v.name,
    slug: v.variant,
    cat: 'section',
    layout: v.layout,
    surface: v.surface[0] ?? '',
    interaction: v.interaction,
    serves: v.serves,
    blocks: v.blocks,
    direction: v.direction,
    limits: v.limits,
  };
}

/**
 * PKG-4A — the planner-facing CompositionRow view, DERIVED FROM THE PROJECTION. This is the
 * surface the composition router consumes instead of reading COMPOSITION.md directly; it is
 * byte-identical to loadCompositionCatalog() (the projection preserves every CompositionRow
 * field in canonical order). Completes the projection contract so the planner needs no direct
 * canonical read.
 */
export function projectedCompositionRows(track: Track = 'website'): CompositionRow[] {
  return loadProjection(track).variants.map(projectedVariantToCompositionRow);
}

/**
 * Serialize a projection to a STABLE, OS-independent string — the determinism reference
 * ("delete + regenerate → byte-identical"). Variants are emitted in canonical order;
 * object keys are fixed; source paths are already repo-relative forward-slash.
 */
export function serializeProjection(p: PlannerProjection): string {
  const variants = p.variants.map((v) => ({
    variant: v.variant,
    name: v.name,
    family: v.family,
    angle: v.angle,
    serves: v.serves,
    surface: v.surface,
    layout: v.layout,
    blocks: v.blocks,
    interaction: v.interaction,
    limits: v.limits,
    direction: v.direction,
    provenance: v.provenance.map((pr) => ({ fact: pr.fact, source: pr.source, altitude: pr.altitude })),
  }));
  return JSON.stringify({ track: p.track, families: p.families, variants }, null, 2);
}

/** One canonical source the projection derives from, with its owning altitude + role. */
export interface ProjectionSource {
  readonly source: string;
  readonly altitude: Altitude;
  readonly role: string;
}

/** Discover the canonical sources the projection is derived from (provenance roots). */
export function discoverProjectionSources(track: Track = 'website', compositionSource?: string): ProjectionSource[] {
  const componentsSource = componentsSourceFor(track);
  const composition = compositionSourceFor(track, compositionSource);
  return [
    {
      source: componentsSource,
      altitude: ownerAltitude(componentsSource),
      role: 'inheritance bridge — variant→family role + distinguishing angle',
    },
    {
      source: composition,
      altitude: ownerAltitude(composition),
      role: 'realized composition facts — serves/surface/layout/blocks/limits/direction',
    },
  ];
}

/** A single projection-integrity violation. */
export type ProjectionViolationKind =
  | 'orphan-variant' // a projected variant with no inherited family (broken join)
  | 'duplicate-projection' // the same variant projected twice
  | 'missing-provenance' // a projected variant with no canonical owner
  | 'multi-owner-fact' // one fact attributed to two sources
  | 'upward-inheritance' // a provenance altitude below the variant altitude
  | 'unknown-altitude'; // a provenance altitude that is not a real altitude

export interface ProjectionViolation {
  readonly kind: ProjectionViolationKind;
  readonly detail: string;
}

/**
 * Validate the projection's integrity invariants (RKA §4). Returns the (empty when clean)
 * violation list; assertProjection is the fail-loud wrapper. Invariants enforced:
 *   • derived completely — every variant inherits a family (no orphan join);
 *   • one owner per fact  — no fact is attributed to two canonical sources;
 *   • traceable           — every variant carries provenance;
 *   • downward-only       — no provenance altitude is below the variant altitude;
 *   • no duplicates       — a variant is projected at most once.
 */
export function validateProjection(p: PlannerProjection): ProjectionViolation[] {
  const violations: ProjectionViolation[] = [];
  const variantRank = altitudeRank('variant');
  const seen = new Set<string>();

  for (const v of p.variants) {
    if (seen.has(v.variant)) {
      violations.push({ kind: 'duplicate-projection', detail: `variant "${v.variant}" projected more than once` });
    }
    seen.add(v.variant);

    if (!v.family) {
      violations.push({ kind: 'orphan-variant', detail: `variant "${v.variant}" inherits no family (broken bridge join)` });
    }
    if (v.provenance.length === 0) {
      violations.push({ kind: 'missing-provenance', detail: `variant "${v.variant}" has no canonical owner` });
    }

    const ownersByFact = new Map<string, Set<string>>();
    for (const pr of v.provenance) {
      if (!ownersByFact.has(pr.fact)) ownersByFact.set(pr.fact, new Set());
      ownersByFact.get(pr.fact)!.add(pr.source);
      const rank = altitudeRank(pr.altitude);
      if (rank < 0) {
        violations.push({ kind: 'unknown-altitude', detail: `variant "${v.variant}" fact "${pr.fact}" → unknown altitude "${pr.altitude}"` });
      } else if (rank > variantRank) {
        violations.push({
          kind: 'upward-inheritance',
          detail: `variant "${v.variant}" fact "${pr.fact}" sourced from a lower altitude "${pr.altitude}" (upward inheritance forbidden)`,
        });
      }
    }
    for (const [fact, owners] of ownersByFact) {
      if (owners.size > 1) {
        violations.push({
          kind: 'multi-owner-fact',
          detail: `variant "${v.variant}" fact "${fact}" attributed to {${[...owners].join(', ')}} — one owner per fact`,
        });
      }
    }
  }

  return violations;
}

/**
 * Fail-loud projection gate: builds the projection (real or injected canonical) and throws
 * if any integrity invariant is violated. This is the PKG-3 validation entrypoint —
 * unconsumed by generation, run by the validators/tests. Returns the projection when clean.
 */
export function assertProjection(track: Track = 'website', deps?: ProjectionDeps): PlannerProjection {
  const projection = buildProjection(track, deps);
  const violations = validateProjection(projection);
  if (violations.length > 0) {
    const lines = violations.map((v) => `  [${v.kind}] ${v.detail}`).join('\n');
    throw new Error(`assertProjection(${track}): ${violations.length} projection violation(s):\n${lines}`);
  }
  return projection;
}
