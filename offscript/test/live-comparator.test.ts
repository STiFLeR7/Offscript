import { describe, it, expect } from 'vitest';
import { fetchLiveHtml, compareLiveVsKit } from '../src/live-comparator.js';
import { RenderRuntime } from '../src/render-runtime.js';

describe('fetchLiveHtml — input validation (always runs)', () => {
  it('rejects non-http URLs', async () => {
    await expect(fetchLiveHtml('ftp://example.com')).rejects.toThrow(/http\(s\)/);
    await expect(fetchLiveHtml('file:///etc/passwd')).rejects.toThrow(/http\(s\)/);
    await expect(fetchLiveHtml('')).rejects.toThrow(/http\(s\)/);
  });
});

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)('compareLiveVsKit — gate ON (real Chromium)', () => {
  /** Two identical pages: every section attribute matches. No divergence. */
  const IDENTICAL = `<!doctype html><html><head></head><body style="margin:0;">
    <section style="background:rgb(255,255,255); opacity:1; width:800px; height:200px;">A</section>
    <footer style="background:rgb(0,0,0); opacity:1; width:800px; height:80px;">F</footer>
  </body></html>`;

  /** Same structure, but the section has a different background color → mismatch. */
  const COLOR_DRIFT = `<!doctype html><html><head></head><body style="margin:0;">
    <section style="background:rgb(240,240,240); opacity:1; width:800px; height:200px;">A</section>
    <footer style="background:rgb(0,0,0); opacity:1; width:800px; height:80px;">F</footer>
  </body></html>`;

  /** Same structure but the footer's opacity is dropped → opacity mismatch. */
  const OPACITY_DRIFT = `<!doctype html><html><head></head><body style="margin:0;">
    <section style="background:rgb(255,255,255); opacity:1; width:800px; height:200px;">A</section>
    <footer style="background:rgb(0,0,0); opacity:0.75; width:800px; height:80px;">F</footer>
  </body></html>`;

  /** Footer dropped on live side → missing-on-live. */
  const LIVE_MISSING_FOOTER = `<!doctype html><html><head></head><body style="margin:0;">
    <section style="background:rgb(255,255,255); opacity:1; width:800px; height:200px;">A</section>
  </body></html>`;

  it('produces zero divergences for two identical pages', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, IDENTICAL, IDENTICAL);
      expect(report.sectionsProbed).toBe(2);
      expect(report.divergences).toEqual([]);
      expect(report.warnings).toEqual([]);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags a color-mismatch when the section background drifts', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, IDENTICAL, COLOR_DRIFT);
      const color = report.divergences.find((d) => d.kind === 'color-mismatch');
      expect(color).toBeDefined();
      expect(color!.severity).toBe('material');
      expect(color!.kit).toMatch(/255, 255, 255/);
      expect(color!.live).toMatch(/240, 240, 240/);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags an opacity-mismatch when the footer drops past the tolerance band', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, IDENTICAL, OPACITY_DRIFT);
      const op = report.divergences.find((d) => d.kind === 'opacity-mismatch');
      expect(op).toBeDefined();
      expect(op!.kit).toBe('1');
      expect(op!.live).toBe('0.75');
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('flags missing-on-live when a section dropped on the live side', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, IDENTICAL, LIVE_MISSING_FOOTER);
      const miss = report.divergences.find((d) => d.kind === 'missing-on-live');
      expect(miss).toBeDefined();
      expect(miss!.selector).toMatch(/^footer/);
      expect(miss!.live).toBeNull();
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('honours a custom sections selector list', async () => {
    const KIT = `<!doctype html><html><body><div class="band">A</div><div class="band">B</div></body></html>`;
    const LIVE = KIT;
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, KIT, LIVE, { sections: ['.band'] });
      expect(report.sectionsProbed).toBe(2);
      expect(report.divergences).toEqual([]);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('emits a warning when one side is empty (rather than crashing)', async () => {
    const rt = await RenderRuntime.launch();
    try {
      const report = await compareLiveVsKit(rt, IDENTICAL, '   ');
      expect(report.warnings.some((w) => /empty liveHtml/.test(w))).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);
});
