import { describe, it, expect } from 'vitest';
import {
  kitVsLive,
  detectKitVsLiveAsync,
  reportToFindings,
} from '../../../src/operators/render/kit-vs-live.js';
import { parseHtml } from '../../../src/working-rep.js';
import { RenderRuntime } from '../../../src/render-runtime.js';
import type { LiveDivergenceReport } from '../../../src/live-comparator.js';

describe('kit-vs-live — sync Operator contract + no-runtime / no-live paths', () => {
  it('declares the canonical Operator shape (name + tier 0 + detect + apply)', () => {
    expect(kitVsLive.name).toBe('kit-vs-live');
    expect(kitVsLive.tier).toBe(0);
    expect(typeof kitVsLive.detect).toBe('function');
    expect(typeof kitVsLive.apply).toBe('function');
  });

  it('sync detect returns [] (work lives on the async helper)', () => {
    const tree = parseHtml('<!doctype html><html><body><p>x</p></body></html>');
    expect(kitVsLive.detect(tree, { params: {} })).toEqual([]);
  });

  it('sync apply returns [] (warn-only oracle)', () => {
    const tree = parseHtml('<!doctype html><html><body><p>x</p></body></html>');
    expect(kitVsLive.apply(tree, { params: {} })).toEqual([]);
  });

  it('async detect returns [] when no runtime is supplied (off-by-default)', async () => {
    const tree = parseHtml('<!doctype html><html><body><p>x</p></body></html>');
    expect(await detectKitVsLiveAsync(undefined, tree, '<html></html>')).toEqual([]);
  });

  it('async detect returns [] when no live HTML is supplied (off-by-default)', async () => {
    const tree = parseHtml('<!doctype html><html><body><p>x</p></body></html>');
    // Casting to bypass the runtime requirement; the live-html guard fires first.
    expect(await detectKitVsLiveAsync({} as never, tree, undefined)).toEqual([]);
    expect(await detectKitVsLiveAsync({} as never, tree, '   ')).toEqual([]);
  });

  describe('reportToFindings (pure adapter)', () => {
    const REPORT: LiveDivergenceReport = {
      url: '',
      sectionsProbed: 2,
      warnings: [],
      divergences: [
        {
          selector: 'section#0',
          kind: 'opacity-mismatch',
          kit: '0.75',
          live: '0.9',
          severity: 'minor',
        },
        {
          selector: 'footer#0',
          kind: 'color-mismatch',
          kit: 'rgb(0,0,0)',
          live: 'rgb(20,20,20)',
          severity: 'material',
        },
      ],
    };

    it('materialOnly:true keeps only material-severity divergences', () => {
      const findings = reportToFindings(REPORT, true);
      expect(findings.length).toBe(1);
      expect(findings[0].id).toBe('kit-vs-live:footer#0:color-mismatch');
      expect(findings[0].outcome).toBe('warning');
    });

    it('materialOnly:false keeps every divergence', () => {
      const findings = reportToFindings(REPORT, false);
      expect(findings.length).toBe(2);
      expect(findings.every((f) => f.outcome === 'warning')).toBe(true);
    });
  });
});

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)('kit-vs-live — gate ON (real Chromium)', () => {
  const KIT = `<!doctype html><html><body style="margin:0;">
    <section style="background:rgb(255,255,255); opacity:1; width:800px; height:200px;">A</section>
    <footer style="background:rgb(0,0,0); opacity:1; width:800px; height:80px;">F</footer>
  </body></html>`;

  const LIVE_COLOR_DRIFT = `<!doctype html><html><body style="margin:0;">
    <section style="background:rgb(240,240,240); opacity:1; width:800px; height:200px;">A</section>
    <footer style="background:rgb(0,0,0); opacity:1; width:800px; height:80px;">F</footer>
  </body></html>`;

  it('emits one warning Finding per material divergence (CR watermark-class case)', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const tree = parseHtml(KIT);
      const findings = await detectKitVsLiveAsync(rt, tree, LIVE_COLOR_DRIFT);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      const color = findings.find((f) => /color-mismatch/.test(f.id));
      expect(color).toBeDefined();
      expect(color!.outcome).toBe('warning');
      expect(color!.description).toMatch(/kit vs live divergence at/);
    } finally {
      await rt.close();
    }
  }, 30_000);
});
