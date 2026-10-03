import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { innerScrollAxis } from '../../src/operators/inner-scroll-axis.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

describe('inner-scroll-axis operator (Tier-1 escalation-only)', () => {
  it('is registered in defaultRegistry()', () => {
    expect(defaultRegistry().get('inner-scroll-axis')).toBe(innerScrollAxis);
  });

  it('returns no findings when no element declares overflow', () => {
    const html = doc(`<main><section><p>x</p></section></main>`);
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('exempts html and body (those host the page scroll)', () => {
    const html = `<!doctype html><html style="overflow-y:auto"><body style="overflow:auto"><main><p>x</p></main></body></html>`;
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('escalates a nested vertical overflow:auto on a non-root element', () => {
    const html = doc(`<main id="content" style="overflow-y:auto;height:400px"><p>x</p></main>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('escalated');
    expect(findings[0].id).toBe('inner-scroll-axis:vertical:id-content');
    expect(findings[0].description).toMatch(/nested vertical overflow:auto/);
  });

  it('escalates overflow-y:scroll the same way', () => {
    const html = doc(`<div id="panel" style="overflow-y:scroll"><p>x</p></div>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].description).toMatch(/overflow:scroll/);
  });

  it('treats shorthand overflow:auto as introducing BOTH axes (vertical fires; horizontal fires too if unmarked)', () => {
    const html = doc(`<div id="dual" style="overflow:auto">x</div>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.id).sort()).toEqual([
      'inner-scroll-axis:horizontal:id-dual',
      'inner-scroll-axis:vertical:id-dual',
    ]);
  });

  it('escalates an unmarked horizontal scroller', () => {
    const html = doc(`<div id="row" style="overflow-x:auto">a b c</div>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('inner-scroll-axis:horizontal:id-row');
    expect(findings[0].description).toMatch(/not marked as a lateral container/);
  });

  it('does NOT escalate a horizontal scroller marked with class*=lateral', () => {
    const html = doc(`<div class="lateral logos" style="overflow-x:auto">logos</div>`);
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('does NOT escalate a horizontal scroller marked with class*=cr-lateral', () => {
    const html = doc(`<div class="cr-lateral-row" style="overflow-x:scroll">x</div>`);
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('does NOT escalate a horizontal scroller marked with data-lateral', () => {
    const html = doc(`<div data-lateral style="overflow-x:auto">x</div>`);
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('still escalates the VERTICAL axis on a lateral-marked element with shorthand overflow:auto', () => {
    // A lateral opt-in only carves out the horizontal axis. A shorthand
    // overflow:auto on a lateral container also creates a vertical scroll,
    // which is still a wayfinding violation.
    const html = doc(`<div class="lateral" style="overflow:auto">x</div>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/^inner-scroll-axis:vertical:/);
  });

  it('ignores overflow:hidden and overflow:visible (no scrollable area)', () => {
    const html = doc(
      `<div id="a" style="overflow:hidden">x</div>` +
        `<div id="b" style="overflow-x:visible">y</div>` +
        `<div id="c" style="overflow-y:hidden">z</div>`,
    );
    expect(innerScrollAxis.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('honours last-wins cascade: overflow:auto then overflow-y:hidden suppresses vertical', () => {
    const html = doc(`<div id="cascade" style="overflow:auto;overflow-y:hidden">x</div>`);
    const findings = innerScrollAxis.detect(parseHtml(html), ctx);
    expect(findings.map((f) => f.id)).toEqual(['inner-scroll-axis:horizontal:id-cascade']);
  });

  it('is idempotent', () => {
    const html = doc(`<div id="x" style="overflow-y:auto">x</div>`);
    const tree = parseHtml(html);
    const a = innerScrollAxis.detect(tree, ctx).map((f) => f.id);
    const b = innerScrollAxis.detect(tree, ctx).map((f) => f.id);
    expect(b).toEqual(a);
  });

  it('apply() does not mutate and returns the same findings as detect()', () => {
    const html = doc(`<div id="x" style="overflow-y:auto">x</div>`);
    const tree = parseHtml(html);
    const before = innerScrollAxis.detect(tree, ctx).map((f) => f.id);
    const applied = innerScrollAxis.apply(tree, ctx).map((f) => f.id);
    const after = innerScrollAxis.detect(tree, ctx).map((f) => f.id);
    expect(applied).toEqual(before);
    expect(after).toEqual(before);
  });
});
