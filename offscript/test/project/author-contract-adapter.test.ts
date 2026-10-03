/**
 * P57 — Author Contract Adapter (unit): the boundary that SOURCES a proposal's identity/scope
 * (origin.client + origin.track) from the immutable P55 Generation Contract and passes every
 * author-owned field through VERBATIM. Mirrors P56's doctor-contract-adapter unit tests.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import { DESIGNER_AUTHOR_PRODUCER, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { generateProposal } from '../../src/designer-author/proposal-generator.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import { evaluateReadiness } from '../../src/project/readiness-evaluator.js';
import { planGeneration } from '../../src/project/generation-planner.js';
import {
  authorContractFromPlan,
  authorOriginFromContract,
  proposalRequestFromContract,
  generateProposalFromContract,
  type AuthorGenerationContract,
  type ProposalRuntimeInputs,
} from '../../src/project/author-contract-adapter.js';

// A bare Author boundary view (the shape `authorContractFromLegacy` used to build) — used to unit-test
// the retained boundary helpers without depending on a full native plan.
const WEBSITE_CONTRACT: AuthorGenerationContract = { client: 'acme', deliverables: ['website'] };

// ── Author-owned runtime surface (contract-owned client/track removed) ───────────
const RUNTIME_ORIGIN: Omit<ProposalOrigin, 'client' | 'track'> = { producer: DESIGNER_AUTHOR_PRODUCER, authoredBy: 'designer:hill' };
const RUNTIME: ProposalRuntimeInputs = {
  kind: 'component',
  origin: RUNTIME_ORIGIN,
  semanticFamily: 'family-hero',
  designerIntent: 'A confident hero for developer-facing SaaS',
  evidence: [{ description: 'Brief calls for a bold hero', reference: 'brief §2' }],
};
const FIXED_NOW = (): string => '2026-01-01T00:00:00Z';

// ── A native P55 Generation Plan for client 'acme' (same fixture shape as P56) ────
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

describe('P57 author contract adapter — boundary sourcing', () => {
  it('authorOriginFromContract sources client+track from the contract, keeps producer+authoredBy verbatim', () => {
    expect(authorOriginFromContract(WEBSITE_CONTRACT, 'website', RUNTIME_ORIGIN)).toEqual({
      producer: DESIGNER_AUTHOR_PRODUCER, client: 'acme', track: 'website', authoredBy: 'designer:hill',
    });
  });

  it('proposalRequestFromContract passes every author-owned field through verbatim', () => {
    const req = proposalRequestFromContract(WEBSITE_CONTRACT, 'website', RUNTIME);
    expect(req).toEqual({ ...RUNTIME, origin: { ...RUNTIME_ORIGIN, client: 'acme', track: 'website' } });
  });

  it('a native P55 plan projects to the expected boundary view', () => {
    expect(authorContractFromPlan(nativePlan(['website']))).toEqual(WEBSITE_CONTRACT);
  });

  it('the contract scope gates which deliverable a proposal may target', () => {
    expect(() => proposalRequestFromContract(WEBSITE_CONTRACT, 'collateral', RUNTIME)).toThrow(/scope/i);
    expect(() => generateProposalFromContract(WEBSITE_CONTRACT, 'deck', RUNTIME, { now: FIXED_NOW })).toThrow(/scope/i);
  });

  it('generateProposalFromContract stamps the contract identity onto the produced proposal', () => {
    const contract = authorContractFromPlan(nativePlan(['website']));
    const proposal = generateProposalFromContract(contract, 'website', RUNTIME, { now: FIXED_NOW });
    expect(proposal.origin.client).toBe('acme');
    expect(proposal.origin.track).toBe('website');
    expect(proposal.origin.authoredBy).toBe('designer:hill');
  });

  it('the produced proposal equals the pre-adoption direct call (the contract only re-sources identity)', () => {
    const contract = authorContractFromPlan(nativePlan(['website']));
    const viaContract = generateProposalFromContract(contract, 'website', RUNTIME, { now: FIXED_NOW });
    const direct = generateProposal({ ...RUNTIME, origin: { ...RUNTIME_ORIGIN, client: 'acme', track: 'website' } }, { now: FIXED_NOW });
    expect(viaContract).toEqual(direct);
  });
});
