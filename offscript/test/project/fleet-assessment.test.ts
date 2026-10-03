/**
 * G3-S3 — Fleet Migration Assessment: a READ-ONLY aggregation of individual migration plans across every
 * project in a workspace. It reuses G3-S2's `planMigration` UNCHANGED, so the fleet result for each project
 * equals the standalone planner (prediction equality is by construction). The core is pure — no fs, no
 * persistence; discovery selection is a pure helper the CLI feeds from `readdirSync`.
 *
 * Deterministic ordering (per the brief): ALREADY_MIGRATED ▸ READY_TO_MIGRATE ▸ OPERATOR_INPUT_REQUIRED ▸
 * NOT_MIGRATABLE, alphabetical by client within each group.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import type { ReadinessPolicy } from '../../src/project/readiness-policy.js';
import { planMigration, type MigrationPlanInput } from '../../src/project/migration-planner.js';
import { assessFleet, selectProjects } from '../../src/project/fleet-assessment.js';

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

// One input per state (client names chosen so within-group order is testable independent of state order).
const migrated: MigrationPlanInput = { client: 'zzz-migrated', readinessPresent: true };
const ready: MigrationPlanInput = { client: 'yyy-ready', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], []), policy: emptyPolicy };
const opA: MigrationPlanInput = { client: 'aaa-op', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) };
const opB: MigrationPlanInput = { client: 'bbb-op', readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) };
const notMig: MigrationPlanInput = { client: 'ccc-none', readinessPresent: false }; // no brief

describe('G3-S3 fleet migration assessment', () => {
  it('discovery selection: keeps only projects (with references/), dedupes, sorts', () => {
    const chosen = selectProjects([
      { name: 'example-brand', hasReferences: true },
      { name: 'website', hasReferences: false }, // legacy track-kit dir — excluded
      { name: 'apa', hasReferences: true },
      { name: 'example-brand', hasReferences: true }, // duplicate — collapsed
      { name: 'collateral', hasReferences: false }, // excluded
    ]);
    expect(chosen).toEqual(['apa', 'example-brand']);
  });

  it('PREDICTION EQUALITY: each fleet plan equals the standalone planMigration for that project', () => {
    const inputs = [migrated, ready, opA, opB, notMig];
    const fleet = assessFleet(inputs);
    for (const input of inputs) {
      const solo = planMigration(input);
      const fromFleet = fleet.plans.find((p) => p.client === input.client);
      expect(fromFleet).toEqual(solo);
    }
  });

  it('deterministic ordering: ALREADY ▸ READY ▸ OPERATOR ▸ NOT_MIGRATABLE, alphabetical within group', () => {
    const scrambled = [opB, notMig, migrated, opA, ready];
    const fleet = assessFleet(scrambled);
    expect(fleet.order).toEqual(['zzz-migrated', 'yyy-ready', 'aaa-op', 'bbb-op', 'ccc-none']);
    expect(fleet.plans.map((p) => p.state)).toEqual([
      'ALREADY_MIGRATED', 'READY_TO_MIGRATE', 'OPERATOR_INPUT_REQUIRED', 'OPERATOR_INPUT_REQUIRED', 'NOT_MIGRATABLE',
    ]);
  });

  it('aggregation: totals per state are correct and sum to the total', () => {
    const fleet = assessFleet([migrated, ready, opA, opB, notMig]);
    expect(fleet.total).toBe(5);
    expect(fleet.totals.ALREADY_MIGRATED).toBe(1);
    expect(fleet.totals.READY_TO_MIGRATE).toBe(1);
    expect(fleet.totals.OPERATOR_INPUT_REQUIRED).toBe(2);
    expect(fleet.totals.NOT_MIGRATABLE).toBe(1);
    const sum = Object.values(fleet.totals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(fleet.total);
    expect(fleet.byState.OPERATOR_INPUT_REQUIRED.map((p) => p.client)).toEqual(['aaa-op', 'bbb-op']);
  });

  it('is deterministic: two assessments of the same inputs (any order) are deep-equal', () => {
    const a = assessFleet([migrated, ready, opA, opB, notMig]);
    const b = assessFleet([notMig, opB, opA, ready, migrated]);
    expect(a).toEqual(b);
  });
});
