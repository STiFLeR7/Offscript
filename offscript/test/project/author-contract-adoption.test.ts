/**
 * P57 — Contract adoption: Designer Author driven through the Generation Contract produces
 * IDENTICAL behaviour whether the contract comes from the legacy identity bridge or from a native
 * P55 plan, and identical to the pre-adoption direct call. Same authored artifact, same package,
 * same replay identity, same metadata — the boundary changed, the behaviour did not.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import { DESIGNER_AUTHOR_PRODUCER, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { generateProposal, generateProposalPackage } from '../../src/designer-author/proposal-generator.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { planGeneration } from '../../src/project/generation-planner.js';
import {
  authorContractFromPlan,
  generateProposalFromContract,
  generateProposalPackageFromContract,
  type ProposalRuntimeInputs,
} from '../../src/project/author-contract-adapter.js';

const RUNTIME_ORIGIN: Omit<ProposalOrigin, 'client' | 'track'> = { producer: DESIGNER_AUTHOR_PRODUCER, authoredBy: 'designer:hill' };
const RUNTIME: ProposalRuntimeInputs = {
  kind: 'component',
  origin: RUNTIME_ORIGIN,
  semanticFamily: 'family-hero',
  designerIntent: 'A confident hero for developer-facing SaaS',
  evidence: [{ description: 'Brief calls for a bold hero', reference: 'brief §2' }],
};
const FIXED_NOW = (): string => '2026-01-01T00:00:00Z';
const directOrigin: ProposalOrigin = { ...RUNTIME_ORIGIN, client: 'acme', track: 'website' };

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

describe('P57 Designer Author contract adoption — identical behaviour', () => {
  it('native-plan contract and direct call produce the IDENTICAL AuthorProposal', () => {
    const nativeView = authorContractFromPlan(nativePlan(['website']));
    expect(nativeView).toEqual({ client: 'acme', deliverables: ['website'] }); // the plan projects to this view

    const viaNative = generateProposalFromContract(nativeView, 'website', RUNTIME, { now: FIXED_NOW });
    const direct = generateProposal({ ...RUNTIME, origin: directOrigin }, { now: FIXED_NOW });

    expect(viaNative).toEqual(direct); // identical to the pre-adoption path — the boundary re-sources identity only
  });

  it('identical package + replay: the ProposalPackage is deep-equal and proposalId/sha256 match across paths', () => {
    const nativeView = authorContractFromPlan(nativePlan(['website']));
    const viaContract = generateProposalPackageFromContract(nativeView, 'website', RUNTIME, { now: FIXED_NOW });
    const direct = generateProposalPackage({ ...RUNTIME, origin: directOrigin }, { now: FIXED_NOW });

    expect(viaContract.manifest.proposalId).toBe(direct.manifest.proposalId); // content-derived replay identity
    expect(viaContract.manifest.artifacts).toEqual(direct.manifest.artifacts); // identical sha256
    expect(viaContract).toEqual(direct); // identical package
  });

  it('identical generated artifact: assembled content + content-derived id are byte-identical across paths', () => {
    const nativeView = authorContractFromPlan(nativePlan(['website']));
    const viaContract = generateProposalFromContract(nativeView, 'website', RUNTIME, { now: FIXED_NOW });
    const direct = generateProposal({ ...RUNTIME, origin: directOrigin }, { now: FIXED_NOW });
    expect(viaContract.content).toBe(direct.content);
    expect(viaContract.identity.id).toBe(direct.identity.id);
  });

  it('the contract scope gates which deliverables Author may target', () => {
    const websiteOnly = authorContractFromPlan(nativePlan(['website']));
    expect(() => generateProposalPackageFromContract(websiteOnly, 'collateral', RUNTIME, { now: FIXED_NOW })).toThrow(/scope/i);
  });
});
