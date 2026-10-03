/**
 * Sprint W30 — Mission & Audience Selection Intelligence.
 *
 * A lightweight, additive, optional World-B metadata layer that gives the website selector its
 * FINAL quality discriminator — BELOW structural fitness, adjacency, brief affinity (W16), component
 * semantics (W19), AND family semantics (W24); ABOVE only cross-page rotation + catalog order.
 *
 * Two dimensions, both SELECTOR METADATA ONLY (never governance, never a runtime obligation, never
 * World A):
 *   - Mission  — the strategic communication job a variant is best at (conversion, trust, education …).
 *   - Audience — the intended reader the variant speaks to (enterprise, technical, executive …).
 *
 * The metadata layer is a CLOSED, FROZEN, INDEPENDENTLY-VERSIONED vocabulary (MISSION_TAGS /
 * AUDIENCE_TAGS + MISSION_AUDIENCE_VERSION). A variant's mission/audience PROFILE is DERIVED
 * deterministically from the variant's own distinguishing prose that already exists in the World-B
 * planner projection (`direction` + `angle` + `blocks`) — it authors NOTHING into component.md,
 * family knowledge, semantic bodies, or governance, and it reads World A not at all. The brief's
 * target profile is derived from the SAME vocabulary over the brief terms. Fit = tag overlap.
 *
 * It may increase confidence, decrease confidence, or break a tie. It may NEVER invent candidates,
 * reorder sections, override structural fitness, or remove a valid candidate (there is no exclusion —
 * a zero-overlap candidate simply scores 0 and stays in the pool). Gated by the caller; when the
 * consumer is absent every selector is byte-identical.
 *
 * Matching is deterministic LEXICAL overlap (the shared bounded tokenizer + closed vocabulary) — NO
 * LLM, NO embeddings, NO vectors, NO meaning inference. Architecture mirrors W24 (family-selection).
 */
import { termsOf } from './semantic-selection.js';
import { loadProjection } from '../knowledge/projection.js';

/** Independent version of the mission/audience metadata layer (bump on any vocabulary change). */
export const MISSION_AUDIENCE_VERSION = 'w30.1';

/** Fail-loud error for every W30 consumer / contract breach. */
export class MissionAudienceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissionAudienceError';
  }
}

// ── the closed, frozen, versioned vocabulary (the metadata layer itself) ───────────────────────────
// Each tag → the closed set of single-token trigger terms (incl. common inflections) that, when they
// overlap a variant's distinguishing prose (or the brief), evidence that tag. Deterministic; no LLM.

/** Mission = the strategic communication job. */
export const MISSION_TAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  conversion: Object.freeze([
    'demo', 'demos', 'book', 'trial', 'signup', 'sign-up', 'start', 'started', 'convert', 'conversion',
    'action', 'contact', 'request', 'call', 'buy', 'subscribe', 'onboard',
  ]),
  trust: Object.freeze([
    'trust', 'trusted', 'credibility', 'credible', 'proof', 'secure', 'security', 'compliance',
    'compliant', 'governance', 'governed', 'audit', 'auditable', 'reliable', 'reliability',
    'certified', 'safety', 'safe',
  ]),
  education: Object.freeze([
    'explain', 'explains', 'how', 'process', 'processes', 'step', 'steps', 'workflow', 'workflows',
    'guide', 'learn', 'understand', 'onboarding', 'walkthrough', 'tutorial', 'sequence',
  ]),
  differentiation: Object.freeze([
    'compare', 'comparison', 'versus', 'alternative', 'alternatives', 'switch', 'migrate',
    'migration', 'replace', 'competitor', 'competitors', 'differ', 'difference',
  ]),
  outcomes: Object.freeze([
    'outcome', 'outcomes', 'result', 'results', 'roi', 'impact', 'savings', 'save', 'faster',
    'reduce', 'growth', 'metric', 'metrics', 'numbers', 'stat', 'stats', 'performance', 'efficiency',
  ]),
  ecosystem: Object.freeze([
    'integration', 'integrations', 'integrate', 'connect', 'connects', 'ecosystem', 'stack',
    'platform', 'api', 'apis', 'interoperable', 'compatible', 'marketplace',
  ]),
  authority: Object.freeze([
    'leader', 'leadership', 'category', 'vision', 'mission', 'manifesto', 'future', 'transform',
    'transformation', 'reinvent', 'pioneer', 'movement', 'era',
  ]),
  'social-proof': Object.freeze([
    'customers', 'customer', 'brands', 'logos', 'testimonial', 'testimonials', 'review', 'reviews',
    'quote', 'quotes', 'story', 'stories', 'case',
  ]),
});

