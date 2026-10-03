/**
 * P34 — Designer Author Script: proposal-review orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful review generation,
 * deterministic replay (the falsification requirement: identical ProposalPackages generate
 * identical ProposalReviewReports), output persistence, malformed ProposalPackage (missing /
 * unparsable proposal-package.json), malformed proposal (parses fine but content itself is
 * broken — reviewProposal reports findings rather than throwing), repeated execution, and the
 * structural isolation guarantee that this module never imports generation/overlay/subagent
 * -dispatch code.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runReviewStep, PROPOSAL_REVIEW_FILENAME, PROPOSAL_REVIEW_REPORT_FILENAME, DesignerAuthorReviewError } from '../../src/designer-author/run-review.js';
import { runProposeStep, DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from '../../src/designer-author/run-propose.js';
import { reviewProposal, renderProposalReviewReport } from '../../src/designer-author/proposal-review.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-review-'));
  tmpDirs.push(dir);
  return dir;
}

function sampleReviewPackage(overrides: Partial<ReviewPackage['metadata']> = {}): ReviewPackage {
  return {
    metadata: {
      client: 'acme',
      track: 'website',
      generatedAt: '2026-07-13T00:00:00.000Z',
      replayIdentity: 'deadbeef',
      platformHarnessVersion: 'p03-platform-harness@2',
      ...overrides,
    },
    executiveSummary: 'Status **PASSED**.',
    headlineStatus: 'passed',
    systematicRatio: 0.9,
    findingCount: 0,
    validationSummary: 'PASSED',
    artifacts: [],
    reviewContract: [],
  } as unknown as ReviewPackage;
}

function sampleDoctorReport(): DoctorReport {
  return {
    subject: 'acme/website',
    generatedAt: '2026-07-13T00:00:00.000Z',
    headlineStatus: 'passed',
    systematicRatio: 0.9,
    findingCount: 0,
    findings: [],
  } as unknown as DoctorReport;
}

function readyDiscovery(dir: string): ReadyDiscovery {
  return { status: 'ready', dir, reviewPackage: sampleReviewPackage(), doctorReport: sampleDoctorReport() };
}

function proposeSample(dir: string, overrides: { intent?: string; now?: () => string } = {}) {
  return runProposeStep(
    readyDiscovery(dir),
    {
      intent: overrides.intent ?? 'A punchier hero with a single, clearer CTA',
      family: 'family-hero',
      authoredBy: 'designer:hill',
    },
    overrides.now !== undefined ? { now: overrides.now } : {},
  );
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runReviewStep — successful review generation', () => {
  it('creates proposal-review.json and proposal-review.md alongside the existing propose artifacts', () => {
    const dir = makeTmpDir();
    proposeSample(dir);
    const result = runReviewStep(readyDiscovery(dir));
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, PROPOSAL_REVIEW_FILENAME))).toBe(true);
    expect(existsSync(join(outDir, PROPOSAL_REVIEW_REPORT_FILENAME))).toBe(true);
    expect(result.reviewReportPath).toBe(join(outDir, PROPOSAL_REVIEW_FILENAME));
    expect(result.reviewMarkdownPath).toBe(join(outDir, PROPOSAL_REVIEW_REPORT_FILENAME));
  });

  it('creates ONLY the two review files in addition to the two propose files — no overlay/approval/activation artifact', () => {
    const dir = makeTmpDir();
    proposeSample(dir);
    runReviewStep(readyDiscovery(dir));
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual(
      [PROPOSAL_PACKAGE_FILENAME, 'proposal-report.md', PROPOSAL_REVIEW_FILENAME, PROPOSAL_REVIEW_REPORT_FILENAME].sort(),
    );
  });

  it('returns a ProposalReviewReport identical to calling reviewProposal directly on the proposed proposal', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T01:00:00.000Z';
    const propose = proposeSample(dir, { now });
    const result = runReviewStep(readyDiscovery(dir), { now });
    expect(result.reviewReport).toEqual(reviewProposal(propose.proposalPackage.proposal, { now }));
  });
});

describe('runReviewStep — malformed ProposalPackage', () => {
  it('throws DesignerAuthorReviewError when no proposal-package.json exists yet', () => {
    const dir = makeTmpDir();
    expect(() => runReviewStep(readyDiscovery(dir))).toThrow(DesignerAuthorReviewError);
  });

  it('throws DesignerAuthorReviewError when proposal-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    proposeSample(dir);
    writeFileSync(join(outDir, PROPOSAL_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runReviewStep(readyDiscovery(dir))).toThrow(DesignerAuthorReviewError);
  });
});

describe('runReviewStep — malformed proposal', () => {
  it('does NOT throw when the proposal content itself is broken — reviewProposal reports a critical finding instead', () => {
    const dir = makeTmpDir();
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const propose = proposeSample(dir);
    const tampered = {
      ...propose.proposalPackage,
      proposal: { ...propose.proposalPackage.proposal, identity: { ...propose.proposalPackage.proposal.identity, id: 'tampered-hash' } },
    };
    writeFileSync(join(outDir, PROPOSAL_PACKAGE_FILENAME), JSON.stringify(tampered, null, 2), 'utf8');

    const result = runReviewStep(readyDiscovery(dir));
    expect(result.reviewReport.reviewStatus).toBe('blocked');
    expect(result.reviewReport.findings.some((f) => f.dimension === 'deterministic-identity')).toBe(true);
  });
});

describe('runReviewStep — output persistence', () => {
  it('the persisted proposal-review.json parses back to the returned ProposalReviewReport', () => {
    const dir = makeTmpDir();
    proposeSample(dir);
    const result = runReviewStep(readyDiscovery(dir));
    const onDisk = JSON.parse(readFileSync(result.reviewReportPath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.reviewReport)));
  });

  it('the persisted proposal-review.md matches the reused renderProposalReviewReport output', () => {
    const dir = makeTmpDir();
    proposeSample(dir);
    const result = runReviewStep(readyDiscovery(dir));
    expect(readFileSync(result.reviewMarkdownPath, 'utf8')).toBe(renderProposalReviewReport(result.reviewReport));
    expect(result.reviewMarkdown).toBe(renderProposalReviewReport(result.reviewReport));
  });
});

describe('runReviewStep — deterministic replay', () => {
  it('identical ProposalPackage + injected clock produce a byte-identical ProposalReviewReport across two dirs', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    proposeSample(dirA, { now });
    proposeSample(dirB, { now });
    const resultA = runReviewStep(readyDiscovery(dirA), { now });
    const resultB = runReviewStep(readyDiscovery(dirB), { now });
    expect(resultA.reviewReport).toEqual(resultB.reviewReport);
  });

  it('reviewStatus and findingCount are stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    proposeSample(dirA);
    proposeSample(dirB);
    const resultA = runReviewStep(readyDiscovery(dirA));
    const resultB = runReviewStep(readyDiscovery(dirB));
    expect(resultA.reviewReport.reviewStatus).toBe(resultB.reviewReport.reviewStatus);
    expect(resultA.reviewReport.findingCount).toBe(resultB.reviewReport.findingCount);
    expect(resultA.reviewReport.subject).toBe(resultB.reviewReport.subject);
  });
});

describe('runReviewStep — repeated execution', () => {
  it('re-running against the same proposal-package.json leaves the persisted files byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    proposeSample(dir, { now });
    const first = runReviewStep(readyDiscovery(dir), { now });
    const firstJson = readFileSync(first.reviewReportPath, 'utf8');
    const firstMd = readFileSync(first.reviewMarkdownPath, 'utf8');
    const second = runReviewStep(readyDiscovery(dir), { now });
    expect(readFileSync(second.reviewReportPath, 'utf8')).toBe(firstJson);
    expect(readFileSync(second.reviewMarkdownPath, 'utf8')).toBe(firstMd);
  });

  it('re-reviewing after the underlying proposal was re-proposed with different intent overwrites the review with a new subject', () => {
    const dir = makeTmpDir();
    proposeSample(dir, { intent: 'first idea' });
    const firstReview = runReviewStep(readyDiscovery(dir));
    proposeSample(dir, { intent: 'second, materially different idea' });
    const secondReview = runReviewStep(readyDiscovery(dir));
    expect(secondReview.reviewReport.subject).not.toBe(firstReview.reviewReport.subject);
    const onDisk = JSON.parse(readFileSync(secondReview.reviewReportPath, 'utf8'));
    expect(onDisk.subject).toBe(secondReview.reviewReport.subject);
  });
});

describe('structural isolation — run-review.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-review.ts', import.meta.url)), 'utf8');
  }

  it('never imports proposal-generator, overlay lifecycle, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/proposal-generator/);
    expect(importLines).not.toMatch(/proposal-overlay|overlay-approval|overlay-materialization|overlay-activation/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses readProposalPackage, reviewProposal, and renderProposalReviewReport rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/readProposalPackage/);
    expect(source).toMatch(/reviewProposal/);
    expect(source).toMatch(/renderProposalReviewReport/);
  });
});
