import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveFillThresholds, DEFAULT_WEBSITE_FILL_THRESHOLDS } from '../../src/operators/render/website-fill-focal.js';
import * as numerics from '../../src/generate/website-numerics.js';

describe('resolveFillThresholds (D-wire)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses governance numerics when they load', () => {
    vi.spyOn(numerics, 'loadWebsiteNumerics').mockReturnValue({ minFillPct: 60, minFocalRatio: 1.6 });
    const r = resolveFillThresholds();
    expect(r.thresholds).toEqual({ minFillPct: 60, minFocalRatio: 1.6 });
    expect(r.warning).toBeNull();
  });

  it('degrades to the baked fallback + one warning when numerics throw', () => {
    vi.spyOn(numerics, 'loadWebsiteNumerics').mockImplementation(() => {
      throw new Error('numerics.md not found');
    });
    const r = resolveFillThresholds();
    expect(r.thresholds).toEqual(DEFAULT_WEBSITE_FILL_THRESHOLDS);
    expect(r.warning?.outcome).toBe('warning');
    expect(r.warning?.id).toBe('website-fill-focal:numerics-fallback');
  });

  it('loads the real numerics.md with no warning (production green path)', () => {
    const r = resolveFillThresholds();
    expect(r.warning).toBeNull();
    expect(r.thresholds.minFillPct).toBeGreaterThan(0);
    expect(r.thresholds.minFocalRatio).toBeGreaterThan(1);
  });
});
