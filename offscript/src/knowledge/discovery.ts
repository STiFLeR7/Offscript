/**
 * Sprint 3 — Discovery Engine.
 *
 * Discovery transforms a semantic intent into the smallest lawful candidate asset set,
 * using ONLY authored repository facts (Stage-1 serves/surface via capabilities.satisfies,
 * role inheritance via semantics.specializes, limits via validation.expects). It never
 * authors, infers, ranks, optimizes, plans, or composes — it discovers.
 *
 * Six independent deterministic stages, each one responsibility:
 *   1 normalizeIntent       raw intent → canonical, classified token set
 *   2 resolveVocabulary     every token ∈ the governed vocabulary (else fail loud)
 *   3 resolveObligations    per token → its repository satisfiers (concept→specializes,
 *                           obligation→capabilities.satisfies)
 *   4 lookupCandidates      assets satisfying EVERY token (strict AND; plurality preserved)
 *   5 filterConstraints     attach each candidate's authored constraints (validation.expects)
 *   6 discover              assemble the DiscoveryResult; fail loud when impossible
 *
 * Determinism: the result is a pure function of (intent, assets, vocabulary). All lists are
 * NFC-normalized, deduped, and sorted — independent of asset traversal / filesystem order.
 * Fail-loud: empty intent, unknown vocabulary, and impossible satisfaction throw a
 * DiscoveryError; the error carries the partial, replayable DiscoveryResult as evidence.
 */
import { digest } from './digest.js';
import type { NormalizedAsset } from './model.js';
import type { GovernedVocabulary } from './vocabulary.js';

const CONCEPT_PREFIX = 'concept:';

export type ObligationKind = 'concept' | 'obligation';

export interface DiscoveryIntent {
  /** Semantic intent tokens in the authored vocabulary (concept:…, serves:…, surface:…). */
  readonly obligations: readonly string[];
}

export interface NormalizedToken {
  readonly token: string;
  readonly kind: ObligationKind;
}

export interface ResolvedObligation {
  readonly token: string;
  readonly kind: ObligationKind;
  /** Asset ids that individually satisfy this token (sorted). Empty ⇒ unresolved. */
  readonly satisfiers: readonly string[];
}

export interface DiscoveryCandidate {
  readonly id: string;
  /** The candidate's authored capabilities.satisfies (sorted) — the selection evidence. */
  readonly satisfies: readonly string[];
  /** The role concepts the candidate specializes (sorted). */
  readonly specializes: readonly string[];
}

export interface CandidateConstraint {
  readonly id: string;
  /** The candidate's authored validation.expects (limits), sorted. */
  readonly expects: readonly string[];
}

export interface DiscoveryResult {
  /** Normalized intent tokens (sorted, deduped). */
  readonly intent: readonly string[];
  readonly resolvedObligations: readonly ResolvedObligation[];
  /** Every lawful candidate (strict AND over the intent), sorted by id. Plurality preserved. */
  readonly candidates: readonly DiscoveryCandidate[];
  readonly constraints: readonly CandidateConstraint[];
  /** Tokens with zero satisfiers in the repository (non-empty ⇒ impossible). */
  readonly unresolvedObligations: readonly string[];
  readonly evidence: {
    readonly assetCount: number;
    readonly obligationCount: number;
    readonly candidateCount: number;
  };
}

/** The repository facts Discovery consumes (the loaded, validated normalized model). */
export interface DiscoveryRepository {
  readonly assets: readonly NormalizedAsset[];
  readonly vocabulary: GovernedVocabulary;
}

/** Fail-loud Discovery error; carries the partial, replayable result when one exists. */
export class DiscoveryError extends Error {
  readonly code: 'EMPTY_INTENT' | 'UNKNOWN_OBLIGATION' | 'IMPOSSIBLE_SATISFACTION';
  readonly result?: DiscoveryResult;
  constructor(code: DiscoveryError['code'], message: string, result?: DiscoveryResult) {
    super(message);
    this.name = 'DiscoveryError';
    this.code = code;
    this.result = result;
  }
}

function sortedUnique(xs: readonly string[]): string[] {
  return [...new Set(xs.map((x) => x.normalize('NFC')))].sort();
}

function classify(token: string): ObligationKind {
  return token.startsWith(CONCEPT_PREFIX) ? 'concept' : 'obligation';
}

/** Stage 1 — normalize: NFC, trim, drop empties, dedupe, sort, classify. Fail loud if empty. */
export function normalizeIntent(intent: DiscoveryIntent): NormalizedToken[] {
  const tokens = sortedUnique((intent.obligations ?? []).map((t) => t.trim()).filter((t) => t !== ''));
  if (tokens.length === 0) {
    throw new DiscoveryError('EMPTY_INTENT', 'discovery: intent carries no obligations.');
  }
  return tokens.map((token) => ({ token, kind: classify(token) }));
}

