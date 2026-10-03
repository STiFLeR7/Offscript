/**
 * Path C — the v2 fragment catalog (loader + serves-based selection).
 *
 * Offscript's website generate path CURATES real `data-crf` fragments from the vendored
 * Website-offscript-v2 catalog (resources/design_processes/website/catalog/)
 * instead of authoring from scratch. This module reads the catalog manifest, maps a
 * Offscript archetype to the v2 `serves` intent vocabulary, and selects ≥2 candidate
 * fragments by meta (never by filename) with cross-/within-page rotation.
 *
 * Pure data + selection — no HTML, no LLM (honours the Stage-2 STOP clause).
 * The manifest is a GENERATED artifact (build-fragments.js in the design team's repo);
 * here it is read-only. See catalog/README.md + docs/v2-pathc-catalog/.
 */

import type { Archetype } from '../archetype.js';
import { type CompositionRow } from './composition-md.js';
import { loadProjection, type ProjectedVariant } from '../knowledge/projection.js';
import { reconstructBandForSlug } from './reconstruct-band.js';
import { ARCHETYPE_SERVES, isBestFit } from './archetype-contract.js';
import { hard, band, keepMax, terminal } from './selection-policy.js';

/** Structured per-fragment direction limits (parsed by build-fragments.js from `{…}`). */
export interface FragmentLimits {
  maxPerPage?: number;
  minBands?: number;
  avoidAdjacent?: string;
  avoidAdjacentSurface?: string;
}

/** A normalized catalog entry — manifest comma-strings tokenized to arrays. */
export interface FragmentEntry {
  slug: string;
  /** Intent vocabulary this fragment serves (the selection key) — e.g. ['feature','stats']. */
  serves: string[];
  /** Surface tokens, first = primary — e.g. ['ink']. */
  surface: string[];
  /** Layout primitives — e.g. ['n-up-card-grid']. */
  layout: string[];
  interaction: string[];
  blocks: string[];
  direction: string;
  limits: FragmentLimits;
  /** 'section' | 'atom' — only sections are pasteable bands. */
  cat: string;
}

/**
 * Map a Offscript section Archetype (closed 20-member set) to a v2 `serves` intent. Each target is
 * verified to have ≥2 serving section fragments in the catalog (see catalog.test.ts — the
 * feasibility assertion guards this table).
 *
 * W85 — re-exported from the single canonical `archetype-contract.ts` (never redeclared here).
 * The composition router (`website-composition.ts`) imports the SAME object; see
 * `archetype-contract.ts`'s doc comment for why this used to be a second, drifted copy.
 */
export const ARCHETYPE_TO_SERVES: Record<Archetype, string> = ARCHETYPE_SERVES;

let cache: FragmentEntry[] | undefined;

/**
 * WS1 — adapt one COMPOSITION.md catalog row (the live SELECT index, parsed by
 * composition-md.ts) into the FragmentEntry the selection algebra consumes. The
 * manifest the dormant loader once read was a GENERATED derivative of this same
 * index (EA-004 / EA-006); COMPOSITION.md is the surviving source of truth, so the
 * entries are sourced from it directly. `surface` is wrapped to an array (only the
 * primary is consumed). `limits` carries through unchanged
 * (composition-md's parseLimits yields the identical shape). composition-md emits
 * section rows only, which is exactly what selectCandidates filters to.
 */
export function compositionRowToFragmentEntry(row: CompositionRow): FragmentEntry {
  return {
    slug: row.slug,
    serves: row.serves,
    surface: row.surface ? [row.surface] : [],
    layout: row.layout,
    interaction: row.interaction,
    blocks: row.blocks,
    direction: row.direction,
    limits: row.limits,
    cat: row.cat,
  };
}

/**
 * PKG-4 — adapt one PROJECTED variant (the PKG-3 derived planner projection) into the
 * FragmentEntry the selection algebra consumes. The projection already carries the
 * variant composition facts (serves/surface[]/layout/interaction/blocks/limits/direction)
 * derived from COMPOSITION.md in canonical order; every projected variant is a selectable
 * section, so `cat` is 'section'. Field-identical to compositionRowToFragmentEntry (PKG-3
 * parity), so the projection-backed catalog is byte-identical to the prior row derivation.
 */
function projectedVariantToFragmentEntry(v: ProjectedVariant): FragmentEntry {
  return {
    slug: v.variant,
    serves: v.serves,
    surface: v.surface,
    layout: v.layout,
    interaction: v.interaction,
    blocks: v.blocks,
    direction: v.direction,
    limits: v.limits,
    cat: 'section',
  };
}

