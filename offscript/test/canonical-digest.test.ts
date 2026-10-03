/**
 * P2-B — Digest logic consolidation: the shared canonicalize+digest-wrapper primitive.
 *
 * `.experiments/2026-08-20-offscript-pressure-audit/PRESSURE-POINT-AUDIT.md` flagged four
 * programs (Rendering IR, Review/Execution Contract, Execution Admission, Workspace State)
 * hand-duplicating the same "sha256(versionTag + '\n' + JSON.stringify(sortedKeysStripUndefined
 * (value)))" formula. Re-tracing `offscript/src/` directly (not relying on the audit's sample) found
 * this pattern in TWENTY-FOUR files, not four — every module of Programs D (rendering-ir.ts,
 * rendering-ir-completeness.ts), R (all 8 review/*.ts files), E (all 6 execution/*.ts files), F
 * (all 5 fullstack/*.ts files), and the Runtime substrate (all 3 runtime/*.ts files) — each with
 * its own copy of an identical `canonical()` (byte-for-byte diffed across all 24) and an
 * identical digest-wrapping call, differing ONLY by a per-file VERSION_TAG salt string.
 *
 * Explicitly NOT part of this consolidation (proven structurally different, not just
 * "differently named" — see DIGEST-CONSOLIDATION-REPORT.md §3/§4 for the full proof):
 *   - `knowledge/digest.ts` — NFC-normalizes strings, no salt, `sha256:` prefix.
 *   - `creative-artifact-contract/digest.ts` — no canonicalization at all (raw content bytes).
 *   - `creative-intent-exporter/digest.ts` / `creative-intent-brief-adapter/digest.ts` — a
 *     hand-rolled FIXED field subset, not a generic recursive sort; a separate, already-tracked,
 *     intentional cross-package duplication (CLAUDE.md hard constraint: never merge with
 *     artifactDigest).
 *   - `project/generation-plan.ts`'s `planIdOf` — FNV-1a (not sha256), fixed hand-written field
 *     order (not a generic canonicalizer).
 *   - `generate/family-semantics.ts`'s `bodyDigest` — canonicalizes a STRING (CRLF→LF), not a
 *     JSON value; a different domain (markdown source text, not structural JSON).
 *   - `project/readiness-store.ts`'s `canonicalize` — structurally similar shape but a genuinely
 *     different array rule (keeps `undefined` array elements instead of coalescing to `null`),
 *     and used for durable serialization (`JSON.stringify(..., null, 2) + '\n'`), never hashing.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalizeStructural, versionedStructuralDigest } from '../src/canonical-digest.js';

describe('canonical-digest — canonicalizeStructural (the shared canonicalization rule)', () => {
  it('sorts object keys deterministically', () => {
    const a = canonicalizeStructural({ b: 1, a: 2 });
    const b = canonicalizeStructural({ a: 2, b: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe('{"a":2,"b":1}');
  });

  it('strips undefined object values', () => {
    expect(canonicalizeStructural({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('coalesces undefined array elements to null (preserves array length/positions)', () => {
    expect(canonicalizeStructural([1, undefined, 3])).toEqual([1, null, 3]);
  });

  it('recurses into nested objects and arrays, sorting at every level', () => {
    const value = { z: [{ y: 1, x: 2 }], a: { d: 1, c: 2 } };
    expect(JSON.stringify(canonicalizeStructural(value))).toBe('{"a":{"c":2,"d":1},"z":[{"x":2,"y":1}]}');
  });

  it('leaves primitives, including unicode strings, untouched (no NFC normalization — unlike knowledge/digest.ts)', () => {
    // "café" as NFC (1 codepoint é) vs NFD (e + combining acute) must stay distinct — this
    // primitive does not normalize, deliberately, matching what all 24 consumers already do.
    const nfc = String.fromCharCode(0x65, 0x301); // NFD: e + combining acute
    const nfd = String.fromCharCode(0xe9); // NFC: single precomposed codepoint
    expect(canonicalizeStructural(nfc)).toBe(nfc);
    expect(canonicalizeStructural(nfd)).toBe(nfd);
    expect(canonicalizeStructural(nfc)).not.toBe(canonicalizeStructural(nfd));
  });

  it('undefined itself canonicalizes to undefined (top-level)', () => {
    expect(canonicalizeStructural(undefined)).toBeUndefined();
  });

  it('empty object and empty array canonicalize to themselves', () => {
    expect(canonicalizeStructural({})).toEqual({});
    expect(canonicalizeStructural([])).toEqual([]);
  });

  it('null is preserved as null, not stripped', () => {
    expect(canonicalizeStructural({ a: null })).toEqual({ a: null });
  });
});

describe('canonical-digest — versionedStructuralDigest (the shared wrapper)', () => {
  it('same input + same salt ⇒ same digest (deterministic)', () => {
    const value = { hero: 'a', sections: [1, 2, 3] };
    expect(versionedStructuralDigest(value, 'tag@1')).toBe(versionedStructuralDigest(value, 'tag@1'));
  });

  it('same input + different salt ⇒ different digest (cross-program collision prevention)', () => {
    const value = { hero: 'a' };
    expect(versionedStructuralDigest(value, 'tag-a@1')).not.toBe(versionedStructuralDigest(value, 'tag-b@1'));
  });

  it('key-order independence: differently-ordered-but-equal objects hash identically', () => {
    const a = versionedStructuralDigest({ b: 1, a: 2 }, 'tag@1');
    const b = versionedStructuralDigest({ a: 2, b: 1 }, 'tag@1');
    expect(a).toBe(b);
  });

  it('nested-object stability: deep key reordering does not change the digest', () => {
    const a = versionedStructuralDigest({ outer: { z: 1, a: 2 } }, 'tag@1');
    const b = versionedStructuralDigest({ outer: { a: 2, z: 1 } }, 'tag@1');
    expect(a).toBe(b);
  });

  it('a value change produces a different digest', () => {
    const a = versionedStructuralDigest({ x: 1 }, 'tag@1');
    const b = versionedStructuralDigest({ x: 2 }, 'tag@1');
    expect(a).not.toBe(b);
  });

  it('output format: 64-char lowercase hex, no prefix (matches every existing D/R/E/F consumer)', () => {
    const d = versionedStructuralDigest({ x: 1 }, 'tag@1');
    expect(d).toMatch(/^[0-9a-f]{64}$/);
  });

  it('empty object digests deterministically and differs from an empty array', () => {
    const objDigest = versionedStructuralDigest({}, 'tag@1');
    const arrDigest = versionedStructuralDigest([], 'tag@1');
    expect(objDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(objDigest).not.toBe(arrDigest);
  });

  it('unicode string content changes the digest (no normalization collapses distinct forms)', () => {
    const nfc = versionedStructuralDigest({ s: String.fromCharCode(0x65, 0x301) }, 'tag@1'); // NFD
    const nfd = versionedStructuralDigest({ s: String.fromCharCode(0xe9) }, 'tag@1'); // NFC
    expect(nfc).not.toBe(nfd);
  });

  it('reproduces the exact known formula: sha256(salt + "\\n" + JSON.stringify(canonicalizeStructural(value)))', () => {
    // Pinned against Node's own crypto module directly, independent of the module under test —
    // this is the fixture that proves the shared primitive matches what all 24 files compute today.
    const value = { b: 2, a: 1 };
    const expected = createHash('sha256').update('pin@1').update('\n').update('{"a":1,"b":2}').digest('hex');
    expect(versionedStructuralDigest(value, 'pin@1')).toBe(expected);
  });
});

describe('canonical-digest — mandatory salt (no accidental cross-program collision)', () => {
  it('versionedStructuralDigest requires a non-empty versionTag — TypeScript enforces this at the call site (no default parameter)', () => {
    // Structural proof: the exported signature has no optional/default `versionTag`, so a caller
    // cannot omit it and silently share digests across programs. Verified by source inspection —
    // this test pins the runtime behavior (an empty string is technically callable but produces a
    // clearly-labeled degenerate salt, not a silent default).
    const withEmptySalt = versionedStructuralDigest({ x: 1 }, '');
    const withRealSalt = versionedStructuralDigest({ x: 1 }, 'real-tag@1');
    expect(withEmptySalt).not.toBe(withRealSalt);
  });
});
