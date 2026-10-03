import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCreativeReference, tryLoadCreativeReference, engineRoot } from '../src/references.js';

describe('Quality Bar reference — loadable through the existing generic loader', () => {
  it('loads QUALITY-BAR.md via the same loadCreativeReference() used for _PENDING.md', () => {
    const content = loadCreativeReference('QUALITY-BAR.md');
    expect(content.length).toBeGreaterThan(0);
  });

  it('does not throw — the reference exists', () => {
    expect(() => loadCreativeReference('QUALITY-BAR.md')).not.toThrow();
  });
});

describe('Quality Bar reference — content shape (provenance + isolation)', () => {
  const content = () => tryLoadCreativeReference('QUALITY-BAR.md') ?? '';

  it('contains all 15 numbered items, traceable to the source', () => {
    for (let i = 1; i <= 15; i++) {
      expect(content()).toMatch(new RegExp(`### ${i}\\.`));
    }
  });

  it('states a classification for every item (PORT/ADAPT/DEFER)', () => {
    const matches = content().match(/\*\*Classification:\*\* (PORT|ADAPT|DEFER|DROP|UNKNOWN)/g) ?? [];
    expect(matches.length).toBe(15);
  });

  it('the classification summary table totals 15 items across the five categories', () => {
    const c = content();
    expect(c).toMatch(/4 PORT/);
    expect(c).toMatch(/6 ADAPT/);
    expect(c).toMatch(/5 DEFER/);
    expect(c).toMatch(/0 DROP/);
    expect(c).toMatch(/0 UNKNOWN/);
  });

  it('is deterministic — loading it twice returns identical content', () => {
    expect(content()).toBe(content());
  });

  it('contains no absolute Windows drive-letter or UNC path literal', () => {
    expect(content()).not.toMatch(/["'`]?[A-Za-z]:[\\/][A-Za-z]/);
    expect(content()).not.toMatch(/\\\\[A-Za-z]/);
  });

  it('does not name the external repository', () => {
    expect(content()).not.toMatch(/Offscript-creatives-generation/i);
  });

  it('does not reference Claude Code tool/skill mechanics', () => {
    expect(content()).not.toMatch(/\bSkill tool\b/i);
    expect(content()).not.toMatch(/\bAskUserQuestion\b/);
    expect(content()).not.toMatch(/hyperframes-/i);
  });

  it('contains no hardcoded hex brand colours (would signal a second brand source)', () => {
    expect(content()).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });

  it('creates no design/creative/brand-pack directory on disk (Sprint 2 boundary, filesystem check not prose)', () => {
    const repoRoot = join(engineRoot, '..');
    expect(existsSync(join(repoRoot, 'design/creative', 'brand-pack'))).toBe(false);
  });

  it('explicitly states its relationship to existing Offscript validation (no silent duplication)', () => {
    expect(content()).toMatch(/source-fidelity/);
    expect(content()).toMatch(/brand-fidelity-scan/);
  });
});

describe('missing-reference behavior remains deterministic (Sprint 3 regression)', () => {
  it('a reference that still does not exist still throws the same way', () => {
    expect(() => loadCreativeReference('camera-system.md')).toThrow(/camera-system\.md/);
  });
});
