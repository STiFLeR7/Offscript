/**
 * `offscript assess-fleet` — Fleet Migration Assessment (G3-S3). READ-ONLY.
 *
 *   npx tsx scripts/assess-fleet.ts [--type <projectType>] [--track <t>]
 *
 * Assesses EVERY project in the workspace and prints a deterministic migration inventory — totals per
 * state, per-project detail, and a suggested migration order — WITHOUT any writes. It reuses G3-S2's
 * `planMigration` per project (via `assessFleet`), so every line equals the standalone planner.
 *
 * `--type` applies a uniform project-type hypothesis to every briefed, un-migrated project (project type
 * is not on disk for legacy projects — see G3-S1). Without it, briefed projects report NOT_MIGRATABLE
 * (type unresolved); already-migrated and brief-less projects classify without a type either way.
 *
 * Boundary: Fleet Assessment owns AGGREGATION only. This command performs ONLY reads (directory listing,
 * readiness.json presence, brief.md, brief discovery for strategy) — it never writes, persists, or mutates.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { assessFleet, selectProjects } from '../src/project/fleet-assessment.js';
import { projectReadinessPath } from '../src/project/readiness-store.js';
import type { MigrationPlanInput } from '../src/project/migration-planner.js';

const MIGRATION_NOW = '2000-01-01T00:00:00.000Z';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const projectType = argValue(args, '--type');
  const track = argValue(args, '--track');

  // ── Discovery (fs) — every immediate subdir of projects/ that has a references/ dir is a project.
  // Excludes the legacy track-kit dirs (projects/website, projects/collateral) which lack references/.
  const root = join(repoRoot, 'projects');
  const candidates = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name, hasReferences: existsSync(join(root, e.name, 'references')) }))
    : [];
  const clients = selectProjects(candidates);

  // ── Resolve each project's planner input (reads only). Build an acquisition plan only when a type is
  // given AND the project is a not-yet-migrated brief — the state that actually needs a reconstruction.
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

  const fleet = assessFleet(inputs);

  // ── Report (deterministic).
  console.log(`\n[fleet] ${fleet.total} project(s) under ${root}${projectType ? `  (type hypothesis: ${projectType})` : ''}`);
  console.log(`  ALREADY_MIGRATED:        ${fleet.totals.ALREADY_MIGRATED}`);
  console.log(`  READY_TO_MIGRATE:        ${fleet.totals.READY_TO_MIGRATE}`);
  console.log(`  OPERATOR_INPUT_REQUIRED: ${fleet.totals.OPERATOR_INPUT_REQUIRED}`);
  console.log(`  NOT_MIGRATABLE:          ${fleet.totals.NOT_MIGRATABLE}`);

  console.log(`\n  suggested migration order:`);
  for (const p of fleet.plans) {
    const ev = [
      ...p.requiredEvidence.assets.map((a) => `--asset ${a}`),
      ...p.requiredEvidence.approvals.map((ap) => `--approve "${ap}"`),
    ].join(' ');
    const detail =
      p.state === 'OPERATOR_INPUT_REQUIRED' ? `  needs: ${ev}`
      : p.state === 'NOT_MIGRATABLE' ? `  (${p.reason})`
      : '';
    console.log(`   ${p.state.padEnd(24)} ${p.client.padEnd(22)} admitted=${p.predictedAdmission} persists=[${p.predictedArtifacts.join(', ')}]${detail}`);
  }
  if (!projectType) {
    console.log(`\n  (pass --type <projectType> to classify briefed projects beyond NOT_MIGRATABLE/type-unresolved)`);
  }
}

main();
