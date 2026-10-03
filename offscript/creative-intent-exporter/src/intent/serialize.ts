/**
 * Deterministic on-disk serialization of a CreativeIntentWire object.
 * Key order here is fixed (for human readability) and is independent of
 * the digest's own canonical-form key order (digest.ts sorts for hashing;
 * this sorts for storage) — both are deterministic, so repeated export of
 * identical input always produces byte-identical bytes.
 */
import type { CreativeIntentWire } from './types.js';

export function serializeCreativeIntent(wire: CreativeIntentWire): string {
  const ordered: CreativeIntentWire = {
    id: wire.id,
    contractVersion: wire.contractVersion,
    digest: wire.digest,
    belief: wire.belief,
    feature: wire.feature,
    ratio: wire.ratio,
    camera: wire.camera,
    'must-include': wire['must-include'],
    'content-provenance': wire['content-provenance'],
  };
  if (wire.section !== undefined) ordered.section = wire.section;
  if (wire.provenance !== undefined) ordered.provenance = wire.provenance;
  return JSON.stringify(ordered, null, 2) + '\n';
}
