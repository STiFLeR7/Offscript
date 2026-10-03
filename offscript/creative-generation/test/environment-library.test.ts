/**
 * Sprint 10V — Environment Library port. `resolveEnvironmentAsset()`/`isEnvironmentSlug()` must
 * read design/creative/governance/creative/ENVIRONMENT-LIBRARY.md (mirrored into
 * resources/design_processes/creative/) through the existing reference-loading boundary, and
 * must resolve the seven governed slugs to their REAL, authoritative asset files under
 * design/website/brand-pack/assets/imagery/environments/ — never a copy, never a second asset
 * repository.
 *
 * What this port can determine deterministically: whether a value is one of the seven governed
 * environment slugs, and where its real asset file lives. What it cannot determine (see
 * ENVIRONMENT-LIBRARY.md "Current selection status" / "Non-goals"): WHICH of the seven a given
 * creative should use — that is belief-semantic judgment, explicitly out of scope for this sprint.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import {
  isEnvironmentSlug,
  loadEnvironmentLibrary,
  resolveEnvironmentAsset,
  environmentAssetsDir,
  type EnvironmentSlug,
} from '../src/environment-library.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/environment-library.ts', import.meta.url));

// The exact, documented seven-value vocabulary, from HANDOFF-v2.md's Decision-Record / log-line
// field format (`env=<cliffside-muted|dawn-haze|lake-mirror|massif-banded|massif-clear|
// ridges-distant|valley-deep>`). Preserved exactly — not alphabetized, not reordered.
const ALL_ENVIRONMENTS: EnvironmentSlug[] = [
  'cliffside-muted',
  'dawn-haze',
  'lake-mirror',
  'massif-banded',
  'massif-clear',
  'ridges-distant',
  'valley-deep',
];

describe('isEnvironmentSlug — all seven documented values', () => {
  for (const slug of ALL_ENVIRONMENTS) {
    it(`recognizes "${slug}" as a governed environment slug`, () => {
      expect(isEnvironmentSlug(slug)).toBe(true);
    });
  }

  it('rejects an unrecognized value', () => {
    expect(isEnvironmentSlug('factory')).toBe(false);
    expect(isEnvironmentSlug('dawn')).toBe(false);
    expect(isEnvironmentSlug('')).toBe(false);
  });

  it('is case-sensitive — no fuzzy or normalized matching is invented', () => {
    expect(isEnvironmentSlug('Dawn-Haze')).toBe(false);
    expect(isEnvironmentSlug('DAWN-HAZE')).toBe(false);
  });
});

describe('resolveEnvironmentAsset — real asset resolution for all seven', () => {
  for (const slug of ALL_ENVIRONMENTS) {
    it(`resolves "${slug}" to its real, existing asset file`, () => {
      const resolved = resolveEnvironmentAsset(slug);
      expect(resolved).toBeDefined();
      expect(existsSync(resolved as string)).toBe(true);
    });

    it(`"${slug}" resolves to the exact governed filename`, () => {
      const resolved = resolveEnvironmentAsset(slug);
      expect(basename(resolved as string)).toBe(`env-${slug}.jpg`);
    });
  }

  it('rejects an unknown slug — never resolves a fabricated path', () => {
    expect(resolveEnvironmentAsset('factory')).toBeUndefined();
    expect(resolveEnvironmentAsset('not-a-real-environment')).toBeUndefined();
  });

  it('rejects an empty string, never throws', () => {
    expect(() => resolveEnvironmentAsset('')).not.toThrow();
    expect(resolveEnvironmentAsset('')).toBeUndefined();
  });

  it('is deterministic — repeated resolution of the same slug returns the same path', () => {
    const first = resolveEnvironmentAsset('dawn-haze');
    const second = resolveEnvironmentAsset('dawn-haze');
    expect(first).toBe(second);
  });
});

describe('environmentAssetsDir — the authoritative, portable asset directory', () => {
  it('resolves to resources/design_processes/website/assets/imagery/environments, computed not hardcoded', () => {
    const dir = environmentAssetsDir();
    expect(dir.replace(/\\/g, '/')).toMatch(
      /resources\/design_processes\/website\/assets\/imagery\/environments$/,
    );
  });

  it('the directory actually exists and contains all seven real asset files', () => {
    const dir = environmentAssetsDir();
    expect(existsSync(dir)).toBe(true);
    for (const slug of ALL_ENVIRONMENTS) {
      expect(existsSync(resolveEnvironmentAsset(slug) as string)).toBe(true);
    }
  });
});

describe('loadEnvironmentLibrary — the reference document is actually loaded', () => {
  it('returns real content naming the Environment Library and all seven slugs', () => {
    const doc = loadEnvironmentLibrary();
    expect(doc.length).toBeGreaterThan(0);
    expect(doc).toContain('Environment Library');
    for (const slug of ALL_ENVIRONMENTS) {
      expect(doc).toContain(slug);
    }
  });

  it('the loaded document states selection is not implemented', () => {
    const doc = loadEnvironmentLibrary();
    expect(doc).toMatch(/Selection is NOT implemented/);
  });
});

describe('environment-library.ts — the document is the source of truth, not a second hardcoded table', () => {
  it('the implementation source file does not embed the Environment Law prose', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/MAY NOT independently/i);
    expect(src).not.toMatch(/still-full-bleed field/i);
  });

  it('the implementation source file does not embed the vocabulary markdown table', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/\|\s*`cliffside-muted`\s*\|/i);
    expect(src).not.toMatch(/EnvironmentSlug.*Asset filename/s);
  });

  it('the implementation source file contains no client-specific string', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('example-brand');
    expect(src.toLowerCase()).not.toContain('apa');
  });
});

describe('environment-library.ts — no selection function of any kind', () => {
  it('exports no selectEnvironment, and no belief/feature/camera/section-based selector', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/selectEnvironment/);
    expect(src).not.toMatch(/function\s+\w*[Ss]elect\w*Environment/);
  });
});

describe('environment-library.ts — Material Boundary (Phase 12)', () => {
  it('does not reference Material, glass, shadow, radius, or surface-recipe vocabulary', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('material');
    expect(src.toLowerCase()).not.toContain('glass');
    expect(src.toLowerCase()).not.toContain('shadow');
    expect(src.toLowerCase()).not.toContain('radius');
    expect(src.toLowerCase()).not.toContain('recipe');
  });
});

describe('environment-library.ts — portability', () => {
  it('contains no absolute Windows drive-letter path literal', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/["'`][A-Za-z]:[\\/]/);
  });

  it('contains no reference to the external Creative Generation engine or backups path', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/Offscript-creatives-generation/i);
    expect(src).not.toMatch(/Backups-Stacks/i);
  });
});
