/**
 * Sprint W70 — Website Visual Discovery Foundation (Model → Loader → Transport; STOPS at
 * Transport). Discovery only: computes deterministic evidence and transports it. Nothing
 * consumes it in this sprint.
 *
 * Per SPRINT-W68-WEBSITE-VISUAL-DISCOVERY-ARCHITECTURE.md §7: website's 20 archetypes are
 * pre-partitioned by visual shape at the catalog level, so — unlike collateral's Presentation
 * Intent — this is not a filter within one heterogeneous pool. It is a DISAGREEMENT flag between
 * the archetype already assigned at plan Stage 1 (`mustIncludeToArchetype`, itself grounded in
 * only the short must-include line) and the section's full BOUND content's own structural shape.
 * Mirrors the W18 (`knowledge/semantic-body.ts`) / W23 (`family-semantics.ts`) /
 * W52 (`presentation-intent.ts`) shape exactly: one immutable model, one deterministic
 * content-addressed cache, one digest-checked provider.
 *
 * Boundary (load-bearing):
 *  - Grounded ONLY in the existing, UNCHANGED `deriveContentSignal` (content-signal.ts) fused
 *    with the item's OWN already-assigned `archetype` (Structural Evidence Fusion, W57 precedent:
 *    fuse an existing deterministic fact rather than write a second detector) — no new detection,
 *    no HTML inspection, no fragment/component-variant inspection, no AI, no embeddings.
 *  - The vocabulary is deliberately narrow: `process` / `comparison` / `stats` — the three shapes
 *    that already have a catalog-level home in the website archetype system (`process`,
 *    `plan-comparison`, `metrics`). `diagram`/`spatial` equivalents are deliberately EXCLUDED —
 *    website has no catalog destination for them (W68 §4.2); classifying into a void would repeat
 *    collateral's own "stamped, never realized" defect on day one.
 *  - NOTHING consumes this module in this sprint. It is referenced only by its own test and by
 *    the one PlanItem.visualDiscovery transport field (types.ts) + the one plan.ts wiring site,
 *    exactly mirroring W52's transport-only footprint. The selectors, the author, the renderer,
 *    and every rail are unchanged.
 *
 * No reasoning. No interpretation. No embeddings. No vectors. No LLM.
 */
import { createHash } from 'node:crypto';
import type { Archetype } from '../archetype.js';
import type { PlanItem } from './types.js';
import { deriveContentSignal, type ContentShape } from './content-signal.js';

/** Bump when the classification/representation contract changes; participates in digest identity. */
export const WEBSITE_VISUAL_DISCOVERY_VERSION = 'w70-website-visual-discovery@1';

/** Fail-loud error for the provider's identity guarantee (never for the pure computation). */
export class WebsiteVisualDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebsiteVisualDiscoveryError';
  }
}

/**
 * The closed, website-native visual-shape vocabulary — grounded in the three archetypes that
 * already have a catalog-level home (`process`, `plan-comparison`, `metrics`), per W68 §7.2.
 */
export type WebsiteVisualFamily = 'process' | 'comparison' | 'stats';

/**
 * The immutable Website Visual Discovery object. Deep-frozen; every field is either a primitive
 * or a frozen array. Exists exactly once per (website) PlanItem once computed — never re-derived
 * by a consumer (there are none yet).
 */
export interface WebsiteVisualDiscovery {
  /**
   * True when the section's already-assigned archetype agrees with (or the content signal has no
   * strong opinion about) its own visual-shape family. False when the bound content's structural
   * shape disagrees with the archetype it was already routed to.
   */
  readonly archetypeFit: boolean;
  /**
   * The family the bound content's own structure suggests, populated ONLY when it disagrees with
   * the already-assigned archetype (`archetypeFit === false`) — a disagreement flag, not a
   * replacement decision. Absent whenever `archetypeFit` is true.
   */
  readonly suggestedFamily?: WebsiteVisualFamily;
  /** The raw content-signal shapes this classification was grounded in (verbatim, for traceability). */
  readonly source: readonly ContentShape[];
  /** sha256 over (VERSION + ' ' + canonicalized archetype + bound-content source text). */
  readonly digest: string;
  /** Always 'valid' — this is a total function over a closed shape vocabulary; it never throws. */
  readonly validationState: 'valid';
}

function canonicalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/**
 * The exact text this module classifies from (`item.archetype` + `item.intent` + `item.content`)
 * — exposed so the digest is transparently content-addressed against the same substance the
 * classification itself reads. The archetype is fused evidence (W57 precedent), so it participates
 * in the source text/digest identity alongside the content-signal inputs.
 */
export function websiteVisualDiscoverySourceText(item: Pick<PlanItem, 'archetype' | 'intent' | 'content'>): string {
  return `${item.archetype}\n${item.intent}\n${item.content ?? ''}`;
}

/** Content digest: sha256 over the version and the canonicalized source text only. Deterministic. */
export function websiteVisualDiscoveryDigest(sourceText: string): string {
  return createHash('sha256')
    .update(WEBSITE_VISUAL_DISCOVERY_VERSION)
    .update(' ')
    .update(canonicalize(sourceText))
    .digest('hex');
}

/**
 * The already-governed catalog home for each of the three closed families, per W68 §4.2/§7.2.
 * Archetypes absent from this map (the other 17, including the generic `feature-grid` sentinel)
 * have no declared family of their own — a strong content-signal suggestion for one of the three
 * families is therefore always a disagreement for them.
 */
const ARCHETYPE_FAMILY: Partial<Record<Archetype, WebsiteVisualFamily>> = {
  process: 'process',
  'plan-comparison': 'comparison',
  metrics: 'stats',
};