/**
 * Load the planner's FragmentEntry catalog.
 *
 * PKG-4 — the default read is now SOURCED FROM THE PROJECTION (the PKG-3 derived planner
 * read model), not from a direct COMPOSITION.md read: the planner consumes the projection,
 * the projection owns the canonical join. Cached on the default read. `rows` (tests) still
 * injects synthetic CompositionRows and bypasses both the cache and the projection, so the
 * test-injection contract is unchanged. Fail-loud on a missing/broken catalog is owned by
 * the projection's canonical readers (composition-md's loadCompositionCatalog).
 */
export function loadFragmentCatalog(rows?: CompositionRow[]): FragmentEntry[] {
  if (rows) return rows.map(compositionRowToFragmentEntry);
  if (cache) return cache;
  cache = loadProjection('website').variants.map(projectedVariantToFragmentEntry);
  return cache;
}

/** Test-only: drop the cached default catalog. */
export function _resetCatalogCache(): void {
  cache = undefined;
}

/**
 * Load one catalog fragment's HTML body by slug — the real `data-crf` band the website author
 * pastes + edits in place. WS3b (EA-018) repoints this to the RECONSTRUCTION pipeline: read the
 * surviving section exemplar (WS3a extraction) → descendant-scope its CSS + wrap it in a single
 * `<div data-crf="<slug>">` root (WS3b). The returned band carries exactly one `data-crf`
 * marker, scoped styles, and chrome-free content; `id`/`data-archetype` are WS6's to add.
 * Throws loud (WS3 F1/F2) on a missing/malformed exemplar. `exemplarPath` (tests) overrides the
 * path. DORMANT — no live caller yet (the live website path is author-from-governance; WS9b
 * activates this). Contract preserved: `(slug, exemplarPath?) → band string`.
 */
export function loadFragmentHtml(slug: string, exemplarPath?: string): string {
  return reconstructBandForSlug(slug, exemplarPath);
}

/**
 * Candidate fragments for an intent: section fragments whose `serves` meta includes
 * `serves` (NEVER by filename). Fails loud when <2 — the v2 law requires the catalog
 * be consulted for ≥2 candidates (validate-page.js rule a). Catalog order is preserved
 * (deterministic), which makes pickFragment's tiebreak stable.
 */
export function selectCandidates(serves: string, catalog?: FragmentEntry[]): FragmentEntry[] {
  const cat = catalog ?? loadFragmentCatalog();
  const got = cat.filter((f) => f.cat === 'section' && f.serves.includes(serves));
  if (got.length < 2) {
    throw new Error(
      `selectCandidates: serves "${serves}" has only ${got.length} catalog section(s) (need ≥2). ` +
        `Selection is by serves meta, never by filename — check ARCHETYPE_TO_SERVES.`,
    );
  }
  return got;
}

/**
 * Rule e (validate-page.js §7): two adjacent bands must differ in surface OR layout.
 * Returns true when they CLASH — same PRIMARY surface AND (they share a layout primitive
 * OR either band declares no layout). Mirrors the gate's predicate over FragmentEntry
 * meta so the planner is rail-satisfiable by construction (not patched after the fact).
 */
export function clashesRuleE(a: FragmentEntry, b: FragmentEntry): boolean {
  const sa = a.surface[0];
  const sb = b.surface[0];
  if (!sa || !sb || sa !== sb) return false; // different surface → never clashes
  const sharesLayout = a.layout.length > 0 && b.layout.length > 0 && a.layout.some((x) => b.layout.includes(x));
  return sharesLayout || a.layout.length === 0 || b.layout.length === 0;
}

/**
 * Structured `avoidAdjacent` / `avoidAdjacentSurface` (validate-page.js §7, one direction):
 * does placing `self` next to `nbr` violate `self`'s declared limit? `avoidAdjacent` is an
 * intent token `nbr` must not serve; `avoidAdjacentSurface` forbids two same-surface
 * neighbours of that surface.
 */
export function violatesAvoidAdjacent(self: FragmentEntry, nbr: FragmentEntry): boolean {
  const lim = self.limits;
  if (lim.avoidAdjacent && nbr.serves.includes(lim.avoidAdjacent)) return true;
  if (lim.avoidAdjacentSurface) {
    const ss = self.surface[0];
    const ns = nbr.surface[0];
    if (ss === lim.avoidAdjacentSurface && ns === lim.avoidAdjacentSurface) return true;
  }
  return false;
}

