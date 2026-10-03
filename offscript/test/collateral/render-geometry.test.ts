import { describe, it, expect } from 'vitest';
import { RenderRuntime, A4_VIEWPORT } from '../../src/render-runtime.js';
import { detectA4BoundsAsync } from '../../src/operators/collateral/render/a4-bounds.js';
import { detectTextOverlapAsync } from '../../src/operators/collateral/render/text-overlap.js';
import { detectPageWrapAsync } from '../../src/operators/collateral/render/page-wrap.js';
import { parseHtml } from '../../src/working-rep.js';

// ──────────────────── env-gate-on branch (skipped without Chromium) ───────────

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)('A4 geometric rails (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)', () => {
  it('flags content past the A4 page box', async () => {
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const html = `<main class="cr-doc"><section class="cr-page" style="padding:60px"><div style="width:900px;height:50px">wide</div></section></main>`;
      const rc = await rt.loadHtml(html);
      const f = await detectA4BoundsAsync(rc, parseHtml(html));
      expect(f.some((x) => x.id.includes('overflow'))).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags sub-floor body text (10px, not eyebrow)', async () => {
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const html = `<main class="cr-doc"><section class="cr-page"><p style="font-size:10px">tiny</p></section></main>`;
      const rc = await rt.loadHtml(html);
      const f = await detectA4BoundsAsync(rc, parseHtml(html));
      expect(f.some((x) => x.id.includes('text-floor'))).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags overlapping text elements within a page', async () => {
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const html = `<main class="cr-doc"><section class="cr-page" style="position:relative"><p style="position:absolute;top:20px;left:20px">alpha text here</p><p style="position:absolute;top:24px;left:24px">beta text here</p></section></main>`;
      const rc = await rt.loadHtml(html);
      const f = await detectTextOverlapAsync(rc, parseHtml(html));
      expect(f.some((x) => x.id.startsWith('text-overlap:'))).toBe(true);
      expect(f.every((x) => x.outcome === 'escalated')).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags a .cr-page taller than one A4 sheet', async () => {
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const html = `<main class="cr-doc"><section class="cr-page" style="height:1600px">tall</section></main>`;
      const f = await detectPageWrapAsync(rt, html);
      expect(f.some((x) => x.id.includes('page-wrap'))).toBe(true);
    } finally {
      await rt.close();
    }
  });
});
