/**
 * The shared canonicalize+digest-wrapper primitive behind every versioned structural digest in
 * Programs D (Rendering IR), R (Review), E (Execution), F (Fullstack), and the Runtime substrate.
 *
 * Before this module existed, 24 files each declared their own byte-identical `canonical()`
 * (recursive key-sort, strip `undefined`) and their own identical
 * `createHash('sha256').update(TAG).update('\n').update(JSON.stringify(canonical(value))).digest
 * ('hex')` wrapper, differing ONLY by their own `..._VERSION_TAG` salt constant — see
 * `.experiments/2026-08-20-digest-consolidation/DIGEST-CONSOLIDATION-REPORT.md` for the full
 * equivalence proof. This module is that one shared primitive; each of the 24 consumers keeps
 * its own version-tag constant and its own exported digest function name — the salt is a
 * REQUIRED parameter here specifically so a caller cannot omit it and silently collide two
 * programs' digest spaces.
 *
 * NOT a general-purpose hashing framework: this is one fixed algorithm (sha256), one fixed
 * canonicalization rule (sorted keys, `undefined` stripped from objects / coalesced to `null` in
 * arrays, no Unicode normalization), and one fixed output format (64-char lowercase hex, no
 * prefix) — deliberately not configurable. Digest families with genuinely different semantics
 * (NFC-normalized World-A content digests, raw-byte artifact digests, FNV-1a plan ids) are NOT
 * this primitive and must not be routed through it.
 */
import { createHash } from 'node:crypto';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Recursively sort object keys and strip `undefined` — object properties are dropped,
 * array elements are coalesced to `null` (preserving array length/position). No Unicode
 * normalization (unlike `knowledge/digest.ts`'s NFC-normalizing `canon()` — a deliberately
 * separate, distinct-purpose canonicalizer).
 */
export function canonicalizeStructural(value: unknown): Json | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((v) => canonicalizeStructural(v) ?? null);
  if (value !== null && typeof value === 'object') {
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const cv = canonicalizeStructural((value as Record<string, unknown>)[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return value as Json;
}

/**
 * `sha256(versionTag + '\n' + JSON.stringify(canonicalizeStructural(value)))`, hex-encoded.
 * `versionTag` is REQUIRED (no default) — it is the per-program salt that keeps each program's
 * digest space collision-free from every other program's; every caller supplies its own.
 */
export function versionedStructuralDigest(value: unknown, versionTag: string): string {
  return createHash('sha256')
    .update(versionTag)
    .update('\n')
    .update(JSON.stringify(canonicalizeStructural(value)))
    .digest('hex');
}
