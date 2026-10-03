import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { noCalloutBox } from '../../src/operators/collateral/no-callout-box.js';
import { metricsInDark } from '../../src/operators/collateral/metrics-in-dark.js';
import { noScript } from '../../src/operators/collateral/no-script.js';
import { squarePageCorners, columnCount } from '../../src/operators/collateral/page-geometry.js';
import type { OperatorContext } from '../../src/operator.js';
const ctx: OperatorContext = { params: {} };

describe('noCalloutBox', () => {
  it('flags a tinted box with a thick coloured left border', () => {
    const t = parseHtml(`<div style="background:#C9CCF0;border-left:4px solid #4F57C4;padding:12px">x</div>`);
    expect(noCalloutBox.detect(t, ctx).length).toBe(1);
  });
  it('passes a plain tonal band (no left-border accent)', () => {
    expect(noCalloutBox.detect(parseHtml(`<div style="background:#C9CCF0;padding:12px">x</div>`), ctx)).toEqual([]);
  });
  // Boundary: the accent threshold is leftBorderPx >= 3 (no-callout-box.ts:32).
  it('passes a 2px left border (below the 3px accent threshold)', () => {
    expect(noCalloutBox.detect(parseHtml(`<div style="background:#C9CCF0;border-left:2px solid #4F57C4">x</div>`), ctx)).toEqual([]);
  });
  it('flags exactly at the 3px boundary', () => {
    expect(noCalloutBox.detect(parseHtml(`<div style="background:#C9CCF0;border-left:3px solid #4F57C4">x</div>`), ctx).length).toBe(1);
  });
  it('reads the separate border-left-width property (not only the shorthand)', () => {
    const t = parseHtml(`<div style="background:#C9CCF0;border-left-width:4px;border-left-style:solid">x</div>`);
    expect(noCalloutBox.detect(t, ctx).length).toBe(1);
  });
  it('passes a thick left border with no fill (needs BOTH fill and accent)', () => {
    expect(noCalloutBox.detect(parseHtml(`<div style="background:transparent;border-left:4px solid #4F57C4">x</div>`), ctx)).toEqual([]);
  });
  it('flags every callout box across the document', () => {
    const t = parseHtml(
      `<div style="background:#C9CCF0;border-left:4px solid #4F57C4">a</div>` +
      `<div style="background:#EADCF6;border-left:5px solid #7A3FC4">b</div>`,
    );
    expect(noCalloutBox.detect(t, ctx).length).toBe(2);
  });
});
describe('metricsInDark', () => {
  it('flags a .cr-stat-value coloured with an accent', () => {
    const t = parseHtml(`<span class="cr-stat-value" style="color:#149DFF">92%</span>`);
    expect(metricsInDark.detect(t, ctx).length).toBe(1);
  });
  it('passes a dark numeral', () => {
    expect(metricsInDark.detect(parseHtml(`<span class="cr-stat-value" style="color:#020B1B">92%</span>`), ctx)).toEqual([]);
  });
});
describe('noScript', () => {
  it('flags a <script> element', () => {
    expect(noScript.detect(parseHtml(`<script>var x=1</script>`), ctx).length).toBe(1);
  });
  it('flags an inline event handler', () => {
    expect(noScript.detect(parseHtml(`<button onclick="go()">x</button>`), ctx).length).toBe(1);
  });
  it('flags a javascript: URL', () => {
    expect(noScript.detect(parseHtml(`<a href="javascript:void(0)">x</a>`), ctx).length).toBe(1);
  });
  it('passes static HTML+CSS with no executable surface', () => {
    expect(noScript.detect(parseHtml(`<a href="https://example.com" style="color:#020B1B">x</a>`), ctx)).toEqual([]);
  });
});
describe('squarePageCorners', () => {
  it('flags a .cr-page with non-zero radius', () => {
    expect(squarePageCorners.detect(parseHtml(`<section class="cr-page" style="border-radius:12px">x</section>`), ctx).length).toBe(1);
  });
  it('passes border-radius:0 and 0px', () => {
    expect(squarePageCorners.detect(parseHtml(`<section class="cr-page" style="border-radius:0">x</section>`), ctx)).toEqual([]);
    expect(squarePageCorners.detect(parseHtml(`<section class="cr-page" style="border-radius:0px">x</section>`), ctx)).toEqual([]);
  });
  it('ignores a rounded element that is not a .cr-page', () => {
    expect(squarePageCorners.detect(parseHtml(`<div style="border-radius:12px">x</div>`), ctx)).toEqual([]);
  });
  it('flags every rounded .cr-page in the document', () => {
    const t = parseHtml(
      `<section class="cr-page" style="border-radius:8px">a</section>` +
      `<section class="cr-page" style="border-radius:16px">b</section>`,
    );
    expect(squarePageCorners.detect(t, ctx).length).toBe(2);
  });
});
describe('columnCount', () => {
  it('flags cr-cols-4', () => {
    expect(columnCount.detect(parseHtml(`<div class="cr-cols-4">x</div>`), ctx).length).toBe(1);
  });
  it('passes cr-cols-3', () => {
    expect(columnCount.detect(parseHtml(`<div class="cr-cols-3">x</div>`), ctx)).toEqual([]);
  });
  // Boundary: the rule is > 3 (page-geometry.ts:44).
  it('passes cr-cols-1 and cr-cols-2 (at/below the 3-column ceiling)', () => {
    expect(columnCount.detect(parseHtml(`<div class="cr-cols-1">x</div>`), ctx)).toEqual([]);
    expect(columnCount.detect(parseHtml(`<div class="cr-cols-2">x</div>`), ctx)).toEqual([]);
  });
  it('flags cr-cols-5 (any count above 3)', () => {
    expect(columnCount.detect(parseHtml(`<div class="cr-cols-5">x</div>`), ctx).length).toBe(1);
  });
});
