import { describe, it, expect } from 'vitest';
import {
  renderOverflowBounds,
  detectOverflowBoundsAsync,
  applyOverflowBoundsAsync,
} from '../../../src/operators/render/render-overflow-bounds.js';
import { parseHtml, serializeHtml } from '../../../src/working-rep.js';
import { RenderRuntime } from '../../../src/render-runtime.js';

describe('render-overflow-bounds — sync Operator contract + no-runtime path', () => {
  it('declares the canonical Operator shape (name + tier 1 + detect + apply)', () => {
    expect(renderOverflowBounds.name).toBe('render-overflow-bounds');
    expect(renderOverflowBounds.tier).toBe(1);
    expect(typeof renderOverflowBounds.detect).toBe('function');
    expect(typeof renderOverflowBounds.apply).toBe('function');
  });

  it('sync detect returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body></body></html>');
    expect(renderOverflowBounds.detect(tree, { params: {} })).toEqual([]);
  });

  it('sync apply returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body></body></html>');
    expect(renderOverflowBounds.apply(tree, { params: {} })).toEqual([]);
  });

  it('async detect returns [] when no RenderContext is provided (graceful degrade)', async () => {
    const tree = parseHtml('<!doctype html><html><body></body></html>');
    expect(await detectOverflowBoundsAsync(undefined, tree)).toEqual([]);
  });

  it('async apply returns [] when no RenderContext is provided (graceful degrade)', async () => {
    const tree = parseHtml('<!doctype html><html><body></body></html>');
    expect(await applyOverflowBoundsAsync(undefined, tree)).toEqual([]);
  });
});

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'render-overflow-bounds — gate ON (real Chromium probe)',
  () => {
    /**
     * Clean band: absolute child fits inside positioned ancestor. No bleed.
     */
    const CLEAN_HTML = `<!doctype html><html><head></head><body style="margin:0;">
      <section id="band" style="position:relative; width:800px; height:300px;">
        <div class="blur" style="position:absolute; top:10px; left:10px; width:200px; height:200px; background:blue;"></div>
      </section>
    </body></html>`;

    /**
     * Bleed band (Tier 1): absolute blur bleeds 100px past the band's right
     * edge and the band has the browser-default `overflow: visible` — safe
     * to auto-remediate.
     */
    const BLEED_TIER1_HTML = `<!doctype html><html><head></head><body style="margin:0;">
      <section id="band" style="position:relative; width:800px; height:300px;">
        <div class="blur" style="position:absolute; top:50px; left:700px; width:200px; height:200px; background:blue;"></div>
      </section>
    </body></html>`;

    /**
     * Bleed band (Tier 2): same bleed but the ancestor explicitly declares
     * `overflow: visible` — a deliberate design choice the rail must not
     * silently overwrite. Escalates instead.
     */
    const BLEED_TIER2_HTML = `<!doctype html><html><head></head><body style="margin:0;">
      <section id="band" style="position:relative; width:800px; height:300px; overflow: visible;">
        <div class="blur" style="position:absolute; top:50px; left:700px; width:200px; height:200px; background:blue;"></div>
      </section>
    </body></html>`;

    it('reports nothing for a clean band (no absolute child bleeds)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(CLEAN_HTML);
        const tree = parseHtml(CLEAN_HTML);
        expect(await detectOverflowBoundsAsync(ctx, tree)).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('flags a Tier-1 bleed (browser-default overflow) as auto-remediated', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(BLEED_TIER1_HTML);
        const tree = parseHtml(BLEED_TIER1_HTML);
        const findings = await detectOverflowBoundsAsync(ctx, tree);
        expect(findings.length).toBe(1);
        expect(findings[0].outcome).toBe('auto-remediated');
        expect(findings[0].description).toMatch(/right \+100px/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('escalates a Tier-2 bleed (ancestor declares overflow:visible)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(BLEED_TIER2_HTML);
        const tree = parseHtml(BLEED_TIER2_HTML);
        const findings = await detectOverflowBoundsAsync(ctx, tree);
        expect(findings.length).toBe(1);
        expect(findings[0].outcome).toBe('escalated');
        expect(findings[0].description).toMatch(/ancestor declares overflow/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('auto-remediates Tier-1 by adding overflow:hidden to the ancestor inline-style', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(BLEED_TIER1_HTML);
        const tree = parseHtml(BLEED_TIER1_HTML);
        const findings = await applyOverflowBoundsAsync(ctx, tree);
        expect(findings.length).toBe(1);
        expect(findings[0].outcome).toBe('auto-remediated');
        const html = serializeHtml(tree);
        expect(html).toMatch(/<section[^>]*style="[^"]*overflow: hidden;/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('is idempotent: re-render after apply finds the bleed clipped', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx1 = await rt.loadHtml(BLEED_TIER1_HTML);
        const tree = parseHtml(BLEED_TIER1_HTML);
        const first = await applyOverflowBoundsAsync(ctx1, tree);
        expect(first.length).toBe(1);
        const ctx2 = await rt.loadHtml(serializeHtml(tree));
        const second = await detectOverflowBoundsAsync(ctx2, tree);
        expect(second).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);
  },
);
