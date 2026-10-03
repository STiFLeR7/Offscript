/**
 * Sprint 10AB — the deterministic Environment eligibility filter. `getEligibleEnvironments()` must
 * answer only "which governed environments are legally eligible for this creative?" — vocabulary
 * membership + ratio legality (design/website/brand-pack/ASSETS.md's own `aspect` column) + recent-env
 * exclusion (the caller-supplied `lastEnvironment`, mirroring Sprint 10Z's own
 * getRecentEnvironmentUsage() output shape) — never "which eligible environment is best". No
 * semantic ranking, no belief/feature/camera input, no LLM, no filesystem read.
 *
 * Ratio note: the four governed ratios are `1:1` / `4:3` / `3:4` / `16:9`
 * (creative-intent-exporter/src/intent/types.ts's own `Ratio` union; ASSETS.md line 36's own "closed
 * creative ratio vocabulary"). `4:5` is explicitly, textually BANNED as a ratio by ASSETS.md line 45
 * ("Never invent a ratio... not the easy near-miss `4:5` against `3:4`") — so it is tested here as an
 * UNSUPPORTED-ratio edge case (yielding zero eligible candidates), not as a "legal ratio" case.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getEligibleEnvironments, type EligibilityInput } from '../src/environment-selection-eligibility.js';
import type { EnvironmentSlug } from '../src/environment-library.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/environment-selection-eligibility.ts', import.meta.url));

// The exact, documented seven-value vocabulary — same source Sprint 10V's own test file uses,
// not re-derived or reordered.
const ALL_ENVIRONMENTS: EnvironmentSlug[] = [
  'cliffside-muted',
  'dawn-haze',
  'lake-mirror',
  'massif-banded',
  'massif-clear',
  'ridges-distant',
  'valley-deep',
];

describe('getEligibleEnvironments — all seven legal at 1:1', () => {
  it('returns all seven candidates unfiltered', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '1:1' });
    expect([...result].sort()).toEqual([...ALL_ENVIRONMENTS].sort());
  });
});

describe('getEligibleEnvironments — all seven legal at 16:9', () => {
  it('returns all seven candidates unfiltered', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '16:9' });
    expect([...result].sort()).toEqual([...ALL_ENVIRONMENTS].sort());
  });
});

describe('getEligibleEnvironments — all seven legal at 4:3', () => {
  it('returns all seven candidates unfiltered', () => {
    // ASSETS.md: dawn-haze's own aspect list is "16:9 · 4:3 · 1:1" and massif-clear's is
    // "4:3 · 16:9 · 1:1" — both include 4:3, so unlike 3:4 (below), 4:3 excludes neither.
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '4:3' });
    expect([...result].sort()).toEqual([...ALL_ENVIRONMENTS].sort());
  });
});

describe('getEligibleEnvironments — 3:4 excludes dawn-haze', () => {
  it('omits dawn-haze from the eligible set at ratio 3:4', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '3:4' });
    expect(result).not.toContain('dawn-haze');
  });
});

describe('getEligibleEnvironments — 3:4 excludes massif-clear', () => {
  it('omits massif-clear from the eligible set at ratio 3:4', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '3:4' });
    expect(result).not.toContain('massif-clear');
  });
});

describe('getEligibleEnvironments — 3:4 preserves all other five', () => {
  it('keeps every environment except dawn-haze and massif-clear at ratio 3:4', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '3:4' });
    const expected = ALL_ENVIRONMENTS.filter((e) => e !== 'dawn-haze' && e !== 'massif-clear');
    expect([...result].sort()).toEqual([...expected].sort());
  });
});

describe('getEligibleEnvironments — recent environment removed', () => {
  it('omits lastEnvironment from an otherwise-eligible set', () => {
    const result = getEligibleEnvironments({
      candidates: ALL_ENVIRONMENTS,
      ratio: '1:1',
      lastEnvironment: 'lake-mirror',
    });
    expect(result).not.toContain('lake-mirror');
    expect(result.length).toBe(ALL_ENVIRONMENTS.length - 1);
  });
});

describe('getEligibleEnvironments — no recent environment removes nothing', () => {
  it('returns the full ratio-legal set when lastEnvironment is undefined', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '1:1' });
    expect(result.length).toBe(ALL_ENVIRONMENTS.length);
  });
});

describe('getEligibleEnvironments — recent environment not in vocabulary does not corrupt result', () => {
  it('treats an unrecognized lastEnvironment value the same as no recent environment', () => {
    const result = getEligibleEnvironments({
      candidates: ALL_ENVIRONMENTS,
      ratio: '1:1',
      lastEnvironment: 'not-a-real-environment',
    });
    expect(result.length).toBe(ALL_ENVIRONMENTS.length);
  });
});

describe('getEligibleEnvironments — only recent candidate removed leaves empty set', () => {
  it('returns an empty array, never re-adding the recent environment as a fallback', () => {
    const result = getEligibleEnvironments({
      candidates: ['dawn-haze'],
      ratio: '1:1',
      lastEnvironment: 'dawn-haze',
    });
    expect(result).toEqual([]);
  });
});

describe('getEligibleEnvironments — stable ordering', () => {
  it('preserves the relative order of the input candidates array, never re-ranking', () => {
    const reversed = [...ALL_ENVIRONMENTS].reverse();
    const result = getEligibleEnvironments({ candidates: reversed, ratio: '1:1' });
    expect([...result]).toEqual(reversed);
  });
});

describe('getEligibleEnvironments — duplicate candidates handled deterministically', () => {
  it('deduplicates repeated candidates, keeping the first occurrence position', () => {
    const withDupes = ['lake-mirror', 'dawn-haze', 'lake-mirror', 'valley-deep', 'dawn-haze'];
    const result = getEligibleEnvironments({ candidates: withDupes, ratio: '1:1' });
    expect(result).toEqual(['lake-mirror', 'dawn-haze', 'valley-deep']);
  });
});

describe('getEligibleEnvironments — unknown candidate rejected', () => {
  it('silently drops a non-governed candidate value rather than throwing or including it', () => {
    const result = getEligibleEnvironments({
      candidates: ['lake-mirror', 'not-a-real-environment', 'valley-deep'],
      ratio: '1:1',
    });
    expect(result).toEqual(['lake-mirror', 'valley-deep']);
  });
});

describe('getEligibleEnvironments — input array remains unchanged', () => {
  it('never mutates the candidates array passed in', () => {
    const input = ['lake-mirror', 'dawn-haze', 'valley-deep'];
    const before = JSON.stringify(input);
    getEligibleEnvironments({ candidates: input, ratio: '3:4', lastEnvironment: 'lake-mirror' });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('returns a frozen array', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '1:1' });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('getEligibleEnvironments — repeated call returns identical output', () => {
  it('is deterministic across repeated calls with the same input', () => {
    const input: EligibilityInput = { candidates: ALL_ENVIRONMENTS, ratio: '3:4', lastEnvironment: 'valley-deep' };
    const first = getEligibleEnvironments(input);
    const second = getEligibleEnvironments(input);
    expect([...first]).toEqual([...second]);
  });
});

describe('getEligibleEnvironments — unsupported ratio yields zero eligible candidates', () => {
  it('returns an empty array for a ratio ASSETS.md never grants any environment (e.g. the explicitly banned 4:5)', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '4:5' });
    expect(result).toEqual([]);
  });

  it('returns an empty array for a missing/empty ratio', () => {
    const result = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: '' });
    expect(result).toEqual([]);
  });
});

describe('environment-selection-eligibility.ts — no semantic input, no semantic ranking', () => {
  // "belief"/"feature"/"camera" may appear in prose explaining the scope boundary (the same
  // documentation convention this program has used throughout, e.g. Sprint 10Z's own header) —
  // what must be absent is actual usage: a property/parameter/destructure of those names.
  it('does not read belief/feature/camera from its input type or logic', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/\.\s*belief\b/);
    expect(src).not.toMatch(/\.\s*feature\b/);
    expect(src).not.toMatch(/\.\s*camera\b/i);
    expect(src).not.toMatch(/\bbelief\s*[:?]\s*(string|Belief)/);
    expect(src).not.toMatch(/\bcamera\s*[:?]\s*(string|Camera)/);
  });

  it('does not perform semantic ranking, scoring, or invoke a selector/judgment function', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/selectEnvironment/);
    expect(src).not.toMatch(/chooseEnvironment/);
    expect(src).not.toMatch(/JudgmentDispatch/);
    expect(src).not.toMatch(/\.sort\(/); // no comparator-based re-ranking of the eligible set
    expect(src).not.toMatch(/function\s+\w*[Ss]core\w*/);
  });
});

describe('environment-selection-eligibility.ts — does not read _LOG.md itself', () => {
  it('contains no filesystem read and no import of a log reader/parser', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"]node:fs['"]/);
    expect(src).not.toMatch(/readFileSync|readLogLines|parseLogLine/);
    expect(src).not.toMatch(/from\s+['"].*recent-environment-usage/);
  });
});

describe('environment-selection-eligibility.ts — isolation from Visual Proof and Website Generation', () => {
  it('does not import Visual Proof, the Revision Executor, or the Rethink Loop', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"].*visual-proof/i);
  });

  it('does not import Website Generation or offscript/src', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"].*\/(plan|author|website-composition)\.js['"]/);
    expect(src).not.toMatch(/from\s+['"].*src\/generate/);
    expect(src).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
  });

  it('does not import a Material, Color, or Benchmark Retrieval module', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    const importLines = src.match(/^import .*$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/material|glass|shadow|radius|benchmark|color/i);
    }
  });
});
