import { describe, it, expect } from 'vitest';
import { parseWebsiteNumerics, loadWebsiteNumerics, websiteNumericsPath } from '../../src/generate/website-numerics.js';

const GOOD = `# x
| key               | value |
|-------------------|-------|
| minFillPct        | 55    |
| minFocalRatio     | 1.4   |
| minBandsForRhythm | 4     |
`;

describe('website-numerics parser (D)', () => {
  it('parses the key→value table', () => {
    expect(parseWebsiteNumerics(GOOD)).toEqual({ minFillPct: 55, minFocalRatio: 1.4, minBandsForRhythm: 4 });
  });

  it('throws on a missing required key', () => {
    expect(() => parseWebsiteNumerics('| key | value |\n|---|---|\n| minFillPct | 55 |\n')).toThrow(/minFocalRatio/);
  });

  it('throws on a non-finite value', () => {
    expect(() => parseWebsiteNumerics('| key | value |\n|---|---|\n| minFillPct | x |\n| minFocalRatio | 1.4 |\n')).toThrow(/minFillPct/);
  });

  it('loads the real governance file (fail-loud smoke)', () => {
    const n = loadWebsiteNumerics();
    expect(n.minFillPct).toBeGreaterThan(0);
    expect(n.minFocalRatio).toBeGreaterThan(1);
  });

  it('resolves a numerics path under the website rulebooks dir', () => {
    expect(websiteNumericsPath().replace(/\\/g, '/')).toMatch(/website\/rulebooks\/numerics\.md$/);
  });

  it('throws on a blank value cell (does not silently coerce to 0)', () => {
    expect(() => parseWebsiteNumerics('| key | value |\n|---|---|\n| minFillPct |  |\n| minFocalRatio | 1.4 |\n')).toThrow(/empty value/);
  });

  it('throws on a non-decimal value (hex/exponent/binary rejected)', () => {
    expect(() => parseWebsiteNumerics('| key | value |\n|---|---|\n| minFillPct | 0x37 |\n| minFocalRatio | 1.4 |\n')).toThrow(/plain decimal/);
  });

  it('resolves backtick-wrapped keys', () => {
    expect(parseWebsiteNumerics('| key | value |\n|---|---|\n| ' + '`minFillPct`' + ' | 55 |\n| minFocalRatio | 1.4 |\n| minBandsForRhythm | 4 |\n')).toEqual({ minFillPct: 55, minFocalRatio: 1.4, minBandsForRhythm: 4 });
  });
});

describe('website-numerics minBandsForRhythm', () => {
  it('parses the new governance key', () => {
    expect(loadWebsiteNumerics().minBandsForRhythm).toBeGreaterThan(0);
  });
});
