/**
 * G3-S2 — Migration Planning: a READ-ONLY capability that predicts, per project, its migration state
 * WITHOUT any writes. It reuses G3-S1's exact `reconstructLegacyReadiness` (the shared evaluation), so
 * "planning must not evaluate differently from migration" holds by construction — the tests below prove
 * the planner's prediction equals what migration would actually produce.
 *
 * Four states: READY_TO_MIGRATE · OPERATOR_INPUT_REQUIRED · NOT_MIGRATABLE · ALREADY_MIGRATED.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import { reconstructLegacyReadiness } from '../../src/project/project-migration.js';
import { planMigration } from '../../src/project/migration-planner.js';

const BRIEF = `---
schemaVersion: 1
track: collateral
brand: Acme
one-liner: Acme ships production-grade widgets fast.
audience: Operations leaders
tone: Confident
must-include:
  - "hero: widgets that ship"
---
# Acme
Acme ships widgets.
`;

// A brief missing the required `brand` fact — an evidence blocker the operator CANNOT supply via migration.
const BRIEF_NO_BRAND = `---
schemaVersion: 1
track: collateral
one-liner: Something ships fast.
audience: Operations leaders
tone: Confident
must-include:
  - "hero: x"
---
# X
body
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

describe('G3-S2 migration planning', () => {
  it('ALREADY_MIGRATED when readiness.json is already present (no reconstruct needed)', () => {
    const plan = planMigration({ client: 'acme', readinessPresent: true });
    expect(plan.state).toBe('ALREADY_MIGRATED');
    expect(plan.predictedArtifacts).toEqual([]);
  });

  it('NOT_MIGRATABLE when there is no brief.md', () => {
    const plan = planMigration({ client: 'acme', readinessPresent: false });
    expect(plan.state).toBe('NOT_MIGRATABLE');
    expect(plan.reason).toMatch(/brief/i);
  });

  it('OPERATOR_INPUT_REQUIRED: reports the exact required evidence and predicts a READY outcome', () => {
    const acq = acqFor(['collateral'], ['brand sign-off']);
    const plan = planMigration({ client: 'acme', readinessPresent: false, briefText: BRIEF, acquisition: acq });
    expect(plan.state).toBe('OPERATOR_INPUT_REQUIRED');
    expect(plan.requiredEvidence.assets).toContain('logo');
    expect(plan.requiredEvidence.approvals).toContain('brand sign-off');
    expect(plan.predictedReadinessState).toBe('READY');
    expect(plan.predictedAdmission).toBe(true);
    expect(plan.predictedArtifacts).toEqual(['readiness.json']);
  });

  it('PREDICTION ACCURACY: supplying the planner-reported evidence to migration yields the predicted admission', () => {
    const acq = acqFor(['collateral'], ['brand sign-off']);
    const plan = planMigration({ client: 'acme', readinessPresent: false, briefText: BRIEF, acquisition: acq });
    // feed the planner's required evidence into the SAME evaluation migration runs
    const actual = reconstructLegacyReadiness({
      client: 'acme', acquisition: acq, briefText: BRIEF,
      evidence: { assets: plan.requiredEvidence.assets, approvals: plan.requiredEvidence.approvals },
      now: '2000-01-01T00:00:00.000Z',
    });
    expect(actual.admitted).toBe(plan.predictedAdmission);
    expect(actual.assessment.state).toBe(plan.predictedReadinessState);
  });

  it('NOT_MIGRATABLE when a non-supplyable blocker (missing brand evidence) survives even maximal evidence', () => {
    const acq = acqFor(['collateral'], []); // low-risk, no approvals required
    const plan = planMigration({ client: 'acme', readinessPresent: false, briefText: BRIEF_NO_BRAND, acquisition: acq });
    expect(plan.state).toBe('NOT_MIGRATABLE');
    expect(plan.predictedAdmission).toBe(false);
    expect(plan.predictedArtifacts).toEqual([]);
    // the surviving blocker is flagged non-supplyable (operator evidence can't clear it)
    expect(plan.blockers.some((b) => b.id === 'evidence:brand' && !b.supplyable)).toBe(true);
    // …and migration would indeed refuse: supplying the supplyable evidence still isn't admitted
    const actual = reconstructLegacyReadiness({
      client: 'acme', acquisition: acq, briefText: BRIEF_NO_BRAND,
      evidence: { assets: plan.requiredEvidence.assets, approvals: plan.requiredEvidence.approvals },
      now: '2000-01-01T00:00:00.000Z',
    });
    expect(actual.admitted).toBe(false);
  });

  it('is deterministic + idempotent: identical inputs → deep-equal plans', () => {
    const acq = acqFor(['collateral'], ['brand sign-off']);
    const a = planMigration({ client: 'acme', readinessPresent: false, briefText: BRIEF, acquisition: acq });
    const b = planMigration({ client: 'acme', readinessPresent: false, briefText: BRIEF, acquisition: acq });
    expect(a).toEqual(b);
  });
});