/** Audience = the intended reader. */
export const AUDIENCE_TAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  enterprise: Object.freeze([
    'enterprise', 'organization', 'organisation', 'institution', 'institutional', 'corporation',
    'corporate', 'regulated', 'global', 'large', 'scale',
  ]),
  technical: Object.freeze([
    'engineer', 'engineers', 'developer', 'developers', 'technical', 'infrastructure', 'devops',
    'api', 'apis', 'platform', 'integration', 'architecture', 'systems',
  ]),
  executive: Object.freeze([
    'executive', 'executives', 'leader', 'ciso', 'cio', 'cto', 'coo', 'cfo', 'decision', 'strategy',
    'strategic', 'board', 'chief',
  ]),
  operations: Object.freeze([
    'operations', 'operational', 'ops', 'workflow', 'workflows', 'team', 'teams', 'process',
    'coordinator', 'coordination', 'back-office', 'admin', 'administrative',
  ]),
  growth: Object.freeze([
    'startup', 'startups', 'growth', 'smb', 'small', 'founder', 'founders', 'scale-up',
  ]),
  specialist: Object.freeze([
    'clinician', 'clinicians', 'analyst', 'analysts', 'marketer', 'designer', 'specialist',
    'practitioner', 'professional', 'agent', 'agents',
  ]),
});

