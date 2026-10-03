/**
 * P32 — Designer Author Script Foundation: input discovery + artifact loading.
 *
 * RED-first per superpowers:test-driven-development. Covers all four discovery states
 * (invalid-directory / not-ready / malformed-artifacts / ready), deterministic replay
 * (identical inputs → identical execution state), and the structural isolation guarantee
 * this module never writes anything (see the falsification test at the bottom).
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverRunArtifacts,
  REVIEW_PACKAGE_FILENAME,
  DOCTOR_REPORT_FILENAME,
} from '../../src/designer-author/run-artifacts.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-designer-author-'));
  tmpDirs.push(dir);
  return dir;
}

function sampleReviewPackage(overrides: Record<string, unknown> = {}): unknown {
  return {
    metadata: {
      client: 'acme',
      track: 'website',
      generatedAt: '2026-07-13T00:00:00.000Z',
      replayIdentity: 'deadbeef',
      platformHarnessVersion: 'p03-platform-harness@2',
    },
    executiveSummary: 'Status **PASSED**.',
    headlineStatus: 'passed',
    systematicRatio: 0.9,
    findingCount: 0,
    validationSummary: 'PASSED',
    artifacts: [],
    reviewContract: [],
    ...overrides,
  };
}

function sampleDoctorReport(overrides: Record<string, unknown> = {}): unknown {
  return {
    subject: 'acme/website',
    generatedAt: '2026-07-13T00:00:00.000Z',
    headlineStatus: 'passed',
    systematicRatio: 0.9,
    findingCount: 0,
    findings: [],
    ...overrides,
  };
}

function writeReadyDir(dir: string): void {
  writeFileSync(join(dir, REVIEW_PACKAGE_FILENAME), JSON.stringify(sampleReviewPackage()), 'utf8');
  writeFileSync(join(dir, DOCTOR_REPORT_FILENAME), JSON.stringify(sampleDoctorReport()), 'utf8');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('discoverRunArtifacts', () => {
  it('returns invalid-directory when dir does not exist', () => {
    const dir = join(makeTmpDir(), 'does-not-exist');
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('invalid-directory');
    expect(result.dir).toBe(dir);
  });

  it('returns invalid-directory when dir is a file, not a directory', () => {
    const parent = makeTmpDir();
    const filePath = join(parent, 'not-a-dir.txt');
    writeFileSync(filePath, 'hello', 'utf8');
    const result = discoverRunArtifacts(filePath);
    expect(result.status).toBe('invalid-directory');
  });

  it('returns not-ready with both filenames when the directory is empty', () => {
    const dir = makeTmpDir();
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('not-ready');
    if (result.status === 'not-ready') {
      expect(result.missing).toEqual([REVIEW_PACKAGE_FILENAME, DOCTOR_REPORT_FILENAME]);
    }
  });

  it('returns not-ready with only the missing filename when one artifact is present', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, REVIEW_PACKAGE_FILENAME), JSON.stringify(sampleReviewPackage()), 'utf8');
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('not-ready');
    if (result.status === 'not-ready') {
      expect(result.missing).toEqual([DOCTOR_REPORT_FILENAME]);
    }
  });

  it('returns malformed-artifacts when review-package.json is not valid JSON', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, REVIEW_PACKAGE_FILENAME), '{ not valid json', 'utf8');
    writeFileSync(join(dir, DOCTOR_REPORT_FILENAME), JSON.stringify(sampleDoctorReport()), 'utf8');
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('malformed-artifacts');
    if (result.status === 'malformed-artifacts') {
      expect(result.malformed).toEqual([REVIEW_PACKAGE_FILENAME]);
    }
  });

  it('returns malformed-artifacts when doctor-report.json is not valid JSON', () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, REVIEW_PACKAGE_FILENAME), JSON.stringify(sampleReviewPackage()), 'utf8');
    writeFileSync(join(dir, DOCTOR_REPORT_FILENAME), '{ not valid json', 'utf8');
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('malformed-artifacts');
    if (result.status === 'malformed-artifacts') {
      expect(result.malformed).toEqual([DOCTOR_REPORT_FILENAME]);
    }
  });

  it('returns ready with both parsed artifacts when both files are valid', () => {
    const dir = makeTmpDir();
    writeReadyDir(dir);
    const result = discoverRunArtifacts(dir);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.reviewPackage.metadata.client).toBe('acme');
      expect(result.doctorReport.subject).toBe('acme/website');
    }
  });

  it('is a pure read — never writes review-package.json or doctor-report.json back to disk', () => {
    const dir = makeTmpDir();
    writeReadyDir(dir);
    const reviewBefore = readFileSync(join(dir, REVIEW_PACKAGE_FILENAME), 'utf8');
    const doctorBefore = readFileSync(join(dir, DOCTOR_REPORT_FILENAME), 'utf8');
    discoverRunArtifacts(dir);
    discoverRunArtifacts(dir);
    expect(readFileSync(join(dir, REVIEW_PACKAGE_FILENAME), 'utf8')).toBe(reviewBefore);
    expect(readFileSync(join(dir, DOCTOR_REPORT_FILENAME), 'utf8')).toBe(doctorBefore);
  });

  it('deterministic replay — identical dir contents produce deep-equal discovery results', () => {
    const dir = makeTmpDir();
    writeReadyDir(dir);
    const a = discoverRunArtifacts(dir);
    const b = discoverRunArtifacts(dir);
    expect(a).toEqual(b);
  });

  it('deterministic replay — a not-ready dir produces deep-equal results across calls', () => {
    const dir = makeTmpDir();
    const a = discoverRunArtifacts(dir);
    const b = discoverRunArtifacts(dir);
    expect(a).toEqual(b);
  });

  it('every branch returns a frozen result', () => {
    const invalid = discoverRunArtifacts(join(makeTmpDir(), 'nope'));
    expect(Object.isFrozen(invalid)).toBe(true);
    const notReadyDir = makeTmpDir();
    const notReady = discoverRunArtifacts(notReadyDir);
    expect(Object.isFrozen(notReady)).toBe(true);
    const readyDir = makeTmpDir();
    writeReadyDir(readyDir);
    const ready = discoverRunArtifacts(readyDir);
    expect(Object.isFrozen(ready)).toBe(true);
  });
});

describe('structural isolation — run-artifacts.ts never writes', () => {
  it('imports no writer function and calls no fs write API', () => {
    const modulePath = fileURLToPath(new URL('../../src/designer-author/run-artifacts.ts', import.meta.url));
    const source = readFileSync(modulePath, 'utf8');
    expect(source).not.toMatch(/writeFileSync|writeReviewPackage|writeDoctorReport|writeProposalPackage|mkdirSync/);
  });

  it('never imports scripts/generate.ts, src/generate/*, or platform-harness.ts', () => {
    const modulePath = fileURLToPath(new URL('../../src/designer-author/run-artifacts.ts', import.meta.url));
    const source = readFileSync(modulePath, 'utf8');
    expect(source).not.toMatch(/from ['"].*\/generate\//);
    expect(source).not.toMatch(/from ['"].*platform-harness/);
  });
});
