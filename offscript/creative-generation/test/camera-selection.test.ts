/**
 * Sprint 10B — Camera Selection port. selectCamera() must read
 * design/creative/governance/creative/CAMERA-SELECTION.md (mirrored into
 * resources/design_processes/creative/) through the existing reference-loading
 * boundary, never a second hardcoded copy of the section-aware bias table.
 *
 * What this methodology can determine deterministically: the five camera values, and
 * whether a declared camera matches the section-aware starting bias (HANDOFF-v2.md §B-9).
 * What it cannot determine (see CAMERA-SELECTION.md "Limitations"): whether a camera is
 * genuinely the closest one that proves a given belief — that is belief-semantic judgment
 * (Visual Proof Validation), explicitly out of scope for this sprint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectCamera, type Camera } from '../src/camera-selection.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/camera-selection.ts', import.meta.url));

const ALL_CAMERAS: Camera[] = ['establishing', 'product', 'workflow', 'component', 'macro'];

// The exact, documented section -> camera bias, from HANDOFF-v2.md §B-9. Bias width
// deliberately not uniform (4 rows of 1, 2 rows of 2) — preserved from the source rather
// than normalized. See CAMERA-SELECTION.md's "Bias-width note".
const SECTION_BIAS: Record<string, Camera[]> = {
  hero: ['establishing'],
  feature: ['workflow'],
  benefit: ['component'],
  cta: ['macro'],
  social: ['component', 'macro'],
  collateral: ['workflow', 'establishing'],
};

describe('selectCamera — all five documented camera values, no section', () => {
  for (const camera of ALL_CAMERAS) {
    it(`honors a declared camera of "${camera}" when no section is given`, () => {
      const result = selectCamera({ camera });
      expect(result.declared).toBe(camera);
      expect(result.selected).toBe(camera);
      expect(result.sectionBias).toEqual([]);
      expect(result.matchesSectionBias).toBeUndefined();
    });
  }
});

describe('selectCamera — determinism', () => {
  it('returns an equivalent result across repeated calls', () => {
    expect(selectCamera({ camera: 'workflow', section: 'feature' })).toEqual(
      selectCamera({ camera: 'workflow', section: 'feature' }),
    );
  });
});

describe('selectCamera — the documented section-aware starting bias', () => {
  for (const [section, bias] of Object.entries(SECTION_BIAS)) {
    it(`resolves section "${section}" to its exact documented bias (${bias.join(', ')})`, () => {
      const result = selectCamera({ camera: 'macro', section });
      expect(result.sectionBias).toEqual(bias);
    });
  }

  it('a declared camera matching a single-value bias reports matchesSectionBias = true', () => {
    const result = selectCamera({ camera: 'establishing', section: 'hero' });
    expect(result.matchesSectionBias).toBe(true);
  });

  it('a declared camera absent from a single-value bias reports matchesSectionBias = false', () => {
    const result = selectCamera({ camera: 'macro', section: 'hero' });
    expect(result.matchesSectionBias).toBe(false);
  });

  it('a declared camera matching either side of a two-value bias reports matchesSectionBias = true', () => {
    expect(selectCamera({ camera: 'component', section: 'social' }).matchesSectionBias).toBe(true);
    expect(selectCamera({ camera: 'macro', section: 'social' }).matchesSectionBias).toBe(true);
  });

  it('always honors the declared camera as selected, even on a bias mismatch — no invented override', () => {
    const result = selectCamera({ camera: 'macro', section: 'hero' });
    expect(result.selected).toBe('macro');
    expect(result.declared).toBe('macro');
  });
});

describe('selectCamera — unknown/invalid input, never throws', () => {
  it('an unrecognized camera falls back to the section bias when one exists', () => {
    const result = selectCamera({ camera: 'not-a-real-camera', section: 'cta' });
    expect(result.declared).toBeUndefined();
    expect(result.sectionBias).toEqual(['macro']);
    expect(result.selected).toBe('macro');
    expect(result.matchesSectionBias).toBeUndefined();
  });

  it('an unrecognized camera with no section resolves nothing, never throws', () => {
    expect(() => selectCamera({ camera: 'not-a-real-camera' })).not.toThrow();
    const result = selectCamera({ camera: 'not-a-real-camera' });
    expect(result.declared).toBeUndefined();
    expect(result.selected).toBeUndefined();
    expect(result.sectionBias).toEqual([]);
  });

  it('an unrecognized section resolves an empty bias, never throws', () => {
    expect(() => selectCamera({ camera: 'workflow', section: 'not-a-real-section' })).not.toThrow();
    const result = selectCamera({ camera: 'workflow', section: 'not-a-real-section' });
    expect(result.sectionBias).toEqual([]);
    expect(result.matchesSectionBias).toBeUndefined();
  });

  it('an empty-string camera and no section resolves nothing, never throws', () => {
    const result = selectCamera({ camera: '' });
    expect(result.declared).toBeUndefined();
    expect(result.selected).toBeUndefined();
  });
});

describe('selectCamera — no documented tie-breaking rule is invented', () => {
  it('a bias mismatch is reported as data, never resolved to a pass/fail verdict', () => {
    const result = selectCamera({ camera: 'establishing', section: 'cta' });
    expect(result.matchesSectionBias).toBe(false);
    // No third field claims the mismatch is "resolved" or "overridden" — the source's own
    // stated-reason override is belief-semantic judgment this methodology does not perform.
    expect(Object.keys(result).sort()).toEqual(['declared', 'matchesSectionBias', 'sectionBias', 'selected']);
  });
});

describe('selectCamera — no mutation', () => {
  it('returned sectionBias array cannot mutate the source', () => {
    const result = selectCamera({ camera: 'macro', section: 'social' });
    expect(() => {
      (result.sectionBias as Camera[]).push('product');
    }).toThrow();
  });

  it('two calls return distinct sectionBias array instances', () => {
    const a = selectCamera({ camera: 'macro', section: 'social' });
    const b = selectCamera({ camera: 'macro', section: 'social' });
    expect(a.sectionBias).not.toBe(b.sectionBias);
    expect(a.sectionBias).toEqual(b.sectionBias);
  });
});

describe('camera-selection.ts — the document is the source of truth, not a second hardcoded table', () => {
  it('the implementation source file does not embed the section-aware bias table', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/\|\s*`hero`\s*\|/i);
    expect(src).not.toMatch(/establishing.*feature.*workflow.*benefit.*component/s);
  });

  it('the implementation source file contains no client-specific string', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('example-brand');
    expect(src.toLowerCase()).not.toContain('apa');
  });
});
