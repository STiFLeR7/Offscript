import { describe, it, expect } from 'vitest';
import {
  renderVisibilityFloor,
  detectVisibilityFloorAsync,
} from '../../../src/operators/render/render-visibility-floor.js';
import { parseHtml } from '../../../src/working-rep.js';
import { RenderRuntime } from '../../../src/render-runtime.js';

describe('render-visibility-floor — sync Operator contract + no-runtime path', () => {
  it('declares the canonical Operator shape (name + tier 1 + detect + apply)', () => {
    expect(renderVisibilityFloor.name).toBe('render-visibility-floor');
    expect(renderVisibilityFloor.tier).toBe(1);
    expect(typeof renderVisibilityFloor.detect).toBe('function');
    expect(typeof renderVisibilityFloor.apply).toBe('function');
  });

  it('sync detect returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body><p>hi</p></body></html>');
    expect(renderVisibilityFloor.detect(tree, { params: {} })).toEqual([]);
  });

  it('sync apply returns [] (warn-only rail — no remediation)', () => {
    const tree = parseHtml('<!doctype html><html><body><p>hi</p></body></html>');
    expect(renderVisibilityFloor.apply(tree, { params: {} })).toEqual([]);
  });

  it('async detect returns [] when no RenderContext is provided (graceful degrade)', async () => {
    const tree = parseHtml('<!doctype html><html><body><p>hi</p></body></html>');
    expect(await detectVisibilityFloorAsync(undefined, tree)).toEqual([]);
  });
});

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'render-visibility-floor — gate ON (real Chromium probe)',
  () => {
    /** Black on white — wide luminance delta. No findings. */
    const CLEAN_HTML = `<!doctype html><html><head></head><body style="background:#ffffff; color:#000000;">
      <p>readable copy</p>
      <div><span>nested span</span></div>
    </body></html>`;

    /** White text on white background — luminance delta zero. One finding. */
    const INVISIBLE_HTML = `<!doctype html><html><head></head><body style="background:#ffffff;">
      <p style="color:#ffffff;">invisible paragraph</p>
      <p style="color:#000000;">visible paragraph</p>
    </body></html>`;

    /**
     * Token-on-token same-surface collapse: a container declares a colour
     * that — through inheritance — equals the visible background. Mirrors
     * the bug class the rail is built for.
     */
    const TOKEN_COLLAPSE_HTML = `<!doctype html><html><head>
      <style>
        :root { --surface-0: #1a1a1a; }
        body { background: var(--surface-0); color: var(--surface-0); }
      </style>
    </head><body>
      <p>same on same — invisible</p>
    </body></html>`;

    it('reports nothing for a clean doc (high luminance delta everywhere)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(CLEAN_HTML);
        const tree = parseHtml(CLEAN_HTML);
        expect(await detectVisibilityFloorAsync(ctx, tree)).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('flags white-on-white text as an escalation (one finding for the invisible paragraph)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(INVISIBLE_HTML);
        const tree = parseHtml(INVISIBLE_HTML);
        const findings = await detectVisibilityFloorAsync(ctx, tree);
        expect(findings.length).toBe(1);
        expect(findings[0].outcome).toBe('escalated');
        expect(findings[0].description).toMatch(/invisible paragraph/);
        expect(findings[0].description).toMatch(/luminance delta 0/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    /**
     * White text on the charter's sanctioned dark GRADIENT surface (and over a
     * translucent veil). The painted backing is indeterminate from computed
     * style (a gradient reads as a transparent backgroundColor; a translucent
     * veil composites over it), so the rail must NOT fall back to the white page
     * default and false-flag visible white-on-dark text. Regression for the 25
     * gradient false-positives the cr-web lock run surfaced.
     */
    const GRADIENT_DARK_HTML = `<!doctype html><html><head></head><body style="background:#ffffff;">
      <section style="background:linear-gradient(160deg,#0a0e1a,#1a0b2e);">
        <h1 style="color:#ffffff;">Visible white headline on a dark gradient</h1>
        <div style="background:rgba(255,255,255,0.06);">
          <p style="color:#ffffff;">white text over a faint translucent veil</p>
        </div>
      </section>
    </body></html>`;

    it('does NOT flag white text on a dark gradient / translucent veil (indeterminate backing → skip)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(GRADIENT_DARK_HTML);
        const tree = parseHtml(GRADIENT_DARK_HTML);
        expect(await detectVisibilityFloorAsync(ctx, tree)).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('flags token-on-token collapse (the rail’s motivating case)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(TOKEN_COLLAPSE_HTML);
        const tree = parseHtml(TOKEN_COLLAPSE_HTML);
        const findings = await detectVisibilityFloorAsync(ctx, tree);
        expect(findings.length).toBeGreaterThanOrEqual(1);
        expect(findings[0].outcome).toBe('escalated');
        expect(findings[0].description).toMatch(/same on same/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('is idempotent: a second probe over the same doc returns the same findings', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(INVISIBLE_HTML);
        const tree = parseHtml(INVISIBLE_HTML);
        const a = await detectVisibilityFloorAsync(ctx, tree);
        const b = await detectVisibilityFloorAsync(ctx, tree);
        expect(b).toEqual(a);
      } finally {
        await rt.close();
      }
    }, 30_000);
  },
);
