/**
 * Sprint W52 — Presentation Intent Foundation (Model → Loader → Transport; STOPS at Transport).
 *
 * Introduces PresentationIntent as a first-class immutable runtime object: the governed
 * visual-communication medium (chart / diagram / spatial / none) a section's BOUND content
 * structure implies, and the commitment level (inline / dominant) that content has earned — per
 * the W51 architecture. Mirrors the W18 (`knowledge/semantic-body.ts`) / W23 (`family-semantics.ts`)
 * / W20 (`semantic-author-context.ts`) shape exactly: one immutable model, one deterministic
 * content-addressed cache, one digest-checked provider.
 *
 * Boundary (load-bearing):
 *  - Grounded ONLY in the existing, UNCHANGED `deriveContentSignal` (content-signal.ts) — no new
 *    detection, no parsing of the governance rulebooks, no AI, no embeddings, no vectors, no
 *    probabilistic behaviour. The classification table below is a closed mapping from the signal's
 *    existing ContentShape vocabulary to the three governed systems W51 identified
 *    (README-DATA-VIZ → 'chart', README-DIAGRAMS → 'diagram', README-SPATIAL → 'spatial'), with
 *    'none' for everything else. Abstract-shapes is deliberately absent (W51 §0.1: no rulebook
 *    exists for it yet — modelling it now would invent governance).
 *  - NOTHING consumes this module in this sprint. It is referenced only by its own test and by the
 *    one PlanItem.presentationIntent transport field (types.ts) + the one plan.ts wiring site,
 *    exactly mirroring W20's transport-only footprint. The planner, the author, the renderer, the
 *    collateral generator, every validator, and every rail are unchanged.
 *
 * No reasoning. No interpretation. No embeddings. No vectors. No LLM.
 */
import { createHash } from 'node:crypto';
import type { PlanItem } from './types.js';
import { deriveContentSignal, type ContentShape } from './content-signal.js';

/** Bump when the classification/representation contract changes; participates in digest identity. */
export const PRESENTATION_INTENT_VERSION = 'w52-presentation-intent@1';

/** Fail-loud error for the provider's identity guarantee (never for the pure computation). */
export class PresentationIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresentationIntentError';
  }
}

/**
 * The governed visual-communication medium, per W51 §5.1 / §9.3:
 *   'chart'    — README-DATA-VIZ (stat/bar/line/area/donut/table/metric visualizations)
 *   'diagram'  — README-DIAGRAMS (relationship / process / structured-visualization families)
 *   'spatial'  — README-SPATIAL (isometric / layered / ecosystem system illustrations)
 *   'none'     — no governed system applies; the content stays prose
 */
export type PresentationIntentClass = 'none' | 'chart' | 'diagram' | 'spatial';

/**
 * The visual commitment the content's OWN structure has earned, per W51 §5.1's "weight" concept:
 *   'dominant' — content shows 2+ distinct rich structural cues; earns a hero-weight treatment
 *   'inline'   — content shows exactly one rich cue; earns a supporting/aside treatment
 *   'none'     — intentClass is 'none'
 * This is a PER-SECTION, LOCAL judgement only — it never compares across sections or budgets a
 * deck-wide allowance (that stays WS5 `routeCollateralVisuals`'s job, untouched by this sprint).
 */
export type PresentationIntentCommitment = 'none' | 'inline' | 'dominant';

/**
 * The immutable Presentation Intent object. Deep-frozen; every field is either a primitive or a
 * frozen array. Exists exactly once per PlanItem once computed — never re-derived by a consumer.
 */
export interface PresentationIntent {
  /** The governed medium this section's bound content implies. */
  readonly intentClass: PresentationIntentClass;
  /** The visual commitment that medium has earned, judged from THIS section alone. */
  readonly commitment: PresentationIntentCommitment;
  /** The raw content-signal shapes this classification was grounded in (verbatim, for traceability). */
  readonly source: readonly ContentShape[];
  /** sha256 over (PRESENTATION_INTENT_VERSION + ' ' + canonicalized bound-content source text). */
  readonly digest: string;
  /** Always 'valid' — this is a total function over a closed shape vocabulary; it never throws. */
  readonly validationState: 'valid';
}

function canonicalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/**
 * The exact text `deriveContentSignal` classifies from (`item.intent` + `item.content`) — exposed
 * so the digest is transparently content-addressed against the same substance the classification
 * itself reads, mirroring how `bodyDigest` hashes the same body `parseSemanticBody` parses.
 */
export function presentationIntentSourceText(item: Pick<PlanItem, 'intent' | 'content'>): string {
  return `${item.intent}\n${item.content ?? ''}`;
}

/** Content digest: sha256 over the version and the canonicalized source text only. Deterministic. */
export function presentationIntentDigest(sourceText: string): string {
  return createHash('sha256')
    .update(PRESENTATION_INTENT_VERSION)
    .update(' ')
    .update(canonicalize(sourceText))
    .digest('hex');
}

/**
 * The five ContentShape values any governed system keys off. Used only to count how many distinct
 * rich cues co-occur (the commitment judgement) — never to re-detect a shape (that is
 * `deriveContentSignal`'s unchanged job).
 */
const RICH_SHAPES: readonly ContentShape[] = ['spatial', 'diagram', 'process', 'comparison', 'stats'];

/**
 * Classify the governed medium from a content signal. Priority mirrors the existing
 * `routedStudyPointer` precedent (author-contract.ts:176) — spatial wins over diagram (a system
 * illustration is the stronger, rarer cue) — extended with 'chart' for the 'stats' shape, closing
 * the chart-parity gap W51 §9.3 identified (grounded in README-DATA-VIZ's own scope statement:
 * stat/metric visualizations are its domain). Closed, total, deterministic.
 */
