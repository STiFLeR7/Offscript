/**
 * PKG — Repository Builder: the build manifest (ES-2 §7).
 *
 * A derived, regenerable artifact recording provenance + identities:
 *   • buildIdentity — digest over (builderVersion + vocabulary digest + sorted
 *     input digests + sorted ARTIFACT digests). Wall-clock and any non-deterministic
 *     value are EXCLUDED, so the same snapshot always yields the same identity
 *     (reproducible). Artifact digests are folded in (M1) because builderVersion is a
 *     hand-bumped value: were identity a function of inputs alone, a change to the
 *     derivation logic (e.g. how edges are projected) would alter the published
 *     artifacts while leaving the identity unchanged, and any cache/replay layer keyed
 *     on it would serve stale output. Since each artifact digest is itself a
 *     deterministic function of (inputs × derivation logic), including them makes the
 *     identity sensitive to logic changes without weakening determinism or adding
 *     runtime state.
 *   • inputs       — assetId → canonical asset digest.
 *   • artifacts    — artifact name → digest.
 *   • provenance   — artifact → contributing input ids (Sprint 1: whole-repo for
 *     graphs; finer per-edge provenance is later work).
 */
import { digest, type Json } from './digest.js';
import { assetCanonical, type NormalizedAsset } from './model.js';
import { graphDigest, type GraphArtifact } from './graph.js';
import { vocabularyDigest, type GovernedVocabulary } from './vocabulary.js';

export interface BuildManifest {
  readonly builderVersion: string;
  readonly buildIdentity: string;
  readonly inputs: Readonly<Record<string, string>>;
  readonly artifacts: Readonly<Record<string, string>>;
  readonly provenance: Readonly<Record<string, readonly string[]>>;
}

export interface ManifestInput {
  readonly builderVersion: string;
  readonly assets: readonly NormalizedAsset[];
  readonly vocabulary: GovernedVocabulary;
  readonly graphs: readonly GraphArtifact[];
  /** Other derived artifacts (e.g. diagnostics, statistics) by name → digest. */
  readonly derivedArtifacts?: ReadonlyArray<{ readonly name: string; readonly digest: string }>;
}

export function buildManifest(input: ManifestInput): BuildManifest {
  const inputs: Record<string, string> = {};
  for (const a of input.assets) inputs[a.identity.id] = digest(assetCanonical(a));
  const sortedIds = Object.keys(inputs).sort();

  const artifacts: Record<string, string> = {};
  const provenance: Record<string, string[]> = {};
  for (const g of input.graphs) {
    artifacts[g.name] = graphDigest(g);
    provenance[g.name] = sortedIds;
  }
  for (const d of input.derivedArtifacts ?? []) {
    artifacts[d.name] = d.digest;
    provenance[d.name] = sortedIds;
  }

  const buildIdentity = digest({
    builder_version: input.builderVersion,
    vocabulary: vocabularyDigest(input.vocabulary),
    inputs: sortedIds.map((id) => ({ id, digest: inputs[id] })),
    artifacts: Object.keys(artifacts)
      .sort()
      .map((name) => ({ name, digest: artifacts[name] })),
  });

  return { builderVersion: input.builderVersion, buildIdentity, inputs, artifacts, provenance };
}

export function manifestCanonical(m: BuildManifest): Json {
  return {
    builder_version: m.builderVersion,
    build_identity: m.buildIdentity,
    inputs: m.inputs,
    artifacts: m.artifacts,
    provenance: Object.fromEntries(
      Object.entries(m.provenance).map(([k, v]) => [k, [...v].sort()]),
    ),
  };
}
