import { describe, it, expect } from 'vitest';
import type { RenderContext } from '../src/render-context.js';
import type { Finding } from '../src/operator.js';
import { safeProbe, collectRail, probeErrorFinding } from '../src/render-probe.js';
import { parseHtml } from '../src/working-rep.js';
import { detectA4BoundsAsync } from '../src/operators/collateral/render/a4-bounds.js';
import { detectVisibilityFloorAsync } from '../src/operators/render/render-visibility-floor.js';

/** Minimal RenderContext whose probe() behaves as supplied; other helpers are stubs. */
function mockRc(probe: (fn: string) => Promise<unknown>): RenderContext {
  return {
    viewport: { width: 800, height: 600 },
    measureBounds: async () => null,
    computedStyle: async () => null,
    probe: probe as RenderContext['probe'],
  };
}

describe('render-probe (I-3: crash isolation)', () => {
  describe('safeProbe', () => {
    it('returns the value on a resolving probe', async () => {
      const rc = mockRc(async () => [1, 2, 3]);
      const res = await safeProbe<number[]>(rc, '(function(){})()', 'a4-bounds');
      expect(res).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it('degrades a rejecting probe to a single probe-error warning', async () => {
      const rc = mockRc(async () => {
        throw new Error('Target page crashed\nstack frame 1\nstack frame 2');
      });
      const res = await safeProbe(rc, '(function(){})()', 'a4-bounds');
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('unreachable');
      expect(res.degrade).toHaveLength(1);
      expect(res.degrade[0]).toEqual<Finding>({
        id: 'a4-bounds:probe-error',
        description: 'a4-bounds render probe failed (Target page crashed) — geometry not verified.',
        outcome: 'warning',
      });
    });
  });

  describe('collectRail', () => {
    it('returns the rail findings when the detector resolves', async () => {
      const findings: Finding[] = [{ id: 'x:1', description: 'd', outcome: 'warning' }];
      const res = await collectRail('render-visibility-floor', async () => findings);
      expect(res).toEqual({ name: 'render-visibility-floor', findings });
    });

    it('isolates a throwing detector to its own probe-error warning', async () => {
      const res = await collectRail('render-visibility-floor', async () => {
        throw new Error('boom');
      });
      expect(res.name).toBe('render-visibility-floor');
      expect(res.findings).toEqual<Finding[]>([
        {
          id: 'render-visibility-floor:probe-error',
          description: 'render-visibility-floor render probe failed (boom) — geometry not verified.',
          outcome: 'warning',
        },
      ]);
    });

    it("one rail's failure does not affect a sibling rail's findings", async () => {
      const ok = await collectRail('rail-a', async () => [
        { id: 'rail-a:hit', description: 'real finding', outcome: 'escalated' as const },
      ]);
      const bad = await collectRail('rail-b', async () => {
        throw new Error('probe died');
      });
      expect(ok.findings[0].id).toBe('rail-a:hit'); // sibling survives intact
      expect(bad.findings[0].id).toBe('rail-b:probe-error');
    });
  });

  // Wiring proof: a real detector with a throwing probe returns a single warning,
  // not a rejection — so one rail's crash can no longer abort the render tier.
  describe('operator-level degrade', () => {
    const throwingRc = mockRc(async () => {
      throw new Error('Target page crashed\nstack');
    });
    const tree = parseHtml('<!doctype html><html><body><p>x</p></body></html>');

    it('detectA4BoundsAsync degrades instead of rejecting', async () => {
      const findings = await detectA4BoundsAsync(throwingRc, tree);
      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe('a4-bounds:probe-error');
      expect(findings[0].outcome).toBe('warning');
    });

    it('detectVisibilityFloorAsync degrades instead of rejecting', async () => {
      const findings = await detectVisibilityFloorAsync(throwingRc, tree);
      expect(findings.map((f) => f.id)).toEqual(['render-visibility-floor:probe-error']);
      expect(findings[0].outcome).toBe('warning');
    });
  });

  describe('probeErrorFinding', () => {
    it('keeps only the first line of the error message', () => {
      const f = probeErrorFinding('deck-body-text-floor', new Error('line1\nline2'));
      expect(f.description).toContain('(line1)');
      expect(f.description).not.toContain('line2');
      expect(f.outcome).toBe('warning');
    });

    it('stringifies a non-Error throw', () => {
      const f = probeErrorFinding('text-overlap', 'plain string failure');
      expect(f.id).toBe('text-overlap:probe-error');
      expect(f.description).toContain('plain string failure');
    });
  });
});