/**
 * Suggest the family the bound content's OWN structure implies, from the existing, unchanged
 * `deriveContentSignal` vocabulary only. Priority (comparison > process > stats) mirrors the
 * existing `routedStudyPointer`/`presentation-intent.ts` precedent of ordering by cue rarity —
 * a comparison ("versus"/"before…after") is the rarer, more specific cue; closed and total.
 * Returns `undefined` when the signal carries no opinion (i.e. `deriveContentSignal` returned only
 * the `'generic'` sentinel or shapes outside this narrow vocabulary), which — matching the
 * scope W68 §7.2 draws — includes the `diagram`/`spatial` shapes: they have no website catalog
 * home yet, so this module never suggests them.
 */
function suggestFamily(signal: readonly ContentShape[]): WebsiteVisualFamily | undefined {
  if (signal.includes('comparison')) return 'comparison';
  if (signal.includes('process')) return 'process';
  if (signal.includes('stats')) return 'stats';
  return undefined;
}

/**
 * Compute Website Visual Discovery for one PlanItem. Pure, uncached, deterministic — the SAME
 * (archetype, bound content) always yields the identical (structurally) result. Grounded in the
 * existing `deriveContentSignal` plus the item's own already-assigned `archetype` (Structural
 * Evidence Fusion) — introduces no new prose detection.
 */
export function computeWebsiteVisualDiscovery(item: PlanItem): WebsiteVisualDiscovery {
  const signal = Object.freeze(deriveContentSignal(item));
  const suggested = suggestFamily(signal);
  const declaredFamily = ARCHETYPE_FAMILY[item.archetype as Archetype];
  const archetypeFit = suggested === undefined || declaredFamily === suggested;
  const digest = websiteVisualDiscoveryDigest(websiteVisualDiscoverySourceText(item));
  return Object.freeze({
    archetypeFit,
    ...(archetypeFit ? {} : { suggestedFamily: suggested }),
    source: signal,
    digest,
    validationState: 'valid' as const,
  });
}

// ── deterministic cache (identity = (archetype + bound-content) digest ONLY — never a timestamp
//    or item id) ──
const CACHE = new Map<string, WebsiteVisualDiscovery>();

/** Clear the content-addressed cache (test isolation / explicit reset). */
export function clearWebsiteVisualDiscoveryCache(): void {
  CACHE.clear();
}

/**
 * Compute with caching. Cache key is the (archetype + bound-content) digest ONLY, so replaying
 * identical input — even under a different PlanItem/anchor — returns the IDENTICAL frozen object.
 * Mirrors `computePresentationIntentCached` exactly.
 */
export function computeWebsiteVisualDiscoveryCached(item: PlanItem): WebsiteVisualDiscovery {
  const key = websiteVisualDiscoveryDigest(websiteVisualDiscoverySourceText(item));
  const hit = CACHE.get(key);
  if (hit) return hit;
  const computed = computeWebsiteVisualDiscovery(item);
  CACHE.set(key, computed);
  return computed;
}

/** A built provider that computes Website Visual Discovery exactly once per plan item. */
export interface WebsiteVisualDiscoveryProvider {
  /**
   * The Website Visual Discovery for this item. Keyed on the item's anchor id; if the SAME id
   * reappears with DIFFERENT (archetype, bound content) — a digest mismatch — this fails loud
   * rather than silently returning a stale object, mirroring
   * `createPresentationIntentProvider.intentFor`'s identical guarantee.
   */
  discoveryFor(item: PlanItem): WebsiteVisualDiscovery;
}

/**
 * Sprint W72 — the FIRST behavioural consumer: a pure tie-break scoring function derived ONLY
 * from a PlanItem's already-transported `visualDiscovery` (W70). Consumes NO new evidence and
 * never widens a candidate pool — callers apply it to candidates already selected for the item's
 * OWN archetype (`selectCandidates`/`candidatesFor`), scoring 1 a candidate that ALSO serves the
 * disagreement's suggested family (a multi-`serves` catalog fact, e.g. `compare-table` already
 * lists both `comparison` and `feature`) and 0 otherwise.
 *
 * Returns `undefined` — never a scoring function — whenever there is nothing to act on: no
 * transport (disabled/absent), or `archetypeFit: true` (agreement). This mirrors every other
 * optional discriminator in this selection algebra (`briefScore`/`semanticScore`/`familyScore`/
 * `missionScore`): undefined ⇒ callers treat the key as a constant ⇒ byte-identical.
 */
export function websiteVisualDiscoveryTieBreak(
  discovery: WebsiteVisualDiscovery | undefined,
): ((serves: readonly string[]) => number) | undefined {
  if (!discovery || discovery.archetypeFit || !discovery.suggestedFamily) return undefined;
  const family = discovery.suggestedFamily;
  return (serves) => (serves.includes(family) ? 1 : 0);
}

/**
 * Build the provider. Per-item-id cache keyed on the (archetype + bound-content) digest; a
 * changed digest under the same id (input changed mid-run) throws WebsiteVisualDiscoveryError
 * rather than returning a stale computation.
 */
export function createWebsiteVisualDiscoveryProvider(): WebsiteVisualDiscoveryProvider {
  const cache = new Map<string, { digest: string; discovery: WebsiteVisualDiscovery }>();
  return {
    discoveryFor(item) {
      const key = item.anchor.id;
      const digest = websiteVisualDiscoveryDigest(websiteVisualDiscoverySourceText(item));
      const hit = cache.get(key);
      if (hit) {
        if (hit.digest !== digest) {
          throw new WebsiteVisualDiscoveryError(
            `website-visual-discovery: digest mismatch for '${key}' (archetype/bound content changed mid-run)`,
          );
        }
        return hit.discovery;
      }
      const discovery = computeWebsiteVisualDiscoveryCached(item);
      cache.set(key, { digest, discovery });
      return discovery;
    },
  };
}
