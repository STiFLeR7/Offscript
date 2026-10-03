import { describe, it, expect } from 'vitest';
import {
  buildWebsiteFillFindings,
  DEFAULT_WEBSITE_FILL_THRESHOLDS,
  type WebsiteFillRow,
} from '../../src/operators/render/website-fill-focal.js';
import { renderOperators } from '../../src/operators/render/index.js';

function row(p: Partial<WebsiteFillRow>): WebsiteFillRow {
  return { index: 0, anchor: 's1', fillPct: 90, focalRatio: 2.5, ...p };
}

describe('buildWebsiteFillFindings (pure)', () => {
  it('escalates a sparse band', () => {
    const f = buildWebsiteFillFindings([row({ anchor: 'thin', fillPct: 30 })]);
    const u = f.find((x) => x.id === 'website-fill-focal:sparse:thin');
    expect(u?.outcome).toBe('escalated');
  });
  it('does NOT flag a well-filled band', () => {
    expect(buildWebsiteFillFindings([row({ fillPct: 92 })]).some((x) => x.id.startsWith('website-fill-focal:sparse:'))).toBe(false);
  });
  it('escalates a band with no focal dominance', () => {
    const f = buildWebsiteFillFindings([row({ anchor: 'flat', focalRatio: 1.05 })]);
    expect(f.some((x) => x.id === 'website-fill-focal:no-focal:flat' && x.outcome === 'escalated')).toBe(true);
  });
  it('does NOT flag a band with a clear focal element', () => {
    expect(buildWebsiteFillFindings([row({ focalRatio: 3 })]).some((x) => x.id.startsWith('website-fill-focal:no-focal:'))).toBe(false);
  });
  it('does NOT flag no-focal when the probe sentinel (single-child) is set', () => {
    expect(buildWebsiteFillFindings([row({ focalRatio: 999 })]).some((x) => x.id.startsWith('website-fill-focal:no-focal:'))).toBe(false);
  });
  it('does NOT flag at exactly the focal threshold (boundary)', () => {
    expect(buildWebsiteFillFindings([row({ focalRatio: DEFAULT_WEBSITE_FILL_THRESHOLDS.minFocalRatio })]).some((x) => x.id.startsWith('website-fill-focal:no-focal:'))).toBe(false);
  });
  it('thresholds are website-owned numerics (no A4 mm)', () => {
    expect(DEFAULT_WEBSITE_FILL_THRESHOLDS.minFillPct).toBeGreaterThan(0);
    expect(DEFAULT_WEBSITE_FILL_THRESHOLDS.minFocalRatio).toBeGreaterThan(1);
  });
});

describe('website-fill-focal — wiring', () => {
  it('is appended to renderOperators', () => {
    expect(renderOperators.some((o) => o.name === 'website-fill-focal')).toBe(true);
  });
});
