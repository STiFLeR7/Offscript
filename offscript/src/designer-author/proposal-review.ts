/**
 * P12 — Designer Author Proposal Review: the first QUALITY-EVALUATION surface
 * for `AuthorProposal`. Doctor remains the single review PRODUCT (P01 §13) —
 * this module produces the proposal-domain review MODEL that Doctor's
 * `ReviewPackage` now optionally carries (see `review-package.ts`'s P12
 * addendum), mirroring the architecture Doctor already established for
 * production runs (`doctor-report.ts` + `review-report.ts`) rather than
 * reinventing review from scratch.
 *
 * REUSE MATRIX (grounded against `doctor-report.ts`, re-read in full this
 * sprint — full investigation in
 * docs/internals/P12-DESIGNER-AUTHOR-PROPOSAL-REVIEW.md §3):
 *   - REUSED VERBATIM (type-only): `DoctorSeverity` — the four-level severity
 *     taxonomy is domain-agnostic; a proposal-quality concern is exactly as
 *     "informational/advisory/concern/critical" as a production finding.
 *   - REUSED AS PATTERN, not as a type: a small immutable finding shape
 *     (severity/what/why/recommendation), a `{kind, rationale}` recommendation
 *     shape, a report shape (subject/generatedAt/status/findingCount/
 *     findings), and a severity-then-secondary-key deterministic sort.
 *   - NOT reused as literal types, because every one of Doctor's is grounded
 *     in production-run-only data a proposal never has: `DoctorCategory` is
 *     classified from a rail/source-fidelity/intent-critic PRODUCER (a
 *     proposal has none of the three); `Tier` is an operator's declared tier
 *     (a proposal invokes no operator); `component`/`overlayId` anchor a
 *     finding to a plan item / frozen overlay entry (a proposal has
 *     neither); `HeadlineStatus` is reduced from `AuthoritySignal[]` plus a
 *     goalMet/systematicRatio pair a proposal never computes;
 *     `DoctorRecommendationKind`'s every value references a rail/overlay/
 *     component concept a proposal doesn't have.
 *   - NOT reused, genuinely new: `ProposalReviewDimension` (the closed set of
 *     5 quality checks the brief specifies), `ProposalReviewRecommendation`
 *     (a proposal-appropriate closed vocabulary), and `ProposalReviewStatus`
 *     (a 3-way reduction over finding severities, mirroring
 *     `buildRunHeadline`'s PATTERN without its production-specific inputs).
 *
 * REVIEW MODEL — evaluates the proposal's OWN structural quality only. Never
 * evaluates rendered HTML (a proposal is never rendered). Never invokes a
 * validation rail (a proposal never enters `generate/validate.ts`). Never
 * reads the catalog/repository/knowledge subsystem — the same isolation
 * guarantee every prior `designer-author/` module holds (see the structural
 * test at the bottom of `proposal-review.test.ts`).
 */
import { createHash } from 'node:crypto';
import type { AuthorProposal } from './proposal.js';
import type { DoctorSeverity } from '../doctor/doctor-report.js';

export type ProposalReviewDimension =
  | 'metadata-completeness'
  | 'semantic-consistency'
  | 'evidence-completeness'
  | 'proposal-structure'
  | 'deterministic-identity';

export type ProposalReviewRecommendationKind =
  | 'no-action'
  | 'add-evidence'
  | 'add-parent-reference'
  | 'expand-content'
  | 'human-review';

export interface ProposalReviewRecommendation {
  readonly kind: ProposalReviewRecommendationKind;
  readonly rationale: string;
}

export interface ProposalReviewFinding {
  readonly dimension: ProposalReviewDimension;
  readonly severity: DoctorSeverity;
  readonly what: string;
  readonly why: string;
  readonly recommendation: ProposalReviewRecommendation;
}

export type ProposalReviewStatus = 'ready-for-review' | 'needs-attention' | 'blocked';

export interface ProposalReviewReport {
  readonly subject: string;
  readonly generatedAt: string;
  readonly reviewStatus: ProposalReviewStatus;
  readonly findingCount: number;
  readonly findings: readonly ProposalReviewFinding[];
}

