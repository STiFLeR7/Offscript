/**
 * Sprint W60 — Governed Default Activation.
 *
 * Extends the SAME precedence rule `realization-routing.ts` already uses for author selection
 * (governance-pack presence is the default signal; an explicit env var always overrides) to the
 * W19/W24/W30 selection consumers. Pure function, no env reads.
 */
import { describe, it, expect } from 'vitest';
import { resolveGovernedActivation } from '../../src/generate/governed-activation.js';

describe('resolveGovernedActivation', () => {
  it('defaults to ON when governance is enabled and the env var is unset', () => {
    expect(resolveGovernedActivation(undefined, true)).toBe(true);
  });

  it('defaults to OFF when governance is disabled and the env var is unset (byte-identical baseline)', () => {
    expect(resolveGovernedActivation(undefined, false)).toBe(false);
  });

  it('an explicit "1" overrides ON even when governance is disabled', () => {
    expect(resolveGovernedActivation('1', false)).toBe(true);
  });

  it('an explicit "0" overrides OFF even when governance is enabled', () => {
    expect(resolveGovernedActivation('0', true)).toBe(false);
  });

  it('any explicitly-set non-"1" value overrides OFF even when governance is enabled (preserves the historical strict-equality gate semantics)', () => {
    expect(resolveGovernedActivation('true', true)).toBe(false);
    expect(resolveGovernedActivation('yes', true)).toBe(false);
    expect(resolveGovernedActivation('', true)).toBe(false);
  });

  it('an explicit "1" is still ON when governance is also enabled (no conflict, same result either way)', () => {
    expect(resolveGovernedActivation('1', true)).toBe(true);
  });
});

// ── W63 — Presentation Cadence & Presentation Intent reuse this SAME resolver ────────────────────
// No second resolver was written for these two consumers; this guards against one ever being added.
describe('W63 — no duplicated activation logic', () => {
  it('the module exposes exactly one activation resolver', async () => {
    const mod = await import('../../src/generate/governed-activation.js');
    expect(Object.keys(mod)).toEqual(['resolveGovernedActivation']);
  });
});
