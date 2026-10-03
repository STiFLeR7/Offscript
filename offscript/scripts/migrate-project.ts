/**
 * `offscript migrate` — Legacy Project Migration (G3-S1).
 *
 *   npx tsx scripts/migrate-project.ts <client> --type <projectType> [--track <t>]
 *       [--asset <name>]... [--approve <label>]... [--now <iso>]
 *
 * Makes a LEGACY project (a brief.md but no readiness.json) native-eligible by reconstructing +
 * evaluating its ProjectReadiness with the EXISTING Project Platform rules, then persisting readiness.json
 * — and NOTHING else. It never alters generation, rendering, or the existing project artifacts; it never
 * fabricates readiness. A project that does not honestly evaluate READY is left on the legacy path
 * untouched, with the exact missing evidence reported.
 *
 * Boundary: Migration owns legacy artifact interpretation + persistence; the Project Platform owns
 * readiness EVALUATION (imported, unmodified); the Generation Platform owns execution.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectReferencesDir, type Track } from '../src/paths.js';
import { createCreativeDirector } from '../src/project/creative-director.js';
import { reconstructLegacyReadiness, MIGRATION_TIMESTAMP, type MigrationEvidence } from '../src/project/project-migration.js';
import { projectReadinessPath, serializeProjectReadiness, readProjectReadiness } from '../src/project/readiness-store.js';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
/** All values for a repeatable flag (e.g. every `--asset x`). */
function argValues(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === flag && args[i + 1] !== undefined) out.push(args[i + 1]);
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const client = args.find((a) => !a.startsWith('--'));
  const projectType = argValue(args, '--type');
  if (!client || !projectType) {
    console.error(
      'usage: npx tsx scripts/migrate-project.ts <client> --type <projectType> [--track <t>] ' +
        '[--asset <name>]... [--approve <label>]... [--now <iso>]',
    );
    process.exit(2);
  }

  // Read the legacy brief — the one required existing artifact. Absent ⇒ nothing to migrate.
  const briefPath = join(projectReferencesDir(client!), 'brief.md');
  if (!existsSync(briefPath)) {
    console.error(`no brief.md for "${client}" at ${briefPath} — nothing to migrate.`);
    process.exit(1);
  }
  const briefText = readFileSync(briefPath, 'utf8');

  const track = argValue(args, '--track');
  const now = argValue(args, '--now') ?? MIGRATION_TIMESTAMP;
  const evidence: MigrationEvidence = { assets: argValues(args, '--asset'), approvals: argValues(args, '--approve') };

  // Build the acquisition plan through the SAME Creative Director acquire-brief uses (strategy from
  // on-disk discovery of the legacy brief). fail-loud on an unknown project type.
  const cd = createCreativeDirector();
  const acq = cd.plan({ client: client!, projectType: projectType!, track: track as Track | undefined, now });

  const { readiness, assessment, admitted } = reconstructLegacyReadiness({
    client: client!, acquisition: acq, briefText, evidence, now,
  });

  console.log(`[migrate] ${client} — type=${acq.projectType} deliverables=[${acq.deliverables.join(', ')}] → readiness ${assessment.state}`);

  if (!admitted) {
    // HONEST non-removal of the legacy path: do NOT persist a non-admitted readiness (that would
    // fail-close a working legacy project). Report exactly what evidence would clear it.
    console.error(`\n[migrate] NOT migrated — "${client}" is ${assessment.state}, not READY. The legacy path is unchanged.`);
    console.error(`  Unmet requirements (supply the ones that legitimately hold for this engagement, then re-run):`);
    for (const b of assessment.blockers) {
      const hint =
        b.category === 'asset' ? `  →  --asset <name-containing-"${b.id.slice('asset:'.length)}">`
        : b.category === 'approval' ? `  →  --approve "${b.reason.replace(/^required approval not granted: /, '')}"`
        : '';
      console.error(`   - [${b.severity}] ${b.reason}${hint}`);
    }
    process.exit(1);
  }

  // Admitted → persist readiness.json (the ONLY thing migration writes). Idempotent: identical bytes on
  // re-run. Refuse to clobber a DIFFERENT existing readiness (e.g. one acquire-brief wrote).
  const outPath = projectReadinessPath(client!);
  const bytes = serializeProjectReadiness(readiness);
  if (existsSync(outPath)) {
    const existing = serializeProjectReadiness(readProjectReadiness(client!)!);
    if (existing === bytes) {
      console.log(`[migrate] readiness.json already up to date (idempotent no-op) → ${outPath}`);
      process.exit(0);
    }
    console.error(`\n[migrate] readiness.json already exists and DIFFERS — refusing to overwrite. Delete it to re-migrate.\n  ${outPath}`);
    process.exit(1);
  }
  writeFileSync(outPath, bytes, 'utf8');
  console.log(`[migrate] persisted readiness.json → ${outPath}`);
  console.log(`  native execution is now available:  npx tsx scripts/generate.ts ${client} --track ${acq.deliverables[0]}`);
}

main();
