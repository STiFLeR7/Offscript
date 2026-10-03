/**
 * Sprint W16 — Goal 1: explicit, deterministic realization routing switch.
 *
 * The scripted author is retained as deterministic infrastructure (CI, regression, offline,
 * byte-identical verification). The subagent (LLM) author is the production-quality realization
 * path. It is selected ONLY when governed reasoning is ENABLED for the run AND a production author
 * is available. Otherwise the scripted double runs — so the disabled default stays byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { selectRealizationAuthor } from '../../src/generate/realization-routing.js';

describe('W16 — realization routing switch', () => {
  it('governance disabled → scripted (even when a production author is available)', () => {
    expect(selectRealizationAuthor({ governanceEnabled: false, productionAuthorAvailable: true })).toBe('scripted');
    expect(selectRealizationAuthor({ governanceEnabled: false, productionAuthorAvailable: false })).toBe('scripted');
  });

  it('governance enabled but no production author → scripted (byte-identical infra path)', () => {
    expect(selectRealizationAuthor({ governanceEnabled: true, productionAuthorAvailable: false })).toBe('scripted');
  });

  it('governance enabled AND production author available → subagent (the only production-quality path)', () => {
    expect(selectRealizationAuthor({ governanceEnabled: true, productionAuthorAvailable: true })).toBe('subagent');
  });

  it('is a pure function of its two inputs (deterministic)', () => {
    const a = selectRealizationAuthor({ governanceEnabled: true, productionAuthorAvailable: true });
    const b = selectRealizationAuthor({ governanceEnabled: true, productionAuthorAvailable: true });
    expect(a).toBe(b);
  });
});
