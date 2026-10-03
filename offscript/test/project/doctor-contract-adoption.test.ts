/**
 * P56 — Contract adoption: Designer Doctor driven through the Generation Contract produces IDENTICAL
 * behaviour whether the contract comes from the legacy identity bridge or from a native P55 plan, and
 * identical to the pre-adoption direct call. Same diagnostics, same governance, same replay, same
 * outputs — the boundary changed, the behaviour did not.
 */
import { describe, it, expect } from 'vitest';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import type { RunScore } from '../../src/score.js';
import { buildDoctorReport } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import type { Track } from '../../src/paths.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { planGeneration } from '../../src/project/generation-planner.js';
import {
  doctorContractFromLegacy,
  doctorContractFromPlan,
  buildDoctorReportFromContract,
  reviewPackageInputFromContract,
  type DoctorRuntimeInputs,
} from '../../src/project/doctor-contract-adapter.js';

// ── Diagnostic surface (run-owned) ──────────────────────────────────────────────
function signal(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return { producer: 'contrast', level: 'failure', where: 'contrast:hero', what: 'insufficient contrast', why: 'WCAG AA', nature: 'objective', ...over };
}
function health(delivered: AuthoritySignal[]): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length ? 'failed' : criticals.length ? 'review-required' : 'success';
  return {
    headline: { status, goalMet: true, systematicRatio: 1, failures, criticals, warnings, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}
const RUNTIME: DoctorRuntimeInputs = {
  generatedAt: '2026-01-01T00:00:00Z',
  health: health([signal(), signal({ producer: 'section-usage', level: 'warning', where: 'sec:1', what: 'w', why: 'y' })]),
  perRail: [],
  frozen: [],
};

// ── A native P55 Generation Plan for client 'acme', website ─────────────────────
function nativePlan(deliverables: Track[]) {
  const strat: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [],
  };
  const id: ProjectIdentity = { client: 'acme', projectType: 'website', deliverables };
  const decisions: SessionInput['decisions'] = [
    { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
    { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
  ];
  const base = emptyContext(id);
  const context: ProjectContext = applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
  const readiness = { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context }), strategy: strat, context };
  return planGeneration({ client: 'acme', readiness, assessment: evaluateReadiness(readiness) });
}

describe('P56 Designer Doctor contract adoption — identical behaviour', () => {
  it('legacy-bridge contract, native-plan contract, and direct call all produce the IDENTICAL DoctorReport', () => {
    const legacyView = doctorContractFromLegacy({ client: 'acme', deliverables: ['website'] });
    const nativeView = doctorContractFromPlan(nativePlan(['website']));
    expect(nativeView).toEqual({ client: 'acme', deliverables: ['website'] }); // the plan projects to the same view

    const viaLegacy = buildDoctorReportFromContract(legacyView, 'website', RUNTIME);
    const viaNative = buildDoctorReportFromContract(nativeView, 'website', RUNTIME);
    const direct = buildDoctorReport({ subject: 'acme/website', ...RUNTIME });

    expect(viaNative).toEqual(viaLegacy); // identical diagnostics
    expect(viaLegacy).toEqual(direct); // identical to the pre-adoption path
  });

  it('identical downstream outputs: review report + markdown are byte-identical across paths', () => {
    const viaNative = buildDoctorReportFromContract(doctorContractFromPlan(nativePlan(['website'])), 'website', RUNTIME);
    const direct = buildDoctorReport({ subject: 'acme/website', ...RUNTIME });
    expect(renderReviewReport(buildReviewReport(viaNative))).toBe(renderReviewReport(buildReviewReport(direct)));
  });

  it('identical governance + replay: the review package matches, replayIdentity is stable across paths', () => {
    const contract = doctorContractFromPlan(nativePlan(['website']));
    const report = buildDoctorReportFromContract(contract, 'website', RUNTIME);
    const reviewReport = buildReviewReport(report);
    const score = { generatedAt: report.generatedAt, subject: 'acme/website', buckets: {}, systematicRatio: 1, railBreakdown: [] } as unknown as RunScore;
    const pkgRuntime = { doctorReport: report, score, reviewReport, reviewReportMarkdown: renderReviewReport(reviewReport), validationSummary: 'summary' };

    const viaContract = buildReviewPackage(reviewPackageInputFromContract(contract, 'website', pkgRuntime));
    const direct = buildReviewPackage({ client: 'acme', track: 'website', ...pkgRuntime });

    expect(viaContract.metadata.client).toBe('acme');
    expect(viaContract.metadata.track).toBe('website');
    expect(viaContract.metadata.replayIdentity).toBe(direct.metadata.replayIdentity); // identical replay
    expect(viaContract.findingCount).toBe(direct.findingCount);
    expect(viaContract).toEqual(direct); // identical package
  });

  it('the contract scope gates which deliverables Doctor may diagnose', () => {
    const websiteOnly = doctorContractFromPlan(nativePlan(['website']));
    expect(() => buildDoctorReportFromContract(websiteOnly, 'collateral', RUNTIME)).toThrow(/scope/i);
  });
});
