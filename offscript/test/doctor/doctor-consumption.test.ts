/**
 * P05 — Designer Doctor Consumption: real ValidateResult grounding + falsification.
 *
 * Proves `buildDoctorReport` is faithful to a REAL, actually-computed validate()
 * output — not a hand-built fixture — by running the exact same real pipeline the
 * Validate + Metrics stages already run (buildContext → plan → authorDocument →
 * validate → fidelitySignals/signalsFromPerRail → composeRunHealth), the SAME
 * sequence src/generate/validate-loop-driver.ts#runValidateAndReport calls, and
 * feeding the results into buildDoctorReport. Then falsifies the "no
 * recomputation" claim from both directions:
 *   - IDENTICAL html/plan/context in ⇒ IDENTICAL DoctorReport.findings out.
 *   - a real rail-tripping DIFFERENCE in the html ⇒ a DIFFERENT DoctorReport.
 *
 * Uses the real example-brand collateral fixture (fast, deterministic, no
 * OFFSCRIPT_PLAYWRIGHT gate — same pattern as test/generate-collateral.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { authorDocument } from '../../src/generate/author.js';
import { defaultScriptedAuthor } from '../../src/generate/authoring-seam.js';
import { validate, type ValidateResult } from '../../src/generate/validate.js';
import { fidelitySignals, composeRunHealth } from '../../src/generate/source-fidelity.js';
import { signalsFromPerRail } from '../../src/run-headline.js';
import { readOverlay } from '../../src/overlay.js';
import { buildDoctorReport, type DoctorReport } from '../../src/doctor/doctor-report.js';
import type { AuthoringPlan, DesignContext } from '../../src/generate/types.js';

/** Mirrors validate-loop-driver.ts's health-composition exactly — the SAME real
 *  functions, in the SAME order — so this test's DoctorReport is grounded in a
 *  genuinely real ValidateResult, not a synthetic stand-in. */
async function doctorReportFromRealValidate(
  html: string,
  authoringPlan: AuthoringPlan,
  context: DesignContext,
  outDir: string,
): Promise<{ report: DoctorReport; validateResult: ValidateResult }> {
  const validateResult = await validate(html, context, { outDir }, authoringPlan);
  const fidelity = authoringPlan.accounting
    ? fidelitySignals(authoringPlan.accounting, {
        enginePaddingConsumerIds: authoringPlan.enginePaddingConsumerIds,
      })
    : [];
  const rail = signalsFromPerRail(validateResult.perRail);
  const health = composeRunHealth({
    fidelity,
    rail,
    goalMet: true,
    systematicRatio: validateResult.score.systematicRatio,
  });
  const report = buildDoctorReport({
    subject: validateResult.score.subject,
    generatedAt: validateResult.score.generatedAt,
    health,
    perRail: validateResult.perRail,
    frozen: readOverlay(join(outDir, 'overlay')),
    plan: authoringPlan,
  });
  return { report, validateResult };
}

/** Strip the fields that are legitimately non-deterministic across separate real
 *  runs (fresh timestamps) so content-equality checks compare substance only. */
function withoutTimestamp(report: DoctorReport): Omit<DoctorReport, 'generatedAt'> {
  const { generatedAt: _generatedAt, ...rest } = report;
  return rest;
}

describe('P05 — DoctorReport generated from a REAL ValidateResult', () => {
  it('a real collateral run produces a DoctorReport whose findingCount equals the real health.delivered length', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p05-real-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
      const { report, validateResult } = await doctorReportFromRealValidate(html, p, ctx, outDir);

      // Ground truth, computed independently but via the SAME real functions.
      const fidelity = p.accounting
        ? fidelitySignals(p.accounting, { enginePaddingConsumerIds: p.enginePaddingConsumerIds })
        : [];
      const rail = signalsFromPerRail(validateResult.perRail);
      expect(report.findingCount).toBe(fidelity.length + rail.length);
      expect(report.findings).toHaveLength(report.findingCount);
      expect(report.subject).toBe(validateResult.score.subject);
      expect(report.systematicRatio).toBe(validateResult.score.systematicRatio);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('every DoctorFinding traces to a real rail name present in the real perRail (no invented rails)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p05-real-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
      const { report, validateResult } = await doctorReportFromRealValidate(html, p, ctx, outDir);

      const realRailNames = new Set(validateResult.perRail.map((r) => r.operator.name));
      realRailNames.add('source-fidelity'); // the one non-rail producer that can also appear
      const structuralFindings = report.findings.filter((f) => f.category === 'structural');
      for (const f of structuralFindings) {
        expect(realRailNames.has(f.rail)).toBe(true);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('P05 — falsification: identical input ⇒ identical Doctor; changed input ⇒ changed Doctor', () => {
  it('IDENTICAL html/plan/context run twice ⇒ IDENTICAL DoctorReport findings (content, not just count)', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p05-same-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p05-same-b-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      const { report: reportA } = await doctorReportFromRealValidate(html, p, ctx, outDirA);
      const { report: reportB } = await doctorReportFromRealValidate(html, p, ctx, outDirB);

      // Compare findings content — NOT subject (legitimately outDir-derived, differs
      // by design across separate temp dirs) or generatedAt (a fresh timestamp per
      // real run). The substance under test is: did Doctor reproduce the SAME
      // diagnosis for the SAME underlying validate() input.
      expect(reportA.findings).toEqual(reportB.findings);
      expect(reportA.headlineStatus).toBe(reportB.headlineStatus);
      expect(reportA.systematicRatio).toBe(reportB.systematicRatio);
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  it('a REAL rail-tripping change to the html ⇒ a DIFFERENT DoctorReport (change propagates, not swallowed)', async () => {
    const outDirClean = mkdtempSync(join(tmpdir(), 'offscript-p05-clean-'));
    const outDirBroken = mkdtempSync(join(tmpdir(), 'offscript-p05-broken-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html: cleanHtml } = await authorDocument(p, ctx, defaultScriptedAuthor());

      // Inject a real, rail-tripping change: an off-token CSS color trips the
      // brand-fidelity-scan rail (already observed live in this project's own
      // baseline runs, e.g. "#e9ecf1 is not traceable to a brand token") — a
      // genuine content mutation, not a synthetic stand-in.
      expect(cleanHtml).toContain('</body>');
      const brokenHtml = cleanHtml.replace(
        '</body>',
        '<style>.doctor-test-marker{color:#123456}</style></body>',
      );

      const { report: cleanReport } = await doctorReportFromRealValidate(cleanHtml, p, ctx, outDirClean);
      const { report: brokenReport } = await doctorReportFromRealValidate(brokenHtml, p, ctx, outDirBroken);

      // The change must be VISIBLE in Doctor's output — either a different finding
      // count or different finding content. Either is acceptable proof; both being
      // identical would mean Doctor silently swallowed a real underlying change.
      const identical =
        cleanReport.findingCount === brokenReport.findingCount &&
        JSON.stringify(withoutTimestamp(cleanReport).findings) ===
          JSON.stringify(withoutTimestamp(brokenReport).findings);
      expect(identical, 'DoctorReport did not change when the underlying ValidateResult changed').toBe(false);
    } finally {
      rmSync(outDirClean, { recursive: true, force: true });
      rmSync(outDirBroken, { recursive: true, force: true });
    }
  }, 30_000);
});
