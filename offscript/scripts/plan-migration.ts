/**
 * `offscript plan-migration` — Migration Planning (G3-S2). READ-ONLY.
 *
 *   npx tsx scripts/plan-migration.ts <client> [--type <projectType>] [--track <t>]
 *
 * Predicts whether a project SHOULD be migrated and what migration would produce — WITHOUT any writes.
 * Reports: current state, migration eligibility (one of READY_TO_MIGRATE / OPERATOR_INPUT_REQUIRED /
 * NOT_MIGRATABLE / ALREADY_MIGRATED), required operator evidence, and the expected readiness outcome /
 * admission decision / persisted artifacts. It reuses G3-S1's exact evaluation, so its prediction matches
 * the migration command's actual behaviour.
 *
 * Boundary: the Migration Planner owns ANALYSIS only. This command performs ONLY reads (brief.md,
 * readiness.json presence, brief discovery for strategy) — it never writes, never persists, never mutates.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { planMigration } from '../src/project/migration-planner.js';
import { projectReadinessPath } from '../src/project/readiness-store.js';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const client = args.find((a) => !a.startsWith('--'));
  if (!client) {
    console.error('usage: npx tsx scripts/plan-migration.ts <client> [--type <projectType>] [--track <t>]');
    process.exit(2);
  }

  // READ-ONLY inspection of the project's artifacts.
  const readinessPresent = existsSync(projectReadinessPath(client));
  const briefPath = join(projectReferencesDir(client), 'brief.md');
  const briefText = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : undefined;
  const projectType = argValue(args, '--type');
  const track = argValue(args, '--track');

  // Build the acquisition plan through the SAME Creative Director migration uses (only when a type is
  // given and the project is a not-yet-migrated brief — the state that actually needs a reconstruction).
  let acquisition;
  if (!readinessPresent && briefText !== undefined && projectType !== undefined) {
    acquisition = createCreativeDirector().plan({ client, projectType, track: track as Track | undefined, now: '2000-01-01T00:00:00.000Z' });
  }

  const plan = planMigration({ client, readinessPresent, briefText, acquisition });

  console.log(`\n[plan] ${plan.client}`);
  console.log(`  state:               ${plan.state}`);
  console.log(`  why:                 ${plan.reason}`);
  if (plan.requiredEvidence.assets.length || plan.requiredEvidence.approvals.length) {
    const flags = [
      ...plan.requiredEvidence.assets.map((a) => `--asset <name-containing-"${a}">`),
      ...plan.requiredEvidence.approvals.map((ap) => `--approve "${ap}"`),
    ].join(' ');
    console.log(`  required evidence:   ${flags}`);
  }
  console.log(`  predicted readiness: ${plan.predictedReadinessState ?? '(n/a)'} — admitted=${plan.predictedAdmission}`);
  console.log(`  would persist:       ${plan.predictedArtifacts.length ? plan.predictedArtifacts.join(', ') : '(nothing)'}`);
  if (plan.blockers.length) {
    console.log(`  blockers:`);
    for (const b of plan.blockers) console.log(`   - [${b.severity}] ${b.reason}  (${b.supplyable ? 'operator-supplyable' : 'NOT supplyable via migration'})`);
  }
  if (plan.state === 'OPERATOR_INPUT_REQUIRED' && acquisition) {
    const ev = [
      ...plan.requiredEvidence.assets.map((a) => `--asset ${a}.svg`),
      ...plan.requiredEvidence.approvals.map((ap) => `--approve "${ap}"`),
    ].join(' ');
    console.log(`\n  to migrate:  npx tsx scripts/migrate-project.ts ${client} --type ${acquisition.projectType} ${ev}`);
  }
}

main();