/** Symmetric adjacency clash between two bands — rule e OR either band's avoidAdjacent*. */
export function adjacencyClash(a: FragmentEntry, b: FragmentEntry): boolean {
  return clashesRuleE(a, b) || violatesAvoidAdjacent(a, b) || violatesAvoidAdjacent(b, a);
}

/**
 * Choose one fragment from a candidate set — a sequential narrowing pipeline over the shared
 * `selection-policy.ts` vocabulary (`hard`/`band`/`keepMax`/`terminal`; W33), in strict
 * precedence order (each stage narrows the survivors of the one before it; floor-protected
 * throughout, so a role is never emptied):
 *  1. BEST FIT (`isBestFit`, archetype-contract.ts — the SAME function the composition router
 *     calls) — a fragment whose PRIMARY serve (`serves[0]`) equals `target` beats one that
 *     merely lists `target` secondarily. No effect when `target` is omitted.
 *  2. ADJACENCY-CLEAN — prefer a fragment that does NOT clash with the previous band (`prev`):
 *     rule e (same surface + shared/absent layout) or either band's avoidAdjacent*. No effect
 *     when `prev` is omitted.
 *  3. WITHIN-PAGE diversity — prefer a fragment not already used on this page.
 *  4. BRIEF AFFINITY (W16/W33) — `band()`, the SAME tolerance-band function the composition
 *     router's W16 stage already calls: keep every candidate within `w16BandDelta` of the
 *     stage max. `w16BandDelta`=0 ⇒ exact-max ⇒ byte-identical default. OMITTED ⇒ skipped
 *     entirely ⇒ byte-identical.
 *  5. SEMANTIC discriminator (W19) — `keepMax()`; an effectively-excluded candidate is passed
 *     a large negative score by the caller, so it loses unless every candidate is excluded
 *     (floor-protected). OMITTED ⇒ skipped ⇒ byte-identical.
 *  6. FAMILY discriminator (W24) — `keepMax()`, same exclusion convention as W19. OMITTED ⇒
 *     skipped ⇒ byte-identical.
 *  7. MISSION/AUDIENCE discriminator (W30) — `keepMax()`; no exclusion (a zero-overlap
 *     candidate scores 0 and stays). OMITTED ⇒ skipped ⇒ byte-identical.
 *  8. VISUAL DISCOVERY tie-break (W72) — `keepMax()`; never widens the candidate set. OMITTED
 *     ⇒ skipped ⇒ byte-identical.
 *  9. CROSS-PAGE rotation + 10. catalog-order tiebreak — `terminal()`, the SAME tail function
 *     the composition router's final pick uses: prefer the lowest `recent` use-count, else the
 *     first survivor in (catalog-preserved) order.
 *
 * Sequential narrowing-by-priority is mathematically equivalent to a lexicographic-vector
 * argmin over the same 9 keys in the same order (each stage's survivors are exactly the
 * vector-argmin winners restricted to that key) — this replaced a hand-written `rank()`/`lt()`
 * vector with an identical-output composition of the shared primitives (see
 * `selection-rank-unification.test.ts`).
 *
 * `recent` is the selection-diversity memory (slug → prior-use count); empty until the
 * gate/diversity wiring feeds it (P4). Pure + deterministic given the same inputs.
 */
export function pickFragment(
  candidates: FragmentEntry[],
  usedThisPage: ReadonlySet<string>,
  recent: ReadonlyMap<string, number> = new Map(),
  target?: string,
  prev?: FragmentEntry,
  briefScore?: (f: FragmentEntry) => number,
  semanticScore?: (f: FragmentEntry) => number,
  familyScore?: (f: FragmentEntry) => number,
  missionScore?: (f: FragmentEntry) => number,
  w16BandDelta = 0,
  visualScore?: (f: FragmentEntry) => number,
): string {
  let pool = hard(candidates, (f) => (isBestFit(f.serves[0], target) ? 1 : 0));
  pool = hard(pool, (f) => (prev && adjacencyClash(prev, f) ? 0 : 1));
  pool = hard(pool, (f) => (usedThisPage.has(f.slug) ? 0 : 1));
  if (briefScore) pool = band(pool, briefScore, w16BandDelta);
  if (semanticScore) pool = keepMax(pool, semanticScore);
  if (familyScore) pool = keepMax(pool, familyScore);
  if (missionScore) pool = keepMax(pool, missionScore);
  if (visualScore) pool = keepMax(pool, visualScore);
  const winner = terminal(pool, { useCount: (f) => recent.get(f.slug) ?? 0 }) ?? pool[0];
  return winner.slug;
}
