/**
 * G3-S5 — Fleet Migration Executor: executes an existing `FleetMigrationPlan` (G3-S4). It CONSUMES the
 * plan — it never replans, reorders, or changes migration semantics. It auto-executes the IMMEDIATE
 * (READY) phase, TERMINATES at the first operator checkpoint, and resumes purely by rebuilding the plan
 * from the filesystem (migrated projects become ALREADY_MIGRATED and drop out). No journal, no checkpoint
 * file — the filesystem is the source of truth.
 *
 * The executor is pure w.r.t. an injected `Migrator` (the side-effecting single-project migration), so
 * these tests use a fake migrator that records calls and marks projects migrated in an in-memory set.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import type { ReadinessPolicy } from '../../src/project/readiness-policy.js';
import { assessFleet } from '../../src/project/fleet-assessment.js';
import { buildFleetMigrationPlan } from '../../src/project/fleet-migration-planner.js';
import type { MigrationPlanInput } from '../../src/project/migration-planner.js';
import { planExecution, executeFleetPlan, type Migrator } from '../../src/project/fleet-migration-executor.js';

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

// Fleet: 2 READY (immediate phase), 2 OPERATOR (one checkpoint), 1 NOT_MIGRATABLE (no brief).
type Def = { client: string; kind: 'ready' | 'op' | 'none' };
const DEFS: Def[] = [
  { client: 'aaa-ready', kind: 'ready' },
  { client: 'bbb-ready', kind: 'ready' },
  { client: 'mmm-op', kind: 'op' },
  { client: 'nnn-op', kind: 'op' },
  { client: 'yyy-none', kind: 'none' },
];

function buildInputs(migrated: ReadonlySet<string>): MigrationPlanInput[] {
  return DEFS.map((d) => {
    if (migrated.has(d.client)) return { client: d.client, readinessPresent: true };
    if (d.kind === 'none') return { client: d.client, readinessPresent: false };
    if (d.kind === 'ready') return { client: d.client, readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], []), policy: emptyPolicy };
    return { client: d.client, readinessPresent: false, briefText: BRIEF, acquisition: acqFor(['collateral'], ['brand sign-off']) };
  });
}

const planFrom = (migrated: ReadonlySet<string>) => buildFleetMigrationPlan(assessFleet(buildInputs(migrated)));
const recordingMigrator = (migrated: Set<string>, calls: string[]): Migrator => (step) => { calls.push(step.client); migrated.add(step.client); return { ok: true }; };

describe('G3-S5 fleet migration execution', () => {
  it('CONSUME, NO REORDER: the schedule is the plan verbatim (immediate steps + first checkpoint)', () => {
    const plan = planFrom(new Set());
    const sched = planExecution(plan);
    expect(sched.toExecute.map((s) => s.client)).toEqual(['aaa-ready', 'bbb-ready']); // plan order, unchanged
    expect(sched.pauseAt).toBe(plan.checkpoints[0]);
    expect(sched.excluded.map((s) => s.client)).toEqual(['yyy-none']);
    expect(sched.alreadyMigrated).toEqual(plan.skipped);
  });

  it('DETERMINISTIC EXECUTION + PREDICTION EQUALITY: executes exactly the READY steps, in plan order', () => {
    const migrated = new Set<string>();
    const calls: string[] = [];
    const result = executeFleetPlan(planFrom(migrated), recordingMigrator(migrated, calls));
    expect(calls).toEqual(['aaa-ready', 'bbb-ready']);
    expect(result.succeeded).toEqual(['aaa-ready', 'bbb-ready']);
    // executed == exactly what the assessment predicted as READY_TO_MIGRATE
    const assessed = assessFleet(buildInputs(new Set()));
    expect(result.executed.map((e) => e.client)).toEqual(assessed.byState.READY_TO_MIGRATE.map((p) => p.client));
  });

  it('CHECKPOINT STOPPING: stops at the first checkpoint; never runs operator or excluded projects', () => {
    const calls: string[] = [];
    const result = executeFleetPlan(planFrom(new Set()), (s) => { calls.push(s.client); return { ok: true }; });
    expect(result.pausedAt).not.toBeNull();
    expect(result.pausedAt!.id).toBe('checkpoint-1');
    expect(result.done).toBe(false);
    for (const forbidden of ['mmm-op', 'nnn-op', 'yyy-none']) expect(calls).not.toContain(forbidden);
    expect(result.excluded).toEqual(['yyy-none']);
  });

  it('FAILURE ISOLATION: one failed migration does not stop the others or corrupt completed ones', () => {
    const plan = planFrom(new Set());
    const result = executeFleetPlan(plan, (s) => (s.client === 'aaa-ready' ? { ok: false, error: 'disk full' } : { ok: true }));
    expect(result.failed.map((f) => f.client)).toEqual(['aaa-ready']);
    expect(result.succeeded).toEqual(['bbb-ready']); // the independent one still completed
    expect(result.executed).toHaveLength(2); // both attempted
    expect(result.pausedAt!.id).toBe('checkpoint-1'); // checkpoint still reported
  });

  it('IDEMPOTENCE: re-executing after a pass does nothing (migrated projects are now skipped)', () => {
    const migrated = new Set<string>();
    executeFleetPlan(planFrom(migrated), recordingMigrator(migrated, []));
    const calls: string[] = [];
    const r2 = executeFleetPlan(planFrom(migrated), recordingMigrator(migrated, calls));
    expect(calls).toEqual([]); // nothing re-executed
    expect(r2.alreadyMigrated).toEqual(expect.arrayContaining(['aaa-ready', 'bbb-ready']));
  });

  it('RESUME: rebuilding the plan continues the walk; completed projects become ALREADY_MIGRATED', () => {
    const migrated = new Set<string>();
    // Pass 1: auto-execute the READY phase, pause at the operator checkpoint.
    const p1 = planFrom(migrated);
    const r1 = executeFleetPlan(p1, recordingMigrator(migrated, []));
    expect(r1.succeeded).toEqual(['aaa-ready', 'bbb-ready']);
    expect(r1.pausedAt!.id).toBe('checkpoint-1');
    expect(r1.done).toBe(false);
    // the completed projects are ALREADY_MIGRATED on replanning
    expect(assessFleet(buildInputs(migrated)).byState.ALREADY_MIGRATED.map((p) => p.client)).toEqual(
      expect.arrayContaining(['aaa-ready', 'bbb-ready']),
    );
    // operator clears checkpoint-1 out-of-band (migrates its projects via the single-project CLI)
    for (const step of p1.checkpoints[0].steps) migrated.add(step.client);
    // Pass 2 (resume): rebuild + continue — no new READY, no more checkpoints → done.
    const r2 = executeFleetPlan(planFrom(migrated), recordingMigrator(migrated, []));
    expect(r2.executed).toEqual([]);
    expect(r2.pausedAt).toBeNull();
    expect(r2.done).toBe(true);
    expect(r2.excluded).toEqual(['yyy-none']); // blocked remains excluded throughout
    // the whole executable fleet is migrated; only the NOT_MIGRATABLE remains
    const final = assessFleet(buildInputs(migrated));
    expect(final.byState.ALREADY_MIGRATED.map((p) => p.client).sort()).toEqual(['aaa-ready', 'bbb-ready', 'mmm-op', 'nnn-op']);
    expect(final.byState.NOT_MIGRATABLE.map((p) => p.client)).toEqual(['yyy-none']);
  });
});
