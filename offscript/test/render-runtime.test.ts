import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RenderRuntime, canLaunchRuntime, DEFAULT_VIEWPORT } from '../src/render-runtime.js';

// ──────────────────────── env-gate-off branch (always runs) ────────────────────────

describe('canLaunchRuntime + RenderRuntime.launch — env gate off', () => {
  const originalEnv = process.env.OFFSCRIPT_PLAYWRIGHT;
  beforeEach(() => {
    delete process.env.OFFSCRIPT_PLAYWRIGHT;
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OFFSCRIPT_PLAYWRIGHT;
    else process.env.OFFSCRIPT_PLAYWRIGHT = originalEnv;
  });

  it('canLaunchRuntime returns false when OFFSCRIPT_PLAYWRIGHT is not set', async () => {
    expect(await canLaunchRuntime()).toBe(false);
  });

  it('RenderRuntime.launch throws a clear error when the env gate is off', async () => {
    await expect(RenderRuntime.launch()).rejects.toThrow(/OFFSCRIPT_PLAYWRIGHT/);
  });

  it('exports a desktop-first default viewport (1440x900)', () => {
    expect(DEFAULT_VIEWPORT).toEqual({ width: 1440, height: 900 });
  });
});

// ──────────────────────── env-gate-on branch (skipped without Chromium) ───────────

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'RenderRuntime — gate ON (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)',
  () => {
    const HTML = `<!doctype html><html><body>
      <div id="hero" style="width:600px;height:400px;background:red;">
        <span class="badge" style="color:#fff;background:#000;">x</span>
      </div>
    </body></html>`;

    it('launches once, loads HTML, measures bounds + computed style, closes cleanly', async () => {
      const rt = await RenderRuntime.launch();
      try {
        expect(rt.viewport).toEqual({ width: 1440, height: 900 });
        const ctx = await rt.loadHtml(HTML);
        const bounds = await ctx.measureBounds('#hero');
        expect(bounds).not.toBeNull();
        expect(bounds!.width).toBe(600);
        expect(bounds!.height).toBe(400);
        const style = await ctx.computedStyle('#hero');
        expect(style).not.toBeNull();
        expect(style!.backgroundColor).toMatch(/rgb\(255,?\s*0,?\s*0\)/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('returns null from measureBounds / computedStyle on no-match (never throws)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(HTML);
        expect(await ctx.measureBounds('.does-not-exist')).toBeNull();
        expect(await ctx.computedStyle('.does-not-exist')).toBeNull();
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('loadHtml twice produces two independent contexts (both queryable until close)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const a = await rt.loadHtml('<html><body><div id="a" style="width:100px;height:50px"></div></body></html>');
        const b = await rt.loadHtml('<html><body><div id="b" style="width:200px;height:80px"></div></body></html>');
        expect(rt.pageCount).toBe(2);
        const ab = await a.measureBounds('#a');
        const bb = await b.measureBounds('#b');
        expect(ab!.width).toBe(100);
        expect(bb!.width).toBe(200);
        // cross-contamination check: querying #b in `a` returns null
        expect(await a.measureBounds('#b')).toBeNull();
        expect(await b.measureBounds('#a')).toBeNull();
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('probe<T>(fn) is the escape hatch for richer page-side computation', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(HTML);
        const heroWidth = await ctx.probe<number>(
          `(function(){ var el = document.getElementById('hero'); return el ? el.getBoundingClientRect().width : -1; })()`,
        );
        expect(heroWidth).toBe(600);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('canLaunchRuntime returns true when env is on AND playwright is importable', async () => {
      expect(await canLaunchRuntime()).toBe(true);
    });
  },
);
