/**
 * P08 — Designer Doctor Review Package: persistence (RED-first).
 *
 * Pure IO, mirroring doctor-report-io.ts / review-report-io.ts's own
 * idempotent stable-JSON / plain-text pattern. No new judgment — transports an
 * ALREADY-BUILT ReviewPackage / an already-computed validation-summary string
 * to and from disk.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeReviewPackage,
  readReviewPackage,
  writeValidationSummary,
} from '../../src/doctor/review-package-io.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

function health(delivered: AuthoritySignal[]): RunHealth {
  return {
    headline: { status: 'success', goalMet: true, systematicRatio: 1, failures: [], criticals: [], warnings: [], signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function samplePackage() {
  const input: DoctorReportInput = {
    subject: 'projects/example-brand/collateral',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([{ producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory QA note', nature: 'objective' }]),
    perRail: [],
    frozen: [],
  };
  const doctorReport = buildDoctorReport(input);
  const reviewReport = buildReviewReport(doctorReport);
  return buildReviewPackage({
    client: 'example-brand',
    track: 'collateral',
    doctorReport,
    score: scoreFindingsByRail({ subject: 'projects/example-brand/collateral', applied: [], perRail: [] }),
    reviewReport,
    reviewReportMarkdown: renderReviewReport(reviewReport),
    validationSummary: 'Run headline: SUCCESS',
  });
}

describe('P08 — writeReviewPackage / readReviewPackage: transport integrity', () => {
  it('round-trips a ReviewPackage through disk with no information loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      const pkg = samplePackage();
      const filePath = join(dir, 'review-package.json');
      writeReviewPackage(filePath, pkg);
      expect(readReviewPackage(filePath)).toEqual(pkg);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      const filePath = join(dir, 'review-package.json');
      writeReviewPackage(filePath, samplePackage());
      const raw = readFileSync(filePath, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent: writing the same package twice does not bump mtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      const pkg = samplePackage();
      const filePath = join(dir, 'review-package.json');
      writeReviewPackage(filePath, pkg);
      const first = statSync(filePath).mtimeMs;
      writeReviewPackage(filePath, pkg);
      const second = statSync(filePath).mtimeMs;
      expect(second).toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readReviewPackage returns undefined on a missing file (never throws)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      expect(existsSync(join(dir, 'nope.json'))).toBe(false);
      expect(readReviewPackage(join(dir, 'nope.json'))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('P08 — writeValidationSummary: idempotent plain-text persistence', () => {
  it('writes the exact text given, with no transformation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      const filePath = join(dir, 'validation-summary.txt');
      writeValidationSummary(filePath, 'Run headline: SUCCESS\n  No Failures.');
      expect(readFileSync(filePath, 'utf8')).toBe('Run headline: SUCCESS\n  No Failures.');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent: writing the same text twice does not bump mtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-package-io-'));
    try {
      const filePath = join(dir, 'validation-summary.txt');
      writeValidationSummary(filePath, 'same text');
      const first = statSync(filePath).mtimeMs;
      writeValidationSummary(filePath, 'same text');
      const second = statSync(filePath).mtimeMs;
      expect(second).toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
