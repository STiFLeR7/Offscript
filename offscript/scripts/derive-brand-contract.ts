/**
 * Offscript WP1.G Track B Task 3 — derive a brand-contract.json from a kit's
 * colors_and_type.css.
 *
 * Auto-derivation only: every slot mapping carries `confidence: "auto"`. The
 * human review pass (designer opens the JSON, fixes / confirms slots, flips
 * `confidence` to `"human"`) is out of scope for this CLI — it just emits the
 * starting point.
 *
 * Usage:
 *   npx tsx scripts/derive-brand-contract.ts [kit-dir]
 *
 *   kit-dir defaults to projects/website/example-brand. The kit dir must
 *   contain a colors_and_type.css (the canonical website-kit shape that
 *   src/intake.ts recognizes); otherwise the script prints a one-line
 *   reason and exits cleanly (rc=0) — same "skip cleanly if not a kit"
 *   contract as scripts/harden.ts's residual gate.
 *
 * Idempotent: re-running on an unchanged kit is a filesystem no-op
 * (writeBrandContract mirrors overlay.ts's writeIfChanged pattern, so a
 * byte-equal target file is left untouched and mtime is not bumped).
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { deriveBrandContract, writeBrandContract } from '../src/brand-contract.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const args = process.argv.slice(2);
const targetArg = args.find((a) => !a.startsWith('--'));
const dir = resolve(targetArg ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));

function isKit(d: string): boolean {
  if (!existsSync(d) || !statSync(d).isDirectory()) return false;
  return existsSync(join(d, 'colors_and_type.css'));
}

if (!isKit(dir)) {
  // Skip-clean contract: not throwing keeps the CLI safe to chain after
  // harden.ts in a make-style runner; the human gets a single readable line.
  console.log(`derive-brand-contract: ${dir} is not a kit (no colors_and_type.css) — skipping.`);
  process.exit(0);
}

const tokensCss = readFileSync(join(dir, 'colors_and_type.css'), 'utf8');
const contract = deriveBrandContract(tokensCss, { subject: basename(dir) });
const outPath = join(dir, 'brand-contract.json');
writeBrandContract(outPath, contract);

const mapped = Object.values(contract.slots).filter((s) => s !== null).length;
const total = Object.keys(contract.slots).length;
console.log(
  `derive-brand-contract: wrote ${outPath} — ${mapped}/${total} slots auto-mapped (confidence=auto).`,
);
