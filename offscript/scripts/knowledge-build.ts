/**
 * `knowledge build` entrypoint (mirrors the scripts/dry-run.ts · scripts/harden.ts
 * convention: run via tsx). Deterministically builds the repository's derived
 * artifacts (graphs + manifest) and publishes them to a gitignored, non-authoritative
 * output dir. Fail-loud: any validation/cycle finding aborts with a non-zero exit and
 * a deterministic report; nothing is published partially.
 *
 *   npm run knowledge:build -- [<repo-root>] [--out <dir>] [--no-publish]
 */
import { buildRepository } from '../src/knowledge/builder.js';
import { GraphCycleError, KnowledgeError, KnowledgeValidationError } from '../src/knowledge/finding.js';
import { crossTrackGovernanceManifest } from '../src/cross-track-governance.js';

function main(argv: string[]): void {
  const positionals = argv.slice(2).filter((a) => !a.startsWith('--'));
  const root = positionals[0] ?? process.cwd();
  const outIdx = argv.indexOf('--out');
  const outputDir = outIdx >= 0 ? argv[outIdx + 1] : undefined;
  const publish = !argv.includes('--no-publish');

  try {
    const r = buildRepository({ root, outputDir, publish });
    const dep = r.dependencyGraph;
    const sem = r.semanticGraph;
    const d = r.diagnostics;
    const s = r.statistics;
    console.log(`✓ validated repository   ${r.assetCount} asset(s)`);
    console.log(`✓ dependency graph       ${dep.nodes.length} node(s), ${dep.edges.length} edge(s)  ${r.manifest.artifacts['dependency-graph']}`);
    console.log(`✓ semantic graph         ${sem.nodes.length} node(s), ${sem.edges.length} edge(s)  ${r.manifest.artifacts['semantic-graph']}`);
    console.log(`✓ build manifest         ${r.manifest.buildIdentity}`);
    console.log(`✓ diagnostics            depth ${d.dependencyGraphDepth}/${d.semanticGraphDepth}, ${d.isolatedAssetCount} isolated  ${r.manifest.artifacts['diagnostics']}`);
    console.log(`✓ repository statistics  fan-out dep ${s.dependencyFanOut.mean} / sem ${s.semanticFanOut.mean}  ${r.manifest.artifacts['statistics']}`);
    console.log('✓ deterministic output   (rebuild of this snapshot yields identical digests)');
    if (r.outputDir) console.log(`→ published to ${r.outputDir}`);

    // Y2 — cross-track governance digest (resources/design_principles/), independent of
    // the repository/ build above (a different tree, a different content domain). Presence-based:
    // silent when no constitutional-altitude file exists yet.
    const ctg = crossTrackGovernanceManifest();
    if (ctg.files.length > 0) {
      console.log(`✓ cross-track governance ${ctg.files.length} file(s)  ${ctg.combined}`);
      for (const f of ctg.files) console.log(`    - ${f.name}  ${f.digest}`);
    }
  } catch (e) {
    if (e instanceof KnowledgeValidationError) {
      console.error(`✗ repository invalid — ${e.findings.length} finding(s):`);
      for (const f of e.findings) console.error(`  [${f.stage}:${f.code}] ${f.location}: ${f.message}`);
    } else if (e instanceof GraphCycleError || e instanceof KnowledgeError) {
      console.error(`✗ ${e.message}`);
    } else {
      throw e;
    }
    process.exit(1);
  }
}

main(process.argv);
