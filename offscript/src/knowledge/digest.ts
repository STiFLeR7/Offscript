/**
 * PKG — Repository Builder: the determinism substrate (ES-1R §8 / ES-2 §1).
 *
 * Every authored document and every derived artifact has a stable content
 * identity over its CANONICAL FORM:
 *   • strings are Unicode NFC-normalized;
 *   • object keys are sorted;
 *   • arrays preserve caller order (the normalizer presents metadata sets already
 *     sorted, so canonical order is fixed);
 *   • the canonical encoding is compact JSON, hashed with SHA-256.
 *
 * The hash function is an engineering choice; the only contract is determinism +
 * collision-resistance. This module is serialization-INDEPENDENT: it operates on
 * the normalized model, never on YAML/Markdown source bytes.
 */
import { createHash } from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function canon(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? value.normalize('NFC') : value;
  }
  if (Array.isArray(value)) {
    return value.map(canon);
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = canon(record[key]);
  }
  return out;
}

/** Canonical, deterministic JSON text for `obj` (sorted keys, NFC strings). */
export function canonicalText(obj: unknown): string {
  return JSON.stringify(canon(obj));
}

/** `sha256:<hex>` over the canonical form of `obj`. */
export function digest(obj: unknown): string {
  return 'sha256:' + createHash('sha256').update(canonicalText(obj), 'utf8').digest('hex');
}