function classify(signal: readonly ContentShape[]): PresentationIntentClass {
  const has = (s: ContentShape): boolean => signal.includes(s);
  if (has('spatial')) return 'spatial';
  if (has('diagram') || has('process') || has('comparison')) return 'diagram';
  if (has('stats')) return 'chart';
  return 'none';
}

/**
 * Judge commitment from how many distinct RICH_SHAPES co-occur in THIS section's own signal —
 * never from any other section. Two or more co-occurring rich cues (e.g. a described process that
 * also carries comparison points) indicate content substantial enough to earn a dominant
 * treatment; a single cue earns only a supporting one. Mirrors the rulebooks' own "earn the
 * treatment" discipline (README-SPATIAL §1: reach for it only when the content AND the context
 * justify it; README-DIAGRAMS §5: reach upward only when the content genuinely demands it).
 */
function commitmentFor(
  intentClass: PresentationIntentClass,
  signal: readonly ContentShape[],
): PresentationIntentCommitment {
  if (intentClass === 'none') return 'none';
  const richCount = RICH_SHAPES.filter((s) => signal.includes(s)).length;
  return richCount >= 2 ? 'dominant' : 'inline';
}

/**
 * W57 — Structural Evidence Fusion (Phase 1). The planner already makes one deterministic,
 * governed decision this classification previously ignored: `item.archetype === 'StatsPage'`
 * (`plan.ts`'s `STATS_RE`, a richer regex than `deriveContentSignal`'s own stats cue — grounded
 * in W56 §5/§6.2, which measured that a StatsPage's must-include line very often carries no
 * literal digit/%/×/$ for the content-signal regex to catch, e.g. "metrics: Supply chain
 * outcomes"). When the archetype is StatsPage, contribute the SAME 'stats' ContentShape the
 * regex path would have produced for a stats-worded section, so `classify()`'s existing,
 * UNCHANGED priority (spatial > diagram/process/comparison > stats > none) decides the final
 * class exactly as it always has — a real spatial/diagram cue detected from prose still wins
 * over this structural addition (W56 §6.2 measured that re-running archetype TEXT through the
 * regex does not work — "StatsPage" as a literal string matches nothing — so this is a direct,
 * closed structural rule on the archetype value, never new detection).
 */
function withStructuralEvidence(
  item: Pick<PlanItem, 'archetype'>,
  signal: readonly ContentShape[],
): ContentShape[] {
  if (item.archetype !== 'StatsPage' || signal.includes('stats')) return [...signal];
  const merged: ContentShape[] = [...signal.filter((s) => s !== 'generic'), 'stats'];
  return merged.sort();
}

/**
 * Compute Presentation Intent for one PlanItem. Pure, uncached, deterministic — the SAME bound
 * content always yields the identical (structurally) result. Grounded in the existing
 * `deriveContentSignal` plus, as of W57, the planner's already-deterministic StatsPage archetype
 * decision (`withStructuralEvidence` above) — introduces no new prose detection.
 */
export function computePresentationIntent(item: PlanItem): PresentationIntent {
  const signal = Object.freeze(withStructuralEvidence(item, deriveContentSignal(item)));
  const intentClass = classify(signal);
  const commitment = commitmentFor(intentClass, signal);
  const digest = presentationIntentDigest(presentationIntentSourceText(item));
  return Object.freeze({
    intentClass,
    commitment,
    source: signal,
    digest,
    validationState: 'valid' as const,
  });
}

// ── deterministic cache (identity = bound-content digest ONLY — never a timestamp or item id) ──
const CACHE = new Map<string, PresentationIntent>();

/** Clear the content-addressed cache (test isolation / explicit reset). */
export function clearPresentationIntentCache(): void {
  CACHE.clear();
}

/**
 * Compute with caching. Cache key is the bound-content digest ONLY, so replaying identical content
 * — even under a different PlanItem/anchor — returns the IDENTICAL frozen object. Mirrors
 * `parseSemanticBodyCached` / `parseFamilyBodyCached` exactly.
 */
export function computePresentationIntentCached(item: PlanItem): PresentationIntent {
  const key = presentationIntentDigest(presentationIntentSourceText(item));
  const hit = CACHE.get(key);
  if (hit) return hit;
  const computed = computePresentationIntent(item);
  CACHE.set(key, computed);
  return computed;
}

/** A built provider that computes Presentation Intent exactly once per plan item. */
export interface PresentationIntentProvider {
  /**
   * The Presentation Intent for this item. Keyed on the item's anchor id; if the SAME id reappears
   * with DIFFERENT bound content (a digest mismatch) this fails loud rather than silently returning
   * a stale object — mirroring the identical guarantee `createFamilyKnowledgeProvider.knowledgeFor`
   * and `createComponentKnowledgeProvider.knowledgeFor` already give.
   */
  intentFor(item: PlanItem): PresentationIntent;
}

/**
 * Build the provider. Per-item-id cache keyed on the bound-content digest; a changed digest under
 * the same id (content changed mid-run) throws PresentationIntentError rather than returning a
 * stale computation.
 */
export function createPresentationIntentProvider(): PresentationIntentProvider {
  const cache = new Map<string, { digest: string; intent: PresentationIntent }>();
  return {
    intentFor(item) {
      const key = item.anchor.id;
      const digest = presentationIntentDigest(presentationIntentSourceText(item));
      const hit = cache.get(key);
      if (hit) {
        if (hit.digest !== digest) {
          throw new PresentationIntentError(
            `presentation-intent: digest mismatch for '${key}' (bound content changed mid-run)`,
          );
        }
        return hit.intent;
      }
      const intent = computePresentationIntentCached(item);
      cache.set(key, { digest, intent });
      return intent;
    },
  };
}
