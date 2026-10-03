import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Install contracts before packages whose file: dependencies point at them.
export const packages = [
  'offscript',
  'offscript/creative-artifact-contract',
  'offscript/creative-intent-exporter',
  'offscript/creative-generation',
  'offscript/website-governance-sync',
];

export function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) {
    throw new Error(`Command failed (${result.signal ?? result.status}): node ${args.join(' ')}`);
  }
}

function npmIn(pkg, args, extraEnv = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) {
    throw new Error('Run this task through npm run, so the installed npm CLI can be located.');
  }
  console.log(`\n[Offscript] ${pkg}: npm ${args.join(' ')}`);
  runNode([npmCli, ...args], { cwd: join(root, pkg), env: { ...process.env, ...extraEnv } });
}

function setup() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Offscript requires Node.js 22 or newer.');
  for (const pkg of packages) {
    if (!existsSync(join(root, pkg, 'package-lock.json'))) throw new Error(`Missing lockfile: ${pkg}/package-lock.json`);
    npmIn(pkg, ['ci', '--no-audit', '--no-fund']);
  }
  // Fresh clones intentionally exclude derived knowledge. Rebuild its manifest from
  // the checked-in authored repository; diagnostics and grounding tests read it.
  npmIn('offscript', ['run', 'knowledge:build']);
}

function typecheck() {
  npmIn('offscript', ['exec', '--', 'tsc', '--noEmit']);
  for (const pkg of packages.slice(1)) npmIn(pkg, ['run', 'typecheck']);
}

function test() {
  const failed = [];
  for (const pkg of packages) {
    try { npmIn(pkg, ['test']); }
    catch (error) { console.error(error.message); failed.push(pkg); }
  }
  if (failed.length) throw new Error(`Tests failed in: ${failed.join(', ')}`);
}

function check() {
  for (const script of ['check:isolation', 'check:capabilities', 'check:runtime-flag-docs']) npmIn('offscript', ['run', script]);
}

const tasks = {
  setup,
  build: () => npmIn('offscript', ['run', 'build']),
  typecheck,
  test,
  check,
  render: () => npmIn('offscript', ['test'], { OFFSCRIPT_PLAYWRIGHT: '1' }),
  browser: () => npmIn('offscript', ['exec', '--', 'playwright', 'install', 'chromium']),
  verify: () => { typecheck(); check(); test(); },
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const task = tasks[process.argv[2]];
    if (!task) throw new Error(`Unknown task. Choose: ${Object.keys(tasks).join(', ')}`);
    task();
  } catch (error) {
    console.error(`[Offscript] ${error.message}`);
    process.exitCode = 1;
  }
}