export interface ReviewProposalOptions {
  readonly now?: () => string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

const SEVERITY_RANK: Readonly<Record<DoctorSeverity, number>> = Object.freeze({
  critical: 3,
  concern: 2,
  advisory: 1,
  informational: 0,
});

function compareFindings(a: ProposalReviewFinding, b: ProposalReviewFinding): number {
  const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (rankDiff !== 0) return rankDiff;
  return a.dimension < b.dimension ? -1 : a.dimension > b.dimension ? 1 : 0;
}

function reviewStatusFor(findings: readonly ProposalReviewFinding[]): ProposalReviewStatus {
  if (findings.some((f) => f.severity === 'critical')) return 'blocked';
  if (findings.some((f) => f.severity === 'concern')) return 'needs-attention';
  return 'ready-for-review';
}

// ─────────────────────────────────────────────────────────────────────────────
// The five checks. Each is pure and total over the proposal's own fields only.
// ─────────────────────────────────────────────────────────────────────────────

function checkMetadataCompleteness(proposal: AuthorProposal): ProposalReviewFinding[] {
  const missing: string[] = [];
  if (!isNonEmptyString(proposal.semanticFamily)) missing.push('semanticFamily');
  if (!isNonEmptyString(proposal.origin.client)) missing.push('origin.client');
  if (!isNonEmptyString(proposal.origin.authoredBy)) missing.push('origin.authoredBy');
  if (proposal.parentComponent !== undefined && !isNonEmptyString(proposal.parentComponent)) {
    missing.push('parentComponent');
  }
  if (missing.length === 0) return [];
  return [
    {
      dimension: 'metadata-completeness',
      severity: 'critical',
      what: `Missing or empty required metadata: ${missing.join(', ')}`,
      why: 'every proposal must carry attributable, non-empty identifying metadata before a human can review it',
      recommendation: {
        kind: 'human-review',
        rationale: 'fill in the missing metadata field(s) before this proposal can be reviewed',
      },
    },
  ];
}

function checkSemanticConsistency(proposal: AuthorProposal): ProposalReviewFinding[] {
  const expectsParent = proposal.kind === 'overlay' || proposal.kind === 'variant';
  if (expectsParent && proposal.parentComponent === undefined) {
    return [
      {
        dimension: 'semantic-consistency',
        severity: 'advisory',
        what: `A "${proposal.kind}" proposal has no parentComponent`,
        why: 'an overlay or variant is defined relative to something — stating its parent makes the proposal legible without extra context',
        recommendation: {
          kind: 'add-parent-reference',
          rationale: 'name the component this overlay/variant relates to',
        },
      },
    ];
  }
  return [];
}

function checkEvidenceCompleteness(proposal: AuthorProposal): ProposalReviewFinding[] {
  const findings: ProposalReviewFinding[] = [];
  if (proposal.evidence.length === 0) {
    findings.push({
      dimension: 'evidence-completeness',
      severity: 'advisory',
      what: 'No evidence supplied',
      why: "a proposal grounded in stated evidence is faster for a human to evaluate than one that isn't",
      recommendation: {
        kind: 'add-evidence',
        rationale: 'cite a brief excerpt, reference URL, or family Choose-when note supporting this proposal',
      },
    });
  }
  const emptyEntries = proposal.evidence.filter((e) => !isNonEmptyString(e.description));
  if (emptyEntries.length > 0) {
    findings.push({
      dimension: 'evidence-completeness',
      severity: 'concern',
      what: `${emptyEntries.length} evidence entr${emptyEntries.length === 1 ? 'y has' : 'ies have'} an empty description`,
      why: 'evidence with no description carries no information a reviewer can act on',
      recommendation: { kind: 'add-evidence', rationale: 'give every evidence entry a non-empty description' },
    });
  }
  return findings;
}

const MIN_CONTENT_LENGTH = 20;

function checkProposalStructure(proposal: AuthorProposal): ProposalReviewFinding[] {
  const trimmed = proposal.content.trim();
  if (trimmed.length === 0) {
    return [
      {
        dimension: 'proposal-structure',
        severity: 'critical',
        what: 'Proposal content is empty',
        why: 'a proposal with no content has nothing for a human to review',
        recommendation: { kind: 'expand-content', rationale: 'supply the proposed content before submitting for review' },
      },
    ];
  }
  if (trimmed.length < MIN_CONTENT_LENGTH) {
    return [
      {
        dimension: 'proposal-structure',
        severity: 'advisory',
        what: `Proposal content is unusually short (${trimmed.length} character(s))`,
        why: 'very short content is often incomplete',
        recommendation: { kind: 'expand-content', rationale: 'expand the proposal content with more detail' },
      },
    ];
  }
  return [];
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacerKeys(value), 2) + '\n';
}

