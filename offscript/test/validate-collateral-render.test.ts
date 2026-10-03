/**
 * Stage 4 validate.ts — collateral render-rail tests (AP-2).
 *
 * Coverage:
 *  (a) Gate-OFF: with OFFSCRIPT_PLAYWRIGHT unset, collateral still scores from static
 *      rails — no Playwright needed, no crash. Static a4-bounds/text-overlap rails
 *      are present in the collateral registry with zero sync findings (stubs).
 *
 *  (b) Non-vacuous gate-ON (gated on OFFSCRIPT_PLAYWRIGHT=1 + Chromium installed):
 *      A generated collateral artifact containing a DELIBERATE A4 overflow produces
 *      at least one `a4-bounds` escalated finding, frozen to overlay/.
 *      Mirrors the sticky-stack pattern in validate.test.ts (b).
 *
 * The OFFSCRIPT_PLAYWRIGHT gate wraps only the Playwright-dependent tests. The
 * gate-OFF tests always run (they must not require the env var).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate } from '../src/generate/validate.js';
import { buildContext } from '../src/generate/context.js';
import type { DesignContext } from '../src/generate/types.js';

// ── Shared minimal collateral context ────────────────────────────────────────
// Uses the reference defaults (example-brand) which is always present. Collateral track.
function makeCollateralContext(): DesignContext {
  return buildContext('example-brand', 'collateral');
}

// ── (a) Gate-OFF: static rails score, no Playwright needed ───────────────────
//
// A minimal valid-looking collateral HTML (has .cr-doc / .cr-page structure,
// no overflow, no overlaps). Static rails should run; no crash; score.json written.
// This always runs — no OFFSCRIPT_PLAYWRIGHT guard.

describe('validate collateral — gate-OFF static rails', () => {
  it('validate returns a RunScore with systematicRatio in [0,1] (no Playwright)', async () => {
    const ctx = makeCollateralContext();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>:root{--color-bg:#fff}</style></head><body><main class="cr-doc"><section class="cr-page" style="padding:60px"><h1>Title</h1><p>Body text that is well within A4 bounds.</p></section></main></body></html>`;
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-a-'));
    try {
      const result = await validate(html, ctx, { outDir });
      expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
      expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes score.json to outDir (collateral track, no Playwright)', async () => {
    const ctx = makeCollateralContext();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main class="cr-doc"><section class="cr-page"><p>Content</p></section></main></body></html>`;
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-a2-'));
    try {
      await validate(html, ctx, { outDir });
      expect(existsSync(join(outDir, 'score.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('per-rail breakdown contains a4-bounds and text-overlap (collateral registry)', async () => {
    const ctx = makeCollateralContext();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main class="cr-doc"><section class="cr-page"><p>Content</p></section></main></body></html>`;
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-a3-'));
    try {
      const result = await validate(html, ctx, { outDir });
      const names = result.perRail.map((r) => r.operator.name);
      expect(names).toContain('a4-bounds');
      expect(names).toContain('text-overlap');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (b) Gate-ON: deliberate A4 overflow → a4-bounds escalated + frozen ───────
//
// Gated: only run when OFFSCRIPT_PLAYWRIGHT=1 (Chromium must be installed).
// Injects a 900px-wide element inside a .cr-page with 60px padding — well past
// the A4 content box at 794px viewport. This is the same overflow fixture used
// in test/collateral/render-geometry.test.ts, mirrored here at the validate()
// integration level.

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'validate collateral — gate-ON: a4-bounds escalated + frozen (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)',
  () => {
    it(
      'deliberate A4 overflow → a4-bounds escalated finding in perRail',
      async () => {
        const ctx = makeCollateralContext();
        // A 900px element at 60px padding on a 794px-wide A4 viewport overflows
        // the right edge of the 16mm content box (right = 794 - 16*(96/25.4) ≈ 733px).
        const overflowHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>:root{--color-bg:#fff}.cr-page{padding:60px}</style></head><body><main class="cr-doc"><section class="cr-page"><div style="width:900px;height:50px">overflow-trigger</div></section></main></body></html>`;
        const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-b-'));
        try {
          const result = await validate(overflowHtml, ctx, { outDir });
          const a4Rail = result.perRail.find((r) => r.operator.name === 'a4-bounds');
          expect(a4Rail).toBeDefined();
          const escalated = a4Rail!.findings.filter((f) => f.outcome === 'escalated');
          expect(escalated.length).toBeGreaterThan(0);
          // The finding id must include 'overflow' (a4-bounds overflow variant)
          expect(escalated.some((f) => f.id.includes('overflow'))).toBe(true);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
      30_000,
    );

    it(
      'deliberate A4 overflow → escalated findings frozen to overlay/',
      async () => {
        const ctx = makeCollateralContext();
        const overflowHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>:root{--color-bg:#fff}.cr-page{padding:60px}</style></head><body><main class="cr-doc"><section class="cr-page"><div style="width:900px;height:50px">overflow-trigger</div></section></main></body></html>`;
        const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-b2-'));
        try {
          const result = await validate(overflowHtml, ctx, { outDir });
          // frozen[] is non-empty — escalated overflow findings were written to overlay/
          expect(result.frozen.length).toBeGreaterThan(0);
          const overlayDir = join(outDir, 'overlay');
          expect(existsSync(overlayDir)).toBe(true);
          const files = readdirSync(overlayDir).filter((f) => f.endsWith('.json'));
          expect(files.length).toBeGreaterThan(0);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
      30_000,
    );

    it(
      'text-overlap escalated → frozen to overlay/ (deliberate overlapping text)',
      async () => {
        const ctx = makeCollateralContext();
        // Two absolutely-positioned elements overlapping > 2px on both axes.
        const overlapHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>:root{--color-bg:#fff}</style></head><body><main class="cr-doc"><section class="cr-page" style="position:relative"><p style="position:absolute;top:20px;left:20px">alpha text here</p><p style="position:absolute;top:24px;left:24px">beta text here</p></section></main></body></html>`;
        const outDir = mkdtempSync(join(tmpdir(), 'offscript-val-coll-b3-'));
        try {
          const result = await validate(overlapHtml, ctx, { outDir });
          const overlapRail = result.perRail.find((r) => r.operator.name === 'text-overlap');
          expect(overlapRail).toBeDefined();
          const escalated = overlapRail!.findings.filter((f) => f.outcome === 'escalated');
          expect(escalated.length).toBeGreaterThan(0);
          // Findings frozen to overlay/
          expect(result.frozen.length).toBeGreaterThan(0);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
      30_000,
    );
  },
);
