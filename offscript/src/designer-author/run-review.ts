/**
 * P34 — Designer Author Script: proposal-review orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * review logic of its own. `readProposalPackage` (proposal-io.ts, P09) reads back the
 * proposal-package.json a prior `--step=propose` run already persisted (run-propose.ts, P33);
 * `reviewProposal` / `renderProposalReviewReport` (proposal-review.ts, P12) do the review-model
 * and reporting work verbatim. This module's only job is: locate and parse the already-persisted
 * ProposalPackage, call the two reused functions in sequence, and persist both artifacts — the
 * ONE new IO primitive this sprint adds (a small writeIfChanged for JSON), duplicated locally per
 * this codebase's own established idiom (see proposal-io.ts / run-propose.ts headers: "every P0x
 * persistence/hashing module duplicates stableStringify rather than sharing it").
 *
 * Never generates a proposal (proposal-generator.ts is not imported — a review step operates on
 * an already-generated ProposalPackage read from disk, it never creates one), never translates
 * the proposal into an overlay candidate, records an approval, or records an activation (none of
 * proposal-overlay.ts / overlay-approval.ts / overlay-materialization.ts / overlay-activation.ts
 * is imported), never dispatches a subagent — see the isolation falsification tests in
 * run-review.test.ts.
 *
 * `reviewProposal` never throws on a structurally broken proposal — it REPORTS the brokenness as
 * a critical finding (e.g. `deterministic-identity`). This module only throws
 * DesignerAuthorReviewError for the one condition reviewProposal cannot see: no readable
 * proposal-package.json at all (missing, or fails to parse as JSON).
 *
 * Output lands under <discovery.dir>/designer-author/ alongside proposal-package.json /
 * proposal-report.md (run-propose.ts) — exactly proposal-review.json and proposal-review.md,
 * nothing else.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readProposalPackage } from './proposal-io.js';
import { reviewProposal, renderProposalReviewReport } from './proposal-review.js';
import type { ProposalReviewReport, ReviewProposalOptions } from './proposal-review.js';
import type { ReadyDiscovery } from './run-artifacts.js';
import { DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from './run-propose.js';

export const PROPOSAL_REVIEW_FILENAME = 'proposal-review.json';
export const PROPOSAL_REVIEW_REPORT_FILENAME = 'proposal-review.md';

export class DesignerAuthorReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorReviewError';
  }
}

export type ReviewStepOptions = ReviewProposalOptions;

export interface ReviewStepResult {
  readonly reviewReport: ProposalReviewReport;
  readonly reviewReportPath: string;
  readonly reviewMarkdownPath: string;
  readonly reviewMarkdown: string;
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

function writeIfChanged(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Orchestrate proposal review: read back the already-persisted ProposalPackage
 * (readProposalPackage, verbatim), review it (reviewProposal, verbatim), then persist the
 * review report as JSON and Markdown (renderProposalReviewReport, verbatim). Throws
 * DesignerAuthorReviewError only when no readable proposal-package.json exists — every other
 * form of a broken proposal is reported as a finding by reviewProposal itself, not thrown.
 */
export function runReviewStep(discovery: ReadyDiscovery, opts: ReviewStepOptions = {}): ReviewStepResult {
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
  const proposalPackagePath = join(outDir, PROPOSAL_PACKAGE_FILENAME);
  const pkg = readProposalPackage(proposalPackagePath);
  if (pkg === undefined) {
    throw new DesignerAuthorReviewError(
      `runReviewStep: no readable proposal-package.json at ${proposalPackagePath} — run --step=propose first`,
    );
  }

  const reviewReport = reviewProposal(pkg.proposal, opts);
  mkdirSync(outDir, { recursive: true });

  const reviewReportPath = join(outDir, PROPOSAL_REVIEW_FILENAME);
  writeIfChanged(reviewReportPath, stableStringify(reviewReport));

  const reviewMarkdown = renderProposalReviewReport(reviewReport);
  const reviewMarkdownPath = join(outDir, PROPOSAL_REVIEW_REPORT_FILENAME);
  writeIfChanged(reviewMarkdownPath, reviewMarkdown);

  return { reviewReport, reviewReportPath, reviewMarkdownPath, reviewMarkdown };
}
