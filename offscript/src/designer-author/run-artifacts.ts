/**
 * P32 — Designer Author Script Foundation: input discovery + artifact loading.
 *
 * Pure, read-only. Loads exactly the two artifacts a completed scripts/generate.ts run
 * already produces — review-package.json (P08, doctor/review-package.ts) and
 * doctor-report.json (P05, doctor/doctor-report.ts) — via the SAME
 * readReviewPackage/readDoctorReport functions those modules already export
 * (review-package-io.ts / doctor-report-io.ts). This module never writes: it calls no
 * `write*` function and imports no fs write API (see the falsification test at the bottom
 * of run-artifacts.test.ts). It also never imports platform-harness.ts or anything under
 * src/generate/ — per P30 §4, the Harness owns nothing about sequencing Designer Author,
 * and per P30 §6, Designer Author must never read the engine's own deterministic-replay
 * surface as a behavioral input, only its already-published diagnosis artifacts.
 *
 * `discoverRunArtifacts` classifies `dir` into exactly one of four states, in order:
 *   invalid-directory    dir does not exist, or is not a directory (bad CLI input)
 *   not-ready             dir exists, but review-package.json and/or doctor-report.json
 *                          are absent — scripts/generate.ts has not completed a run there
 *   malformed-artifacts   dir exists, both files exist, but one or both fail to parse —
 *                          readReviewPackage/readDoctorReport's own undefined-on-malformed
 *                          contract, surfaced here rather than swallowed
 *   ready                  both artifacts loaded successfully — the terminal state this
 *                          Foundation phase reaches; no proposal is generated from it
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readReviewPackage } from '../doctor/review-package-io.js';
import { readDoctorReport } from '../doctor/doctor-report-io.js';
import type { ReviewPackage } from '../doctor/review-package.js';
import type { DoctorReport } from '../doctor/doctor-report.js';

export const REVIEW_PACKAGE_FILENAME = 'review-package.json';
export const DOCTOR_REPORT_FILENAME = 'doctor-report.json';

export type RunArtifactDiscoveryStatus = 'invalid-directory' | 'not-ready' | 'malformed-artifacts' | 'ready';

export interface InvalidDirectoryDiscovery {
  readonly status: 'invalid-directory';
  readonly dir: string;
}

export interface NotReadyDiscovery {
  readonly status: 'not-ready';
  readonly dir: string;
  readonly missing: readonly string[];
}

export interface MalformedArtifactsDiscovery {
  readonly status: 'malformed-artifacts';
  readonly dir: string;
  readonly malformed: readonly string[];
}

export interface ReadyDiscovery {
  readonly status: 'ready';
  readonly dir: string;
  readonly reviewPackage: ReviewPackage;
  readonly doctorReport: DoctorReport;
}

export type RunArtifactDiscovery =
  | InvalidDirectoryDiscovery
  | NotReadyDiscovery
  | MalformedArtifactsDiscovery
  | ReadyDiscovery;

/**
 * Classify `dir` into exactly one discovery state. Pure aside from the fs reads themselves;
 * never writes, never mutates anything on disk. Total: every branch returns, none throws —
 * mirrors readReviewPackage/readDoctorReport's own never-throws discipline, extended to the
 * whole discovery rather than a single file read.
 */
export function discoverRunArtifacts(dir: string): RunArtifactDiscovery {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return Object.freeze({ status: 'invalid-directory', dir });
  }

  const reviewPackagePath = join(dir, REVIEW_PACKAGE_FILENAME);
  const doctorReportPath = join(dir, DOCTOR_REPORT_FILENAME);
  const missing: string[] = [];
  if (!existsSync(reviewPackagePath)) missing.push(REVIEW_PACKAGE_FILENAME);
  if (!existsSync(doctorReportPath)) missing.push(DOCTOR_REPORT_FILENAME);
  if (missing.length > 0) {
    return Object.freeze({ status: 'not-ready', dir, missing: Object.freeze(missing) });
  }

  const reviewPackage = readReviewPackage(reviewPackagePath);
  const doctorReport = readDoctorReport(doctorReportPath);
  if (reviewPackage === undefined || doctorReport === undefined) {
    const malformed: string[] = [];
    if (reviewPackage === undefined) malformed.push(REVIEW_PACKAGE_FILENAME);
    if (doctorReport === undefined) malformed.push(DOCTOR_REPORT_FILENAME);
    return Object.freeze({ status: 'malformed-artifacts', dir, malformed: Object.freeze(malformed) });
  }

  return Object.freeze({ status: 'ready', dir, reviewPackage, doctorReport });
}
