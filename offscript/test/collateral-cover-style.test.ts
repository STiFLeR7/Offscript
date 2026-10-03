import { describe, it, expect } from 'vitest';
import { buildCollateralCoverStyle } from '../src/generate/author.js';
import { buildContext } from '../src/generate/context.js';

describe('buildCollateralCoverStyle', () => {
  it('inlines the governed cover photo + navy scrim on the cover selector', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const warnings: string[] = [];
    const css = buildCollateralCoverStyle(ctx, warnings);
    expect(css).toContain('.cr-page--dark.cr-page--bleed');
    expect(css).toContain('data:image/jpeg;base64,');
    expect(css).toContain('linear-gradient'); // the navy scrim
    expect(css).toContain('background-size: cover');
    expect(warnings).toHaveLength(0);
  });
});
