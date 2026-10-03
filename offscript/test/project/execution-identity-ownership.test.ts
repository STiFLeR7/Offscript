/**
 * G2-S2 — DesignContext Ownership Retirement: the GenerationContract is the sole PRODUCTION owner of
 * execution identity; DesignContext transports a COMPATIBILITY PROJECTION of it, never originates it.
 *
 * The seam is `resolveGenerationEntry`: it now carries the execution-identity projection
 * (`LegacyExecutionIdentity`) on BOTH modes — native sources it FROM the frozen contract
 * (`renderIdentityFromOrchestration`), legacy sources it from the compatibility bridge
 * (`legacyExecutionIdentityFromLegacy`). `scripts/generate.ts` then builds the DesignContext's
 * {client, track} from `entry.identity` instead of from raw argv, so execution identity flows
 * Contract → projection → DesignContext. Both projections are byte-identical to the legacy {client,
 * track}, so behaviour is unchanged.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import {
  legacyExecutionIdentityFromLegacy,
  legacyExecutionIdentityFromContract,
} from '../../src/project/legacy-execution-adapter.js';
import { resolveGenerationEntry } from '../../src/project/generation-orchestration.js';

function readinessFor(deliverables: Track[]): ProjectReadiness {
  const strategy: CreativeStrategy = {
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
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy, context }), strategy, context };
}

describe('G2-S2 execution-identity ownership', () => {
  it('legacy entry carries the execution-identity projection (compat bridge), not only a reason', () => {
    const entry = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    expect(entry.mode).toBe('legacy');
    // The compatibility projection — DesignContext will transport THIS, not raw argv.
    expect(entry.identity).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'website' }));
    expect(entry.identity).toEqual({ client: 'acme', track: 'website', subject: 'acme/website' });
  });

  it('native entry sources the execution identity FROM the contract (the GenerationContract is the owner)', () => {
    const entry = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: readinessFor(['website']) });
    if (entry.mode !== 'native') throw new Error('unreachable');
    // Ownership: the identity IS the contract's projection — its client comes from the contract identity.
    expect(entry.identity.client).toBe(entry.generation.orchestration.contract.identity.client);
    expect(entry.identity).toEqual(legacyExecutionIdentityFromContract(entry.generation.orchestration.renderContract, 'website'));
  });

  it('single execution identity: the native (contract) and legacy (bridge) projections are byte-identical', () => {
    const native = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: readinessFor(['website']) });
    const legacy = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    expect(native.identity).toEqual(legacy.identity);
  });

  it('the projection carries the SAME {client, track} for both modes — DesignContext transports one value', () => {
    const native = resolveGenerationEntry({ client: 'acme', track: 'collateral', readiness: readinessFor(['collateral']) });
    const legacy = resolveGenerationEntry({ client: 'acme', track: 'collateral', readiness: null });
    expect({ client: native.identity.client, track: native.identity.track }).toEqual({ client: 'acme', track: 'collateral' });
    expect({ client: legacy.identity.client, track: legacy.identity.track }).toEqual({ client: 'acme', track: 'collateral' });
  });

  it('replay: the same inputs resolve to the identical execution-identity projection (both modes)', () => {
    const r = readinessFor(['website']);
    const nA = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: r });
    const nB = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: r });
    expect(nA.identity).toEqual(nB.identity);
    const lA = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    const lB = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    expect(lA.identity).toEqual(lB.identity);
  });
});
