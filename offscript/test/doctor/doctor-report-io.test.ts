/**
 * P05 — Designer Doctor Consumption: persistence (RED-first).
 *
 * `writeDoctorReport`/`readDoctorReport` are pure IO — write via the SAME
 * idempotent stable-JSON pattern score.ts already uses (writeScore), read back
 * via a simple parse. No new judgment: this module transports an ALREADY-BUILT
 * DoctorReport (from src/doctor/doctor-report.ts, unmodified since P04) to and
 * from disk, so it becomes a real, durable, "canonical review artifact" a future
 * Doctor CLI/UI can read — not just an in-memory value.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeDoctorReport, readDoctorReport } from '../../src/doctor/doctor-report-io.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

function health(delivered: AuthoritySignal[]): RunHealth {
  return {
    headline: {
      status: 'success',
      goalMet: true,
      systematicRatio: 1,
      failures: [],
      criticals: [],
      warnings: [],
      signalCount: delivered.length,
    },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function sampleInput(): DoctorReportInput {
  return {
    subject: 'projects/example-brand/collateral',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([
      {
        producer: 'contrast',
        level: 'warning',
        where: 'contrast:hero',
        what: 'low contrast',
        why: 'advisory QA note',
        nature: 'objective',
      },
    ]),
    perRail: [],
    frozen: [],
  };
}

describe('P05 — writeDoctorReport / readDoctorReport: transport integrity', () => {
  it('round-trips a DoctorReport through disk with no information loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-doctor-io-'));
    try {
      const report = buildDoctorReport(sampleInput());
      const filePath = join(dir, 'doctor-report.json');
      writeDoctorReport(filePath, report);
      const roundTripped = readDoctorReport(filePath);
      expect(roundTripped).toEqual(report);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes stable, sorted-key JSON with a trailing newline (matches score.ts convention)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-doctor-io-'));
    try {
      const report = buildDoctorReport(sampleInput());
      const filePath = join(dir, 'doctor-report.json');
      writeDoctorReport(filePath, report);
      const raw = readFileSync(filePath, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent: writing the same report twice does not bump mtime (content-compare no-op)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-doctor-io-'));
    try {
      const report = buildDoctorReport(sampleInput());
      const filePath = join(dir, 'doctor-report.json');
      writeDoctorReport(filePath, report);
      const firstMtime = statSync(filePath).mtimeMs;
      writeDoctorReport(filePath, report);
      const secondMtime = statSync(filePath).mtimeMs;
      expect(secondMtime).toBe(firstMtime);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readDoctorReport returns undefined when the file does not exist (never throws)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-doctor-io-'));
    try {
      const missing = join(dir, 'nope.json');
      expect(existsSync(missing)).toBe(false);
      expect(readDoctorReport(missing)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readDoctorReport returns undefined on malformed JSON (never throws)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-doctor-io-'));
    try {
      const filePath = join(dir, 'doctor-report.json');
      writeDoctorReport(filePath, buildDoctorReport(sampleInput()));
      // Corrupt it.
      writeFileSync(filePath, '{not valid json', 'utf8');
      expect(readDoctorReport(filePath)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
