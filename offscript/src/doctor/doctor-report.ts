/**
 * P04 — Designer Doctor Foundation.
 *
 * Doctor is a READ-ONLY diagnosis product. It never mutates the catalog, never
 * promotes content, never authors, never runs a rail. It observes a run's
 * ALREADY-COMPUTED diagnostic surface and reframes it into a structured,
 * immutable `DoctorReport` — one finding per already-delivered signal, each
 * carrying a deterministic severity, category, and recommendation. Every fact
 * on a `DoctorFinding` traces back to an input field VERBATIM; nothing here
 * detects, scores, or judges from scratch (see the module's own "consumes, does
 * not recompute" test coverage in test/doctor/doctor-report.test.ts).
 *
 * P06 — DIAGNOSTIC INTELLIGENCE ADDENDUM. Every `DoctorFinding` now also carries
 * a structured `explanation` (Problem -> Evidence -> Impact -> Suggested Review
 * Area) — a pure, total REGROUPING of fields this module already resolves one
 * line earlier (severity/category/tier/what/why/component/overlayId/
 * recommendation). `buildExplanation` takes ONLY those already-known scalars as
 * input — its type signature cannot accept a raw AuthoritySignal, PerRailEntry,
 * Frozen, or AuthoringPlan — so it is architecturally incapable of introducing a
 * fact this module did not already derive. `impact` is the one genuinely new
 * string per finding, and it is a closed, deterministic template keyed on
 * (severity, category, tier) — the exact same "template over known fields"
 * pattern `recommendationFor`'s `rationale` strings already used since P04, never
 * generative text. The recommendation vocabulary also gained two grounded kinds
 * this sprint (`review-content`, `review-intent`) — the two cases where a critical
 * or concern finding's own `category` was already computed but previously
 * discarded into a generic `human-review` catch-all; see test/doctor/
 * doctor-explanation.test.ts for the full RED/GREEN + falsification coverage.
 *
 * WHAT THIS REUSES (nothing reinvented):
 *   - `RunHealth.delivered` (generate/source-fidelity.ts#composeRunHealth) — the
 *     ledger-delivered `AuthoritySignal[]`, ALREADY attributed (producer/level/
 *     where/what/why) across fidelity + rail + intent-readiness + intent-critic
 *     signals. This IS Doctor's findings source; Doctor mints none of its own.
 *   - `PerRailEntry[]` (generate/reauthor-loop.ts — the SAME shape validate()
 *     returns as `ValidateResult.perRail`) — read ONLY for its operator→tier
 *     lookup and as the input to the reused `mapFindingsToItems` (component
 *     linkage). No detect/apply is called; `.findings` on each entry is read,
 *     never recomputed.
 *   - `Frozen[]` (overlay.ts) — the SAME overlay entries `freezeEscalatedFindings`
 *     already persists. Doctor only reads `findingIds` to answer "is this already
 *     frozen" — it writes nothing to overlay/.
 *   - `mapFindingsToItems` (generate/reauthor-loop.ts) — the SAME anchor-matching
 *     the re-author loop uses to route findings to plan items. Doctor calls it,
 *     inverts the result, and stops — it does not reimplement anchor matching.
 *   - `SOURCE_FIDELITY_PRODUCER` / `INTENT_READINESS_PRODUCER` / `INTENT_CRITIC_PRODUCER`
 *     — the SAME producer-key constants those modules already export, used here
 *     only to classify a signal's category (content / intent / structural).
 *
 * WHAT THIS IS NOT: an authoring surface, a CLI, a UI, or a second validation
 * pass. `buildDoctorReport` calls no `detect`/`apply`/`runGate`/`validate`; it is
 * a pure function over already-produced data (P01 §13 / P02 / P03 Foundation
 * pattern — one immutable model, nothing wired, zero consumers yet).
 */

