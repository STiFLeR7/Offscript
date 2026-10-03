/**
 * Sprint W24 — Family Semantic Selection Consumption (the FIRST runtime consumer of W23).
 *
 * Consumes the W23 ComponentFamilyKnowledge (the abstract role layer — Hero, FAQ, Footer, …) to
 * influence website component SELECTION ONLY, and ONLY as a SECONDARY discriminator that ranks
 * BELOW structural fitness, governance (brief) affinity, AND the W19 component-semantic key — above
 * only catalog order. It may raise/lower a candidate's confidence, effectively eliminate an
 * unsuitable family WITHIN a tie (a dominating penalty in the tie tier — never a hard removal that
 * could empty a role or override a superior structural match), and break ties between candidates of
 * DIFFERENT families. It NEVER invents candidates, adds/removes/reorders sections, changes the
 * planner, modifies reasoning/authoring/HTML, or outranks structural fitness.
 *
 * It consumes ONLY the 16 authored family dimensions (REQUIRED_FAMILY_SECTIONS) — nothing else.
 * Matching is deterministic LEXICAL overlap (a bounded tokenizer + a closed negation/role
 * vocabulary, both shared verbatim with the W19 component-semantic consumer) — NO LLM, NO
 * embeddings, NO vectors, NO meaning inference, NO heuristics outside authored knowledge. Gated by
 * the caller; when the consumer is absent every selector is byte-identical.
 *
 * Architecture mirrors W19 (`semantic-selection.ts`) exactly — a pure scorer, a pure in-tie
 * application, a fail-loud contract guard, and a digest-guarded per-family consumer.
 *
 * Candidate → family resolution is GROUNDED, not authored here: the canonical PKG-2 inheritance
 * bridge (`components.md` Variant appendix), surfaced through the planner projection
 * (`ProjectedVariant.family`), already maps every realized variant to its family. This module reads
 * that mapping and normalizes the family's display label to the W23 `family-*` slug — a deterministic
 * mechanical correspondence over the same 17 families, never a new authored mapping.
 */
import type { ParsedFamilyBody } from './family-semantics.js';
import {
  KNOWN_FAMILIES,
  createFamilyKnowledgeProvider,
  type FamilyKnowledgeProvider,
} from './family-semantics.js';
import { termsOf } from './semantic-selection.js';
import { loadProjection } from '../knowledge/projection.js';

/** Fail-loud error for every W24 consumer breach (repository mismatch / missing knowledge / …). */
export class FamilySelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilySelectionError';
  }
}

// ── the consumed dimensions (a strict subset of the 16 — nothing else is ever read) ───────────────
/** Positive (confidence-up) dimensions: what the family does best / when it is chosen / how it converts. */
const POSITIVE_SECTIONS = ['Strengths', 'Decision Style', 'Conversion Style'] as const;
/** Negative (confidence-down) dimensions: where the role is fragile / the wrong choice. */
const NEGATIVE_SECTIONS = ['Weaknesses', 'Avoid When'] as const;
/** The single dimension whose brief overlap can effectively EXCLUDE the family within a tie. */
const EXCLUDE_SECTION = 'Avoid When';
/** Neighbour-compatibility dimensions: hard lines / sibling angles that may name an adjacent role. */
const NEIGHBOUR_SECTIONS = ['Escalation Rules', 'Sibling Differences'] as const;

const AVOID_EXCLUDE_THRESHOLD = 2; // ≥2 Avoid-When terms overlapping the brief ⇒ effectively excluded
const W_POSITIVE = 2;
const W_NEIGHBOUR = 1;
/** Closed negation cue set (shared verbatim with the W19 component-semantic consumer). */
const NEG_CUES: readonly string[] = [
  'rarely', 'never', 'should not', "shouldn't", 'not sit', 'avoid', 'competing', 'dilute',
  'not beside', 'flatten', 'false ending', 'overpower',
];

// ── context + verdict (same shape as the W19 component-semantic consumer) ──────────────────────────
/** Context the family consumer scores against: brief character + (optional) preceding neighbour role. */
export interface FamilySelectionContext {
  /** Salient brief terms (see briefTermsOf in semantic-selection). */
  readonly briefTerms: ReadonlySet<string>;
  /** Role terms of the immediately-preceding section, for neighbour compatibility (optional). */
  readonly precedingRoleTerms?: ReadonlySet<string>;
}

