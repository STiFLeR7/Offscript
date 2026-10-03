/**
 * G3-S1 — Legacy Project Migration: reconstruct a ProjectReadiness for a legacy project (one with a
 * brief.md but no readiness.json) using the EXISTING Project Platform rules, so it becomes native-eligible
 * and produces byte-identical outputs.
 *
 * The migration core (`reconstructLegacyReadiness`) interprets the legacy artifacts — the brief (→ confirmed
 * facts via the same `buildBriefSession` acquire-brief uses) plus operator-supplied evidence for the values
 * legacy artifacts cannot recover (validated assets, granted approvals) — and evaluates readiness with the
 * UNMODIFIED `projectReadinessFor` + `evaluateReadiness`. It fabricates nothing: without the supplied
 * evidence it honestly evaluates NOT_READY (the missing logo asset / ungranted approvals are real blockers).
 * Persistence is the CLI's job (`scripts/migrate-project.ts`); this core is pure over its inputs.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import { serializeProjectReadiness } from '../../src/project/readiness-store.js';
import { resolveGenerationEntry, beginGeneration } from '../../src/project/generation-orchestration.js';
import { legacyExecutionIdentityFromLegacy } from '../../src/project/legacy-execution-adapter.js';
import { reconstructLegacyReadiness } from '../../src/project/project-migration.js';

const NOW = '2000-01-01T00:00:00.000Z';

const BRIEF = `---
schemaVersion: 1
track: collateral
brand: Acme
one-liner: Acme ships production-grade widgets fast.
audience: Operations leaders
tone: Confident
goals:
  - Convert buyers
must-include:
  - "hero: widgets that ship"
  - "features: fast, reliable"
---
# Acme
Acme ships widgets.
`;

function acqFor(deliverables: Track[], requiredApprovals: string[]): AcquisitionPlan {
  const strategy: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'],
    requiredApprovals, unknownCriticalDecisions: [],
  };
  return {
    projectType: 'collateral', track: deliverables[0], deliverables, sourceId: 'manual', strategy,
    questionPlan: { questions: [] }, questions: [], ready: true, alreadyKnown: [], critical: [],
    inferable: [], neverInfer: [], mustConfirm: [],
  };
}

describe('G3-S1 legacy project migration', () => {
  it('migrates a legacy brief + supplied evidence into an admitted ProjectReadiness', () => {
    const acq = acqFor(['collateral'], ['brand sign-off']);
    const r = reconstructLegacyReadiness({
      client: 'acme', acquisition: acq, briefText: BRIEF,
      evidence: { assets: ['logo.svg'], approvals: ['brand sign-off'] }, now: NOW,
    });
    expect(r.admitted).toBe(true);
    expect(r.assessment.state).toBe('READY');
    expect(r.readiness.deliverables).toEqual(['collateral']);
    // the brief-derived context carries the confirmed facts + the supplied logo asset (no fabrication of facts)
    expect(r.readiness.context?.confirmedFacts.brand?.value).toBe('Acme');
    expect(r.readiness.context?.knownAssets).toContain('logo.svg');
  });

  it('is deterministic + idempotent: identical inputs → byte-identical serialized readiness', () => {
    const mk = () => reconstructLegacyReadiness({
      client: 'acme', acquisition: acqFor(['collateral'], ['brand sign-off']), briefText: BRIEF,
      evidence: { assets: ['logo.svg'], approvals: ['brand sign-off'] }, now: NOW,
    }).readiness;
    expect(serializeProjectReadiness(mk())).toBe(serializeProjectReadiness(mk()));
  });

  it('NEVER fabricates: without the supplied evidence, the missing logo asset is an honest blocker (NOT admitted)', () => {
    const r = reconstructLegacyReadiness({
      client: 'acme', acquisition: acqFor(['collateral'], ['brand sign-off']), briefText: BRIEF, now: NOW,
    });
    expect(r.admitted).toBe(false);
    expect(r.assessment.state).not.toBe('READY');
    expect(r.assessment.blockers.map((b) => b.id)).toContain('asset:logo');
    expect(r.assessment.blockers.map((b) => b.id)).toContain('approval:brand-sign-off');
  });

  it('GenerationPlan / GenerationContract unchanged: the migrated readiness drives native execution deterministically, byte-identical to legacy identity', () => {
    const readiness = reconstructLegacyReadiness({
      client: 'acme', acquisition: acqFor(['collateral'], ['brand sign-off']), briefText: BRIEF,
      evidence: { assets: ['logo.svg'], approvals: ['brand sign-off'] }, now: NOW,
    }).readiness;
    // native execution becomes available, and its identity byte-equals the legacy fallback identity
    const entry = resolveGenerationEntry({ client: 'acme', track: 'collateral', readiness });
    expect(entry.mode).toBe('native');
    expect(entry.identity).toEqual(legacyExecutionIdentityFromLegacy({ client: 'acme', track: 'collateral' }));
    // replay: the same migrated readiness yields the identical GenerationContract id
    const a = beginGeneration({ client: 'acme', readiness });
    const b = beginGeneration({ client: 'acme', readiness });
    expect(a.orchestration.contractId).toBe(b.orchestration.contractId);
  });
});