function sortedReplacerKeys(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

/**
 * Recompute the proposal's expected identity, using the SAME formula
 * `proposal.ts`'s (private) `computeProposalId` uses — duplicated locally
 * rather than exported/imported, matching the established codebase idiom
 * (every P0x persistence/hashing module duplicates `stableStringify` rather
 * than sharing it; see review-package.ts's own header for the same choice).
 */
function recomputeProposalId(proposal: AuthorProposal): string {
  const identityContent = {
    kind: proposal.kind,
    origin: proposal.origin,
    parentComponent: proposal.parentComponent,
    semanticFamily: proposal.semanticFamily,
    content: proposal.content,
    evidence: proposal.evidence,
  };
  return createHash('sha256').update(stableStringify(identityContent)).digest('hex');
}

function checkDeterministicIdentity(proposal: AuthorProposal): ProposalReviewFinding[] {
  const expected = recomputeProposalId(proposal);
  if (expected === proposal.identity.id) return [];
  return [
    {
      dimension: 'deterministic-identity',
      severity: 'critical',
      what: 'Proposal identity does not match a fresh recomputation of its own content',
      why: 'identity.id must always equal sha256 over (kind, origin, parentComponent, semanticFamily, content, evidence) — a mismatch means the proposal object was constructed or altered outside buildAuthorProposal',
      recommendation: {
        kind: 'human-review',
        rationale: 'do not trust this proposal — regenerate it via buildAuthorProposal / generateProposal',
      },
    },
  ];
}

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

/**
 * Review a proposal's own structural quality. Pure and total: no filesystem,
 * no rail, no HTML render, no catalog lookup — only the proposal's own
 * already-in-memory fields.
 */
export function reviewProposal(proposal: AuthorProposal, opts: ReviewProposalOptions = {}): ProposalReviewReport {
  const now = opts.now ?? (() => new Date().toISOString());
  const findings = [
    ...checkMetadataCompleteness(proposal),
    ...checkSemanticConsistency(proposal),
    ...checkEvidenceCompleteness(proposal),
    ...checkProposalStructure(proposal),
    ...checkDeterministicIdentity(proposal),
  ].sort(compareFindings);

  return deepFreeze({
    subject: proposal.identity.id,
    generatedAt: now(),
    reviewStatus: reviewStatusFor(findings),
    findingCount: findings.length,
    findings,
  });
}

/** Deterministic Markdown rendering of a ProposalReviewReport. */
export function renderProposalReviewReport(report: ProposalReviewReport): string {
  const lines: string[] = [];
  lines.push('# Designer Author — Proposal Review');
  lines.push('');
  lines.push(`- Subject: \`${report.subject}\``);
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Status: ${report.reviewStatus}`);
  lines.push(`- Findings: ${report.findingCount}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('_No findings — this proposal passed every quality check._');
  } else {
    lines.push('| dimension | severity | what | recommendation |');
    lines.push('|---|---|---|---|');
    for (const f of report.findings) {
      lines.push(`| ${f.dimension} | ${f.severity} | ${f.what} | ${f.recommendation.kind}: ${f.recommendation.rationale} |`);
    }
  }
  return lines.join('\n');
}
