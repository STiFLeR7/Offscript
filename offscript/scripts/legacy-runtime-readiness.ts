/**
 * `offscript legacy-runtime-readiness` — Legacy Runtime Retirement Readiness (G4-S1). READ-ONLY.
 *
 *   npx tsx scripts/legacy-runtime-readiness.ts [--type <projectType>] [--track <t>]
 *
 * Reports whether the CLI's legacy execution branch (`resolveGenerationEntry` `readiness===null` fallback)
 * can now retire: it assesses the fleet (G3-S3, unchanged) and computes the retirement verdict — retirable
 * only when every project is ALREADY_MIGRATED. It prints the current fleet state, the verdict, and the
 * blockers. It never writes, migrates, or alters anything.
 *
 * `--type` applies a uniform project-type hypothesis (project type is not on disk for legacy projects —
 * G3-S1; per-project type resolution is itself a documented removal prerequisite). Without it, briefed
 * projects report NOT_MIGRATABLE (type unresolved), so the verdict is conservative.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { assessFleet, selectProjects } from '../src/project/fleet-assessment.js';
import { assessLegacyRetirement } from '../src/project/legacy-runtime-readiness.js';
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

  const root = join(repoRoot, 'projects');
  const candidates = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name, hasReferences: existsSync(join(root, e.name, 'references')) }))
    : [];
  const clients = selectProjects(candidates);

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

  const verdict = assessLegacyRetirement(assessFleet(inputs));

  console.log(`\n[legacy-runtime-readiness] ${verdict.total} project(s) under ${root}${projectType ? `  (type hypothesis: ${projectType})` : ''}`);
  console.log(`  already migrated (NATIVE-eligible): ${verdict.alreadyMigrated.length}`);
  console.log(`  pending migration (migratable):     ${verdict.pendingMigration.length}`);
  console.log(`  NOT_MIGRATABLE (hard blocker):       ${verdict.notMigratable.length}`);
  console.log(`\n  legacy execution branch retirable?  ${verdict.retirable ? 'YES' : 'NO'}`);
  if (!verdict.retirable) {
    for (const b of verdict.blockers) console.log(`   - ${b}`);
  } else {
    console.log(`   every supported project is ALREADY_MIGRATED — the readiness===null fallback is dead code and can be removed.`);
  }
  if (!projectType) {
    console.log(`\n  (pass --type <projectType> for a non-conservative verdict; per-project type resolution is removal prerequisite #1)`);
  }
}

main();
