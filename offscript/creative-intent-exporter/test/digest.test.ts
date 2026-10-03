import { describe, it, expect } from 'vitest';
import { canonicalize, computeDigest } from '../src/intent/digest.js';
import type { DigestInput } from '../src/intent/digest.js';

const base: DigestInput = {
  contractVersion: 1,
  id: 'owned-task-handoff',
  belief: 'nothing falls through the cracks because every task always has a clear, visible owner',
  feature: 'collaboration',
  ratio: '16:9',
  camera: 'component',
  mustInclude: [],
  contentProvenance: 'augmented',
};

describe('canonicalize', () => {
  it('sorts keys lexicographically regardless of insertion order', () => {
    const a = canonicalize({ b: 1, a: 2 });
    const b = canonicalize({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('produces no insignificant whitespace', () => {
    expect(canonicalize({ x: [1, 2] })).toBe('{"x":[1,2]}');
  });
});

describe('computeDigest', () => {
  it('is deterministic across repeated calls on identical input', () => {
    const d1 = computeDigest(base);
    const d2 = computeDigest(base);
    expect(d1).toBe(d2);
  });

  it('produces the sha256: prefix and a 64-hex-char digest', () => {
    const d = computeDigest(base);
    expect(d).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is insensitive to the input object key insertion order', () => {
    const reordered: DigestInput = {
      camera: base.camera,
      contentProvenance: base.contentProvenance,
      mustInclude: base.mustInclude,
      ratio: base.ratio,
      feature: base.feature,
      belief: base.belief,
      id: base.id,
      contractVersion: base.contractVersion,
    };
    expect(computeDigest(reordered)).toBe(computeDigest(base));
  });

  it('changes when belief changes', () => {
    expect(computeDigest({ ...base, belief: 'a different belief entirely' })).not.toBe(
      computeDigest(base)
    );
  });

  it('changes when section is added, and omits the key entirely when absent', () => {
    const withSection = computeDigest({ ...base, section: 'feature' });
    const withoutSection = computeDigest(base);
    expect(withSection).not.toBe(withoutSection);
  });

  it('preserves must-include array order (does not sort array contents)', () => {
    const a = computeDigest({ ...base, mustInclude: ['first', 'second'] });
    const b = computeDigest({ ...base, mustInclude: ['second', 'first'] });
    expect(a).not.toBe(b);
  });

  it('never includes provenance in the digested payload', () => {
    // computeDigest's DigestInput type has no provenance field at all —
    // this is a compile-time guarantee, asserted here at runtime too via
    // two otherwise-identical inputs differing only by an extra prop cast in.
    const withExtra = computeDigest({ ...base, provenance: { x: 'y' } } as DigestInput);
    expect(withExtra).toBe(computeDigest(base));
  });
});
