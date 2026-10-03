/**
 * Implements CG7 §2's canonicalization + digest rule exactly:
 *   - the digested set is {contractVersion, id, belief, feature, ratio,
 *     camera, must-include, content-provenance, section?}
 *   - object keys sorted lexicographically (ASCII order)
 *   - no insignificant whitespace
 *   - must-include array order preserved as-authored, never sorted
 *   - absent `section` is omitted entirely from the canonical form, never null
 *   - provenance and digest itself are never digested
 *   - digest = "sha256:" + hex(sha256(canonical_bytes)), UTF-8, no BOM
 * No deviations, no alternative ordering, no timestamps, no non-determinism.
 */
import { createHash } from 'node:crypto';

export interface DigestInput {
  contractVersion: number;
  id: string;
  belief: string;
  feature: string;
  ratio: string;
  camera: string;
  mustInclude: string[];
  contentProvenance: string;
  section?: string;
}

/** Sorts keys lexicographically and serializes with no insignificant whitespace. */
export function canonicalize(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(payload[k])}`);
  return `{${parts.join(',')}}`;
}

function digestedPayload(input: DigestInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contractVersion: input.contractVersion,
    id: input.id,
    belief: input.belief,
    feature: input.feature,
    ratio: input.ratio,
    camera: input.camera,
    'must-include': input.mustInclude,
    'content-provenance': input.contentProvenance,
  };
  if (input.section !== undefined) payload.section = input.section;
  return payload;
}

export function computeDigest(input: DigestInput): string {
  const canonical = canonicalize(digestedPayload(input));
  const hex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hex}`;
}
