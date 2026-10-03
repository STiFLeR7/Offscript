/**
 * PKG — Repository Builder: digest / canonical-form determinism.
 */
import { describe, it, expect } from 'vitest';
import { canonicalText, digest } from '../../src/knowledge/digest.js';

describe('digest — canonical form is deterministic', () => {
  it('is insensitive to object key order', () => {
    expect(canonicalText({ b: 1, a: 2 })).toBe(canonicalText({ a: 2, b: 1 }));
    expect(digest({ b: 1, a: 2 })).toBe(digest({ a: 2, b: 1 }));
  });

  it('is sensitive to array order (arrays carry caller order)', () => {
    expect(digest(['a', 'b'])).not.toBe(digest(['b', 'a']));
  });

  it('NFC-normalizes strings (composed ≡ decomposed)', () => {
    const composed = 'é'; // U+00E9
    const decomposed = 'é'; // e + combining acute
    expect(composed).not.toBe(decomposed);
    expect(digest(composed)).toBe(digest(decomposed));
  });

  it('produces the sha256:<hex> shape', () => {
    expect(digest({ x: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is stable across calls (replayable)', () => {
    const obj = { kind: 'component', tags: ['a', 'b'] };
    expect(digest(obj)).toBe(digest(obj));
  });
});
