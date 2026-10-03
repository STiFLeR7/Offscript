import { describe, expect, it } from 'vitest';
import { PRESERVE_LIST, isPreserved, classifyExistingTargetFiles } from '../src/preserve.js';

describe('PRESERVE_LIST', () => {
  it('names exactly the 3 live, engine-load-bearing artifacts with no design/website source', () => {
    expect(isPreserved('behavior.js')).toBe(true);
    expect(isPreserved('imagery.md')).toBe(true);
    expect(isPreserved('exemplars/fragments/hero.html')).toBe(true);
    expect(isPreserved('exemplars/fragments/anything-else.html')).toBe(true);
  });

  it('does not preserve a file merely under a similar-looking path', () => {
    expect(isPreserved('exemplars/fragments-old/hero.html')).toBe(false);
    expect(isPreserved('rulebooks/numerics.md')).toBe(false); // orphan, not preserve-list — see classify
  });
});

describe('classifyExistingTargetFiles', () => {
  it('splits existing target files into written / preserved / unaccounted, with nothing dropped', () => {
    const existing = [
      'ASSETS.md', // will be (re)written by this sync
      'behavior.js', // preserve-list
      'exemplars/fragments/hero.html', // preserve-list
      'rulebooks/numerics.md', // orphan — no source, not preserve-list either
      'assets/imagery/backgrounds/hero-bg-night.jpg', // a second, previously-undiscovered orphan
    ];
    const written = new Set(['ASSETS.md', 'colors_and_type.css']); // colors_and_type.css is new, not "existing"
    const result = classifyExistingTargetFiles(existing, written);

    expect(result.overwritten).toEqual(['ASSETS.md']);
    expect(result.preserved.sort()).toEqual(['behavior.js', 'exemplars/fragments/hero.html'].sort());
    expect(result.unaccounted.sort()).toEqual(
      ['rulebooks/numerics.md', 'assets/imagery/backgrounds/hero-bg-night.jpg'].sort(),
    );
    // every existing file is classified exactly once
    const total = result.overwritten.length + result.preserved.length + result.unaccounted.length;
    expect(total).toBe(existing.length);
  });

  it('a written file that is ALSO on the preserve-list is an error — the two must never overlap', () => {
    expect(() => classifyExistingTargetFiles(['behavior.js'], new Set(['behavior.js']))).toThrow(
      /preserve-list.*written|written.*preserve-list/i,
    );
  });
});
