import { describe, it, expect } from 'vitest';
import { assignComposition, buildAuthorContract } from '../src/generate/author-contract.js';
import { buildContext } from '../src/generate/context.js';

describe('Fix A contract wording', () => {
  it('CoverPage instruction states the engine paints the cover photo', () => {
    const cover = assignComposition('CoverPage', 0, 'collateral');
    expect(cover).toMatch(/engine paints the governed cover photo/i);
  });

  it('website contract permits a governance-listed image request and names imagery.md', () => {
    const context = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(context);
    expect(contract).toMatch(/imagery\.md/);
    expect(contract).toMatch(/MAY request a governance-listed image/i);
    // collateral interiors stay photo-free wording survives:
    expect(contract).toMatch(/collateral interiors stay\s+photo-free/i);
  });

  it('website contract no longer bans <img> as "not yet inlined"', () => {
    const context = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(context);
    expect(contract).not.toMatch(/not yet inlined/i);
  });
});
