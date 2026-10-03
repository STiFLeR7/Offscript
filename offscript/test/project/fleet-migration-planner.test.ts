/**
 * G3-S4 — Fleet Migration Planner: transforms a READ-ONLY `FleetAssessment` (G3-S3) into a deterministic,
 * executable `FleetMigrationPlan`. It is a PURE derivation of the assessment — it changes no evaluation
 * rule, runs no migration, and persists nothing. Because every step is derived from the assessment's own
 * `MigrationPlan` per project, "planning must exactly reflect assessment results" holds by construction.
 *
 * Scheduling (per the brief): READY_TO_MIGRATE first (an immediate phase, no operator input), then
 * OPERATOR_INPUT_REQUIRED grouped into explicit operator checkpoints; NOT_MIGRATABLE excluded with reasons;
 * ALREADY_MIGRATED reported separately. Migrations are independent (no inter-project dependency), so
 * `blockingDependencies` is always intra-project (evidence gates / brief fixes), never "migrate X first".
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import type { ReadinessPolicy } from '../../src/project/readiness-policy.js';
import { assessFleet, type FleetAssessment } from '../../src/project/fleet-assessment.js';
import type { MigrationPlanInput } from '../../src/project/migration-planner.js';
import { buildFleetMigrationPlan } from '../../src/project/fleet-migration-planner.js';

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

// A permissive policy so a brief reconstructs admitted with NO operator input → READY_TO_MIGRATE.
const emptyPolicy: ReadinessPolicy = {
  id: 'empty',
  requirements: () => ({ minEvidence: [], minAssets: [], minApprovals: [], requiredDeliverables: [], requiredWorkflowTasks: [], requiredDecisions: [], niceToHaveEvidence: [] }),
};

const migrated: MigrationPlanInput = { client: 'zzz-migrated', readinessPresent: true };
const ready1: MigrationPlanInput = { client: 'aaa-ready', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], []), policy: emptyPolicy };
const ready2: MigrationPlanInput = { client: 'bbb-ready', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], []), policy: emptyPolicy };
// opA + opB share an evidence signature (logo asset + brand sign-off) → one checkpoint.
const opA: MigrationPlanInput = { client: 'mmm-op', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) };
const opB: MigrationPlanInput = { client: 'nnn-op', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) };
// opC needs an extra approval → a DIFFERENT evidence signature → a second checkpoint.
const opC: MigrationPlanInput = { client: 'ppp-op2', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off', 'executive sign-off']) };
const notMig: MigrationPlanInput = { client: 'yyy-none', readinessPresent: false }; // no brief

const ALL = [migrated, ready1, ready2, opA, opB, opC, notMig];

const clientsOf = (steps: readonly { client: string }[]) => steps.map((s) => s.client);

describe('G3-S4 fleet migration planning', () => {
  it('PREDICTION CONSISTENCY: every step reflects the assessment plan exactly', () => {
    const assessment = assessFleet(ALL);
    const plan = buildFleetMigrationPlan(assessment);
    const stepFor = (client: string) =>
      [...plan.phases.flatMap((ph) => ph.steps), ...plan.skipped, ...plan.blocked].find((s) => s.client === client)!;
    for (const src of assessment.plans) {
      const step = stepFor(src.client);
      expect(step.currentState).toBe(src.state);
      expect(step.requiredEvidence).toEqual(src.requiredEvidence);
      expect(step.expectedArtifacts).toEqual(src.predictedArtifacts);
      expect(step.reason).toBe(src.reason);
    }
  });

  it('READY_TO_MIGRATE scheduled first in an immediate phase; operator checkpoints follow', () => {
    const plan = buildFleetMigrationPlan(assessFleet(ALL));
    expect(plan.phases[0].kind).toBe('IMMEDIATE');
    expect(clientsOf(plan.phases[0].steps)).toEqual(['aaa-ready', 'bbb-ready']);
    expect(plan.phases[0].steps.every((s) => s.eligibility === 'ELIGIBLE_NOW')).toBe(true);
    expect(plan.phases[0].steps.every((s) => s.blockingDependencies.length === 0)).toBe(true);
    // every phase after the first is an operator checkpoint
    expect(plan.phases.slice(1).every((ph) => ph.kind === 'OPERATOR_CHECKPOINT')).toBe(true);
    // execution order begins with the ready projects
    expect(plan.order.slice(0, 2)).toEqual(['aaa-ready', 'bbb-ready']);
  });

  it('OPERATOR checkpoint grouping: same evidence groups together, different evidence splits', () => {
    const plan = buildFleetMigrationPlan(assessFleet(ALL));
    expect(plan.checkpoints).toHaveLength(2);
    // checkpoint 1: {logo, brand sign-off} → opA + opB
    expect(plan.checkpoints[0].requiredEvidence.assets).toEqual(['logo']);
    expect(plan.checkpoints[0].requiredEvidence.approvals).toEqual(['brand sign-off']);
    expect(clientsOf(plan.checkpoints[0].steps)).toEqual(['mmm-op', 'nnn-op']);
    // checkpoint 2: {logo, brand sign-off + executive sign-off} → opC alone
    expect(plan.checkpoints[1].requiredEvidence.approvals).toEqual(['brand sign-off', 'executive sign-off']);
    expect(clientsOf(plan.checkpoints[1].steps)).toEqual(['ppp-op2']);
    // checkpoint ids are deterministic + stable
    expect(plan.checkpoints.map((c) => c.id)).toEqual(['checkpoint-1', 'checkpoint-2']);
    // operator steps are gated on their evidence (intra-project blocking dependency)
    const op = plan.checkpoints[0].steps[0];
    expect(op.eligibility).toBe('ELIGIBLE_AFTER_EVIDENCE');
    expect(op.blockingDependencies).toEqual(['asset:logo', 'approval:brand sign-off']);
    expect(op.targetState).toBe('ALREADY_MIGRATED');
  });

  it('NOT_MIGRATABLE excluded with reasons; ALREADY_MIGRATED reported separately — neither in phases', () => {
    const plan = buildFleetMigrationPlan(assessFleet(ALL));
    expect(clientsOf(plan.blocked)).toEqual(['yyy-none']);
    expect(plan.blocked[0].eligibility).toBe('EXCLUDED');
    expect(plan.blocked[0].targetState).toBe('NOT_MIGRATABLE');
    expect(plan.blocked[0].reason).toMatch(/brief/i);
    expect(clientsOf(plan.skipped)).toEqual(['zzz-migrated']);
    expect(plan.skipped[0].eligibility).toBe('COMPLETE');
    // excluded + skipped never appear in an executable phase / the execution order
    expect(plan.order).not.toContain('yyy-none');
    expect(plan.order).not.toContain('zzz-migrated');
  });

  it('is deterministic + pure: any input order → deep-equal plan, and the input assessment is not mutated', () => {
    const a = buildFleetMigrationPlan(assessFleet(ALL));
    const b = buildFleetMigrationPlan(assessFleet([notMig, opC, opB, ready2, opA, migrated, ready1]));
    expect(a).toEqual(b);
    const assessment = assessFleet(ALL);
    const before = JSON.stringify(assessment);
    buildFleetMigrationPlan(assessment);
    expect(JSON.stringify(assessment)).toBe(before); // no mutation, no persistence
  });

  it('DETERMINISTIC RESUME: re-planning after a partial migration yields exactly the remaining work', () => {
    const plan1 = buildFleetMigrationPlan(assessFleet(ALL));
    // simulate ready1 having been migrated mid-run: its readiness.json now exists.
    const resumed: MigrationPlanInput[] = ALL.map((i) => (i.client === 'aaa-ready' ? { client: 'aaa-ready', readinessPresent: true } : i));
    const plan2 = buildFleetMigrationPlan(assessFleet(resumed));
    // the migrated project drops out of the executable order and into skipped…
    expect(plan2.order).not.toContain('aaa-ready');
    expect(clientsOf(plan2.skipped)).toContain('aaa-ready');
    // …and the remaining execution order is exactly plan1's order minus that project (stable subsequence).
    expect(plan2.order).toEqual(plan1.order.filter((c) => c !== 'aaa-ready'));
  });
});

// Suppress "unused" on the FleetAssessment import when only used as a type in some builds.
export type _Uses = FleetAssessment;
