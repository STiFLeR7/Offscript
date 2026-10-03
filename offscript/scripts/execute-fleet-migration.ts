/**
 * `offscript execute-fleet-migration` — Fleet Migration Execution (G3-S5).
 *
 *   npx tsx scripts/execute-fleet-migration.ts [--type <projectType>] [--track <t>]
 *
 * Executes an existing FleetMigrationPlan: auto-migrates the IMMEDIATE (READY) phase, then TERMINATES at
 * the first operator checkpoint with explicit instructions. It rebuilds the plan from the filesystem on
 * every run (assessFleet → buildFleetMigrationPlan), so re-running RESUMES — projects migrated last pass
 * are ALREADY_MIGRATED and drop out. There is no journal and no checkpoint file: `readiness.json` presence
 * is the source of truth.
 *
 * Writes: ONLY `readiness.json`, and ONLY for READY steps (each reconstructs admitted with no evidence).
 * Operator-checkpoint projects and NOT_MIGRATABLE projects are never written here — the operator clears a
 * checkpoint with `migrate-project` (the plan prints the exact commands), then re-runs this to resume.
 *
 * Boundary: the Fleet Migration Executor owns EXECUTION only. Fleet Assessment owns discovery; the Fleet
 * Migration Planner owns planning; the Migration CLI owns single-project migration; the Project Platform
 * owns readiness evaluation. This command never replans, reorders, or alters migration semantics.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { assessFleet, selectProjects } from '../src/project/fleet-assessment.js';
import { buildFleetMigrationPlan } from '../src/project/fleet-migration-planner.js';
import { executeFleetPlan, type Migrator } from '../src/project/fleet-migration-executor.js';
import { reconstructLegacyReadiness, MIGRATION_TIMESTAMP } from '../src/project/project-migration.js';
import { projectReadinessPath, serializeProjectReadiness } from '../src/project/readiness-store.js';
import type { MigrationPlanInput } from '../src/project/migration-planner.js';
import type { AcquisitionPlan } from '../src/project/acquisition-plan.js';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
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

  // ── Resolve each project's planner input (reads only); remember brief+acquisition for the migrator.
  const cd = createCreativeDirector();
  const ctx = new Map<string, { briefText: string; acquisition: AcquisitionPlan }>();
  const inputs: MigrationPlanInput[] = clients.map((client) => {
    const readinessPresent = existsSync(projectReadinessPath(client));
    const briefPath = join(projectReferencesDir(client), 'brief.md');
    const briefText = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : undefined;
    const acquisition =
      !readinessPresent && briefText !== undefined && projectType !== undefined
        ? cd.plan({ client, projectType, track: track as Track | undefined, now: MIGRATION_TIMESTAMP })
        : undefined;
    if (briefText !== undefined && acquisition !== undefined) ctx.set(client, { briefText, acquisition });
    return { client, readinessPresent, briefText, acquisition };
  });

  const plan = buildFleetMigrationPlan(assessFleet(inputs));

  // ── The real migrator: reconstruct a READY step (no evidence) and persist readiness.json. READY steps
  // admit with no evidence by definition, so this is the only thing execution writes.
  const migrate: Migrator = (step) => {
    const c = ctx.get(step.client);
    if (!c) return { ok: false, error: 'brief/acquisition unavailable (needs --type)' };
    const { readiness, admitted } = reconstructLegacyReadiness({ client: step.client, acquisition: c.acquisition, briefText: c.briefText, now: MIGRATION_TIMESTAMP });
    if (!admitted) return { ok: false, error: 'reconstructed not-admitted (unexpected for a READY step)' };
    const outPath = projectReadinessPath(step.client);
    if (existsSync(outPath)) return { ok: true }; // idempotent no-op (should not occur for READY)
    writeFileSync(outPath, serializeProjectReadiness(readiness), 'utf8');
    return { ok: true };
  };

  const result = executeFleetPlan(plan, migrate);

  // ── Report.
  console.log(`\n[execute-fleet] ${clients.length} project(s) under ${root}${projectType ? `  (type hypothesis: ${projectType})` : ''}`);
  console.log(`  executed: ${result.executed.length}  (succeeded ${result.succeeded.length}, failed ${result.failed.length})   already-migrated: ${result.alreadyMigrated.length}   excluded: ${result.excluded.length}`);

  for (const o of result.executed) {
    console.log(`   ${o.ok ? '[ok]   migrated' : '[FAIL] '} ${o.client}${o.error ? `  — ${o.error}` : '  → readiness.json'}`);
  }

  if (result.pausedAt) {
    const cp = result.pausedAt;
    const ev = [...cp.requiredEvidence.assets.map((a) => `asset:${a}`), ...cp.requiredEvidence.approvals.map((a) => `approval:${a}`)].join(', ');
    console.log(`\n  ⏸  STOP — operator checkpoint ${cp.id} (execution does not bypass checkpoints).`);
    console.log(`     Supply the evidence [${ev}] and migrate these projects, then re-run this command to resume:`);
    for (const s of cp.steps) {
      const flags = [
        projectType ? `--type ${projectType}` : '--type <projectType>',
        ...(track ? [`--track ${track}`] : []),
        ...s.requiredEvidence.assets.map((a) => `--asset <name-containing-"${a}">`),
        ...s.requiredEvidence.approvals.map((ap) => `--approve "${ap}"`),
      ].join(' ');
      console.log(`       npx tsx scripts/migrate-project.ts ${s.client} ${flags}`);
    }
  } else {
    console.log(`\n  ✅ Done — no operator checkpoint remains; the executable fleet is complete.`);
  }

  if (result.excluded.length > 0) {
    console.log(`\n  Excluded (NOT_MIGRATABLE — never executed; fix the brief/workflow, then re-plan):`);
    for (const s of plan.blocked) console.log(`     - ${s.client.padEnd(22)}  ${s.reason}`);
  }

  if (!projectType) console.log(`\n  (pass --type <projectType> to classify briefed projects and execute READY migrations)`);

  // Exit non-zero when a checkpoint pauses execution or a step failed, so a script driving the resume loop
  // can tell "paused/incomplete" from "fully done". Read-only otherwise; only readiness.json is ever written.
  if (result.failed.length > 0) process.exit(1);
}

main();
