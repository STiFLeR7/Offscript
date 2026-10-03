/**
 * G4-S1 — Legacy Runtime Readiness: a READ-ONLY predicate that answers, from a fleet assessment, whether
 * the CLI's legacy execution branch (`resolveGenerationEntry` `readiness===null` fallback) can now retire.
 *
 * The retirement precondition (G2-S4): every supported production project must possess `readiness.json`
 * — i.e. every project is ALREADY_MIGRATED. This predicate turns that into a measurable, testable gate:
 * `retirable` is true iff the fleet is non-empty and every project is ALREADY_MIGRATED; otherwise it
 * reports the blockers (projects still to migrate, and NOT_MIGRATABLE projects that need a brief fix).
 * It changes no evaluation rule and persists nothing — it reuses the G3-S3 assessment unchanged.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import type { ReadinessPolicy } from '../../src/project/readiness-policy.js';
import { assessFleet } from '../../src/project/fleet-assessment.js';
import type { MigrationPlanInput } from '../../src/project/migration-planner.js';
import { assessLegacyRetirement } from '../../src/project/legacy-runtime-readiness.js';

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

const emptyPolicy: ReadinessPolicy = {
  id: 'empty',
  requirements: () => ({ minEvidence: [], minAssets: [], minApprovals: [], requiredDeliverables: [], requiredWorkflowTasks: [], requiredDecisions: [], niceToHaveEvidence: [] }),
};

const migrated = (client: string): MigrationPlanInput => ({ client, readinessPresent: true });
const ready = (client: string): MigrationPlanInput => ({ client, readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], []), policy: emptyPolicy });
const op = (client: string): MigrationPlanInput => ({ client, readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) });
const notMig = (client: string): MigrationPlanInput => ({ client, readinessPresent: false }); // no brief

describe('G4-S1 legacy runtime retirement readiness', () => {
  it('RETIRABLE only when every project is ALREADY_MIGRATED', () => {
    const r = assessLegacyRetirement(assessFleet([migrated('a'), migrated('b')]));
    expect(r.retirable).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.alreadyMigrated).toEqual(['a', 'b']);
    expect(r.pendingMigration).toEqual([]);
    expect(r.notMigratable).toEqual([]);
  });

  it('NOT retirable while any project is still migratable-but-unmigrated (READY or OPERATOR)', () => {
    const r = assessLegacyRetirement(assessFleet([migrated('a'), ready('b'), op('c')]));
    expect(r.retirable).toBe(false);
    expect(r.pendingMigration).toEqual(['b', 'c']);
    expect(r.blockers.some((m) => /not yet migrated/i.test(m))).toBe(true);
  });

  it('NOT retirable while any project is NOT_MIGRATABLE (hard blocker — needs a brief fix)', () => {
    const r = assessLegacyRetirement(assessFleet([migrated('a'), notMig('z')]));
    expect(r.retirable).toBe(false);
    expect(r.notMigratable).toEqual(['z']);
    expect(r.blockers.some((m) => /NOT_MIGRATABLE/.test(m))).toBe(true);
  });

  it('an empty fleet is NOT retirable — nothing to attest, the branch must be retained', () => {
    const r = assessLegacyRetirement(assessFleet([]));
    expect(r.retirable).toBe(false);
    expect(r.total).toBe(0);
    expect(r.blockers.some((m) => /no projects|nothing to attest/i.test(m))).toBe(true);
  });

  it('partitions the fleet (alreadyMigrated + pending + notMigratable == total) and is deterministic', () => {
    const inputs = [migrated('a'), ready('b'), op('c'), notMig('z')];
    const r = assessLegacyRetirement(assessFleet(inputs));
    expect(r.alreadyMigrated.length + r.pendingMigration.length + r.notMigratable.length).toBe(r.total);
    expect(r).toEqual(assessLegacyRetirement(assessFleet([...inputs].reverse())));
  });
});
