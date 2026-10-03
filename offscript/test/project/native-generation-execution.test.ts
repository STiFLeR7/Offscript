/**
 * G1-S1 — Native Generation Contract Execution: the immutable P55 Generation Contract is the NATIVE
 * execution boundary. The legacy DesignContext {client, track} execution identity becomes a DERIVED
 * projection of the ONE contract (the compatibility adapter — Native Contract → Legacy Consumer), proven
 * byte-identical to the scattered legacy value — so no duplicate execution identity remains, and the
 * render tier's terminal ReviewPackage sourced from the contract is byte-identical to today's direct
 * {client, track} call.
 */
import { describe, it, expect } from 'vitest';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import type { ReviewPackageRuntimeInputs } from '../../src/project/doctor-contract-adapter.js';
import {
  renderContractFromPlan,
  legacyExecutionIdentityFromContract,
  legacyExecutionIdentityFromLegacy,
} from '../../src/project/legacy-execution-adapter.js';
import {
  orchestrateGeneration,
  renderIdentityFromOrchestration,
  runReviewPackageFromOrchestration,
} from '../../src/project/generation-orchestration.js';

// ── A READY project for client 'acme' (drives the whole orchestration) ───────────
function readinessFor(deliverables: Track[], over: Partial<CreativeStrategy> = {}): ProjectReadiness {
  const strat: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [],
    ...over,
  };
  const id: ProjectIdentity = { client: 'acme', projectType: 'website', deliverables };
  const decisions: SessionInput['decisions'] = [
    { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
    { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
  ];
  const base = emptyContext(id);
  const context: ProjectContext = applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context }), strategy: strat, context };
}

// ── The run-owned ReviewPackage surface (everything MINUS the contract-owned client/track) ──
function signal(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return { producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective', ...over };
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
function doctorInput(subject: string): DoctorReportInput {
  return { subject, generatedAt: '2026-01-01T00:00:00.000Z', health: health([signal()]), perRail: [], frozen: [] };
}
/** The run-owned review-package inputs — built ONCE and shared so both paths compare a fixed surface. */
function reviewRuntime(subject: string): ReviewPackageRuntimeInputs {
  const doctorReport = buildDoctorReport(doctorInput(subject));
  const reviewReport = buildReviewReport(doctorReport);
  return {
    doctorReport,
    score: scoreFindingsByRail({ subject, applied: [], perRail: [] }),
    reviewReport,
    reviewReportMarkdown: renderReviewReport(reviewReport),
    validationSummary: 'Run headline: SUCCESS',
  };
}

describe('G1-S1 native generation contract execution', () => {
  it('native path: the orchestration yields the render identity from the ONE contract; it equals the legacy {client, track}', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const id = renderIdentityFromOrchestration(orch, 'website');
    expect(id).toEqual({ client: 'acme', track: 'website', subject: 'acme/website' });
    // it is a projection of the SAME frozen contract, not an independent source
    expect(id.client).toBe(orch.contract.identity.client);
    expect(orch.renderContract.deliverables).toEqual(orch.contract.scope.included);
  });

  it('no duplicate execution identity: the contract projection and the legacy bridge converge on ONE identity', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const fromContract = legacyExecutionIdentityFromContract(renderContractFromPlan(orch.contract), 'website');
    const fromLegacy = legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'website' });
    expect(fromContract).toEqual(fromLegacy); // native and legacy-bridge are the SAME identity
    expect(renderIdentityFromOrchestration(orch, 'website')).toEqual(fromLegacy);
  });

  it('one contract, THREE consumers: Doctor + Author + render identity all project the SAME frozen instance', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(orch.renderContract.client).toBe(orch.contract.identity.client);
    expect(orch.renderContract.deliverables).toEqual(orch.contract.scope.included);
    expect(orch.doctorContract.deliverables).toEqual(orch.renderContract.deliverables);
    expect(orch.authorContract.deliverables).toEqual(orch.renderContract.deliverables);
  });

  it('legacy compatibility: the render tier ReviewPackage sourced from the contract is byte-identical to the direct {client, track} call', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const runtime = reviewRuntime('projects/acme/website'); // subject stays run/IO-owned (a working-dir path), not the contract's business
    const viaContract = runReviewPackageFromOrchestration(orch, 'website', runtime);
    const direct = buildReviewPackage({ client: 'acme', track: 'website', ...runtime });
    expect(viaContract).toEqual(direct); // identical artifact
    expect(viaContract.metadata.replayIdentity).toBe(direct.metadata.replayIdentity); // replay unchanged
  });

  it('replay is deterministic: the same READY project replays the identical render identity and review package', () => {
    const a = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const b = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(a.contractId).toBe(b.contractId);
    expect(renderIdentityFromOrchestration(a, 'website')).toEqual(renderIdentityFromOrchestration(b, 'website'));
    const runtime = reviewRuntime('projects/acme/website');
    expect(runReviewPackageFromOrchestration(a, 'website', runtime)).toEqual(runReviewPackageFromOrchestration(b, 'website', runtime));
  });

  it('scope gate: deck (design-team-gated, excluded from scope) is refused by the render boundary too', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(() => renderIdentityFromOrchestration(orch, 'deck')).toThrow(/scope/i);
    expect(() => runReviewPackageFromOrchestration(orch, 'deck', reviewRuntime('projects/acme/deck'))).toThrow(/scope/i);
  });

  it('website + collateral share ONE contract; each deliverable render identity is byte-identical to its direct legacy value', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral']) });
    expect(orch.renderContract.deliverables).toEqual(['website', 'collateral']);
    expect(renderIdentityFromOrchestration(orch, 'website')).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'website' }));
    expect(renderIdentityFromOrchestration(orch, 'collateral')).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'collateral' }));
  });

  it('enterprise (high-risk, complex): the render boundary reads the SAME single contract that preserves its constraints', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral'], { riskLevel: 'high', projectComplexity: 'complex' }) });
    // render identity still projects correctly under enterprise config…
    expect(renderIdentityFromOrchestration(orch, 'website')).toEqual({ client: 'acme', track: 'website', subject: 'acme/website' });
    // …and the ONE contract the render boundary reads still carries governance + coordination constraints
    const kinds = orch.contract.constraints.map((c) => c.kind);
    expect(kinds).toContain('governance');
    expect(kinds).toContain('coordination');
  });
});
