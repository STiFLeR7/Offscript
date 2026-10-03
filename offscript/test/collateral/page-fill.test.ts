import { describe, it, expect } from 'vitest';
import {
  buildPageFillFindings,
  DEFAULT_PAGE_FILL_THRESHOLDS,
  type PageFillRow,
} from '../../src/operators/collateral/render/page-fill.js';

function row(p: Partial<PageFillRow>): PageFillRow {
  return { index: 0, anchor: 'sec', bleed: false, voidMm: 0, fillPct: 90, skeleton: 'LIST+BAND', hasBand: true, ...p };
}

describe('buildPageFillFindings (pure)', () => {
  it('flags a page with a large void below content, anchor embedded for routing', () => {
    const f = buildPageFillFindings([row({ anchor: 'three-zones', voidMm: 75, fillPct: 70 })]);
    const u = f.find((x) => x.id.startsWith('page-fill:underfill:'));
    expect(u).toBeTruthy();
    expect(u!.id).toBe('page-fill:underfill:three-zones');
    expect(u!.outcome).toBe('warning');
  });

  it('does NOT flag a well-filled page', () => {
    const f = buildPageFillFindings([row({ voidMm: 10, fillPct: 92 })]);
    expect(f.some((x) => x.id.startsWith('page-fill:underfill:'))).toBe(false);
  });

  it('exempts the bleed cover from underfill', () => {
    const f = buildPageFillFindings([row({ anchor: 'cover', bleed: true, voidMm: 200, fillPct: 5 })]);
    expect(f.some((x) => x.id.startsWith('page-fill:underfill:'))).toBe(false);
  });

  it('flags monotony when one skeleton dominates the document', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ index: i, anchor: 'p' + i, voidMm: 5, skeleton: 'LIST+BAND' }));
    const f = buildPageFillFindings(rows);
    expect(f.some((x) => x.id === 'page-fill:monotony')).toBe(true);
  });

  it('does NOT flag monotony when layouts are varied', () => {
    const sks = ['LIST', 'CARDS', 'QUOTE', 'CHECK', 'LEDGER', '2COL', 'WALL', 'TEXT'];
    const rows = Array.from({ length: 8 }, (_, i) => row({ index: i, anchor: 'p' + i, voidMm: 5, skeleton: sks[i], hasBand: false }));
    const f = buildPageFillFindings(rows);
    expect(f.some((x) => x.id === 'page-fill:monotony')).toBe(false);
  });

  it('flags trailing-band repetition when most pages end in a band', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ index: i, anchor: 'p' + i, voidMm: 5, skeleton: 'X' + i, hasBand: i < 18 }));
    const f = buildPageFillFindings(rows);
    expect(f.some((x) => x.id === 'page-fill:repetition:trailing-band')).toBe(true);
  });

  it('emits ONLY warnings — never escalated (guard: advisory can never freeze)', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ index: i, anchor: 'p' + i, voidMm: 90, skeleton: 'LIST+BAND' }));
    const f = buildPageFillFindings(rows);
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.outcome === 'warning')).toBe(true);
  });

  it('exposes default thresholds', () => {
    expect(DEFAULT_PAGE_FILL_THRESHOLDS.underfillMm).toBe(40);
  });
});

import { RenderRuntime, A4_VIEWPORT } from '../../src/render-runtime.js';
import { detectPageFillAsync } from '../../src/operators/collateral/render/page-fill.js';
import { parseHtml } from '../../src/working-rep.js';

const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)('page-fill render lane (OFFSCRIPT_PLAYWRIGHT=1 + Chromium)', () => {
  it('flags a deliberately short page and only ever emits warnings', async () => {
    // The fragment root must be a full-height flex column (as real fragments are),
    // so .cr-page-foot{margin-top:auto} floats to the page bottom and leaves a void.
    const html = `<main class="cr-doc">
      <section class="cr-page" style="height:1123px;padding:60px;box-sizing:border-box">
        <div id="short-one" style="height:100%;display:flex;flex-direction:column">
          <h2 style="font-size:40px">Tiny</h2><p style="font-size:18px">One short line.</p>
          <div class="cr-page-foot" style="margin-top:auto">foot</div>
        </div>
      </section></main>`;
    const rt = await RenderRuntime.launch({ viewport: A4_VIEWPORT });
    try {
      const rc = await rt.loadHtml(html);
      const findings = await detectPageFillAsync(rc, parseHtml(html));
      expect(findings.some((f) => f.id === 'page-fill:underfill:short-one')).toBe(true);
      expect(findings.every((f) => f.outcome === 'warning')).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);
});
