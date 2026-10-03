/**
 * P36 — Designer Author Script: overlay-approval orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful approval, rejected
 * approval, malformed candidate package (missing / unparsable overlay-candidate-package.json),
 * deterministic replay, persistence, and repeated execution. Includes the falsification test
 * required by the brief: changing only the approval decision changes only the approval artifact
 * — every other file under designer-author/ stays byte-identical.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runApproveStep, OVERLAY_APPROVAL_PACKAGE_FILENAME, DesignerAuthorApprovalError } from '../../src/designer-author/run-approve.js';
import { runProposeStep, DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from '../../src/designer-author/run-propose.js';
import { runReviewStep, PROPOSAL_REVIEW_FILENAME } from '../../src/designer-author/run-review.js';
import { runOverlayStep, OVERLAY_CANDIDATE_PACKAGE_FILENAME } from '../../src/designer-author/run-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { buildApprovalPackage } from '../../src/designer-author/overlay-approval-package.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-approve-'));
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

function setUpCandidate(dir: string, overrides: { intent?: string; now?: () => string } = {}) {
  const nowOpt = overrides.now !== undefined ? { now: overrides.now } : {};
  const propose = runProposeStep(
    readyDiscovery(dir),
    { intent: overrides.intent ?? 'A punchier hero with a single, clearer CTA', family: 'family-hero', authoredBy: 'designer:hill' },
    nowOpt,
  );
  const review = runReviewStep(readyDiscovery(dir), nowOpt);
  const overlay = runOverlayStep(readyDiscovery(dir), nowOpt);
  return { propose, review, overlay };
}

function sampleApproveInput(overrides: { status?: 'approved' | 'rejected'; reviewer?: string; rationale?: string } = {}) {
  return {
    reviewer: overrides.reviewer ?? 'designer:hill',
    status: overrides.status ?? ('approved' as const),
    rationale: overrides.rationale ?? 'Clear, on-brand, and well-evidenced.',
  };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runApproveStep — successful approval', () => {
  it('creates overlay-approval-package.json alongside the existing propose/review/overlay artifacts', () => {
    const dir = makeTmpDir();
    setUpCandidate(dir);
    const result = runApproveStep(readyDiscovery(dir), sampleApproveInput());
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME))).toBe(true);
    expect(result.approvalPackagePath).toBe(join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME));
    expect(result.approvalPackage.approval.decision.status).toBe('approved');
  });

  it('creates ONLY overlay-approval-package.json in addition to the five prior files — no materialization/activation artifact', () => {
    const dir = makeTmpDir();
    setUpCandidate(dir);
    runApproveStep(readyDiscovery(dir), sampleApproveInput());
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual(
      [
        PROPOSAL_PACKAGE_FILENAME,
        'proposal-report.md',
        PROPOSAL_REVIEW_FILENAME,
        'proposal-review.md',
        OVERLAY_CANDIDATE_PACKAGE_FILENAME,
        OVERLAY_APPROVAL_PACKAGE_FILENAME,
      ].sort(),
    );
  });

  it('carries sourceReviewSubject through when proposal-review.json is present on disk', () => {
    const dir = makeTmpDir();
    const { review } = setUpCandidate(dir);
    const result = runApproveStep(readyDiscovery(dir), sampleApproveInput());
    expect(result.approvalPackage.approval.sourceReviewSubject).toBe(review.reviewReport.subject);
  });

  it('returns an ApprovalPackage identical to calling recordOverlayApproval + buildApprovalPackage directly', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T03:00:00.000Z';
    const { overlay, review } = setUpCandidate(dir, { now });
    const input = sampleApproveInput();
    const result = runApproveStep(readyDiscovery(dir), input, { now });
    const expectedApproval = recordOverlayApproval(
      { candidate: overlay.overlayCandidatePackage.translation.candidate, review: review.reviewReport, ...input },
      { now },
    );
    const expected = buildApprovalPackage({ approval: expectedApproval }, { now });
    expect(result.approvalPackage).toEqual(expected);
  });
});

describe('runApproveStep — rejected approval', () => {
  it('records a rejected decision when status is "rejected"', () => {
    const dir = makeTmpDir();
    setUpCandidate(dir);
    const result = runApproveStep(readyDiscovery(dir), sampleApproveInput({ status: 'rejected', rationale: 'Off-brand tone.' }));
    expect(result.approvalPackage.approval.decision.status).toBe('rejected');
  });
});

describe('runApproveStep — malformed candidate package', () => {
  it('throws DesignerAuthorApprovalError when no overlay-candidate-package.json exists yet', () => {
    const dir = makeTmpDir();
    expect(() => runApproveStep(readyDiscovery(dir), sampleApproveInput())).toThrow(DesignerAuthorApprovalError);
  });

  it('throws DesignerAuthorApprovalError when overlay-candidate-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    setUpCandidate(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runApproveStep(readyDiscovery(dir), sampleApproveInput())).toThrow(DesignerAuthorApprovalError);
  });
});

describe('runApproveStep — deterministic replay', () => {
  it('identical candidate + review + input + injected clock produce a byte-identical ApprovalPackage across two dirs', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpCandidate(dirA, { now });
    setUpCandidate(dirB, { now });
    const resultA = runApproveStep(readyDiscovery(dirA), sampleApproveInput(), { now });
    const resultB = runApproveStep(readyDiscovery(dirB), sampleApproveInput(), { now });
    expect(resultA.approvalPackage).toEqual(resultB.approvalPackage);
  });

  it('approval id (content-derived) is stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    setUpCandidate(dirA);
    setUpCandidate(dirB);
    const resultA = runApproveStep(readyDiscovery(dirA), sampleApproveInput());
    const resultB = runApproveStep(readyDiscovery(dirB), sampleApproveInput());
    expect(resultA.approvalPackage.approval.id).toBe(resultB.approvalPackage.approval.id);
  });
});

describe('runApproveStep — persistence', () => {
  it('the persisted overlay-approval-package.json parses back to the returned ApprovalPackage', () => {
    const dir = makeTmpDir();
    setUpCandidate(dir);
    const result = runApproveStep(readyDiscovery(dir), sampleApproveInput());
    const onDisk = JSON.parse(readFileSync(result.approvalPackagePath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.approvalPackage)));
  });
});

describe('runApproveStep — repeated execution', () => {
  it('re-running with identical input leaves the persisted file byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpCandidate(dir, { now });
    const first = runApproveStep(readyDiscovery(dir), sampleApproveInput(), { now });
    const firstJson = readFileSync(first.approvalPackagePath, 'utf8');
    const second = runApproveStep(readyDiscovery(dir), sampleApproveInput(), { now });
    expect(readFileSync(second.approvalPackagePath, 'utf8')).toBe(firstJson);
  });

  it('FALSIFICATION: changing only the approval decision changes only the approval artifact — proposal/review/candidate files stay byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpCandidate(dir, { now });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

    const otherFiles = [PROPOSAL_PACKAGE_FILENAME, 'proposal-report.md', PROPOSAL_REVIEW_FILENAME, 'proposal-review.md', OVERLAY_CANDIDATE_PACKAGE_FILENAME];
    const before = Object.fromEntries(otherFiles.map((f) => [f, readFileSync(join(outDir, f), 'utf8')]));

    const first = runApproveStep(readyDiscovery(dir), sampleApproveInput({ status: 'approved' }), { now });
    const second = runApproveStep(readyDiscovery(dir), sampleApproveInput({ status: 'rejected', rationale: 'Changed my mind.' }), { now });

    expect(first.approvalPackage.approval.decision.status).toBe('approved');
    expect(second.approvalPackage.approval.decision.status).toBe('rejected');
    expect(second.approvalPackage.approval.id).not.toBe(first.approvalPackage.approval.id);

    for (const f of otherFiles) {
      expect(readFileSync(join(outDir, f), 'utf8')).toBe(before[f]);
    }
  });
});

describe('structural isolation — run-approve.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-approve.ts', import.meta.url)), 'utf8');
  }

  it('never imports materialization/activation, the real overlay store, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/overlay-materialization|overlay-activation/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses recordOverlayApproval, buildApprovalPackage, writeApprovalPackage, and readOverlayCandidatePackage rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/recordOverlayApproval/);
    expect(source).toMatch(/buildApprovalPackage/);
    expect(source).toMatch(/writeApprovalPackage/);
    expect(source).toMatch(/readOverlayCandidatePackage/);
  });
});
