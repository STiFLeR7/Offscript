/**
 * P03 — Platform Harness Consumption: the Validate + Metrics + Report driver.
 *
 * `runValidateAndReport` is a MECHANICAL extraction of scripts/generate.ts's former inline
 * `runValidateLoop` — same body, same call into runReauthorLoop/composeRunHealth/
 * formatRunHeadline, same console output shape. The only two real changes:
 *   (1) free variables the inline version closed over (outDir, useSubagent, the Stage-3
 *       `author` default) are now explicit, required parameters — no hidden defaults;
 *   (2) it RETURNS the already-computed HarnessReportResult ({status, formatted}) instead of
 *       discarding it — the value scripts/generate.ts needs to populate the final
 *       HarnessRunResult.headlineStatus (P02 Foundation's transport type).
 * No validation ALGORITHM changed: runReauthorLoop, composeRunHealth, and every rail are
 * untouched, called exactly as before.
 *
 * Uses the real example-brand collateral fixture (fast, deterministic, no OFFSCRIPT_PLAYWRIGHT gate —
 * same pattern as test/generate-collateral.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { authorDocument } from '../../src/generate/author.js';
import { defaultScriptedAuthor } from '../../src/generate/authoring-seam.js';
import { runValidateAndReport, type ReviewPackageBuilder } from '../../src/generate/validate-loop-driver.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { readDoctorReport } from '../../src/doctor/doctor-report-io.js';
import { readReviewReport } from '../../src/doctor/review-report-io.js';
import { readReviewPackage } from '../../src/doctor/review-package-io.js';
import type { HeadlineStatus } from '../../src/run-headline.js';

const VALID_STATUSES: HeadlineStatus[] = ['success', 'review-required', 'failed'];

// G2-S1 — the render driver now REQUIRES an injected review-package builder (its execution-identity
// source; it no longer reads context.client/track). Every test here uses the example-brand/collateral
// fixture, so the builder supplies that identity verbatim — byte-identical to the pre-G2-S1 driver.
const rpBuilder: ReviewPackageBuilder = (runtime) => buildReviewPackage({ client: 'example-brand', track: 'collateral', ...runtime });

describe('P03 — runValidateAndReport (extracted Validate + Metrics + Report driver)', () => {
  it('returns a HarnessReportResult: a valid HeadlineStatus + a non-empty formatted headline', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p03-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      const report = await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
      });

      expect(VALID_STATUSES).toContain(report.status);
      expect(typeof report.formatted).toBe('string');
      expect(report.formatted).toContain('Run headline:');
      expect(report.formatted.length).toBeGreaterThan(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('writes index.html and score.json to the supplied outDir (unchanged side effect from before extraction)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p03-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
      });

      expect(existsSync(join(outDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outDir, 'score.json'))).toBe(true);
      expect(readFileSync(join(outDir, 'index.html'), 'utf8').length).toBeGreaterThan(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('Deliverable Naming: writes to the given deliverableFilename instead of index.html when supplied', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-name-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
        deliverableFilename: 'better-bookkeeping-solutions-ltd.html',
      });

      expect(existsSync(join(outDir, 'better-bookkeeping-solutions-ltd.html'))).toBe(true);
      expect(existsSync(join(outDir, 'index.html'))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('deterministic replay — two independent invocations against the same inputs report the same status', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p03-driver-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p03-driver-b-'));
    try {
      const ctxA = buildContext('example-brand', 'collateral');
      const pA = plan(ctxA);
      const { html: htmlA } = await authorDocument(pA, ctxA, defaultScriptedAuthor());
      const reportA = await runValidateAndReport(htmlA, pA, ctxA, {
        outDir: outDirA,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pA, ctxA, defaultScriptedAuthor(), f),
      });

      const ctxB = buildContext('example-brand', 'collateral');
      const pB = plan(ctxB);
      const { html: htmlB } = await authorDocument(pB, ctxB, defaultScriptedAuthor());
      const reportB = await runValidateAndReport(htmlB, pB, ctxB, {
        outDir: outDirB,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pB, ctxB, defaultScriptedAuthor(), f),
      });

      expect(reportA.status).toBe(reportB.status);
      expect(reportA.formatted).toBe(reportB.formatted);
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  // ── P05 — Designer Doctor consumption, wired at this exact seam ──────────────

  it('P05: writes doctor-report.json alongside score.json/index.html, whose headlineStatus matches the returned HarnessReportResult.status', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p05-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      const report = await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
      });

      const doctorReportPath = join(outDir, 'doctor-report.json');
      expect(existsSync(doctorReportPath)).toBe(true);
      const doctorReport = readDoctorReport(doctorReportPath);
      expect(doctorReport).toBeDefined();
      // The cross-check: the SAME headline the driver returned to its caller must be
      // the SAME headline persisted in the Doctor report — one health, two consumers,
      // never two independently-derived answers.
      expect(doctorReport!.headlineStatus).toBe(report.status);
      expect(Array.isArray(doctorReport!.findings)).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('P05: deterministic replay — two independent driver runs against the same inputs persist the SAME Doctor findings', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p05-driver-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p05-driver-b-'));
    try {
      const ctxA = buildContext('example-brand', 'collateral');
      const pA = plan(ctxA);
      const { html: htmlA } = await authorDocument(pA, ctxA, defaultScriptedAuthor());
      await runValidateAndReport(htmlA, pA, ctxA, {
        outDir: outDirA,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pA, ctxA, defaultScriptedAuthor(), f),
      });

      const ctxB = buildContext('example-brand', 'collateral');
      const pB = plan(ctxB);
      const { html: htmlB } = await authorDocument(pB, ctxB, defaultScriptedAuthor());
      await runValidateAndReport(htmlB, pB, ctxB, {
        outDir: outDirB,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pB, ctxB, defaultScriptedAuthor(), f),
      });

      const reportA = readDoctorReport(join(outDirA, 'doctor-report.json'))!;
      const reportB = readDoctorReport(join(outDirB, 'doctor-report.json'))!;
      expect(reportA.findings).toEqual(reportB.findings);
      expect(reportA.headlineStatus).toBe(reportB.headlineStatus);
      expect(reportA.systematicRatio).toBe(reportB.systematicRatio);
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  // ── P07 — Designer Review Report, wired right after the Doctor report ────────

  it('P07: writes review-report.md and review-report.json alongside doctor-report.json, whose findingCount matches', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p07-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
      });

      const mdPath = join(outDir, 'review-report.md');
      expect(existsSync(mdPath)).toBe(true);
      const md = readFileSync(mdPath, 'utf8');
      expect(md).toContain('# Executive Summary');

      const doctorReport = readDoctorReport(join(outDir, 'doctor-report.json'))!;
      const reviewReport = readReviewReport(join(outDir, 'review-report.json'))!;
      expect(reviewReport).toBeDefined();
      expect(reviewReport.findingCount).toBe(doctorReport.findingCount);
      expect(reviewReport.headlineStatus).toBe(doctorReport.headlineStatus);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('P07: deterministic replay — two independent driver runs against the same inputs persist the SAME review report Markdown', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p07-driver-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p07-driver-b-'));
    try {
      const ctxA = buildContext('example-brand', 'collateral');
      const pA = plan(ctxA);
      const { html: htmlA } = await authorDocument(pA, ctxA, defaultScriptedAuthor());
      await runValidateAndReport(htmlA, pA, ctxA, {
        outDir: outDirA,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pA, ctxA, defaultScriptedAuthor(), f),
      });

      const ctxB = buildContext('example-brand', 'collateral');
      const pB = plan(ctxB);
      const { html: htmlB } = await authorDocument(pB, ctxB, defaultScriptedAuthor());
      await runValidateAndReport(htmlB, pB, ctxB, {
        outDir: outDirB,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pB, ctxB, defaultScriptedAuthor(), f),
      });

      // Subject is legitimately outDir-derived (same as doctorReport.subject, P05's own
      // precedent) and generatedAt is a fresh real timestamp per run — both differ across
      // the two temp dirs/runs by design. Strip those two lines; everything else,
      // including every finding's problem/impact/evidence, must be byte-identical.
      const stripVolatile = (md: string): string =>
        md.split('\n').filter((l) => !l.startsWith('- Subject:') && !l.startsWith('- Generated:')).join('\n');
      const mdA = stripVolatile(readFileSync(join(outDirA, 'review-report.md'), 'utf8'));
      const mdB = stripVolatile(readFileSync(join(outDirB, 'review-report.md'), 'utf8'));
      expect(mdA).toBe(mdB);
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  // ── P08 — Designer Review Package, wired right after the review report ───────

  it('P08: writes review-package.json and validation-summary.txt, whose manifest indexes the already-written artifacts by hash', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p08-driver-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
      });

      expect(existsSync(join(outDir, 'validation-summary.txt'))).toBe(true);
      const validationSummary = readFileSync(join(outDir, 'validation-summary.txt'), 'utf8');
      expect(validationSummary).toContain('Run headline:');

      const pkg = readReviewPackage(join(outDir, 'review-package.json'))!;
      expect(pkg).toBeDefined();
      expect(pkg.metadata.client).toBe('example-brand');
      expect(pkg.metadata.track).toBe('collateral');
      expect(pkg.validationSummary).toBe(validationSummary);

      const reviewReportMd = readFileSync(join(outDir, 'review-report.md'), 'utf8');
      const doctorReportRaw = readFileSync(join(outDir, 'doctor-report.json'), 'utf8');
      const scoreRaw = readFileSync(join(outDir, 'score.json'), 'utf8');
      const hash = (t: string) => createHash('sha256').update(t).digest('hex');

      const byName = new Map(pkg.artifacts.map((a) => [a.name, a]));
      expect(byName.get('review-report.md')!.sha256).toBe(hash(reviewReportMd));
      // doctor-report.json / score.json: the manifest recomputes the SAME stable-JSON
      // serialization from the in-memory objects (never re-reads the file) — verify it
      // matches the ACTUAL on-disk bytes exactly, proving no drift between the two
      // independent stableStringify implementations.
      expect(byName.get('doctor-report.json')!.sha256).toBe(hash(doctorReportRaw));
      expect(byName.get('score.json')!.sha256).toBe(hash(scoreRaw));
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('P08: deterministic replay — two independent driver runs against the same inputs produce the SAME replay identity', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p08-driver-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p08-driver-b-'));
    try {
      const ctxA = buildContext('example-brand', 'collateral');
      const pA = plan(ctxA);
      const { html: htmlA } = await authorDocument(pA, ctxA, defaultScriptedAuthor());
      await runValidateAndReport(htmlA, pA, ctxA, {
        outDir: outDirA,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pA, ctxA, defaultScriptedAuthor(), f),
      });

      const ctxB = buildContext('example-brand', 'collateral');
      const pB = plan(ctxB);
      const { html: htmlB } = await authorDocument(pB, ctxB, defaultScriptedAuthor());
      await runValidateAndReport(htmlB, pB, ctxB, {
        outDir: outDirB,
        useSubagent: false,
        reviewPackageBuilder: rpBuilder,
        author: (f) => authorDocument(pB, ctxB, defaultScriptedAuthor(), f),
      });

      const pkgA = readReviewPackage(join(outDirA, 'review-package.json'))!;
      const pkgB = readReviewPackage(join(outDirB, 'review-package.json'))!;
      // replayIdentity deliberately excludes subject (outDir-derived) and generatedAt
      // (a fresh real timestamp) — it must match across the two independent temp dirs.
      expect(pkgA.metadata.replayIdentity).toBe(pkgB.metadata.replayIdentity);
      expect(pkgA.headlineStatus).toBe(pkgB.headlineStatus);
      expect(pkgA.findingCount).toBe(pkgB.findingCount);
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  it('requires an explicit `author` at the type level — no implicit default (P03 removed the hidden fallback closure)', () => {
    // Compile-time proof, not runtime: `author` is a non-optional field on
    // ValidateLoopDriverOptions, so omitting it must fail to type-check. If a future
    // change reintroduces an `author?:` optional/defaulted field, `@ts-expect-error`
    // stops erroring and `npx tsc --noEmit` fails on this line — the falsification.
    function typeOnlyCheck(outDir: string): void {
      // @ts-expect-error — `author` is required; this call must not type-check.
      void runValidateAndReport('<html></html>', {} as never, {} as never, { outDir, useSubagent: false });
    }
    expect(typeof typeOnlyCheck).toBe('function');
  });
});
