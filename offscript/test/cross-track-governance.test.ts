import { describe, it, expect } from 'vitest';
import {
  loadCrossTrackGovernance,
  tryCrossTrackGovernance,
  validateCrossTrackGovernanceShape,
  crossTrackGovernanceManifest,
  MIN_CROSS_TRACK_SECTIONS,
} from '../src/cross-track-governance.js';

describe('loadCrossTrackGovernance', () => {
  it('loads a ported cross-track governance file by name (no extension)', () => {
    expect(loadCrossTrackGovernance('CREATIVE_DIRECTION')).toContain('# CREATIVE DIRECTION');
    expect(loadCrossTrackGovernance('INHERITED_CREATIVE_CONSTITUTION')).toContain(
      'THE INHERITED CREATIVE CONSTITUTION',
    );
  });

  it('throws for an unknown / not-yet-ported cross-track document', () => {
    expect(() => loadCrossTrackGovernance('does-not-exist')).toThrow();
  });
});

describe('tryCrossTrackGovernance (presence-based enablement)', () => {
  it('returns the content when present', () => {
    expect(tryCrossTrackGovernance('CREATIVE_DIRECTION')).toContain('# CREATIVE DIRECTION');
  });

  it('returns undefined — never throws — for an absent document', () => {
    expect(tryCrossTrackGovernance('does-not-exist')).toBeUndefined();
  });
});

describe('validateCrossTrackGovernanceShape', () => {
  it('accepts real content with enough §-sections', () => {
    const content = Array.from({ length: MIN_CROSS_TRACK_SECTIONS }, (_, i) => `## §${i} — Heading\n\nbody`).join(
      '\n\n',
    );
    expect(validateCrossTrackGovernanceShape(content)).toEqual([]);
  });

  it('flags an empty document', () => {
    expect(validateCrossTrackGovernanceShape('   \n  ')).toEqual(['document is empty']);
  });

  it(`flags a document below the ${MIN_CROSS_TRACK_SECTIONS}-section floor`, () => {
    const problems = validateCrossTrackGovernanceShape('## §0 — Only one section\n\nbody');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/section/i);
  });

  it('the real ported documents pass validation', () => {
    expect(validateCrossTrackGovernanceShape(loadCrossTrackGovernance('CREATIVE_DIRECTION'))).toEqual([]);
    expect(
      validateCrossTrackGovernanceShape(loadCrossTrackGovernance('INHERITED_CREATIVE_CONSTITUTION')),
    ).toEqual([]);
  });
});

describe('crossTrackGovernanceManifest (digest tracking)', () => {
  it('enumerates every constitutional-altitude file under design_principles/ with a stable digest', () => {
    const manifest = crossTrackGovernanceManifest();
    const names = manifest.files.map((f) => f.name).sort();
    expect(names).toEqual(['CREATIVE_DIRECTION.md', 'INHERITED_CREATIVE_CONSTITUTION.md']);
    expect(manifest.files.every((f) => /^sha256:[0-9a-f]{64}$/.test(f.digest))).toBe(true);
    expect(manifest.combined).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is deterministic — two calls produce the identical manifest', () => {
    expect(crossTrackGovernanceManifest()).toEqual(crossTrackGovernanceManifest());
  });
});
