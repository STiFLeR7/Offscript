/**
 * harden-review — interactive review of Tier-2 advisory proposals (M2, Track B
 * Task 8). The human-in-the-loop half of the Tier-2 lane.
 *
 * The `tier-2-advisory` pass (src/tier-2-advisory.ts) drafts proposals to
 * `output/website/<brand>/tier-2-proposals.json` but applies nothing. This CLI
 * walks the pending proposals and, per proposal, asks accept / reject / edit /
 * skip:
 *   - accept → apply the find/replace to index.html now (the actuator-recipe
 *     applyRecipe split/join mutation) AND append the edit to
 *     actuator-recipe.json's edits[] (mergeRecipe), so it replays on future
 *     `harden --force` without re-dispatching a subagent.
 *   - reject → mark the proposal `rejected` (the region stays frozen).
 *   - edit   → tweak the find/replace, then accept.
 *   - skip   → leave it pending for a later pass.
 *
 * A `tier-2-policy` block in `creative-direction.md` (forward-compat hook) can
 * declare `auto-accept: high|medium|low`, auto-accepting proposals at or above
 * that confidence without a prompt.
 *
 * Usage:  npx tsx scripts/harden-review.ts [kit-dir]
 *   kit-dir defaults to projects/website/example-brand (gitignored input). Only the
 *   kit's basename (the brand) is needed to locate output/website/<brand>/.
 *
 * The pure decision helpers are exported and unit-tested; the readline loop runs
 * only when this file is invoked directly.
 *
 * Spec: M2 charter §4 Task 8; src/actuator-recipe.ts; src/tier-2-advisory.ts.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { join, basename, resolve } from 'node:path';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import {
  readRecipe,
  writeRecipe,
  mergeRecipe,
  applyRecipe,
  type RecipeEdit,
  type ActuatorRecipe,
  type TierTwoProposal,
} from '../src/actuator-recipe.js';
import { readProposals, writeProposals } from '../src/tier-2-advisory.js';
import { detectKitLayout } from '../src/intake.js';

type Confidence = 'high' | 'medium' | 'low';

/** A creative-direction.md tier-2-policy (forward-compat; v1 reads auto-accept only). */
export interface Tier2Policy {
  autoAccept: Confidence | 'none';
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/**
 * Parse a fenced ```tier-2-policy block from creative-direction.md.
 * Recognises `auto-accept: high|medium|low|none`. Absent block / file → no
 * auto-accept (every proposal is reviewed by hand).
 */
export function parseTier2Policy(creativeDirection?: string): Tier2Policy {
  const def: Tier2Policy = { autoAccept: 'none' };
  if (!creativeDirection) return def;
  const block = creativeDirection.match(/```tier-2-policy\s*([\s\S]*?)```/);
  if (!block) return def;
  const m = block[1].match(/auto-accept\s*:\s*(high|medium|low|none)/i);
  if (m) def.autoAccept = m[1].toLowerCase() as Tier2Policy['autoAccept'];
  return def;
}

/** Does the policy auto-accept a proposal of this confidence? */
export function policyAutoAccepts(policy: Tier2Policy, confidence: Confidence): boolean {
  if (policy.autoAccept === 'none') return false;
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[policy.autoAccept];
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  return needle.length === 0 ? 0 : haystack.split(needle).length - 1;
}

/** The replayable recipe edit a proposal becomes when accepted. */
export function editFromProposal(p: TierTwoProposal, html: string): RecipeEdit {
  return {
    pass: p.pass,
    findingIds: [p.findingId],
    find: p.proposedEdit.find,
    replace: p.proposedEdit.replace,
    expectedOccurrences: countOccurrences(html, p.proposedEdit.find),
  };
}

export interface AcceptResult {
  /** index.html with the edit applied (split/join; unchanged if find absent). */
  html: string;
  /** the recipe with the edit appended via mergeRecipe. */
  recipe: ActuatorRecipe;
  /** occurrences applied to the html (0 = find not present — recorded only). */
  applied: number;
}

/**
 * Accept a proposal: apply its edit to the live html now AND append it to the
 * recipe so it replays. Pure — the caller stamps status/decidedAt on the
 * proposal and persists. Reuses the frozen applyRecipe / mergeRecipe.
 */
export function acceptProposal(
  p: TierTwoProposal,
  html: string,
  recipe: ActuatorRecipe | null,
  generatedAt: string,
): AcceptResult {
  const edit = editFromProposal(p, html);
  const { html: applied } = applyRecipe(html, { generatedAt, edits: [edit] });
  const merged = mergeRecipe(recipe, [edit], generatedAt);
  return { html: applied, recipe: merged, applied: edit.expectedOccurrences };
}

// ───────────────────────── interactive CLI ─────────────────────────

function printProposal(p: TierTwoProposal, index: number, total: number): void {
  console.log(`\n[${index}/${total}] finding: ${p.findingId}  (confidence: ${p.confidence})`);
  if (p.frozenId) console.log(`  frozen: ${p.frozenId}`);
  console.log(`  rationale: ${p.rationale}`);
  console.log(`  find:    ${JSON.stringify(p.proposedEdit.find)}`);
  console.log(`  replace: ${JSON.stringify(p.proposedEdit.replace)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith('--')) ?? resolveWorkingDir(DEFAULT_CLIENT, 'website'));
  const brand = basename(dir);
  // v2: harden output co-locates in the kit's track working dir.
  const outDir = dir;
  const proposalsPath = join(outDir, 'tier-2-proposals.json');
  const idxPath = join(outDir, 'index.html');
  const recipePath = join(outDir, 'actuator-recipe.json');

  console.log(`Offscript Tier-2 review`);
  console.log(`  brand: ${brand}`);
  console.log(`  proposals: ${proposalsPath}\n`);

  const proposals = readProposals(proposalsPath);
  if (proposals.length === 0) {
    console.log('No Tier-2 proposals to review.');
    return;
  }
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  if (pendingCount === 0) {
    console.log(`All ${proposals.length} proposal(s) already decided — nothing pending.`);
    return;
  }

  if (!existsSync(idxPath)) {
    console.error(`No index.html at ${idxPath} — run 'npm run harden' first.`);
    process.exit(1);
  }
  const originalHtml = readFileSync(idxPath, 'utf8');
  let html = originalHtml;
  let recipe = readRecipe(recipePath);

  let creativeDirection: string | undefined;
  try {
    creativeDirection = detectKitLayout(dir).creativeDirection;
  } catch {
    // kit input may be absent (gitignored) — fall back to no policy.
  }
  const policy = parseTier2Policy(creativeDirection);
  if (policy.autoAccept !== 'none') {
    console.log(`creative-direction tier-2-policy: auto-accept ≥ ${policy.autoAccept}\n`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const decidedAt = new Date().toISOString();
  let accepted = 0;
  let autoAccepted = 0;
  let rejected = 0;
  let skipped = 0;

  try {
    let i = 0;
    for (const p of proposals) {
      if (p.status !== 'pending') continue;
      i += 1;
      printProposal(p, i, pendingCount);

      let decision: 'accept' | 'reject' | 'skip';
      if (policyAutoAccepts(policy, p.confidence)) {
        decision = 'accept';
        autoAccepted += 1;
        console.log(`  → auto-accepted by tier-2-policy`);
      } else {
        const ans = (await rl.question('  [a]ccept / [r]eject / [e]dit / [s]kip ? ')).trim().toLowerCase();
        if (ans === 'e' || ans === 'edit') {
          const newFind = (await rl.question('  new find (blank keeps current): ')).trim();
          const newReplace = (await rl.question('  new replace (blank keeps current): ')).trim();
          if (newFind) p.proposedEdit.find = newFind;
          if (newReplace) p.proposedEdit.replace = newReplace;
          decision = 'accept';
        } else if (ans === 'a' || ans === 'accept') {
          decision = 'accept';
        } else if (ans === 'r' || ans === 'reject') {
          decision = 'reject';
        } else {
          decision = 'skip';
        }
      }

      if (decision === 'accept') {
        const res = acceptProposal(p, html, recipe, decidedAt);
        html = res.html;
        recipe = res.recipe;
        p.status = 'accepted';
        p.decidedAt = decidedAt;
        accepted += 1;
        if (res.applied === 0) {
          console.log(`  ⚠ find not present in index.html — recorded in recipe but nothing applied`);
        } else {
          console.log(`  ✓ applied ${res.applied} occurrence(s) and appended to the recipe`);
        }
      } else if (decision === 'reject') {
        p.status = 'rejected';
        p.decidedAt = decidedAt;
        rejected += 1;
        console.log('  ✗ rejected — the region stays frozen');
      } else {
        skipped += 1;
        console.log('  … skipped — still pending');
      }
    }
  } finally {
    rl.close();
  }

  if (html !== originalHtml) writeFileSync(idxPath, html, 'utf8');
  writeProposals(proposalsPath, proposals);
  if (recipe) writeRecipe(recipePath, recipe);

  console.log(
    `\nDone: ${accepted} accepted (${autoAccepted} auto), ${rejected} rejected, ${skipped} skipped.`,
  );
  if (accepted > 0) console.log(`index.html updated and ${recipePath} appended.`);
}

// Run the interactive loop only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
