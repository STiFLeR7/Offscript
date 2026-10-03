/**
 * P07 — Designer Doctor Review Report: persistence (RED-first).
 *
 * Pure IO, mirroring doctor-report-io.ts's own pattern (itself mirroring
 * score.ts's writeScore): idempotent stable-key JSON for the structured
 * `ReviewReport` companion, plain content-compare idempotent write for the
 * human-first Markdown. No new judgment — this module transports an
 * ALREADY-BUILT ReviewReport/Markdown string to and from disk.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeReviewReportMarkdown,
  writeReviewReport,
  readReviewReport,
} from '../../src/doctor/review-report-io.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

function health(delivered: AuthoritySignal[]): RunHealth {
  return {
    headline: { status: 'success', goalMet: true, systematicRatio: 1, failures: [], criticals: [], warnings: [], signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function sampleInput(): DoctorReportInput {
  return {
    subject: 'projects/example-brand/collateral',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([
      { producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory QA note', nature: 'objective' },
    ]),
    perRail: [],
    frozen: [],
  };
}

describe('P07 — writeReviewReportMarkdown: idempotent plain-text persistence', () => {
  it('writes the exact Markdown string given, with no transformation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-review-io-'));
    try {
      const review = buildReviewReport(buildDoctorReport(sampleInput()));
      const md = renderReviewReport(review);
      const filePath = join(dir, 'review-report.md');
      writeReviewReportMarkdown(filePath, md);
      expect(readFileSync(filePath, 'utf8')).toBe(md);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent: writing the same content twice does not bump mtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-review-io-'));
    try {
      const md = renderReviewReport(buildReviewReport(buildDoctorReport(sampleInput())));
      const filePath = join(dir, 'review-report.md');
      writeReviewReportMarkdown(filePath, md);
      const first = statSync(filePath).mtimeMs;
      writeReviewReportMarkdown(filePath, md);
      const second = statSync(filePath).mtimeMs;
      expect(second).toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('P07 — writeReviewReport / readReviewReport: JSON companion transport integrity', () => {
  it('round-trips a ReviewReport through disk with no information loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-review-io-'));
    try {
      const review = buildReviewReport(buildDoctorReport(sampleInput()));
      const filePath = join(dir, 'review-report.json');
      writeReviewReport(filePath, review);
      expect(readReviewReport(filePath)).toEqual(review);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-review-io-'));
    try {
      const review = buildReviewReport(buildDoctorReport(sampleInput()));
      const filePath = join(dir, 'review-report.json');
      writeReviewReport(filePath, review);
      const raw = readFileSync(filePath, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readReviewReport returns undefined on a missing file (never throws)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-review-io-'));
    try {
      expect(existsSync(join(dir, 'nope.json'))).toBe(false);
      expect(readReviewReport(join(dir, 'nope.json'))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
