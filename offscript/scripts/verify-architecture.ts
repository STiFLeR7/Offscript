/**
 * Sprint 8 — Verification Harness: the single command.
 *
 *   npx tsx scripts/verify-architecture.ts [repositoryDir]
 *
 * Verifies the complete pipeline (Repository → Discovery → Composition → Conditioning →
 * Authoring → Execution) against the materialized repository and prints a Verification Report.
 * Exits 0 when every check passes, 1 otherwise. Uses the default mocked provider; future
 * providers inherit the harness by passing an Author into verifyArchitecture().
 */
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../src/knowledge/source/index.js';
import { verifyArchitecture, type VerificationCategory } from '../src/knowledge/verification.js';

async function main(): Promise<void> {
  const arg = process.argv[2];
  const repoDir = arg ? arg : fileURLToPath(new URL('../repository', import.meta.url));
  const loaded = loadRepository(repoDir);
  const report = await verifyArchitecture({ assets: loaded.assets, vocabulary: loaded.vocabulary });

  console.log(`Verification Harness ${report.harnessVersion}`);
  console.log(`repository: ${repoDir}`);
  console.log(`repository identity: ${report.repositoryIdentity}`);
  console.log(`intents verified: ${report.intentsVerified}`);
  console.log('');
  const cats = Object.keys(report.summary.byCategory) as VerificationCategory[];
  for (const cat of cats) {
    const { passed, failed } = report.summary.byCategory[cat];
    console.log(`  ${cat.padEnd(12)} ${passed} passed, ${failed} failed`);
  }
  console.log('');
  if (report.trace) {
    const c = report.trace.identityChain;
    console.log(`identity chain  [${report.trace.intent.join(', ')}]`);
    console.log(`  repository   ${c.repository}`);
    console.log(`  composition  ${c.composition}`);
    console.log(`  conditioning ${c.conditioning}`);
    console.log(`  authoring    ${c.authoring}`);
    console.log(`  execution    ${c.execution}`);
    console.log(`evidence chain  obligations: ${report.trace.evidenceChain.authoringObligations.join(', ')} (over ${report.trace.evidenceChain.repositoryFacts} repository facts)`);
    console.log('');
  }
  for (const f of report.checks.filter((c) => !c.passed)) {
    console.log(`  ✗ [${f.category}/${f.stage}] ${f.name} — ${f.detail}`);
  }
  console.log(`${report.ok ? 'OK' : 'FAILED'} — ${report.summary.passed}/${report.summary.total} checks passed`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
