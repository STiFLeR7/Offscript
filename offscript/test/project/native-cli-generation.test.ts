/**
 * G1-S4 — Native CLI Generation: the generation CLI's native-vs-legacy resolution. Given a possibly-absent
 * persisted ProjectReadiness (G1-S3), `resolveGenerationEntry` decides how generation begins — NATIVE
 * (build the GenerationContract ONCE from persisted readiness via beginGeneration, governed by admission +
 * scope) or LEGACY (no readiness → compatibility). It NEVER synthesizes readiness; a valid-but-not-READY
 * or scope-mismatched readiness fails closed (throws); a missing readiness returns the legacy fallback.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import { legacyExecutionIdentityFromLegacy } from '../../src/project/legacy-execution-adapter.js';
import { resolveGenerationEntry } from '../../src/project/generation-orchestration.js';

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

describe('G1-S4 native CLI generation entry', () => {
  it('absent readiness → legacy fallback (compatibility)', () => {
    const entry = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    expect(entry.mode).toBe('legacy');
  });

  it('present + READY + admitted track → native: the contract is built ONCE from persisted readiness', () => {
    const entry = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: readinessFor(['website']) });
    expect(entry.mode).toBe('native');
    if (entry.mode !== 'native') throw new Error('unreachable');
    expect(entry.generation.orchestration.contractId).toBe(entry.generation.orchestration.contract.planId);
    // the execution identity comes FROM the contract, and equals the single materialized projection
    expect(entry.identity).toEqual(entry.generation.legacyIdentity.get('website'));
    // …and it is byte-identical to the legacy {client, track} — so threading it changes nothing (behaviour unchanged)
    expect(entry.identity).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'website' }));
  });

  it('no duplicate identity: the native entry derives ONE identity, shared by the contract projection', () => {
    const entry = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: readinessFor(['website', 'collateral']) });
    if (entry.mode !== 'native') throw new Error('unreachable');
    expect(entry.identity).toEqual(entry.generation.legacyIdentity.get('website'));
    expect(entry.generation.orchestration.contract.scope.included).toEqual(['website', 'collateral']);
  });

  it('present but NOT READY → fail closed (the readiness gate refuses; the CLI never synthesizes)', () => {
    const notReady = readinessFor(['website'], { requiredApprovals: ['legal sign-off'] });
    expect(() => resolveGenerationEntry({ client: 'acme', track: 'website', readiness: notReady })).toThrow(/READY|readiness|admit/i);
  });

  it('present + READY but track NOT admitted by scope → fail closed', () => {
    // readiness admits website only; deck is design-team-gated / excluded → refused
    expect(() => resolveGenerationEntry({ client: 'acme', track: 'deck', readiness: readinessFor(['website']) })).toThrow(/scope/i);
  });

  it('replay: the same persisted readiness resolves to the identical contract + identity', () => {
    const r = readinessFor(['website']);
    const a = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: r });
    const b = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: r });
    if (a.mode !== 'native' || b.mode !== 'native') throw new Error('unreachable');
    expect(a.generation.orchestration.contractId).toBe(b.generation.orchestration.contractId);
    expect(a.identity).toEqual(b.identity);
  });

  it('enterprise (high-risk, complex) READY project → native, constraints preserved on the one contract', () => {
    const entry = resolveGenerationEntry({
      client: 'acme', track: 'website',
      readiness: readinessFor(['website', 'collateral'], { riskLevel: 'high', projectComplexity: 'complex' }),
    });
    if (entry.mode !== 'native') throw new Error('unreachable');
    const kinds = entry.generation.orchestration.contract.constraints.map((c) => c.kind);
    expect(kinds).toContain('governance');
    expect(kinds).toContain('coordination');
  });
});
