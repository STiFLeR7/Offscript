/**
 * record-actuator-pass — capture one actuator pass's edits into the
 * brand's actuator-recipe.json so `npm run harden --force` can replay them
 * deterministically (no subagent re-dispatch).
 *
 * Usage:
 *   tsx scripts/record-actuator-pass.ts <before-html> <after-html> <pass> <findingIds>
 *
 * <findingIds> is a comma-separated list, or the literal string `all` to mean
 * "the whole set of findings this pass addressed".
 *
 * The brand is inferred from the after-html path (its containing directory
 * name); the recipe is merged into `<after-dir>/actuator-recipe.json`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';
import {
  diffToRecipe,
  mergeRecipe,
  readRecipe,
  writeRecipe,
} from '../src/actuator-recipe.js';

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error(
    'usage: tsx scripts/record-actuator-pass.ts <before-html> <after-html> <pass> <findingIds>',
  );
  console.error('  <findingIds> = comma-separated finding ids, or `all`');
  process.exit(2);
}

const [beforeArg, afterArg, passName, findingArg] = args;
const beforePath = resolve(beforeArg);
const afterPath = resolve(afterArg);

if (!existsSync(beforePath)) {
  console.error(`before-html not found: ${beforePath}`);
  process.exit(2);
}
if (!existsSync(afterPath)) {
  console.error(`after-html not found: ${afterPath}`);
  process.exit(2);
}

const before = readFileSync(beforePath, 'utf8');
const after = readFileSync(afterPath, 'utf8');
const findingIds = findingArg === 'all' ? ['all'] : findingArg.split(',').map((s) => s.trim()).filter(Boolean);

const edits = diffToRecipe({ before, after, pass: passName, findingIds });

const outDir = dirname(afterPath);
const brand = basename(outDir);
const recipePath = join(outDir, 'actuator-recipe.json');

const existing = readRecipe(recipePath);
const merged = mergeRecipe(existing, edits, new Date().toISOString());
writeRecipe(recipePath, merged);

console.log(`Recorded actuator pass: ${passName}`);
console.log(`  brand:        ${brand}`);
console.log(`  before:       ${beforePath}`);
console.log(`  after:        ${afterPath}`);
console.log(`  findingIds:   ${findingIds.join(',') || '(none)'}`);
console.log(`  new edits:    ${edits.length}`);
console.log(`  recipe edits: ${merged.edits.length} total`);
console.log(`  written:      ${recipePath}`);
if (edits.length === 0) {
  console.log(`  note: no value-substitution diffs detected (before === after, or only structural changes).`);
}
