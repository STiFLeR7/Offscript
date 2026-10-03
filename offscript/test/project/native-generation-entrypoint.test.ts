/**
 * G1-S2 — Native Generation Entrypoint Migration: `beginGeneration` is the native starting point for a
 * caller that holds a READY project. It runs the ONE engine (orchestrateGeneration) and materializes the
 * legacy execution identity EXACTLY ONCE per admitted deliverable — the single compatibility projection.
 * Every downstream legacy consumer (Doctor, Author, ReviewPackage) is driven from that ONE identity, so
 * execution identity has a single source of truth; the native path constructs NO DesignContext, and every
 * output is byte-identical to the direct/legacy call.
 */
import { describe, it, expect } from 'vitest';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import { DESIGNER_AUTHOR_PRODUCER, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { generateProposal } from '../../src/designer-author/proposal-generator.js';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import type { DoctorRuntimeInputs, ReviewPackageRuntimeInputs } from '../../src/project/doctor-contract-adapter.js';
import type { ProposalRuntimeInputs } from '../../src/project/author-contract-adapter.js';
import {
  legacyExecutionIdentityFromContract,
  legacyExecutionIdentityFromLegacy,
} from '../../src/project/legacy-execution-adapter.js';
import {
  beginGeneration,
  nativeDoctorReport,
  nativeAuthorProposal,
  nativeReviewPackage,
} from '../../src/project/generation-orchestration.js';

// ── A READY project for client 'acme' ────────────────────────────────────────────
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

// ── Run-owned diagnostic + authoring + review-package surfaces ────────────────────
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
const DOCTOR_RUNTIME: DoctorRuntimeInputs = {
  generatedAt: '2026-01-01T00:00:00.000Z', health: health([signal()]), perRail: [], frozen: [],
};
const AUTHOR_RUNTIME_ORIGIN: Omit<ProposalOrigin, 'client' | 'track'> = { producer: DESIGNER_AUTHOR_PRODUCER, authoredBy: 'designer:hill' };
const AUTHOR_RUNTIME: ProposalRuntimeInputs = {
  kind: 'component', origin: AUTHOR_RUNTIME_ORIGIN, semanticFamily: 'family-hero',
  designerIntent: 'A confident hero for developer-facing SaaS', evidence: [{ description: 'Brief calls for a bold hero', reference: 'brief §2' }],
};
const FIXED_NOW = (): string => '2026-01-01T00:00:00Z';
function doctorInput(subject: string): DoctorReportInput {
  return { subject, generatedAt: '2026-01-01T00:00:00.000Z', health: health([signal()]), perRail: [], frozen: [] };
}
function reviewRuntime(subject: string): ReviewPackageRuntimeInputs {
  const doctorReport = buildDoctorReport(doctorInput(subject));
  const reviewReport = buildReviewReport(doctorReport);
  return {
    doctorReport, score: scoreFindingsByRail({ subject, applied: [], perRail: [] }),
    reviewReport, reviewReportMarkdown: renderReviewReport(reviewReport), validationSummary: 'Run headline: SUCCESS',
  };
}

describe('G1-S2 native generation entrypoint', () => {
  it('native entrypoint: beginGeneration runs the one engine and materializes the legacy identity ONCE per admitted track', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect([...gen.legacyIdentity.keys()]).toEqual(['website']);
    expect(gen.legacyIdentity.get('website')).toEqual({ client: 'acme', track: 'website', subject: 'acme/website' });
    expect(gen.orchestration.contract.identity.client).toBe('acme');
  });

  it('single source of truth: the materialized identity equals the contract projection AND the legacy bridge', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(gen.legacyIdentity.get('website')).toEqual(legacyExecutionIdentityFromContract(gen.orchestration.renderContract, 'website'));
    expect(gen.legacyIdentity.get('website')).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'website' }));
  });

  it('Doctor unchanged: the native Doctor report (driven from the single identity) is byte-identical to the direct call', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(nativeDoctorReport(gen, 'website', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/website', ...DOCTOR_RUNTIME }));
  });

  it('Author unchanged: the native Author proposal (driven from the single identity) is byte-identical to the direct call', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const via = nativeAuthorProposal(gen, 'website', AUTHOR_RUNTIME, { now: FIXED_NOW });
    const direct = generateProposal({ ...AUTHOR_RUNTIME, origin: { ...AUTHOR_RUNTIME_ORIGIN, client: 'acme', track: 'website' } }, { now: FIXED_NOW });
    expect(via).toEqual(direct);
    expect(via.identity.id).toBe(direct.identity.id);
  });

  it('ReviewPackage unchanged: the native ReviewPackage (built from the single identity) is byte-identical, replay included', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const runtime = reviewRuntime('projects/acme/website'); // subject stays run/IO-owned, not the contract's business
    const via = nativeReviewPackage(gen, 'website', runtime);
    const id = gen.legacyIdentity.get('website')!;
    // built from the SAME single materialized identity, and byte-identical to the direct legacy call
    expect(via).toEqual(buildReviewPackage({ client: id.client, track: id.track, ...runtime }));
    expect(via.metadata.replayIdentity).toBe(buildReviewPackage({ client: 'acme', track: 'website', ...runtime }).metadata.replayIdentity);
  });

  it('replay unchanged: the same READY project replays the identical native identity, Doctor, Author, and ReviewPackage', () => {
    const a = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const b = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(a.orchestration.contractId).toBe(b.orchestration.contractId);
    expect(a.legacyIdentity.get('website')).toEqual(b.legacyIdentity.get('website'));
    expect(nativeDoctorReport(a, 'website', DOCTOR_RUNTIME)).toEqual(nativeDoctorReport(b, 'website', DOCTOR_RUNTIME));
    expect(nativeAuthorProposal(a, 'website', AUTHOR_RUNTIME, { now: FIXED_NOW })).toEqual(nativeAuthorProposal(b, 'website', AUTHOR_RUNTIME, { now: FIXED_NOW }));
    const runtime = reviewRuntime('projects/acme/website');
    expect(nativeReviewPackage(a, 'website', runtime)).toEqual(nativeReviewPackage(b, 'website', runtime));
  });

  it('scope gate: deck (excluded) is never materialized and every native consumer refuses it', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(gen.legacyIdentity.has('deck')).toBe(false);
    expect(() => nativeDoctorReport(gen, 'deck', DOCTOR_RUNTIME)).toThrow(/scope/i);
    expect(() => nativeAuthorProposal(gen, 'deck', AUTHOR_RUNTIME, { now: FIXED_NOW })).toThrow(/scope/i);
    expect(() => nativeReviewPackage(gen, 'deck', reviewRuntime('projects/acme/deck'))).toThrow(/scope/i);
  });

  it('website + collateral: one native entrypoint materializes both identities; each consumer is byte-identical to its direct call', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral']) });
    expect([...gen.legacyIdentity.keys()]).toEqual(['website', 'collateral']);
    expect(nativeDoctorReport(gen, 'website', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/website', ...DOCTOR_RUNTIME }));
    expect(nativeDoctorReport(gen, 'collateral', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/collateral', ...DOCTOR_RUNTIME }));
  });

  it('enterprise (high-risk, complex): the native entrypoint drives the SAME single contract that preserves its constraints', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral'], { riskLevel: 'high', projectComplexity: 'complex' }) });
    expect(nativeDoctorReport(gen, 'website', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/website', ...DOCTOR_RUNTIME }));
    const kinds = gen.orchestration.contract.constraints.map((c) => c.kind);
    expect(kinds).toContain('governance');
    expect(kinds).toContain('coordination');
  });
});
