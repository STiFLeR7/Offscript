/**
 * Task-5 gate driver: detect-only over a single HTML file for ONE judgment pass.
 * Usage:
 *   tsx scripts/task5-gate.ts <pass> <html-path> [kit-dir]
 *     <pass>      = 'contrast' | 'brand-fidelity'
 *     <html-path> = path to the HTML doc to gate (e.g. output/website/example-brand/index.html)
 *     [kit-dir]   = brand kit dir for token loading (default: projects/website/example-brand)
 *
 * Emits one JSON object to stdout:
 *   { pass, rails: [...], count, findings: [...] }
 * Exit code: 0 always (status is reported via JSON, not exit). The main session
 * (the live actuator orchestrator) reads this output to drive the gate loop.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { parseHtml } from '../src/working-rep.js';
import { runGate } from '../src/gate.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { contrastPass, brandFidelityPass } from '../src/passes.js';
import type { PassSpec } from '../src/actuation.js';

const PASSES: Record<string, PassSpec> = {
  contrast: contrastPass,
  'brand-fidelity': brandFidelityPass,
};

const [, , passName, htmlPath, kitDirArg] = process.argv;
if (!passName || !htmlPath) {
  console.error('Usage: tsx scripts/task5-gate.ts <pass> <html-path> [kit-dir]');
  process.exit(2);
}
const pass = PASSES[passName];
if (!pass) {
  console.error(`Unknown pass "${passName}". Known: ${Object.keys(PASSES).join(', ')}`);
  process.exit(2);
}

const kitDir = resolve(kitDirArg ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));
const kit = detectKitLayout(kitDir);
const tokens = loadTokensFromCss(kit.tokensCss);
const html = readFileSync(resolve(htmlPath), 'utf8');
const tree = parseHtml(html);
const findings = runGate(tree, { params: {}, tokens }, pass.rails);

const out = {
  pass: pass.name,
  rails: pass.rails.map((r) => r.name),
  count: findings.length,
  findings,
};
console.log(JSON.stringify(out, null, 2));
