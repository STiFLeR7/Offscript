/**
 * P37 — Designer Author Script: overlay-materialization orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful materialization,
 * rejected approval (cannot be materialized), approval/candidate mismatch, malformed approval
 * package (missing / unparsable overlay-approval-package.json), deterministic replay, and
 * persistence. Includes the falsification test required by the brief: changing only the
 * approval artifact changes only the materialized package — every proposal/review/candidate
 * file under designer-author/ stays byte-identical.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMaterializeStep, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME, DesignerAuthorMaterializationError } from '../../src/designer-author/run-materialize.js';
import { runProposeStep, DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from '../../src/designer-author/run-propose.js';
import { runReviewStep, PROPOSAL_REVIEW_FILENAME } from '../../src/designer-author/run-review.js';
import { runOverlayStep, OVERLAY_CANDIDATE_PACKAGE_FILENAME } from '../../src/designer-author/run-overlay.js';
import { runApproveStep, OVERLAY_APPROVAL_PACKAGE_FILENAME } from '../../src/designer-author/run-approve.js';
import { materializeOverlayCandidate, MaterializationError } from '../../src/designer-author/overlay-materialization.js';
import { buildMaterializationPackage } from '../../src/designer-author/overlay-materialization-package.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-materialize-'));
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

function setUpApprovedCandidate(dir: string, overrides: { intent?: string; status?: 'approved' | 'rejected'; rationale?: string; now?: () => string } = {}) {
  const nowOpt = overrides.now !== undefined ? { now: overrides.now } : {};
  const propose = runProposeStep(
    readyDiscovery(dir),
    { intent: overrides.intent ?? 'A punchier hero with a single, clearer CTA', family: 'family-hero', authoredBy: 'designer:hill' },
    nowOpt,
  );
  const review = runReviewStep(readyDiscovery(dir), nowOpt);
  const overlay = runOverlayStep(readyDiscovery(dir), nowOpt);
  const approve = runApproveStep(
    readyDiscovery(dir),
    { reviewer: 'designer:hill', status: overrides.status ?? 'approved', rationale: overrides.rationale ?? 'Clear, on-brand, and well-evidenced.' },
    nowOpt,
  );
  return { propose, review, overlay, approve };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runMaterializeStep — successful materialization', () => {
  it('creates overlay-materialization-package.json alongside the existing propose/review/overlay/approve artifacts', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir);
    const result = runMaterializeStep(readyDiscovery(dir));
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME))).toBe(true);
    expect(result.materializationPackagePath).toBe(join(outDir, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME));
  });

  it('creates ONLY overlay-materialization-package.json in addition to the six prior files — no activation artifact, no Frozen overlay, no overlay/', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir);
    runMaterializeStep(readyDiscovery(dir));
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
        OVERLAY_MATERIALIZATION_PACKAGE_FILENAME,
      ].sort(),
    );
  });

  it('the materialized record correctly traces back to its candidate and approval', () => {
    const dir = makeTmpDir();
    const { overlay, approve } = setUpApprovedCandidate(dir);
    const result = runMaterializeStep(readyDiscovery(dir));
    const materialized = result.materializationPackage.materialization.materialized;
    expect(materialized.sourceCandidateId).toBe(overlay.overlayCandidatePackage.translation.candidate.id);
    expect(materialized.sourceApprovalId).toBe(approve.approvalPackage.approval.id);
  });

  it('returns a MaterializationPackage identical to calling materializeOverlayCandidate + buildMaterializationPackage directly', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T04:00:00.000Z';
    const { overlay, approve } = setUpApprovedCandidate(dir, { now });
    const result = runMaterializeStep(readyDiscovery(dir), { now });
    const expectedReport = materializeOverlayCandidate(overlay.overlayCandidatePackage.translation.candidate, approve.approvalPackage.approval, { now });
    const expected = buildMaterializationPackage({ materialization: expectedReport }, { now });
    expect(result.materializationPackage).toEqual(expected);
  });
});

describe('runMaterializeStep — rejected approval', () => {
  it('throws (propagates MaterializationError) when the recorded decision is "rejected" — a rejected candidate cannot be materialized', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir, { status: 'rejected', rationale: 'Off-brand tone.' });
    expect(() => runMaterializeStep(readyDiscovery(dir))).toThrow(MaterializationError);
  });
});

describe('runMaterializeStep — approval/candidate mismatch', () => {
  it('throws (propagates MaterializationError) when the persisted approval.candidateId does not match the persisted candidate.id', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const approvalPath = join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME);
    const tampered = JSON.parse(readFileSync(approvalPath, 'utf8'));
    tampered.approval.candidateId = 'proposal-overlay:not-the-real-candidate';
    writeFileSync(approvalPath, JSON.stringify(tampered, null, 2), 'utf8');
    expect(() => runMaterializeStep(readyDiscovery(dir))).toThrow(MaterializationError);
  });
});

describe('runMaterializeStep — malformed approval package', () => {
  it('throws DesignerAuthorMaterializationError when no overlay-approval-package.json exists yet', () => {
    const dir = makeTmpDir();
    runProposeStep(readyDiscovery(dir), { intent: 'x', family: 'family-hero', authoredBy: 'designer:hill' });
    runReviewStep(readyDiscovery(dir));
    runOverlayStep(readyDiscovery(dir));
    expect(() => runMaterializeStep(readyDiscovery(dir))).toThrow(DesignerAuthorMaterializationError);
  });

  it('throws DesignerAuthorMaterializationError when overlay-approval-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, OVERLAY_APPROVAL_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runMaterializeStep(readyDiscovery(dir))).toThrow(DesignerAuthorMaterializationError);
  });

  it('throws DesignerAuthorMaterializationError when no overlay-candidate-package.json exists yet either', () => {
    const dir = makeTmpDir();
    expect(() => runMaterializeStep(readyDiscovery(dir))).toThrow(DesignerAuthorMaterializationError);
  });
});

describe('runMaterializeStep — deterministic replay', () => {
  it('identical candidate + approval + injected clock produce a byte-identical MaterializationPackage across two dirs', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpApprovedCandidate(dirA, { now });
    setUpApprovedCandidate(dirB, { now });
    const resultA = runMaterializeStep(readyDiscovery(dirA), { now });
    const resultB = runMaterializeStep(readyDiscovery(dirB), { now });
    expect(resultA.materializationPackage).toEqual(resultB.materializationPackage);
  });

  it('materialized id (content-derived from candidate.id + approval.id) is stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    setUpApprovedCandidate(dirA);
    setUpApprovedCandidate(dirB);
    const resultA = runMaterializeStep(readyDiscovery(dirA));
    const resultB = runMaterializeStep(readyDiscovery(dirB));
    expect(resultA.materializationPackage.materialization.materialized.id).toBe(resultB.materializationPackage.materialization.materialized.id);
  });
});

describe('runMaterializeStep — persistence', () => {
  it('the persisted overlay-materialization-package.json parses back to the returned MaterializationPackage', () => {
    const dir = makeTmpDir();
    setUpApprovedCandidate(dir);
    const result = runMaterializeStep(readyDiscovery(dir));
    const onDisk = JSON.parse(readFileSync(result.materializationPackagePath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.materializationPackage)));
  });

  it('re-running against the same candidate/approval leaves the persisted file byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpApprovedCandidate(dir, { now });
    const first = runMaterializeStep(readyDiscovery(dir), { now });
    const firstJson = readFileSync(first.materializationPackagePath, 'utf8');
    const second = runMaterializeStep(readyDiscovery(dir), { now });
    expect(readFileSync(second.materializationPackagePath, 'utf8')).toBe(firstJson);
  });
});

describe('runMaterializeStep — falsification: changing only the approval artifact changes only the materialized package', () => {
  it('re-approving with a different rationale changes overlay-materialization-package.json only — proposal/review/candidate files stay byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpApprovedCandidate(dir, { now, rationale: 'first rationale' });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

    const upstreamFiles = [PROPOSAL_PACKAGE_FILENAME, 'proposal-report.md', PROPOSAL_REVIEW_FILENAME, 'proposal-review.md', OVERLAY_CANDIDATE_PACKAGE_FILENAME];
    const before = Object.fromEntries(upstreamFiles.map((f) => [f, readFileSync(join(outDir, f), 'utf8')]));

    const first = runMaterializeStep(readyDiscovery(dir), { now });

    // Change ONLY the approval artifact (re-approve with a different rationale, still approved).
    runApproveStep(readyDiscovery(dir), { reviewer: 'designer:hill', status: 'approved', rationale: 'second, different rationale' }, { now });
    const second = runMaterializeStep(readyDiscovery(dir), { now });

    expect(second.materializationPackage.materialization.materialized.id).not.toBe(first.materializationPackage.materialization.materialized.id);
    for (const f of upstreamFiles) {
      expect(readFileSync(join(outDir, f), 'utf8')).toBe(before[f]);
    }
  });
});

describe('structural isolation — run-materialize.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-materialize.ts', import.meta.url)), 'utf8');
  }

  it('never imports activation, the real overlay store, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/overlay-activation/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses materializeOverlayCandidate, buildMaterializationPackage, writeMaterializationPackage, readOverlayCandidatePackage, and readApprovalPackage rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/materializeOverlayCandidate/);
    expect(source).toMatch(/buildMaterializationPackage/);
    expect(source).toMatch(/writeMaterializationPackage/);
    expect(source).toMatch(/readOverlayCandidatePackage/);
    expect(source).toMatch(/readApprovalPackage/);
  });
});
