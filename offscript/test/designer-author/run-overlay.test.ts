/**
 * P35 — Designer Author Script: overlay-candidate orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful overlay-candidate
 * generation, deterministic replay (the falsification requirement: identical ProposalPackages
 * and ProposalReviews produce identical OverlayCandidatePackages), output persistence, malformed
 * ProposalPackage (missing / unparsable proposal-package.json), malformed Proposal Review
 * (missing / unparsable proposal-review.json), repeated execution, and the structural isolation
 * guarantee that this module never imports approval/materialization/activation code, the real
 * overlay store, or subagent-dispatch code.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOverlayStep, OVERLAY_CANDIDATE_PACKAGE_FILENAME, DesignerAuthorOverlayError } from '../../src/designer-author/run-overlay.js';
import { runProposeStep, DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from '../../src/designer-author/run-propose.js';
import { runReviewStep, PROPOSAL_REVIEW_FILENAME } from '../../src/designer-author/run-review.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { buildOverlayCandidatePackage } from '../../src/designer-author/proposal-overlay-package.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-overlay-'));
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

function proposeAndReview(dir: string, overrides: { intent?: string; now?: () => string } = {}) {
  const propose = runProposeStep(
    readyDiscovery(dir),
    {
      intent: overrides.intent ?? 'A punchier hero with a single, clearer CTA',
      family: 'family-hero',
      authoredBy: 'designer:hill',
    },
    overrides.now !== undefined ? { now: overrides.now } : {},
  );
  const review = runReviewStep(readyDiscovery(dir), overrides.now !== undefined ? { now: overrides.now } : {});
  return { propose, review };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runOverlayStep — successful overlay-candidate generation', () => {
  it('creates overlay-candidate-package.json alongside the existing propose/review artifacts', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir);
    const result = runOverlayStep(readyDiscovery(dir));
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME))).toBe(true);
    expect(result.overlayCandidatePackagePath).toBe(join(outDir, OVERLAY_CANDIDATE_PACKAGE_FILENAME));
  });

  it('creates ONLY overlay-candidate-package.json in addition to the four propose/review files — no approval/materialization/activation artifact', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir);
    runOverlayStep(readyDiscovery(dir));
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual(
      [PROPOSAL_PACKAGE_FILENAME, 'proposal-report.md', PROPOSAL_REVIEW_FILENAME, 'proposal-review.md', OVERLAY_CANDIDATE_PACKAGE_FILENAME].sort(),
    );
  });

  it('returns an OverlayCandidatePackage identical to calling translateProposalToOverlayCandidate + buildOverlayCandidatePackage directly', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T02:00:00.000Z';
    const { propose } = proposeAndReview(dir, { now });
    const result = runOverlayStep(readyDiscovery(dir), { now });
    const expectedTranslation = translateProposalToOverlayCandidate(propose.proposalPackage.proposal, { now });
    const expected = buildOverlayCandidatePackage({ translation: expectedTranslation }, { now });
    expect(result.overlayCandidatePackage).toEqual(expected);
  });
});

describe('runOverlayStep — malformed ProposalPackage', () => {
  it('throws DesignerAuthorOverlayError when no proposal-package.json exists yet', () => {
    const dir = makeTmpDir();
    expect(() => runOverlayStep(readyDiscovery(dir))).toThrow(DesignerAuthorOverlayError);
  });

  it('throws DesignerAuthorOverlayError when proposal-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, PROPOSAL_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runOverlayStep(readyDiscovery(dir))).toThrow(DesignerAuthorOverlayError);
  });
});

describe('runOverlayStep — malformed Proposal Review', () => {
  it('throws DesignerAuthorOverlayError when proposed but not yet reviewed (no proposal-review.json)', () => {
    const dir = makeTmpDir();
    runProposeStep(readyDiscovery(dir), { intent: 'x', family: 'family-hero', authoredBy: 'designer:hill' });
    expect(() => runOverlayStep(readyDiscovery(dir))).toThrow(DesignerAuthorOverlayError);
  });

  it('throws DesignerAuthorOverlayError when proposal-review.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, PROPOSAL_REVIEW_FILENAME), '{ not valid json', 'utf8');
    expect(() => runOverlayStep(readyDiscovery(dir))).toThrow(DesignerAuthorOverlayError);
  });

  it('does NOT gate on reviewStatus — a "blocked" review still produces an overlay candidate', () => {
    const dir = makeTmpDir();
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    proposeAndReview(dir);
    const blockedReview = { subject: 'x', generatedAt: '2026-07-13T00:00:00.000Z', reviewStatus: 'blocked', findingCount: 1, findings: [] };
    writeFileSync(join(outDir, PROPOSAL_REVIEW_FILENAME), JSON.stringify(blockedReview, null, 2), 'utf8');
    expect(() => runOverlayStep(readyDiscovery(dir))).not.toThrow();
  });
});

describe('runOverlayStep — output persistence', () => {
  it('the persisted overlay-candidate-package.json parses back to the returned OverlayCandidatePackage', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir);
    const result = runOverlayStep(readyDiscovery(dir));
    const onDisk = JSON.parse(readFileSync(result.overlayCandidatePackagePath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.overlayCandidatePackage)));
  });
});

describe('runOverlayStep — deterministic replay', () => {
  it('identical ProposalPackage + ProposalReview + injected clock produce a byte-identical OverlayCandidatePackage across two dirs', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    proposeAndReview(dirA, { now });
    proposeAndReview(dirB, { now });
    const resultA = runOverlayStep(readyDiscovery(dirA), { now });
    const resultB = runOverlayStep(readyDiscovery(dirB), { now });
    expect(resultA.overlayCandidatePackage).toEqual(resultB.overlayCandidatePackage);
  });

  it('candidate id (content-derived from the proposal identity) is stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    proposeAndReview(dirA);
    proposeAndReview(dirB);
    const resultA = runOverlayStep(readyDiscovery(dirA));
    const resultB = runOverlayStep(readyDiscovery(dirB));
    expect(resultA.overlayCandidatePackage.translation.candidate.id).toBe(resultB.overlayCandidatePackage.translation.candidate.id);
  });
});

describe('runOverlayStep — repeated execution', () => {
  it('re-running against the same proposal/review leaves the persisted file byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    proposeAndReview(dir, { now });
    const first = runOverlayStep(readyDiscovery(dir), { now });
    const firstJson = readFileSync(first.overlayCandidatePackagePath, 'utf8');
    const second = runOverlayStep(readyDiscovery(dir), { now });
    expect(readFileSync(second.overlayCandidatePackagePath, 'utf8')).toBe(firstJson);
  });

  it('re-translating after the underlying proposal was re-proposed and re-reviewed with different intent overwrites with a new candidate id', () => {
    const dir = makeTmpDir();
    proposeAndReview(dir, { intent: 'first idea' });
    const first = runOverlayStep(readyDiscovery(dir));
    proposeAndReview(dir, { intent: 'second, materially different idea' });
    const second = runOverlayStep(readyDiscovery(dir));
    expect(second.overlayCandidatePackage.translation.candidate.id).not.toBe(first.overlayCandidatePackage.translation.candidate.id);
    const onDisk = JSON.parse(readFileSync(second.overlayCandidatePackagePath, 'utf8'));
    expect(onDisk.translation.candidate.id).toBe(second.overlayCandidatePackage.translation.candidate.id);
  });
});

describe('structural isolation — run-overlay.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-overlay.ts', import.meta.url)), 'utf8');
  }

  it('never imports approval/materialization/activation, the real overlay store, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/overlay-approval|overlay-materialization|overlay-activation/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses translateProposalToOverlayCandidate, buildOverlayCandidatePackage, and writeOverlayCandidatePackage rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/translateProposalToOverlayCandidate/);
    expect(source).toMatch(/buildOverlayCandidatePackage/);
    expect(source).toMatch(/writeOverlayCandidatePackage/);
  });
});