import type { AuthoritySignal, AuthorityLevel } from '../authority.js';
import type { HeadlineStatus } from '../run-headline.js';
import type { RunHealth } from '../generate/source-fidelity.js';
import { SOURCE_FIDELITY_PRODUCER } from '../generate/source-fidelity.js';
import { INTENT_READINESS_PRODUCER } from '../generate/intent-signal.js';
import { INTENT_CRITIC_PRODUCER } from '../generate/intent-critic.js';
import { mapFindingsToItems, type PerRailEntry } from '../generate/reauthor-loop.js';
import type { Frozen } from '../overlay.js';
import type { Tier } from '../operator.js';
import type { AuthoringPlan } from '../generate/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Severity — a total, deterministic relabeling of the existing AuthorityLevel.
// No new judgment: this is the SAME four-level taxonomy authority.ts already
// defines, renamed for Doctor's presentation surface.
// ─────────────────────────────────────────────────────────────────────────────

export type DoctorSeverity = 'informational' | 'advisory' | 'concern' | 'critical';

const SEVERITY_FROM_AUTHORITY: Readonly<Record<AuthorityLevel, DoctorSeverity>> = Object.freeze({
  information: 'informational',
  warning: 'advisory',
  'critical-warning': 'concern',
  failure: 'critical',
});

/** Pure, total: every AuthorityLevel maps to exactly one DoctorSeverity. */
export function severityFromAuthorityLevel(level: AuthorityLevel): DoctorSeverity {
  return SEVERITY_FROM_AUTHORITY[level];
}

