/**
 * `offscript init` — Project Bootstrap.
 *
 *   npx tsx scripts/init.ts <client> --type <project-type>
 *   npx tsx scripts/init.ts            # list available project families
 *
 * Creates the project, registers its identity, and prepares the execution context. It does NOT
 * collect branding or creative information — that is the Creative Director's brief-acquisition job
 * (scripts/acquire-brief.ts). Its responsibility ends once the project exists.
 */
import { listProjectTypes } from '../src/project/project-registry.js';
import { initProject } from '../src/project/workspace.js';

function printProjectTypes(): void {
  console.log('Available project families:\n');
  for (const p of listProjectTypes()) {
    console.log(`  ${p.id.padEnd(20)} ${p.label} — delivers: ${p.deliverables.join(', ')}`);
    console.log(`  ${''.padEnd(20)} ${p.description}`);
  }
  console.log(`\nUsage: npx tsx scripts/init.ts <client> --type <id>`);
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const client = args.find((a) => !a.startsWith('--'));
  const type = argValue(args, '--type');

  if (!client || !type) {
    printProjectTypes();
    if (!client) console.log(`\n(no client given — nothing created)`);
    else if (!type) console.log(`\n(no --type given — pick one of the families above)`);
    process.exit(client && type ? 0 : 1);
  }

  try {
    const m = initProject({ client: client!, projectType: type! });
    console.log(`Initialized project "${m.client}" (${m.projectType}) — deliverables: ${m.deliverables.join(', ')}.`);
    console.log(`  workspace: projects/${m.client}/`);
    console.log(`  next: acquire a brief →  npx tsx scripts/acquire-brief.ts ${m.client} [--answers <answers.json>]`);
  } catch (err) {
    console.error(`offscript init: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
