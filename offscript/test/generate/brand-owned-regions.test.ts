/**
 * P42 — Website Brand-Owned Regions (RED-first).
 *
 * Transport-only foundation: a typed, hand-authored, frozen declaration of which regions in
 * which vendored website exemplar fragments are Example Brand's own house identity (P41's
 * evidence), as opposed to reusable structure. NOTHING consumes this module yet — this test
 * only proves the data is well-formed and stays in sync with the corpus on disk (fragmentId
 * existence only, never content — no runtime HTML parsing here or in the module itself).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  BRAND_OWNED_REGIONS,
  brandOwnedRegionsFor,
  type BrandOwnedRegion,
} from '../../src/generate/brand-owned-regions.js';
import { exemplarSectionPath } from '../../src/generate/reconstruct-band.js';

describe('BRAND_OWNED_REGIONS — well-formed, corpus-aligned data', () => {
  it('every fragmentId matches a real exemplar file on disk', () => {
    for (const entry of BRAND_OWNED_REGIONS) {
      expect(existsSync(exemplarSectionPath(entry.fragmentId))).toBe(true);
    }
  });

  it('has no duplicate fragmentId entries', () => {
    const ids = BRAND_OWNED_REGIONS.map((e) => e.fragmentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fragment declares at least one region', () => {
    for (const entry of BRAND_OWNED_REGIONS) {
      expect(entry.regions.length).toBeGreaterThan(0);
    }
  });

  it('every region carries a selector or a textAnchor (never neither)', () => {
    const allRegions: BrandOwnedRegion[] = BRAND_OWNED_REGIONS.flatMap((e) => e.regions);
    for (const r of allRegions) {
      expect(Boolean(r.selector) || Boolean(r.textAnchor)).toBe(true);
    }
  });

  it('every region carries a non-empty human-readable description', () => {
    for (const entry of BRAND_OWNED_REGIONS) {
      for (const r of entry.regions) {
        expect(r.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the P41-evidenced fragments (hero/nav/footer/comparison families)', () => {
    const ids = new Set(BRAND_OWNED_REGIONS.map((e) => e.fragmentId));
    for (const expected of ['hero-bento', 'nav', 'footer-cta', 'footer-dark', 'comparison']) {
      expect(ids.has(expected)).toBe(true);
    }
  });
});

describe('brandOwnedRegionsFor', () => {
  it('returns the declared regions for a known fragment', () => {
    const regions = brandOwnedRegionsFor('hero-bento');
    expect(regions).toBeDefined();
    expect(regions!.some((r) => r.kind === 'logo')).toBe(true);
  });

  it('returns undefined for a fragment with no declared brand-owned region', () => {
    expect(brandOwnedRegionsFor('stat-cards')).toBeUndefined();
  });

  it('returns undefined for an unknown slug', () => {
    expect(brandOwnedRegionsFor('not-a-real-fragment')).toBeUndefined();
  });
});