/** A stable, deterministic digest of the frozen vocabulary — a replay/immutability witness. */
export function missionAudienceVocabularyDigest(): string {
  const canon = JSON.stringify({ v: MISSION_AUDIENCE_VERSION, m: MISSION_TAGS, a: AUDIENCE_TAGS });
  // small deterministic FNV-1a-style hash (no crypto import needed; pure)
  let h = 2166136261 >>> 0;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── profiles ───────────────────────────────────────────────────────────────────────────────────
/** A derived mission/audience profile: the tags evidenced by a piece of text. */
export interface MissionAudienceProfile {
  readonly missions: ReadonlySet<string>;
  readonly audiences: ReadonlySet<string>;
}

/** The per-variant facts the profile is grounded in (a strict subset of ProjectedVariant). */
export interface VariantFacts {
  readonly direction: string;
  readonly angle: string;
  readonly blocks: readonly string[];
}

function tagsFor(tokens: ReadonlySet<string>, vocab: Readonly<Record<string, readonly string[]>>): Set<string> {
  const out = new Set<string>();
  for (const [tag, triggers] of Object.entries(vocab)) {
    for (const t of triggers) {
      if (tokens.has(t)) { out.add(tag); break; }
    }
  }
  return out;
}

/**
 * Derive a variant's mission/audience profile from its OWN distinguishing prose (direction + angle +
 * blocks) — the World-B projection facts that already differ variant-to-variant (so two same-family
 * variants derive different profiles). Pure + deterministic. Never reads component.md / family /
 * semantic bodies / governance.
 */
export function deriveVariantProfile(facts: VariantFacts): MissionAudienceProfile {
  const tokens = termsOf([facts.direction, facts.angle, (facts.blocks ?? []).join(' ')].join(' '));
  return { missions: tagsFor(tokens, MISSION_TAGS), audiences: tagsFor(tokens, AUDIENCE_TAGS) };
}

/** Derive the BRIEF's target profile from its salient terms (see briefTermsOf), same vocabulary. */
export function briefProfileOf(briefTerms: ReadonlySet<string>): MissionAudienceProfile {
  return { missions: tagsFor(briefTerms, MISSION_TAGS), audiences: tagsFor(briefTerms, AUDIENCE_TAGS) };
}

// ── scoring ──────────────────────────────────────────────────────────────────────────────────────
const W_MISSION = 2;
const W_AUDIENCE = 1;

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/**
 * Score a variant profile against the brief profile: weighted tag overlap (mission ≥ audience).
 * Always ≥ 0 — there is no exclusion (mission/audience may raise or lower relative confidence and
 * break ties, but NEVER removes a valid candidate). Higher = better fit. Pure + deterministic.
 */
export function scoreMissionAudience(variant: MissionAudienceProfile, brief: MissionAudienceProfile): number {
  return W_MISSION * overlap(variant.missions, brief.missions) + W_AUDIENCE * overlap(variant.audiences, brief.audiences);
}

// ── in-tie application (the final quality discriminator) ───────────────────────────────────────────
/**
 * Narrow a tied candidate pool to the highest mission/audience score. A null score (no opinion) is
 * treated as 0. Order-preserving. With ≤1 candidate it is the identity. NEVER invents, NEVER empties,
 * NEVER excludes — an all-equal pool (incl. all-zero) is returned unchanged (⇒ byte-identical).
 */
export function applyMissionAudience<T>(
  candidates: readonly T[],
  scoreFor: (candidate: T) => number | null,
): T[] {
  if (candidates.length <= 1) return [...candidates];
  const scored = candidates.map((c) => ({ c, s: scoreFor(c) ?? 0 }));
  let best = -Infinity;
  for (const s of scored) best = Math.max(best, s.s);
  return scored.filter((s) => s.s === best).map((s) => s.c);
}

/**
 * Verify a mission-narrowing result honours the selection contract: `after` must be an
 * order-preserving subset of `before` (no invented candidate, no reorder, no duplicate) and must be
 * non-empty whenever `before` is non-empty. Throws MissionAudienceError on any breach.
 */
export function verifyMissionSelection<T>(before: readonly T[], after: readonly T[]): void {
  if (before.length > 0 && after.length === 0) {
    throw new MissionAudienceError('mission-audience: narrowing emptied a non-empty candidate pool');
  }
  if (after.length > before.length) {
    throw new MissionAudienceError('mission-audience: narrowing produced more candidates than it received (invented)');
  }
  let cursor = 0;
  for (const a of after) {
    let found = -1;
    for (let i = cursor; i < before.length; i++) {
      if (before[i] === a) { found = i; break; }
    }
    if (found === -1) {
      const existsEarlier = before.indexOf(a) !== -1;
      throw new MissionAudienceError(
        existsEarlier
          ? 'mission-audience: narrowing reordered the candidate pool'
          : 'mission-audience: narrowing invented a candidate not in the input pool',
      );
    }
    cursor = found + 1;
  }
  if (new Set(after).size !== after.length) {
    throw new MissionAudienceError('mission-audience: narrowing duplicated a candidate');
  }
}

// ── the consumer (variant slug → projection facts → profile → score) ───────────────────────────────
/** Context the consumer scores against: the brief's target mission/audience profile. */
export interface MissionAudienceContext {
  readonly briefProfile: MissionAudienceProfile;
}

/** A built mission/audience consumer over the variant→facts map. */
export interface MissionAudienceConsumer {
  /** Score a candidate by variant slug; null when the variant is absent from the projection (no opinion). */
  scoreFor(slug: string, ctx: MissionAudienceContext): number | null;
  /** The derived profile for a variant slug (null when absent) — for tests / observability. */
  profileFor(slug: string): MissionAudienceProfile | null;
}

/** The bundle the planner threads into both website selectors: the consumer + the brief's profile. */
export interface MissionAudienceSelection {
  readonly consumer: MissionAudienceConsumer;
  readonly briefProfile: MissionAudienceProfile;
}

/** Injectable deps (defaults read the real website projection; tests override). */
export interface MissionAudienceDeps {
  /** variant slug → the distinguishing facts (default: derived from the website projection). */
  readonly variantFacts?: ReadonlyMap<string, VariantFacts>;
}

function defaultVariantFacts(): ReadonlyMap<string, VariantFacts> {
  const map = new Map<string, VariantFacts>();
  for (const v of loadProjection('website').variants) {
    map.set(v.variant, { direction: v.direction, angle: v.angle, blocks: v.blocks });
  }
  return map;
}

/**
 * Build the consumer. Resolution per slug: variant → facts (projection) → derived profile (cached).
 * A slug absent from the projection ⇒ null (no opinion), leaving selection unaffected.
 */
export function createMissionAudienceConsumer(deps: MissionAudienceDeps = {}): MissionAudienceConsumer {
  const variantFacts = deps.variantFacts ?? defaultVariantFacts();
  const profileCache = new Map<string, MissionAudienceProfile | null>();

  const profileFor = (slug: string): MissionAudienceProfile | null => {
    if (profileCache.has(slug)) return profileCache.get(slug) ?? null;
    const facts = variantFacts.get(slug);
    const profile = facts ? deriveVariantProfile(facts) : null;
    profileCache.set(slug, profile);
    return profile;
  };

  return {
    profileFor,
    scoreFor(slug, ctx) {
      const profile = profileFor(slug);
      if (profile === null) return null;
      return scoreMissionAudience(profile, ctx.briefProfile);
    },
  };
}
