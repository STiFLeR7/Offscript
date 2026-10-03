/**
 * P33 — Designer Author Script: proposal-generation orchestration.
 *
 * RED-first per superpowers:test-driven-development. Covers successful generation,
 * deterministic replay (the falsification requirement: identical completed runs generate
 * identical ProposalPackages), output persistence, repeated execution, and the structural
 * isolation guarantee that this module never imports review/overlay/subagent-dispatch code.
 *
 * "Malformed ReviewPackage" / "malformed DoctorReport" are NOT re-tested here: run-propose.ts
 * only accepts a `ReadyDiscovery` — a TYPE `discoverRunArtifacts` (P32) can only construct once
 * both artifacts parsed successfully — so a malformed run structurally cannot reach this module.
 * That boundary is proven at the script/production-verification level (P33 report §6), where
 * `--step=propose` is run against invalid/not-ready/malformed directories and confirmed to
 * produce no proposal artifacts.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProposeRequest,
  runProposeStep,
  DESIGNER_AUTHOR_OUTPUT_DIRNAME,
  PROPOSAL_PACKAGE_FILENAME,
  PROPOSAL_REPORT_FILENAME,
  type ProposeCliInput,
} from '../../src/designer-author/run-propose.js';
import type { ReadyDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';
import { renderProposalManifestReport, buildProposalManifestReport } from '../../src/designer-author/proposal-report.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-propose-'));
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

function readyDiscovery(dir: string, reviewPackage = sampleReviewPackage(), doctorReport = sampleDoctorReport()): ReadyDiscovery {
  return { status: 'ready', dir, reviewPackage, doctorReport };
}

function sampleInput(overrides: Partial<ProposeCliInput> = {}): ProposeCliInput {
  return {
    intent: 'A punchier hero with a single, clearer CTA',
    family: 'family-hero',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildProposeRequest', () => {
  it('derives origin.client / origin.track from the discovery\'s own ReviewPackage metadata', () => {
    const discovery = readyDiscovery('/d', sampleReviewPackage({ client: 'globex', track: 'collateral' } as any));
    const request = buildProposeRequest(discovery, sampleInput());
    expect(request.origin.client).toBe('globex');
    expect(request.origin.track).toBe('collateral');
  });

  it('defaults kind to component when not supplied', () => {
    const request = buildProposeRequest(readyDiscovery('/d'), sampleInput());
    expect(request.kind).toBe('component');
  });

  it('carries a supplied kind and parentComponent through verbatim', () => {
    const request = buildProposeRequest(readyDiscovery('/d'), sampleInput({ kind: 'variant', parentComponent: 'hero-bento' }));
    expect(request.kind).toBe('variant');
    expect(request.parentComponent).toBe('hero-bento');
  });

  it('omits parentComponent entirely when not supplied', () => {
    const request = buildProposeRequest(readyDiscovery('/d'), sampleInput());
    expect('parentComponent' in request).toBe(false);
  });

  it('carries designerIntent and semanticFamily verbatim from CLI input', () => {
    const request = buildProposeRequest(readyDiscovery('/d'), sampleInput({ intent: 'X', family: 'family-cta' }));
    expect(request.designerIntent).toBe('X');
    expect(request.semanticFamily).toBe('family-cta');
  });
});

describe('runProposeStep — successful generation', () => {
  it('creates the designer-author/ output directory with both artifacts', () => {
    const dir = makeTmpDir();
    const result = runProposeStep(readyDiscovery(dir), sampleInput());
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    expect(existsSync(join(outDir, PROPOSAL_PACKAGE_FILENAME))).toBe(true);
    expect(existsSync(join(outDir, PROPOSAL_REPORT_FILENAME))).toBe(true);
    expect(result.proposalPackagePath).toBe(join(outDir, PROPOSAL_PACKAGE_FILENAME));
    expect(result.reportPath).toBe(join(outDir, PROPOSAL_REPORT_FILENAME));
  });

  it('creates ONLY proposal-package.json and proposal-report.md — no review/overlay/approval/activation artifact', () => {
    const dir = makeTmpDir();
    runProposeStep(readyDiscovery(dir), sampleInput());
    const outDir = join(dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual([PROPOSAL_PACKAGE_FILENAME, PROPOSAL_REPORT_FILENAME]);
  });

  it('returns a ProposalPackage whose proposal carries the supplied content', () => {
    const dir = makeTmpDir();
    const result = runProposeStep(readyDiscovery(dir), sampleInput({ family: 'family-hero' }));
    expect(result.proposalPackage.proposal.semanticFamily).toBe('family-hero');
    expect(result.proposalPackage.proposal.status).toBe('draft');
    expect(result.proposalPackage.proposal.content).toContain('A punchier hero');
  });
});

describe('runProposeStep — output persistence', () => {
  it('the persisted proposal-package.json parses back to the returned ProposalPackage', () => {
    const dir = makeTmpDir();
    const result = runProposeStep(readyDiscovery(dir), sampleInput());
    const onDisk = JSON.parse(readFileSync(result.proposalPackagePath, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(result.proposalPackage)));
  });

  it('the persisted proposal-report.md matches the reused renderProposalManifestReport output', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    const result = runProposeStep(readyDiscovery(dir), sampleInput(), { now });
    const expectedReport = renderProposalManifestReport(
      buildProposalManifestReport([result.proposalPackage.proposal], { now }),
    );
    expect(readFileSync(result.reportPath, 'utf8')).toBe(expectedReport);
    expect(result.reportMarkdown).toBe(expectedReport);
  });
});

describe('runProposeStep — deterministic replay', () => {
  it('identical discovery + input + injected clock produce a byte-identical ProposalPackage', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    const resultA = runProposeStep(readyDiscovery(dirA), sampleInput(), { now });
    const resultB = runProposeStep(readyDiscovery(dirB), sampleInput(), { now });
    expect(resultA.proposalPackage).toEqual(resultB.proposalPackage);
  });

  it('identity.id (content hash) is stable across calls even without an injected clock', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const resultA = runProposeStep(readyDiscovery(dirA), sampleInput());
    const resultB = runProposeStep(readyDiscovery(dirB), sampleInput());
    expect(resultA.proposalPackage.proposal.identity.id).toBe(resultB.proposalPackage.proposal.identity.id);
  });

  it('a different designerIntent yields a different identity.id', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const resultA = runProposeStep(readyDiscovery(dirA), sampleInput({ intent: 'A' }));
    const resultB = runProposeStep(readyDiscovery(dirB), sampleInput({ intent: 'B' }));
    expect(resultA.proposalPackage.proposal.identity.id).not.toBe(resultB.proposalPackage.proposal.identity.id);
  });
});

describe('runProposeStep — repeated execution', () => {
  it('re-running with identical input leaves the persisted files byte-identical', () => {
    const dir = makeTmpDir();
    const now = () => '2026-07-13T00:00:00.000Z';
    const first = runProposeStep(readyDiscovery(dir), sampleInput(), { now });
    const firstJson = readFileSync(first.proposalPackagePath, 'utf8');
    const firstMd = readFileSync(first.reportPath, 'utf8');
    const second = runProposeStep(readyDiscovery(dir), sampleInput(), { now });
    expect(readFileSync(second.proposalPackagePath, 'utf8')).toBe(firstJson);
    expect(readFileSync(second.reportPath, 'utf8')).toBe(firstMd);
  });

  it('re-running with a different intent overwrites proposal-package.json with the new proposal', () => {
    const dir = makeTmpDir();
    runProposeStep(readyDiscovery(dir), sampleInput({ intent: 'first idea' }));
    const second = runProposeStep(readyDiscovery(dir), sampleInput({ intent: 'second, different idea' }));
    const onDisk = JSON.parse(readFileSync(second.proposalPackagePath, 'utf8'));
    expect(onDisk.proposal.content).toContain('second, different idea');
    expect(onDisk.proposal.identity.id).toBe(second.proposalPackage.proposal.identity.id);
  });
});

describe('structural isolation — run-propose.ts', () => {
  function readSource(): string {
    return readFileSync(fileURLToPath(new URL('../../src/designer-author/run-propose.ts', import.meta.url)), 'utf8');
  }

  it('never imports proposal-review, overlay, platform-harness, or src/generate/*', () => {
    const source = readSource();
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).not.toMatch(/proposal-review|proposal-overlay|overlay-approval|overlay-materialization|overlay-activation/);
    expect(importLines).not.toMatch(/platform-harness/);
    expect(importLines).not.toMatch(/\/generate\//);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    const source = readSource();
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });

  it('reuses generateAndPersistProposalPackage and buildProposalManifestReport/renderProposalManifestReport rather than re-implementing them', () => {
    const source = readSource();
    expect(source).toMatch(/generateAndPersistProposalPackage/);
    expect(source).toMatch(/buildProposalManifestReport/);
    expect(source).toMatch(/renderProposalManifestReport/);
  });
});
