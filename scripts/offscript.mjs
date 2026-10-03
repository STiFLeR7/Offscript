import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { root, runNode } from './workspace.mjs';

const commands = {
  init: 'scripts/init.ts',
  brief: 'scripts/acquire-brief.ts',
  generate: 'scripts/generate.ts',
  fullstack: 'scripts/fullstack.ts',
  list: 'scripts/projects.ts',
  status: 'scripts/projects.ts',
  harden: 'scripts/harden.ts',
  'dry-run': 'scripts/dry-run.ts',
  'harden-review': 'scripts/harden-review.ts',
  'derive-brand': 'scripts/derive-brand-contract.ts',
  bundle: 'src/cli.ts',
};

const [command, ...args] = process.argv.slice(2);
if (!command || command === '--help' || command === 'help') {
  console.log(`Offscript — local creative production foundation\n
Usage: npm run offscript -- <command> [arguments]\n
  init <project> --type website|collateral|brand-identity|social-campaign
  brief <project> --answers <file.json>
  generate <project> --track website|collateral
  status <project> [--track website|collateral]
  list
  derive-brand <references-dir>
  harden <project> --track website|collateral
  dry-run <project> --track website|collateral
  harden-review <project> --track website|collateral
  bundle <bundle-dir>
  fullstack <project> [arguments]   Experimental framework scaffold

Arguments and relative file paths resolve from the repository root.
For first-run verification use npm run demo.
Generation defaults to scripted output; real authoring needs session dispatch.
Deck generation remains blocked; see docs/REPRODUCING.md.`);
} else {
  try {
    if (!Object.hasOwn(commands, command)) throw new Error(`Unknown command "${command}". Use --help.`);
    const runner = join(root, 'offscript/node_modules/tsx/dist/cli.mjs');
    if (!existsSync(runner)) throw new Error('Dependencies are missing. Run npm run setup first.');
    runNode([runner, resolve(root, 'offscript', commands[command]), ...args]);
  } catch (error) {
    console.error(`[Offscript] ${error.message}`);
    process.exitCode = 1;
  }
}
