/**
 * PKG — Repository Builder: lifecycle orchestration (ES-2 §3, stages 1-13 minus the
 * stubbed engines). Derives only: load → validate (aggregate, fail-loud) → graphs →
 * manifest → atomic publication. Never authors, repairs, or performs discovery /
 * composition / conditioning (Sprint 1 excludes those entirely).
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { canonicalText } from './digest.js';
import { KnowledgeError, KnowledgeValidationError, PublicationError } from './finding.js';
import {
  buildDependencyGraph,
  buildSemanticGraph,
  graphText,
  type GraphArtifact,
} from './graph.js';
import { buildManifest, manifestCanonical, type BuildManifest } from './manifest.js';
import { validateRepository } from './validate.js';
import { validateGraphs } from './graph-validate.js';
import { computeDiagnostics, diagnosticsDigest, diagnosticsText, type Diagnostics } from './diagnostics.js';
import { computeStatistics, statisticsDigest, statisticsText, type Statistics } from './statistics.js';
import { loadRepository, type LoadedRepository, type LoaderDeps } from './source/index.js';

export const BUILDER_VERSION = '0.2.0';

export interface BuildRequest {
  /** Repository root (required unless `loaded` is supplied). */
  readonly root?: string;
  /** Pre-loaded model (DI: bypasses disk; used by tests). */
  readonly loaded?: LoadedRepository;
  readonly deps?: LoaderDeps;
  /** Where to publish derived artifacts (default `<root>/.knowledge-build`). */
  readonly outputDir?: string;
  readonly publish?: boolean;
  readonly builderVersion?: string;
}

export interface BuildResult {
  readonly assetCount: number;
  readonly dependencyGraph: GraphArtifact;
  readonly semanticGraph: GraphArtifact;
  readonly diagnostics: Diagnostics;
  readonly statistics: Statistics;
  readonly manifest: BuildManifest;
  readonly outputDir?: string;
}

export function buildRepository(req: BuildRequest = {}): BuildResult {
  const loaded = req.loaded ?? loadRepository(requireRoot(req), req.deps);

  // Aggregate every load + asset-level validation finding; abort before any derivation.
  const findings = [...loaded.parseFindings, ...validateRepository(loaded.assets, loaded.vocabulary)];
  if (findings.length > 0) throw new KnowledgeValidationError(findings);

  const dependencyGraph = buildDependencyGraph(loaded.assets); // may throw GraphCycleError
  const semanticGraph = buildSemanticGraph(loaded.assets);

  // Graph-level validation (fail-loud, before publication).
  const graphFindings = validateGraphs(semanticGraph);
  if (graphFindings.length > 0) throw new KnowledgeValidationError(graphFindings);

  const diagnostics = computeDiagnostics(loaded.assets, dependencyGraph, semanticGraph);
  const statistics = computeStatistics(loaded.assets, dependencyGraph, semanticGraph);

  const manifest = buildManifest({
    builderVersion: req.builderVersion ?? BUILDER_VERSION,
    assets: loaded.assets,
    vocabulary: loaded.vocabulary,
    graphs: [dependencyGraph, semanticGraph],
    derivedArtifacts: [
      { name: 'diagnostics', digest: diagnosticsDigest(diagnostics) },
      { name: 'statistics', digest: statisticsDigest(statistics) },
    ],
  });

  let outputDir: string | undefined;
  if (req.publish) {
    outputDir = req.outputDir ?? (req.root ? join(req.root, '.knowledge-build') : undefined);
    if (!outputDir) throw new KnowledgeError('publish requires outputDir (or root)');
    publish(outputDir, { dependencyGraph, semanticGraph, diagnostics, statistics, manifest });
  }

  return {
    assetCount: loaded.assets.length,
    dependencyGraph,
    semanticGraph,
    diagnostics,
    statistics,
    manifest,
    outputDir,
  };
}

function requireRoot(req: BuildRequest): string {
  if (!req.root) throw new KnowledgeError('buildRepository: `root` or `loaded` is required');
  return req.root;
}

/**
 * Atomic publication (M2): the entire build is written into a per-build UNIQUE
 * staging directory first — the live build is never touched until the new one is
 * fully materialized, eliminating the old delete-then-write window. The swap is two
 * fast metadata renames (move the old build aside, move the new one in); on any
 * failure the prior build is restored. The unique staging/backup names mean
 * concurrent builders can never corrupt each other's staging. Every filesystem fault
 * is wrapped in a PublicationError (M4) so publication participates in the fail-loud
 * model — no raw fs exception escapes the Builder. Outputs are byte-for-byte the
 * deterministic artifact text; only the transient directory names vary.
 */
interface PublishSet {
  readonly dependencyGraph: GraphArtifact;
  readonly semanticGraph: GraphArtifact;
  readonly diagnostics: Diagnostics;
  readonly statistics: Statistics;
  readonly manifest: BuildManifest;
}

function publish(dir: string, set: PublishSet): void {
  const parent = dirname(dir);
  const staging = join(parent, `.knowledge-build.staging-${randomUUID()}`);
  const backup = join(parent, `.knowledge-build.old-${randomUUID()}`);
  let movedAside = false;
  try {
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'dependency-graph.json'), graphText(set.dependencyGraph) + '\n', 'utf8');
    writeFileSync(join(staging, 'semantic-graph.json'), graphText(set.semanticGraph) + '\n', 'utf8');
    writeFileSync(join(staging, 'diagnostics.json'), diagnosticsText(set.diagnostics) + '\n', 'utf8');
    writeFileSync(join(staging, 'statistics.json'), statisticsText(set.statistics) + '\n', 'utf8');
    writeFileSync(join(staging, 'manifest.json'), canonicalText(manifestCanonical(set.manifest)) + '\n', 'utf8');
    if (existsSync(dir)) {
      renameSync(dir, backup);
      movedAside = true;
    }
    try {
      renameSync(staging, dir);
    } catch (swapErr) {
      if (movedAside) renameSync(backup, dir); // restore the prior good build
      throw swapErr;
    }
  } catch (e) {
    throw new PublicationError(
      `failed to publish knowledge build to '${dir}': ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(backup, { recursive: true, force: true });
  }
}
