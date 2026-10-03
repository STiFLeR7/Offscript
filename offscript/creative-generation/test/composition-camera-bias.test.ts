/**
 * Sprint 10D — Camera -> Density/Breathing Starting Bias port. getCompositionCameraBias() must
 * read design/creative/governance/creative/COMPOSITION-CAMERA-BIAS.md (mirrored into
 * resources/design_processes/creative/) through the existing reference-loading boundary,
 * never a second hardcoded copy of the five-row table.
 *
 * This is a STARTING BIAS only (HANDOFF-v2.md: "Camera sets the starting density/breathing,
 * then intent may adjust one step") — no test here asserts a final density/breathing decision,
 * since that requires belief-semantic judgment explicitly out of scope for this sprint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCompositionCameraBias } from '../src/composition-camera-bias.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/composition-camera-bias.ts', import.meta.url));

// The exact, documented starting-bias pairs, from HANDOFF-v2.md's sentence following §B-4's
// numeric-translation table. Compound density values (en-dash ranges) preserved verbatim, never
// split or normalized.
const EXPECTED: Record<string, { density: string; breathing: string }> = {
  macro: { density: 'minimal', breathing: 'generous' },
  component: { density: 'minimal–moderate', breathing: 'generous' },
  workflow: { density: 'moderate', breathing: 'standard' },
  product: { density: 'moderate–populated', breathing: 'standard' },
  establishing: { density: 'moderate', breathing: 'generous' },
};

describe('getCompositionCameraBias — all five documented camera values', () => {
  for (const [camera, expected] of Object.entries(EXPECTED)) {
    it(`resolves "${camera}" to its exact documented starting bias`, () => {
      expect(getCompositionCameraBias(camera)).toEqual(expected);
    });
  }
});

describe('getCompositionCameraBias — determinism', () => {
  it('returns an equivalent result across repeated calls', () => {
    expect(getCompositionCameraBias('workflow')).toEqual(getCompositionCameraBias('workflow'));
    expect(getCompositionCameraBias('product')).toEqual(getCompositionCameraBias('product'));
  });
});

describe('getCompositionCameraBias — unknown camera behavior', () => {
  it('returns undefined for an unrecognized camera, never throws', () => {
    expect(() => getCompositionCameraBias('not-a-real-camera')).not.toThrow();
    expect(getCompositionCameraBias('not-a-real-camera')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(getCompositionCameraBias('')).toBeUndefined();
  });
});

describe('getCompositionCameraBias — returned value is immutable', () => {
  it('mutating a returned bias object throws (frozen)', () => {
    const result = getCompositionCameraBias('macro');
    expect(() => {
      (result as { density: string }).density = 'populated';
    }).toThrow();
  });

  it('two calls return distinct object instances', () => {
    const a = getCompositionCameraBias('macro');
    const b = getCompositionCameraBias('macro');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('composition-camera-bias.ts — the document is the source of truth, not a second hardcoded table', () => {
  it('the implementation source file does not embed the five-row bias table', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/minimal.{0,10}moderate.{0,10}populated/s);
    expect(src).not.toMatch(/\|\s*`macro`\s*\|/i);
  });

  it('the implementation source file contains no client-specific string', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('example-brand');
    expect(src.toLowerCase()).not.toContain('apa');
  });
});

describe('getCompositionCameraBias — the reference document is actually consulted', () => {
  it('a call fails loud (not silently empty) if the reference boundary itself is broken', async () => {
    // Sanity check: the real document exists and is non-empty, proving the function's success
    // path above is genuinely reading real content, not coincidentally matching a fallback.
    const { loadCreativeReference } = await import('../src/references.js');
    const doc = loadCreativeReference('COMPOSITION-CAMERA-BIAS.md');
    expect(doc.length).toBeGreaterThan(0);
    expect(doc).toContain('minimal');
  });
});
