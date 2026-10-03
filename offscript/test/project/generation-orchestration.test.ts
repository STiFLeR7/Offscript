/**
 * P58 — Generation-Engine Contract Orchestration: the engine builds the immutable Generation Contract
 * EXACTLY ONCE and derives both downstream boundary views (Doctor + Author) from that ONE frozen
 * instance. Proves single construction, deterministic replay, and that driving Doctor/Author through
 * the orchestrated contract is byte-identical to the direct/legacy path — the boundary changed, the
 * behaviour did not.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import { buildDoctorReport } from '../../src/doctor/doctor-report.js';
import { DESIGNER_AUTHOR_PRODUCER, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { generateProposal } from '../../src/designer-author/proposal-generator.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import { verifyContract, contractConstraints } from '../../src/project/generation-contract.js';
import type { DoctorRuntimeInputs } from '../../src/project/doctor-contract-adapter.js';
import type { ProposalRuntimeInputs } from '../../src/project/author-contract-adapter.js';
import {
  orchestrateGeneration,
  runDoctorFromOrchestration,
  runAuthorFromOrchestration,
} from '../../src/project/generation-orchestration.js';

// ── Run-owned diagnostic surface (Doctor) ────────────────────────────────────────
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
const DOCTOR_RUNTIME: DoctorRuntimeInputs = {
  generatedAt: '2026-01-01T00:00:00Z',
  health: health([signal(), signal({ producer: 'section-usage', level: 'warning', where: 'sec:1', what: 'w', why: 'y' })]),
  perRail: [],
  frozen: [],
};

// ── Author-owned authoring surface ───────────────────────────────────────────────
const AUTHOR_RUNTIME_ORIGIN: Omit<ProposalOrigin, 'client' | 'track'> = { producer: DESIGNER_AUTHOR_PRODUCER, authoredBy: 'designer:hill' };
const AUTHOR_RUNTIME: ProposalRuntimeInputs = {
  kind: 'component',
  origin: AUTHOR_RUNTIME_ORIGIN,
  semanticFamily: 'family-hero',
  designerIntent: 'A confident hero for developer-facing SaaS',
  evidence: [{ description: 'Brief calls for a bold hero', reference: 'brief §2' }],
};
const FIXED_NOW = (): string => '2026-01-01T00:00:00Z';

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

describe('P58 generation-engine contract orchestration', () => {
  it('builds exactly ONE immutable, verified contract and derives both boundary views from it', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(Object.isFrozen(orch.contract)).toBe(true);
    expect(verifyContract(orch.contract)).toBe(true); // integrity holds
    expect(orch.contractId).toBe(orch.contract.planId);
    // both views are projections of the SAME contract — same identity, same scope
    expect(orch.doctorContract.client).toBe(orch.contract.identity.client);
    expect(orch.authorContract.client).toBe(orch.contract.identity.client);
    expect(orch.doctorContract.deliverables).toEqual(orch.contract.scope.included);
    expect(orch.authorContract.deliverables).toEqual(orch.contract.scope.included);
    expect(orch.doctorContract.deliverables).toEqual(orch.authorContract.deliverables);
  });

  it('is deterministic: the same READY project replays the identical contract (single construction, no drift)', () => {
    const a = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    const b = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });
    expect(a.contractId).toBe(b.contractId);
    expect(a.contract).toEqual(b.contract);
  });

  it('refuses to orchestrate a project that is not READY (admission gate — no contract without readiness)', () => {
    const blocked = readinessFor(['website'], { requiredApprovals: ['legal sign-off'] });
    expect(() => orchestrateGeneration({ client: 'acme', readiness: blocked })).toThrow(/READY|readiness|admit/i);
  });

  it('Doctor and Author consume the SAME contract: outputs are identical to the direct/legacy path', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website']) });

    const viaOrchDoctor = runDoctorFromOrchestration(orch, 'website', DOCTOR_RUNTIME);
    const directDoctor = buildDoctorReport({ subject: 'acme/website', ...DOCTOR_RUNTIME });
    expect(viaOrchDoctor).toEqual(directDoctor); // identical diagnostics + deterministic replay

    const viaOrchAuthor = runAuthorFromOrchestration(orch, 'website', AUTHOR_RUNTIME, { now: FIXED_NOW });
    const directAuthor = generateProposal({ ...AUTHOR_RUNTIME, origin: { ...AUTHOR_RUNTIME_ORIGIN, client: 'acme', track: 'website' } }, { now: FIXED_NOW });
    expect(viaOrchAuthor).toEqual(directAuthor); // identical authored artifact
    expect(viaOrchAuthor.identity.id).toBe(directAuthor.identity.id); // identical content-derived replay identity
  });

  it('website + collateral share ONE contract; both deliverables drive off it and deck is refused', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral']) });
    expect(orch.contract.scope.included).toEqual(['website', 'collateral']);
    expect(orch.doctorContract.deliverables).toEqual(['website', 'collateral']);
    expect(orch.authorContract.deliverables).toEqual(['website', 'collateral']);
    // both deliverables diagnose off the SAME orchestration, each identical to its direct call
    expect(runDoctorFromOrchestration(orch, 'website', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/website', ...DOCTOR_RUNTIME }));
    expect(runDoctorFromOrchestration(orch, 'collateral', DOCTOR_RUNTIME)).toEqual(buildDoctorReport({ subject: 'acme/collateral', ...DOCTOR_RUNTIME }));
    // deck is design-team-gated → out of the contract's scope → refused by both consumers
    expect(() => runDoctorFromOrchestration(orch, 'deck', DOCTOR_RUNTIME)).toThrow(/scope/i);
    expect(() => runAuthorFromOrchestration(orch, 'deck', AUTHOR_RUNTIME, { now: FIXED_NOW })).toThrow(/scope/i);
  });

  it('enterprise (high-risk, complex) project: the single contract preserves governance + coordination constraints', () => {
    const orch = orchestrateGeneration({ client: 'acme', readiness: readinessFor(['website', 'collateral'], { riskLevel: 'high', projectComplexity: 'complex' }) });
    const kinds = orch.contract.constraints.map((c) => c.kind);
    expect(kinds).toContain('governance'); // regulated-governance preserved on the one contract
    expect(kinds).toContain('coordination'); // cross-deliverable-consistency preserved
    expect(contractConstraints(orch.contract, 'governance').map((c) => c.id)).toContain('regulated-governance');
  });
});
