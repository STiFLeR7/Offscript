/**
 * P24 — Content Contract v2 Foundation: plan.ts's contentCapacity TRANSPORT wiring (RED-first).
 *
 * Proof strategy mirrors W53's plan-presentation-intent-consumption.test.ts exactly: since NO real
 * repository component authors `## Content Capacity` yet (corpus authoring is deferred, out of this
 * sprint's scope), a passive run against the real corpus can only ever observe `undefined` — which
 * cannot distinguish "wiring exists and correctly finds nothing" from "wiring was never built". A
 * scoped mock of `createContentCapacityProvider` injects a FABRICATED capacity object so the test
 * can observe the wiring site actually call the provider and assign its result, keyed on the
 * selected component, gated by the flag, and absent on collateral.
 *
 * Scoped to this file only (vi.mock is file-local) so plan.test.ts's own P24 transport tests —
 * which assert contentCapacity stays undefined against REAL (un-authored) content — are untouched.
 */
import { describe, it, expect, vi } from 'vitest';

const FABRICATED = Object.freeze({
  slots: Object.freeze([Object.freeze({ name: 'headline', shape: 'heading', required: true, min: 1, max: 1 })]),
  digest: 'p24-fabricated-fixture',
  sourceFile: 'fabricated',
});

vi.mock('../../src/generate/content-capacity.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createContentCapacityProvider: () => ({
      capacityFor: () => FABRICATED,
    }),
  };
});

const { plan } = await import('../../src/generate/plan.js');
const { buildContext } = await import('../../src/generate/context.js');

describe('P24 — plan.ts contentCapacity wiring (proven via a fabricated provider)', () => {
  it('enabled: every website item that has a selected component receives the FABRICATED capacity, verbatim', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx, { contentCapacity: true });
    const withSlug = p.items.filter((i) => i.fragmentId ?? i.componentVariant);
    expect(withSlug.length).toBeGreaterThan(0);
    for (const item of withSlug) {
      expect(item.contentCapacity).toEqual(FABRICATED);
    }
  });

  it('disabled (default): the provider is never consulted — no item carries the fabricated value even though the mock would return it if called', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    for (const item of p.items) {
      expect(item.contentCapacity).toBeUndefined();
    }
  });

  it('never attached on the collateral track, even when the flag is enabled', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx, { contentCapacity: true });
    for (const item of p.items) {
      expect(item.contentCapacity).toBeUndefined();
    }
  });
});
