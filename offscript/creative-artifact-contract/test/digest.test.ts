import { describe, it, expect } from 'vitest';
import { computeContentDigest, isValidDigestFormat } from '../src/artifact/digest.js';

describe('computeContentDigest', () => {
  it('is deterministic for the same string content', () => {
    const a = computeContentDigest('<html>hello</html>');
    const b = computeContentDigest('<html>hello</html>');
    expect(a).toBe(b);
  });

  it('produces different digests for different content', () => {
    const a = computeContentDigest('<html>hello</html>');
    const b = computeContentDigest('<html>goodbye</html>');
    expect(a).not.toBe(b);
  });

  it('produces a sha256:<64-hex> formatted string', () => {
    const digest = computeContentDigest('anything');
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('accepts Buffer content and is consistent with the equivalent utf8 string', () => {
    const fromString = computeContentDigest('binary-ish content');
    const fromBuffer = computeContentDigest(Buffer.from('binary-ish content', 'utf8'));
    expect(fromBuffer).toBe(fromString);
  });
});

describe('isValidDigestFormat', () => {
  it('accepts a well-formed sha256 digest', () => {
    const digest = computeContentDigest('sample');
    expect(isValidDigestFormat(digest)).toBe(true);
  });

  it('rejects a digest missing the sha256: prefix', () => {
    expect(isValidDigestFormat('a'.repeat(64))).toBe(false);
  });

  it('rejects a digest with the wrong hex length', () => {
    expect(isValidDigestFormat('sha256:abc123')).toBe(false);
  });

  it('rejects a digest with uppercase hex', () => {
    expect(isValidDigestFormat('sha256:' + 'A'.repeat(64))).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidDigestFormat('')).toBe(false);
  });
});
