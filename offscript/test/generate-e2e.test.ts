/**
 * Phase 6A — Guarded end-to-end smoke: generate pipeline per buildable track.
 *
 * Gate: OFFSCRIPT_PLAYWRIGHT=1 (same idiom as all render-gated tests in this repo).
 *   - Default `npx vitest run` → skips cleanly (no Playwright required).
 *   - `npm run test:render` (POSIX) / `$env:OFFSCRIPT_PLAYWRIGHT='1'; npx vitest run` (PowerShell)
 *     → runs both tracks end-to-end with render rails active.
 *
 * Coverage (smoke-level — pipeline completes + self-contained + scored):
 *   website   buildContext → plan → authorDocument → validate:
 *               - html produced, no relative url("fonts/ refs (self-contained)
 *               - RunScore with buckets.total ≥ 1 (rails fired)
 *   collateral same pipeline with track='collateral':
 *               - isCollateral(html) === true
 *               - RunScore with buckets.total ≥ 1 (static rails fired)
 *
 * NOTE: collateral render rails are NOT folded into generate-validate on the
 * collateral path (see TODO in src/generate/validate.ts §112–123). Gate-on
 * for collateral exercises static rails only — that is correct, not a gap.
 * Website render rails (render-shorthand-sanity, render-overflow-bounds,
 * render-visibility-floor) DO run under the gate on the website path.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import { validate } from '../src/generate/validate.js';
import { isCollateral } from '../src/collateral/intake.js';

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'generate e2e smoke — gate ON (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)',
  () => {
    // ── website ──────────────────────────────────────────────────────────────

    it(
      'website: pipeline completes, self-contained, scored (render rails active)',
      async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'offscript-e2e-website-'));
        try {
          const ctx = buildContext('example-brand', 'website');
          const p = plan(ctx);
          const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

          // Self-contained: no surviving relative url("fonts/ refs
          expect(html).not.toMatch(/url\(\s*["']?fonts\//);
          expect(html).not.toMatch(/url\(\s*["']?\.{1,2}\//);

          // Score: validate runs rails (including render rails under the gate)
          const result = await validate(html, ctx, { outDir });

          // Rails fired — at least one finding (not vacuous)
          expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);

          // Score is a valid ratio
          expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
          expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
      60_000,
    );

    // ── collateral ───────────────────────────────────────────────────────────

    it(
      'collateral: pipeline completes, isCollateral true, scored (static rails)',
      async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'offscript-e2e-collateral-'));
        try {
          const ctx = buildContext('example-brand', 'collateral');
          const p = plan(ctx);
          const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

          // Collateral marker present
          expect(isCollateral(html)).toBe(true);

          // Self-contained: no surviving relative url("fonts/ refs
          expect(html).not.toMatch(/url\(\s*["']?fonts\//);
          expect(html).not.toMatch(/url\(\s*["']?\.{1,2}\//);

          // Score: static rails ran, at least one finding
          const result = await validate(html, ctx, { outDir });
          expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);
          expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
          expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
      60_000,
    );
  },
);
