import { describe, it, expect } from 'vitest';
import { RenderRuntime, A4_VIEWPORT, canLaunchRuntime } from '../../src/render-runtime.js';

// ──────────────────────── static branch (always runs) ────────────────────────

describe('A4_VIEWPORT (static)', () => {
  it('A4_VIEWPORT is 794x1123', () => {
    expect(A4_VIEWPORT).toEqual({ width: 794, height: 1123 });
  });
});

// ──────────────────── env-gate-on branch (skipped without Chromium) ───────────

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)('A4 render — gate ON (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)', () => {
  it('measures per-.cr-page block heights under print media', async () => {
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const probe = await rt.loadHtmlForPrint(
        `<main class="cr-doc"><section class="cr-page" style="height:200px">a</section><section class="cr-page" style="height:200px">b</section></main>`,
      );
      expect(probe.pages.length).toBe(2);
      expect(probe.contentHeightPx).toBeGreaterThan(900);
    } finally {
      await rt.close();
    }
  }, 30_000);
});