/** The family verdict: a relative score (higher = better fit) and an exclusion flag (avoid-when). */
export interface FamilyVerdict {
  readonly score: number;
  readonly excluded: boolean;
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function sectionMarkdown(k: ParsedFamilyBody, name: string): string {
  return k.sections.find((s) => s.name === name)?.markdown ?? '';
}

function joinSections(k: ParsedFamilyBody, names: readonly string[]): string {
  return names.map((n) => sectionMarkdown(k, n)).join('\n');
}

/**
 * Neighbour compatibility against the preceding role: +1 when the neighbour's role is named in a
 * neutral/positive clause, −2 when named inside a negation clause ("should not sit beside …").
 * 0 when no neighbour context or no mention. Bounded lexical rule (mirrors W19's compositionScore).
 */
function neighbourScore(markdown: string, precedingRoleTerms?: ReadonlySet<string>): number {
  if (!precedingRoleTerms || precedingRoleTerms.size === 0) return 0;
  let score = 0;
  for (const sentence of markdown.split(/(?<=[.!?])\s+|\n+/)) {
    const lower = sentence.toLowerCase();
    const mentions = [...precedingRoleTerms].some((t) => lower.includes(t));
    if (!mentions) continue;
    score += NEG_CUES.some((c) => lower.includes(c)) ? -2 : 1;
  }
  return score;
}

/**
 * Score a family's knowledge against a selection context — consuming ONLY the positive / negative /
 * neighbour dimensions of the 16. Pure + deterministic.
 *  - positive dims (Strengths / Decision Style / Conversion Style): brief overlap → +confidence.
 *  - negative dims (Weaknesses / Avoid When): brief overlap → −confidence; Avoid-When overlap
 *    ≥ threshold ⇒ excluded.
 *  - neighbour dims (Escalation Rules / Sibling Differences): preceding-role compatibility.
 */
export function scoreFamilyKnowledge(k: ParsedFamilyBody, ctx: FamilySelectionContext): FamilyVerdict {
  const positive = overlap(termsOf(joinSections(k, POSITIVE_SECTIONS)), ctx.briefTerms);
  const negative = overlap(termsOf(joinSections(k, NEGATIVE_SECTIONS)), ctx.briefTerms);
  const avoidOverlap = overlap(termsOf(sectionMarkdown(k, EXCLUDE_SECTION)), ctx.briefTerms);
  const neighbour = neighbourScore(joinSections(k, NEIGHBOUR_SECTIONS), ctx.precedingRoleTerms);
  const excluded = avoidOverlap >= AVOID_EXCLUDE_THRESHOLD;
  const score = W_POSITIVE * positive + W_NEIGHBOUR * neighbour - negative;
  return { score, excluded };
}

// ── pure in-tie narrowing (the application step both selectors share in spirit) ────────────────────
/**
 * Narrow a tied candidate pool by family verdicts — the SECONDARY discriminator's application:
 *   1. drop effectively-excluded candidates, UNLESS that empties the pool (then keep all);
 *   2. among survivors, keep those with the maximum family score (a null verdict scores 0).
 * Pure + order-preserving. With ≤1 candidate it is the identity. Never invents, never empties.
 */
export function applyFamilyKnowledge<T>(
  candidates: readonly T[],
  verdictFor: (candidate: T) => FamilyVerdict | null,
): T[] {
  if (candidates.length <= 1) return [...candidates];
  const scored = candidates.map((c) => ({ c, v: verdictFor(c) }));
  const kept = scored.filter((s) => !s.v?.excluded);
  const afterExclude = kept.length > 0 ? kept : scored;
  let best = -Infinity;
  for (const s of afterExclude) best = Math.max(best, s.v?.score ?? 0);
  return afterExclude.filter((s) => (s.v?.score ?? 0) === best).map((s) => s.c);
}

// ── contract guard (fail loud) ────────────────────────────────────────────────────────────────────
/**
 * Verify a family-narrowing result honours the selection contract: `after` must be an
 * order-preserving subset of `before` (no invented candidate, no reorder, no duplicate), and must be
 * non-empty whenever `before` is non-empty (a role is never emptied). Throws FamilySelectionError on
 * any breach — the measured guarantee behind "family semantics never invent / reorder / empty".
 */
export function verifyFamilySelection<T>(before: readonly T[], after: readonly T[]): void {
  if (before.length > 0 && after.length === 0) {
    throw new FamilySelectionError('family-selection: narrowing emptied a non-empty candidate pool');
  }
  if (after.length > before.length) {
    throw new FamilySelectionError('family-selection: narrowing produced more candidates than it received (invented)');
  }
  // `after` must appear in `before` in the same relative order, by identity.
  let cursor = 0;
  for (const a of after) {
    let found = -1;
    for (let i = cursor; i < before.length; i++) {
      if (before[i] === a) { found = i; break; }
    }
    if (found === -1) {
      // either not present at all, or present only before the cursor (⇒ a reorder)
      const existsEarlier = before.indexOf(a) !== -1;
      throw new FamilySelectionError(
        existsEarlier
          ? 'family-selection: narrowing reordered the candidate pool'
          : 'family-selection: narrowing invented a candidate not in the input pool',
      );
    }
    cursor = found + 1;
  }
  if (new Set(after).size !== after.length) {
    throw new FamilySelectionError('family-selection: narrowing duplicated a candidate');
  }
}

// ── label normalization: projection display family → W23 family-* slug (deterministic) ─────────────
const KNOWN_SET: ReadonlySet<string> = new Set(KNOWN_FAMILIES);

/**
 * Normalize a projection family display label ("Hero", "Feature / value-prop", "Call-to-action") to
 * its W23 `family-*` slug ("family-hero", "family-feature-value-prop", "family-call-to-action").
 * Mechanical + deterministic — the same lowercase/hyphenate slug rule used elsewhere — over the same
 * 17 families; never a new authored correspondence. Validated bijective against the real projection
 * by the W24 test (a label that does not resolve to a KNOWN family is a repository mismatch).
 */
export function familySlugForLabel(label: string): string {
  return 'family-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── the consumer (variant slug → canonical family → verdict), fail-loud ───────────────────────────
/** A built family-selection consumer over the variant→family map + the family-knowledge provider. */
export interface FamilySelectionConsumer {
  /**
   * Score a candidate by variant slug; null when the variant is absent from the projection or its
   * family is an orphan (no opinion). Fails loud when a present variant's family does not normalize
   * to a known family (repository mismatch), the known family has no authored document (missing
   * knowledge), or the loaded knowledge object is not frozen (mutable object).
   */
  scoreFor(slug: string, ctx: FamilySelectionContext): FamilyVerdict | null;
  /** Resolve a variant slug to its canonical `family-*` slug (null when absent / orphan). */
  familyFor(slug: string): string | null;
}

/** The bundle the planner threads into both website selectors: the consumer + the brief's terms. */
export interface FamilySelection {
  readonly consumer: FamilySelectionConsumer;
  readonly briefTerms: ReadonlySet<string>;
}

/** Injectable deps (defaults read the real projection + family-knowledge root; tests override). */
export interface FamilySelectionDeps {
  /** variant slug → family DISPLAY label (default: derived from the website projection). */
  readonly variantToFamily?: ReadonlyMap<string, string>;
  /** The family-knowledge provider (default: createFamilyKnowledgeProvider()). */
  readonly provider?: FamilyKnowledgeProvider;
}

function defaultVariantToFamily(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const v of loadProjection('website').variants) map.set(v.variant, v.family);
  return map;
}

/**
 * Build the consumer. Resolution per slug: variant → family display label (projection) → `family-*`
 * slug (normalized) → ComponentFamilyKnowledge (provider). A per-family verdict cache keyed on the
 * resolved slug keeps each family scored at most once per (consumer, context) — but because the
 * context varies per call, only the loaded knowledge is reused; scoring is recomputed (cheap, pure).
 */
export function createFamilySelectionConsumer(deps: FamilySelectionDeps = {}): FamilySelectionConsumer {
  const variantToFamily = deps.variantToFamily ?? defaultVariantToFamily();
  const provider = deps.provider ?? createFamilyKnowledgeProvider();

  const familyFor = (slug: string): string | null => {
    const label = variantToFamily.get(slug);
    if (label === undefined || label === '') return null; // not in projection / orphan ⇒ no opinion
    const familySlug = familySlugForLabel(label);
    if (!KNOWN_SET.has(familySlug)) {
      throw new FamilySelectionError(
        `family-selection: repository mismatch — variant "${slug}" family "${label}" ` +
          `normalizes to "${familySlug}", which is not one of the ${KNOWN_FAMILIES.length} known families`,
      );
    }
    return familySlug;
  };

  return {
    familyFor,
    scoreFor(slug, ctx) {
      const familySlug = familyFor(slug);
      if (familySlug === null) return null;
      const knowledge = provider.knowledgeFor(familySlug);
      if (knowledge === null) {
        throw new FamilySelectionError(
          `family-selection: missing family knowledge for "${familySlug}" (variant "${slug}") — ` +
            `the family is known but no authored document was found`,
        );
      }
      if (!Object.isFrozen(knowledge)) {
        throw new FamilySelectionError(
          `family-selection: family knowledge for "${familySlug}" is a mutable object (expected frozen)`,
        );
      }
      return scoreFamilyKnowledge(knowledge, ctx);
    },
  };
}
