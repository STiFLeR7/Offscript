/**
 * `offscript plan-fleet-migration` — Fleet Migration Planning (G3-S4). READ-ONLY.
 *
 *   npx tsx scripts/plan-fleet-migration.ts [--type <projectType>] [--track <t>]
 *
 * Turns a fleet assessment into a deterministic, executable migration plan and prints it — WITHOUT any
 * writes. It runs G3-S3's `assessFleet` per project, then `buildFleetMigrationPlan` (a pure derivation),
 * so the plan reflects the assessment (and therefore each standalone `planMigration`) exactly.
 *
 * Output: ordered execution phases (immediate READY batch, then operator checkpoints), the exact
 * `migrate-project` invocation per step, the projects excluded with reasons, and the projects already
 * migrated. The `--type` here is only a hypothesis for classifying briefed projects + rendering the
 * `migrate` commands; the plan model itself carries no project type (it isn't on disk — see G3-S1).
 *
 * Boundary: the Fleet Migration Planner owns PLANNING only. This command performs ONLY reads. Execution
 * (persisting readiness.json) remains `migrate-project`'s job (G3-S1); this tool never writes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { assessFleet, selectProjects } from '../src/project/fleet-assessment.js';
import { buildFleetMigrationPlan, type MigrationStep } from '../src/project/fleet-migration-planner.js';
import { projectReadinessPath } from '../src/project/readiness-store.js';
import type { MigrationPlanInput } from '../src/project/migration-planner.js';

const MIGRATION_NOW = '2000-01-01T00:00:00.000Z';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/** The exact `migrate-project` invocation an operator would run for a step (uses the --type hypothesis). */
function migrateCommand(step: MigrationStep, projectType: string | undefined, track: string | undefined): string {
  const flags = [
    projectType ? `--type ${projectType}` : '--type <projectType>',
    ...(track ? [`--track ${track}`] : []),
    ...step.requiredEvidence.assets.map((a) => `--asset <name-containing-"${a}">`),
    ...step.requiredEvidence.approvals.map((ap) => `--approve "${ap}"`),
  ].join(' ');
  return `npx tsx scripts/migrate-project.ts ${step.client} ${flags}`;
}

function main(): void {
  const args = process.argv.slice(2);
  const projectType = argValue(args, '--type');
  const track = argValue(args, '--track');

  // ── Discovery (fs) — every immediate subdir of projects/ that has a references/ dir is a project.
  const root = join(repoRoot, 'projects');
  const candidates = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name, hasReferences: existsSync(join(root, e.name, 'references')) }))
    : [];
  const clients = selectProjects(candidates);

  // ── Resolve each project's planner input (reads only).
  const cd = createCreativeDirector();
  const inputs: MigrationPlanInput[] = clients.map((client) => {
    const readinessPresent = existsSync(projectReadinessPath(client));
    const briefPath = join(projectReferencesDir(client), 'brief.md');
    const briefText = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : undefined;
    const acquisition =
      !readinessPresent && briefText !== undefined && projectType !== undefined
        ? cd.plan({ client, projectType, track: track as Track | undefined, now: MIGRATION_NOW })
        : undefined;
    return { client, readinessPresent, briefText, acquisition };
  });

  const plan = buildFleetMigrationPlan(assessFleet(inputs));

  // ── Report (deterministic, read-only).
  console.log(`\n[fleet-plan] ${clients.length} project(s) under ${root}${projectType ? `  (type hypothesis: ${projectType})` : ''}`);
  console.log(`  executable steps: ${plan.order.length}   phases: ${plan.phases.length}   checkpoints: ${plan.checkpoints.length}   skipped: ${plan.skipped.length}   blocked: ${plan.blocked.length}`);

  if (plan.phases.length === 0) {
    console.log(`\n  (no executable migrations — nothing is READY or OPERATOR_INPUT_REQUIRED under this hypothesis)`);
  }
  for (const phase of plan.phases) {
    const header =
      phase.kind === 'IMMEDIATE'
        ? `Phase ${phase.order} — IMMEDIATE (no operator input; run now)`
        : `Phase ${phase.order} — OPERATOR CHECKPOINT ${phase.checkpointId} (supply evidence, then run)`;
    console.log(`\n  ${header}`);
    if (phase.kind === 'OPERATOR_CHECKPOINT') {
      const cp = plan.checkpoints.find((c) => c.id === phase.checkpointId)!;
      const ev = [...cp.requiredEvidence.assets.map((a) => `asset:${a}`), ...cp.requiredEvidence.approvals.map((a) => `approval:${a}`)].join(', ');
      console.log(`    ↳ checkpoint evidence: ${ev}`);
    }
    for (const s of phase.steps) {
      console.log(`     - ${s.client.padEnd(22)} ${s.currentState} → ${s.targetState}   [${s.eligibility}]  persists=[${s.expectedArtifacts.join(', ')}]`);
      console.log(`         ${migrateCommand(s, projectType, track)}`);
    }
  }

  if (plan.blocked.length > 0) {
    console.log(`\n  Excluded (NOT_MIGRATABLE — fix the brief/workflow, then re-plan):`);
    for (const s of plan.blocked) {
      const deps = s.blockingDependencies.length ? `  blockers=[${s.blockingDependencies.join(', ')}]` : '';
      console.log(`     - ${s.client.padEnd(22)}${deps}  ${s.reason}`);
    }
  }
  if (plan.skipped.length > 0) {
    console.log(`\n  Already migrated (skipped — native-eligible, no-op):`);
    for (const s of plan.skipped) console.log(`     - ${s.client}`);
  }

  if (!projectType) {
    console.log(`\n  (pass --type <projectType> to classify briefed projects and render migrate commands)`);
  }
}

main();
