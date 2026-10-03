/**
 * P38 — Designer Author Script: overlay-activation orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful activation, revoked
 * activation, malformed materialization package (missing / unparsable
 * overlay-materialization-package.json), deterministic replay, persistence, and repeated
 * execution. Includes the falsification test required by the brief: changing only activation
 * inputs changes only the activation artifact — every proposal/review/candidate/
 * approval/materialization file under designer-author/ stays byte-identical.
 *
 * runRevokeStep deliberately persists NOTHING (see run-activate.ts's own header) — the brief's
 * OUTPUT section caps designer-author/ at exactly eight named artifacts, and there is no
 * RevocationPackage/writer counterpart in the reused P16 model to persist one with. "Revoked
 * activation" coverage is therefore proven by calling runRevokeStep and feeding its returned
 * ActivationRevocation into the reused resolveActivationStatus (overlay-activation.ts, P16,
 * verbatim), and by proving runRevokeStep creates no new file.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runActivateStep, runRevokeStep, OVERLAY_ACTIVATION_PACKAGE_FILENAME, DesignerAuthorActivationError } from '../../src/designer-author/run-activate.js';
import { runProposeStep, DESIGNER_AUTHOR_OUTPUT_DIRNAME, PROPOSAL_PACKAGE_FILENAME } from '../../src/designer-author/run-propose.js';
import { runReviewStep, PROPOSAL_REVIEW_FILENAME } from '../../src/designer-author/run-review.js';
import { runOverlayStep, OVERLAY_CANDIDATE_PACKAGE_FILENAME } from '../../src/designer-author/run-overlay.js';
import { runApproveStep, OVERLAY_APPROVAL_PACKAGE_FILENAME } from '../../src/designer-author/run-approve.js';
import { runMaterializeStep, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME } from '../../src/designer-author/run-materialize.js';
import { recordOverlayActivation, resolveActivationStatus } from '../../src/designer-author/overlay-activation.js';
import { buildActivationPackage } from '../../src/designer-author/overlay-activation-package.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-activate-'));
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

function setUpMaterialized(dir: string, overrides: { now?: () => string } = {}) {
  const nowOpt = overrides.now !== undefined ? { now: overrides.now } : {};
  const propose = runProposeStep(readyDiscovery(dir), { intent: 'A punchier hero with a single, clearer CTA', family: 'family-hero', authoredBy: 'designer:hill' }, nowOpt);
  const review = runReviewStep(readyDiscovery(dir), nowOpt);
  const overlay = runOverlayStep(readyDiscovery(dir), nowOpt);
  const approve = runApproveStep(readyDiscovery(dir), { reviewer: 'designer:hill', status: 'approved', rationale: 'Clear, on-brand, and well-evidenced.' }, nowOpt);
  const materialize = runMaterializeStep(readyDiscovery(dir), nowOpt);
  return { propose, review, overlay, approve, materialize };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runActivateStep — successful activation', () => {
  it('creates overlay-activation-package.json alongside the existing prior artifacts', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    const result = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, OVERLAY_ACTIVATION_PACKAGE_FILENAME))).toBe(true);
    expect(result.activationPackagePath).toBe(join(outDir, OVERLAY_ACTIVATION_PACKAGE_FILENAME));
  });

  it('creates ONLY overlay-activation-package.json in addition to the seven prior files — no Frozen overlay, no overlay/, no review session, no workspace', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
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
        OVERLAY_ACTIVATION_PACKAGE_FILENAME,
      ].sort(),
    );
  });

  it('the activation record correctly traces back to its materialized overlay', () => {
    const dir = makeTmpDir();
    const { materialize } = setUpMaterialized(dir);
    const result = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const activation = result.activationPackage.activation;
    const materialized = materialize.materializationPackage.materialization.materialized;
    expect(activation.sourceMaterializedId).toBe(materialized.id);
    expect(activation.sourceApprovalId).toBe(materialized.sourceApprovalId);
    expect(activation.sourceCandidateId).toBe(materialized.sourceCandidateId);
    expect(activation.sourceProposalId).toBe(materialized.sourceProposalId);
  });

  it('returns an ActivationPackage identical to calling recordOverlayActivation + buildActivationPackage directly', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T05:00:00.000Z';
    const { materialize } = setUpMaterialized(dir, { now });
    const result = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' }, { now });
    const expectedActivation = recordOverlayActivation(materialize.materializationPackage.materialization.materialized, { activatedBy: 'designer:hill' }, { now });
    const expected = buildActivationPackage({ activation: expectedActivation }, { now });
    expect(result.activationPackage).toEqual(expected);
  });
});

describe('runActivateStep — malformed materialization package', () => {
  it('throws DesignerAuthorActivationError when no overlay-materialization-package.json exists yet', () => {
    const dir = makeTmpDir();
    expect(() => runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' })).toThrow(DesignerAuthorActivationError);
  });

  it('throws DesignerAuthorActivationError when overlay-materialization-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, OVERLAY_MATERIALIZATION_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' })).toThrow(DesignerAuthorActivationError);
  });
});

describe('runActivateStep — deterministic replay', () => {
  it('identical materialized overlay + activatedBy + injected clock produce a byte-identical ActivationPackage across two dirs', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpMaterialized(dirA, { now });
    setUpMaterialized(dirB, { now });
    const resultA = runActivateStep(readyDiscovery(dirA), { activatedBy: 'designer:hill' }, { now });
    const resultB = runActivateStep(readyDiscovery(dirB), { activatedBy: 'designer:hill' }, { now });
    expect(resultA.activationPackage).toEqual(resultB.activationPackage);
  });

  it('activation id (content-derived) is stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    setUpMaterialized(dirA);
    setUpMaterialized(dirB);
    const resultA = runActivateStep(readyDiscovery(dirA), { activatedBy: 'designer:hill' });
    const resultB = runActivateStep(readyDiscovery(dirB), { activatedBy: 'designer:hill' });
    expect(resultA.activationPackage.activation.id).toBe(resultB.activationPackage.activation.id);
  });
});

describe('runActivateStep — persistence', () => {
  it('the persisted overlay-activation-package.json parses back to the returned ActivationPackage', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    const result = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const onDisk = JSON.parse(readFileSync(result.activationPackagePath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.activationPackage)));
  });
});

describe('runActivateStep — repeated execution', () => {
  it('re-running with identical input leaves the persisted file byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpMaterialized(dir, { now });
    const first = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' }, { now });
    const firstJson = readFileSync(first.activationPackagePath, 'utf8');
    const second = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' }, { now });
    expect(readFileSync(second.activationPackagePath, 'utf8')).toBe(firstJson);
  });
});

describe('runRevokeStep — revoked activation', () => {
  it('records a revocation referencing the original activation id', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    const activate = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const result = runRevokeStep(readyDiscovery(dir), { revokedBy: 'designer:hill', reason: 'Superseded by a newer proposal.' });
    expect(result.revocation.activationId).toBe(activate.activationPackage.activation.id);
  });

  it('resolveActivationStatus reports "revoked" once a revocation is applied, and "activated" before', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    const activate = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    expect(resolveActivationStatus(activate.activationPackage.activation, [])).toBe('activated');
    const result = runRevokeStep(readyDiscovery(dir), { revokedBy: 'designer:hill', reason: 'Superseded.' });
    expect(resolveActivationStatus(activate.activationPackage.activation, [result.revocation])).toBe('revoked');
  });

  it('persists NOTHING new — designer-author/ still contains exactly the eight prior artifacts after a revoke', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const before = readdirSync(outDir).sort();
    runRevokeStep(readyDiscovery(dir), { revokedBy: 'designer:hill', reason: 'Superseded.' });
    const after = readdirSync(outDir).sort();
    expect(after).toEqual(before);
  });

  it('throws DesignerAuthorActivationError when no overlay-activation-package.json exists yet (nothing to revoke)', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    expect(() => runRevokeStep(readyDiscovery(dir), { revokedBy: 'designer:hill', reason: 'x' })).toThrow(DesignerAuthorActivationError);
  });

  it('throws DesignerAuthorActivationError when overlay-activation-package.json is unparsable JSON', () => {
    const dir = makeTmpDir();
    setUpMaterialized(dir);
    runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    writeFileSync(join(outDir, OVERLAY_ACTIVATION_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    expect(() => runRevokeStep(readyDiscovery(dir), { revokedBy: 'designer:hill', reason: 'x' })).toThrow(DesignerAuthorActivationError);
  });
});

describe('falsification: changing only activation inputs changes only the activation artifact', () => {
  it('re-activating with a different activatedBy changes overlay-activation-package.json only — all seven prior files stay byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    setUpMaterialized(dir, { now });
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);

    const upstreamFiles = [
      PROPOSAL_PACKAGE_FILENAME,
      'proposal-report.md',
      PROPOSAL_REVIEW_FILENAME,
      'proposal-review.md',
      OVERLAY_CANDIDATE_PACKAGE_FILENAME,
      OVERLAY_APPROVAL_PACKAGE_FILENAME,
      OVERLAY_MATERIALIZATION_PACKAGE_FILENAME,
    ];
    const before = Object.fromEntries(upstreamFiles.map((f) => [f, readFileSync(join(outDir, f), 'utf8')]));

    const first = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:hill' }, { now });
    const second = runActivateStep(readyDiscovery(dir), { activatedBy: 'designer:someone-else' }, { now });

    expect(second.activationPackage.activation.id).not.toBe(first.activationPackage.activation.id);
    for (const f of upstreamFiles) {
      expect(readFileSync(join(outDir, f), 'utf8')).toBe(before[f]);
    }
  });
});

describe('structural isolation — run-activate.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-activate.ts', import.meta.url)), 'utf8');
  }

  it('never imports the real overlay store, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/from ['"]\.\.\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses recordOverlayActivation, revokeOverlayActivation, buildActivationPackage, writeActivationPackage, readActivationPackage, and readMaterializationPackage rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/recordOverlayActivation/);
    expect(source).toMatch(/revokeOverlayActivation/);
    expect(source).toMatch(/buildActivationPackage/);
    expect(source).toMatch(/writeActivationPackage/);
    expect(source).toMatch(/readActivationPackage/);
    expect(source).toMatch(/readMaterializationPackage/);
  });
});
