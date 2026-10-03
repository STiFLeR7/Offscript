import { describe, it, expect } from 'vitest';
import {
  renderShorthandSanity,
  detectShorthandFailuresAsync,
  applyShorthandRemediationsAsync,
} from '../../../src/operators/render/render-shorthand-sanity.js';
import { parseHtml, serializeHtml } from '../../../src/working-rep.js';
import { RenderRuntime } from '../../../src/render-runtime.js';

// ──────────────────────── env-gate-off branch (always runs) ────────────────────────

describe('render-shorthand-sanity — sync Operator contract + async no-runtime path', () => {
  it('declares the canonical Operator shape (name + tier 1 + detect + apply)', () => {
    expect(renderShorthandSanity.name).toBe('render-shorthand-sanity');
    expect(renderShorthandSanity.tier).toBe(1);
    expect(typeof renderShorthandSanity.detect).toBe('function');
    expect(typeof renderShorthandSanity.apply).toBe('function');
  });

  it('sync detect returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body><div style="background:red;"></div></body></html>');
    expect(renderShorthandSanity.detect(tree, { params: {} })).toEqual([]);
  });

  it('sync apply returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body><div style="background:red;"></div></body></html>');
    expect(renderShorthandSanity.apply(tree, { params: {} })).toEqual([]);
  });

  it('async detect returns [] when no RenderContext is provided (graceful degrade)', async () => {
    const tree = parseHtml('<!doctype html><html><body><div style="background:red;"></div></body></html>');
    expect(await detectShorthandFailuresAsync(undefined, tree)).toEqual([]);
  });

  it('async apply returns [] when no RenderContext is provided (graceful degrade)', async () => {
    const tree = parseHtml('<!doctype html><html><body><div style="background:red;"></div></body></html>');
    expect(await applyShorthandRemediationsAsync(undefined, tree)).toEqual([]);
  });
});

// ──────────────────────── env-gate-on branch (skipped without Chromium) ────────────

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'render-shorthand-sanity — gate ON (real Chromium probe)',
  () => {
    /**
     * A "good" doc: every inline shorthand parses cleanly. Detector should
     * report nothing.
     */
    const INTACT_HTML = `<!doctype html><html><head></head><body>
      <div id="ok" style="background: linear-gradient(red, blue); border: 1px solid black;">x</div>
    </body></html>`;

    /**
     * A "bad" doc reproducing the CR class: an inline `background:` shorthand
     * that DECLARES a gradient (meaningful per the heuristic) but is malformed
     * — unterminated `linear-gradient(` — so Chromium drops the whole
     * declaration. Computed `backgroundImage` resolves to the initial `none`.
     * Mirrors the silent-failure mode of the 3.3 MB attribute-buffer overflow
     * without needing a multi-MB blob in the test source.
     */
    const BROKEN_HTML = `<!doctype html><html><head></head><body>
      <div id="bad" style="background: linear-gradient(red, blue;">x</div>
    </body></html>`;

    it('reports nothing for an intact doc — all shorthands parse to non-initial', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(INTACT_HTML);
        const tree = parseHtml(INTACT_HTML);
        const findings = await detectShorthandFailuresAsync(ctx, tree);
        expect(findings).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('flags a `background:` shorthand whose computed backgroundImage is the initial', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(BROKEN_HTML);
        const tree = parseHtml(BROKEN_HTML);
        const findings = await detectShorthandFailuresAsync(ctx, tree);
        expect(findings.length).toBeGreaterThanOrEqual(1);
        const bg = findings.find((f) => f.id.endsWith(':background'));
        expect(bg).toBeDefined();
        expect(bg!.outcome).toBe('auto-remediated');
        expect(bg!.description).toMatch(/inline-style shorthand `background:/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('auto-remediates: extracts the failed decl into a managed <style> + adds class', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx = await rt.loadHtml(BROKEN_HTML);
        const tree = parseHtml(BROKEN_HTML);
        const findings = await applyShorthandRemediationsAsync(ctx, tree);
        expect(findings.length).toBeGreaterThanOrEqual(1);
        expect(findings.every((f) => f.outcome === 'auto-remediated')).toBe(true);
        const html = serializeHtml(tree);
        expect(html).toMatch(/<style data-offscript-rail="render-shorthand-sanity">/);
        expect(html).toMatch(/\.offscript-rsh-0\s*\{[^}]*background:/);
        expect(html).toMatch(/class="offscript-rsh-0"/);
        // The failing decl was stripped from the inline style attribute:
        expect(html).not.toMatch(/style="[^"]*background:[^"]*linear-gradient\(red, blue;/);
      } finally {
        await rt.close();
      }
    }, 30_000);

    it('is idempotent: apply twice yields no second extraction (class+style already there)', async () => {
      const rt = await RenderRuntime.launch();
      try {
        const ctx1 = await rt.loadHtml(BROKEN_HTML);
        const tree = parseHtml(BROKEN_HTML);
        const first = await applyShorthandRemediationsAsync(ctx1, tree);
        expect(first.length).toBeGreaterThanOrEqual(1);

        // Re-render the mutated tree and re-probe: the inline shorthand is
        // gone, so the rail should find nothing further to remediate.
        const ctx2 = await rt.loadHtml(serializeHtml(tree));
        const second = await applyShorthandRemediationsAsync(ctx2, tree);
        expect(second).toEqual([]);
      } finally {
        await rt.close();
      }
    }, 30_000);
  },
);