const SEVERITY_RANK: Readonly<Record<DoctorSeverity, number>> = Object.freeze({
  critical: 3,
  concern: 2,
  advisory: 1,
  informational: 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// Category — structural (a rail/offscript concern) vs content (a source-
// fidelity binding concern) vs intent (the brief's own legibility/readiness).
// Classified purely from the signal's producer — the SAME producer keys the
// three producing modules already export as constants.
// ─────────────────────────────────────────────────────────────────────────────

export type DoctorCategory = 'structural' | 'content' | 'intent';

function categoryForProducer(producer: string): DoctorCategory {
  if (producer === SOURCE_FIDELITY_PRODUCER) return 'content';
  if (producer === INTENT_READINESS_PRODUCER || producer === INTENT_CRITIC_PRODUCER) return 'intent';
  return 'structural';
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation — a CLOSED, deterministic vocabulary (never generative text).
// Doctor recommends; it never decides. The rationale string is built from known
// fields via template, never authored by an LLM or free-form.
// ─────────────────────────────────────────────────────────────────────────────

export type DoctorRecommendationKind =
  | 'no-action'
  | 'monitor'
  | 'human-review'
  | 'review-overlay'
  | 'reconsider-component'
  | 'review-content'
  | 'review-intent';

export interface DoctorRecommendation {
  readonly kind: DoctorRecommendationKind;
  readonly rationale: string;
}

/**
 * P06: now takes the already-computed `category` alongside severity/overlayId/
 * component. This closes a real gap, not a hypothetical one — `category` was
 * ALREADY resolved by the caller one line before P04's original call site; it
 * was simply never threaded through, so the two most specific catch-all cases
 * (a critical content-fidelity gap, a critical/concern intent-legibility gap)
 * fell into the same generic `human-review` bucket as an unanchored structural
 * rail failure. No new signal source, no new field — just using a value this
 * function's caller already had.
 */
function recommendationFor(
  severity: DoctorSeverity,
  category: DoctorCategory,
  overlayId: string | undefined,
  component: string | undefined,
): DoctorRecommendation {
  if (severity === 'informational') {
    return { kind: 'no-action', rationale: 'deterministically resolved; nothing for a human to do' };
  }
  if (severity === 'advisory') {
    return { kind: 'monitor', rationale: 'delivered-but-degraded QA note; no guarantee violated' };
  }
  if (severity === 'concern') {
    if (category === 'intent') {
      return {
        kind: 'review-intent',
        rationale: 'a subjective, human-escalated observation about the brief\'s own legibility — a human judgement call is needed',
      };
    }
    return {
      kind: 'human-review',
      rationale: 'a subjective, human-escalated observation — a human judgement call is needed',
    };
  }
  // severity === 'critical'
  if (overlayId !== undefined) {
    return {
      kind: 'review-overlay',
      rationale: `already frozen under overlay "${overlayId}" — re-decide it, do not regenerate`,
    };
  }
  if (component !== undefined) {
    return {
      kind: 'reconsider-component',
      rationale: `anchored to component "${component}" — the selected component/variant may not fit this content`,
    };
  }
  if (category === 'content') {
    return {
      kind: 'review-content',
      rationale: 'an objective source-fidelity guarantee was violated — content may be missing or unbound from the brief',
    };
  }
  if (category === 'intent') {
    return {
      kind: 'review-intent',
      rationale: 'an objective intent-readiness guarantee was violated — required brief structure is missing or malformed',
    };
  }
  return {
    kind: 'human-review',
    rationale: 'a document-global critical finding with no component or overlay anchor — needs direct human review',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P06 — Structured explanation: Problem -> Evidence -> Impact -> Suggested
// Review Area. A pure REGROUPING of fields already resolved above — see the
// module header. `impact` is the one new string; it is a closed, deterministic
// template over (severity, category, tier), the same pattern `recommendationFor`
// already uses for its `rationale` strings.
// ─────────────────────────────────────────────────────────────────────────────

/** Structured evidence — a verbatim regrouping of the finding's own anchor/rail/
 *  rationale/tier/component/overlayId fields. Adds no fact the finding lacks. */
export interface DoctorEvidence {
  readonly rail: string;
  readonly anchor: string;
  readonly rationale: string;
  readonly tier?: Tier;
  readonly component?: string;
  readonly overlayId?: string;
}

export interface DoctorExplanation {
  /** = the finding's own `what`, verbatim. */
  readonly problem: string;
  readonly evidence: DoctorEvidence;
  /** a closed, deterministic template keyed on (severity, category, tier) — never generative. */
  readonly impact: string;
  /** = the finding's own `recommendation.kind`, verbatim — not a second decision. */
  readonly reviewArea: DoctorRecommendationKind;
}

const IMPACT_INFORMATIONAL =
  'No impact — already resolved automatically by the rail; nothing reaches the deliverable unresolved.';
const IMPACT_ADVISORY_CONTENT =
  'Delivered but degraded — the content reached the deliverable via a coarser or engine-default path; worth a spot-check, no guarantee broken.';
const IMPACT_ADVISORY_OTHER = 'A soft design-quality note — delivered as-is; no guarantee was violated.';
const IMPACT_CONCERN =
  "A human-judgement call on the brief's own legibility — nothing is technically broken, but the intended message may not land with a reader.";
const IMPACT_CRITICAL_CONTENT =
  'An objective source-fidelity guarantee was violated — delivered content may not trace back to the brief, or brief content may be missing from the deliverable.';
const IMPACT_CRITICAL_INTENT =
  'An objective intent-readiness guarantee was violated — a required brief signal is missing or malformed.';
const IMPACT_CRITICAL_STRUCTURAL_TIER0 =
  'A document-wide guarantee was violated — likely affects the whole deliverable, not just one section.';
const IMPACT_CRITICAL_STRUCTURAL_TIER1 = 'A category-level offscript guarantee was violated for this kind of section.';
const IMPACT_CRITICAL_STRUCTURAL_OTHER = 'A offscript guarantee was violated for a specific element.';

/** Pure, total: a closed template over (severity, category, tier) only. */
function impactFor(severity: DoctorSeverity, category: DoctorCategory, tier: Tier | undefined): string {
  if (severity === 'informational') return IMPACT_INFORMATIONAL;
  if (severity === 'advisory') return category === 'content' ? IMPACT_ADVISORY_CONTENT : IMPACT_ADVISORY_OTHER;
  if (severity === 'concern') return IMPACT_CONCERN;
  // severity === 'critical'
  if (category === 'content') return IMPACT_CRITICAL_CONTENT;
  if (category === 'intent') return IMPACT_CRITICAL_INTENT;
  if (tier === 0) return IMPACT_CRITICAL_STRUCTURAL_TIER0;
  if (tier === 1) return IMPACT_CRITICAL_STRUCTURAL_TIER1;
  return IMPACT_CRITICAL_STRUCTURAL_OTHER;
}

/**
 * Pure, total. Note the input type: it accepts ONLY the scalars this module has
 * already resolved by the time it's called (see `buildFinding`) — never a raw
 * `AuthoritySignal`, `PerRailEntry`, `Frozen`, or `AuthoringPlan`. That narrowed
 * signature is the architectural guarantee behind "explanations derive solely
 * from already-existing findings" — this function is structurally incapable of
 * consulting anything Doctor hasn't already decided.
 */
function buildExplanation(f: {
  rail: string;
  id: string;
  what: string;
  why: string;
  tier?: Tier;
  component?: string;
  overlayId?: string;
  category: DoctorCategory;
  severity: DoctorSeverity;
  recommendation: DoctorRecommendation;
}): DoctorExplanation {
  const evidence: DoctorEvidence = Object.freeze({
    rail: f.rail,
    anchor: f.id,
    rationale: f.why,
    ...(f.tier !== undefined ? { tier: f.tier } : {}),
    ...(f.component !== undefined ? { component: f.component } : {}),
    ...(f.overlayId !== undefined ? { overlayId: f.overlayId } : {}),
  });
  return Object.freeze({
    problem: f.what,
    evidence,
    impact: impactFor(f.severity, f.category, f.tier),
    reviewArea: f.recommendation.kind,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorFinding / DoctorReport — the immutable domain model.
// ─────────────────────────────────────────────────────────────────────────────

export interface DoctorFinding {
  /** join key back to the source — equal to the delivering AuthoritySignal's `where`
   *  (which, for rail-derived signals, is the original Finding.id verbatim). */
  readonly id: string;
  /** = the signal's producer — "which rail failed" / who diagnosed it. */
  readonly rail: string;
  readonly category: DoctorCategory;
  readonly severity: DoctorSeverity;
  /** the emitting operator's declared tier, when the caller supplied a matching
   *  perRail entry — absent for non-rail producers (fidelity/intent signals). */
  readonly tier?: Tier;
  /** = the signal's `what` verbatim. */
  readonly what: string;
  /** = the signal's `why` verbatim. */
  readonly why: string;
  /** the plan item's anchor id this finding is attributed to, when resolvable
   *  via the caller-supplied plan (reusing mapFindingsToItems). */
  readonly component?: string;
  /** the Frozen entry's id this finding is already parked under, when one exists. */
  readonly overlayId?: string;
  readonly recommendation: DoctorRecommendation;
  /** P06 — structured Problem/Evidence/Impact/Suggested-Review-Area; a pure
   *  regrouping of this SAME finding's own fields (see buildExplanation). */
  readonly explanation: DoctorExplanation;
}

export interface DoctorReport {
  /** = the run's subject verbatim (e.g. RunScore.subject). */
  readonly subject: string;
  /** = the run's own timestamp verbatim — Doctor mints no new clock read. */
  readonly generatedAt: string;
  /** = health.headline.status verbatim. */
  readonly headlineStatus: HeadlineStatus;
  /** = health.headline.systematicRatio verbatim. */
  readonly systematicRatio: number;
  readonly findingCount: number;
  /** deterministically ordered — severity (critical first), then rail, then id. */
  readonly findings: readonly DoctorFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// The builder — a pure function over already-produced data.
// ─────────────────────────────────────────────────────────────────────────────

export interface DoctorReportInput {
  readonly subject: string;
  readonly generatedAt: string;
  /** reused verbatim — the SAME RunHealth composeRunHealth already produced. */
  readonly health: RunHealth;
  /** reused verbatim — the SAME perRail shape validate() already returns.
   *  Read only for operator→tier lookup and mapFindingsToItems; never re-run. */
  readonly perRail: readonly PerRailEntry[];
  /** reused verbatim — the SAME Frozen[] overlay.ts already persists. */
  readonly frozen: readonly Frozen[];
  /** optional — enables component linkage via the reused mapFindingsToItems. */
  readonly plan?: AuthoringPlan;
}

function invertFindingsToItems(byItem: ReadonlyMap<string, { id: string }[]>): Map<string, string> {
  const byFindingId = new Map<string, string>();
  for (const [anchorId, findings] of byItem) {
    for (const f of findings) {
      // A finding can theoretically route to more than one item (a pair-site
      // adjacency finding). Keep the FIRST resolved anchor for determinism —
      // Map iteration order here is mapFindingsToItems' own perRail-derived
      // insertion order, not arbitrary.
      if (!byFindingId.has(f.id)) byFindingId.set(f.id, anchorId);
    }
  }
  return byFindingId;
}

function compareFindings(a: DoctorFinding, b: DoctorFinding): number {
  const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (rankDiff !== 0) return rankDiff;
  if (a.rail !== b.rail) return a.rail < b.rail ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildFinding(
  signal: AuthoritySignal,
  ctx: {
    tierByProducer: ReadonlyMap<string, Tier>;
    overlayIdByFindingId: ReadonlyMap<string, string>;
    componentByFindingId: ReadonlyMap<string, string>;
  },
): DoctorFinding {
  const severity = severityFromAuthorityLevel(signal.level);
  const category = categoryForProducer(signal.producer);
  const tier = ctx.tierByProducer.get(signal.producer);
  const overlayId = ctx.overlayIdByFindingId.get(signal.where);
  const component = ctx.componentByFindingId.get(signal.where);
  const recommendation = recommendationFor(severity, category, overlayId, component);
  const explanation = buildExplanation({
    rail: signal.producer,
    id: signal.where,
    what: signal.what,
    why: signal.why,
    tier,
    component,
    overlayId,
    category,
    severity,
    recommendation,
  });

  return Object.freeze({
    id: signal.where,
    rail: signal.producer,
    category,
    severity,
    what: signal.what,
    why: signal.why,
    recommendation,
    explanation,
    ...(tier !== undefined ? { tier } : {}),
    ...(overlayId !== undefined ? { overlayId } : {}),
    ...(component !== undefined ? { component } : {}),
  });
}

/**
 * Build a DoctorReport from a run's already-computed diagnostic surface. Pure:
 * same input, same output, always — no rail runs, no score is recomputed, no
 * timestamp is minted. See the module header for the exact reuse mapping.
 */
export function buildDoctorReport(input: DoctorReportInput): DoctorReport {
  const tierByProducer = new Map<string, Tier>();
  for (const { operator } of input.perRail) tierByProducer.set(operator.name, operator.tier);

  const overlayIdByFindingId = new Map<string, string>();
  for (const f of input.frozen) {
    for (const findingId of f.findingIds) overlayIdByFindingId.set(findingId, f.id);
  }

  const componentByFindingId = input.plan
    ? invertFindingsToItems(mapFindingsToItems([...input.perRail], input.plan))
    : new Map<string, string>();

  const findings = input.health.delivered.map((signal) =>
    buildFinding(signal, { tierByProducer, overlayIdByFindingId, componentByFindingId }),
  );
  findings.sort(compareFindings);

  return Object.freeze({
    subject: input.subject,
    generatedAt: input.generatedAt,
    headlineStatus: input.health.headline.status,
    systematicRatio: input.health.headline.systematicRatio,
    findingCount: findings.length,
    findings: Object.freeze(findings),
  });
}
