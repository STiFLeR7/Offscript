import { describe, expect, it } from 'vitest';
import { defaultBriefSources } from '../../src/project/creative-director.js';

describe('bundled brief sources', () => {
  it('does not register sources backed by removed external adapter packages', () => {
    expect(defaultBriefSources().map((source) => source.id)).toEqual(['manual']);
  });
});