/** Stage 2 — vocabulary resolution: partition tokens into known / unknown. */
export function resolveVocabulary(
  tokens: readonly NormalizedToken[],
  vocab: GovernedVocabulary,
): { known: NormalizedToken[]; unknown: string[] } {
  const known: NormalizedToken[] = [];
  const unknown: string[] = [];
  for (const t of tokens) {
    const inVocab = t.kind === 'concept' ? vocab.concepts.has(t.token) : vocab.obligations.has(t.token);
    if (inVocab) known.push(t);
    else unknown.push(t.token);
  }
  return { known, unknown: unknown.sort() };
}

/** Stage 3 — obligation resolution: per token, the asset ids that individually satisfy it. */
export function resolveObligations(
  tokens: readonly NormalizedToken[],
  assets: readonly NormalizedAsset[],
): ResolvedObligation[] {
  return tokens.map((t) => {
    const satisfiers = assets
      .filter((a) => (t.kind === 'concept' ? a.semantics.specializes : a.capabilities.satisfies).includes(t.token))
      .map((a) => a.identity.id)
      .sort();
    return { token: t.token, kind: t.kind, satisfiers };
  });
}

/** Stage 4 — candidate lookup: assets satisfying EVERY token (strict AND), sorted. */
export function lookupCandidates(
  tokens: readonly NormalizedToken[],
  assets: readonly NormalizedAsset[],
): NormalizedAsset[] {
  return assets
    .filter((a) =>
      tokens.every((t) =>
        (t.kind === 'concept' ? a.semantics.specializes : a.capabilities.satisfies).includes(t.token),
      ),
    )
    .sort((x, y) => x.identity.id.localeCompare(y.identity.id));
}

/** Stage 5 — constraint resolution: surface each candidate's authored limits (no ranking). */
export function filterConstraints(candidates: readonly NormalizedAsset[]): CandidateConstraint[] {
  return candidates
    .filter((a) => a.validation.expects.length > 0)
    .map((a) => ({ id: a.identity.id, expects: [...a.validation.expects].sort() }));
}

/**
 * Stage 6 — the pipeline. Deterministic intent → smallest lawful candidate set.
 * Throws DiscoveryError (carrying the partial result) when discovery is impossible.
 */
export function discover(intent: DiscoveryIntent, repo: DiscoveryRepository): DiscoveryResult {
  const tokens = normalizeIntent(intent); // stage 1 (throws on empty)

  const { unknown } = resolveVocabulary(tokens, repo.vocabulary); // stage 2
  if (unknown.length > 0) {
    throw new DiscoveryError(
      'UNKNOWN_OBLIGATION',
      `discovery: ${unknown.length} obligation(s) not in the governed vocabulary: ${unknown.join(', ')}`,
    );
  }

  const resolvedObligations = resolveObligations(tokens, repo.assets); // stage 3
  const candidateAssets = lookupCandidates(tokens, repo.assets); // stage 4
  const constraints = filterConstraints(candidateAssets); // stage 5

  const candidates: DiscoveryCandidate[] = candidateAssets.map((a) => ({
    id: a.identity.id,
    satisfies: [...a.capabilities.satisfies].sort(),
    specializes: [...a.semantics.specializes].sort(),
  }));
  const unresolvedObligations = resolvedObligations
    .filter((r) => r.satisfiers.length === 0)
    .map((r) => r.token)
    .sort();

  const result: DiscoveryResult = {
    intent: tokens.map((t) => t.token),
    resolvedObligations,
    candidates,
    constraints,
    unresolvedObligations,
    evidence: {
      assetCount: repo.assets.length,
      obligationCount: tokens.length,
      candidateCount: candidates.length,
    },
  };

  // Impossible satisfaction: no asset satisfies the whole intent. Fail loud, carry the evidence.
  if (candidates.length === 0) {
    const why =
      unresolvedObligations.length > 0
        ? `unsatisfiable obligation(s): ${unresolvedObligations.join(', ')}`
        : `the conjunction of [${result.intent.join(', ')}] is satisfied by no single asset`;
    throw new DiscoveryError('IMPOSSIBLE_SATISFACTION', `discovery: impossible — ${why}.`, result);
  }

  return result;
}

/** Deterministic digest over the canonical discovery result — for replay verification. */
export function discoveryDigest(result: DiscoveryResult): string {
  return digest({
    intent: result.intent,
    resolved: result.resolvedObligations.map((r) => ({ token: r.token, kind: r.kind, satisfiers: r.satisfiers })),
    candidates: result.candidates.map((c) => ({ id: c.id, satisfies: c.satisfies, specializes: c.specializes })),
    constraints: result.constraints.map((c) => ({ id: c.id, expects: c.expects })),
    unresolved: result.unresolvedObligations,
  });
}
