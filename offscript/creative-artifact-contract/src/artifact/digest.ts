/**
 * Content digest for an artifact's own bytes — distinct from Creative Intent's
 * canonicalize-then-hash digest (which hashes a small set of JSON fields). This
 * hashes arbitrary artifact content (an HTML file's bytes, etc.) so a later
 * consumer can verify `location` still resolves to what `artifactDigest` claims.
 * Pure — no filesystem access; the caller reads the content, this only hashes it.
 */
import { createHash } from 'node:crypto';

export function computeContentDigest(content: string | Buffer): string {
  const hex = createHash('sha256').update(content).digest('hex');
  return `sha256:${hex}`;
}

export function isValidDigestFormat(digest: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(digest);
}
