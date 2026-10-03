/**
 * P10 — Designer Author Consumption: proposal-report.ts, the first real
 * CONSUMER of `AuthorProposal` (Classify: Presentation — pure report
 * generation over already-built proposals, never generation/selection/
 * catalog/validation logic). Mirrors Doctor's review-report.ts shape: a
 * pure model builder + a pure deterministic Markdown renderer, nothing else.
 *
 * `summarizeProposal` is the ONE thing every other P10 consumption site
 * reuses (review-package.ts imports it as its one legitimate value import;
 * see docs/internals/P10-DESIGNER-AUTHOR-CONSUMPTION.md §4) — it derives a
 * `ProposalSummary` from an `AuthorProposal` by taking fields verbatim,
 * deliberately EXCLUDING `content` (the proposed substance itself never
 * needs to travel into a summary — a summary describes a proposal, it does
 * not re-embed it).
 */
import type { AuthorProposal, ProposalKind, ProposalStatus } from './proposal.js';

export interface ProposalSummary {
  readonly id: string;
  readonly kind: ProposalKind;
  readonly status: ProposalStatus;
  readonly semanticFamily: string;
  readonly parentComponent?: string;
  readonly authoredBy: string;
  readonly evidenceCount: number;
}

export interface ProposalManifestReport {
  readonly generatedAt: string;
  readonly proposalCount: number;
  readonly proposals: readonly ProposalSummary[];
}

export interface BuildProposalManifestReportOptions {
  readonly now?: () => string;
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

/** Derive a ProposalSummary from an AuthorProposal — verbatim fields only, never content. */
export function summarizeProposal(proposal: AuthorProposal): ProposalSummary {
  const summary: ProposalSummary = {
    id: proposal.identity.id,
    kind: proposal.kind,
    status: proposal.status,
    semanticFamily: proposal.semanticFamily,
    ...(proposal.parentComponent !== undefined ? { parentComponent: proposal.parentComponent } : {}),
    authoredBy: proposal.origin.authoredBy,
    evidenceCount: proposal.evidence.length,
  };
  return deepFreeze(summary);
}

/** Build a deterministic report over a set of proposals — summaries sorted by id. */
export function buildProposalManifestReport(
  proposals: readonly AuthorProposal[],
  opts: BuildProposalManifestReportOptions = {},
): ProposalManifestReport {
  const now = opts.now ?? (() => new Date().toISOString());
  const summaries = proposals.map(summarizeProposal).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return deepFreeze({
    generatedAt: now(),
    proposalCount: summaries.length,
    proposals: summaries,
  });
}

/** Deterministic Markdown rendering of a ProposalManifestReport. */
export function renderProposalManifestReport(report: ProposalManifestReport): string {
  const lines: string[] = [];
  lines.push('# Designer Author — Proposal Manifest Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Proposal count: ${report.proposalCount}`);
  lines.push('');
  lines.push('## Proposals');
  lines.push('');
  if (report.proposals.length === 0) {
    lines.push('_No proposals._');
  } else {
    lines.push('| id | kind | status | semantic family | parent component | authored by | evidence |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const p of report.proposals) {
      lines.push(
        `| \`${p.id}\` | ${p.kind} | ${p.status} | ${p.semanticFamily} | ${p.parentComponent ?? '_(none)_'} | ${p.authoredBy} | ${p.evidenceCount} |`,
      );
    }
  }
  return lines.join('\n');
}
