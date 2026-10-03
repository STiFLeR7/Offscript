/**
 * Deterministic serialize/deserialize for replay — same discipline as
 * src/project/readiness.ts's serializeReadiness: a fixed key order so two
 * equal objects always produce byte-identical text.
 */
import type { CreativeArtifact } from './types.js';

export function serializeCreativeArtifact(artifact: CreativeArtifact): string {
  const canonical: CreativeArtifact = {
    contractVersion: artifact.contractVersion,
    id: artifact.id,
    intentDigest: artifact.intentDigest,
    artifactType: artifact.artifactType,
    location: artifact.location,
    artifactDigest: artifact.artifactDigest,
    createdAt: artifact.createdAt,
    generation: { ...artifact.generation },
    approval: { ...artifact.approval },
    ...(artifact.validation !== undefined ? { validation: { ...artifact.validation } } : {}),
    ...(artifact.provenance !== undefined ? { provenance: { ...artifact.provenance } } : {}),
  };
  return JSON.stringify(canonical, null, 2);
}

export function deserializeCreativeArtifact(text: string): CreativeArtifact {
  const obj = JSON.parse(text) as CreativeArtifact;
  if (obj.contractVersion !== 1) {
    throw new Error(`creative-artifact: unsupported contractVersion ${String(obj.contractVersion)}.`);
  }
  return obj;
}
