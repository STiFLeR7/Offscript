import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { motionBudget } from '../../src/operators/motion-budget.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };
const doc = (head: string, body = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('motion-budget operator (Tier-0 warning)', () => {
  it('is registered in defaultRegistry()', () => {
    expect(defaultRegistry().get('motion-budget')).toBe(motionBudget);
  });

  it('is silent on a document with no animation triggers', () => {
    const html = doc(`<style>.x { color: red }</style>`, `<div>x</div>`);
    expect(motionBudget.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('is silent at exactly the budget (3 triggers)', () => {
    const css = `
      .a { animation: fadeIn 1s; }
      .b { animation: fadeIn 1s; }
      .c { animation-name: slide; }
    `;
    const html = doc(`<style>${css}</style>`);
    expect(motionBudget.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('warns when triggers EXCEED the budget (4 → fires)', () => {
    const css = `
      .a { animation: fadeIn 1s; }
      .b { animation: fadeIn 1s; }
      .c { animation: fadeIn 1s; }
      .d { animation-name: slide; }
    `;
    const html = doc(`<style>${css}</style>`);
    const findings = motionBudget.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('warning');
    expect(findings[0].id).toBe('motion-budget:over:4');
    expect(findings[0].description).toMatch(/4 simultaneous CSS animation triggers/);
  });

  it('counts a CSS rule that declares both animation AND animation-name as ONE trigger', () => {
    const css = `
      .a { animation: fadeIn 1s; animation-name: fadeIn; }
      .b { animation: fadeIn 1s; }
      .c { animation: fadeIn 1s; }
      .d { animation: fadeIn 1s; }
    `;
    const html = doc(`<style>${css}</style>`);
    const findings = motionBudget.detect(parseHtml(html), ctx);
    // 4 distinct rules → 4 triggers (the rule with both declarations
    // counts once, not twice).
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('motion-budget:over:4');
  });

  it('skips @keyframes blocks (they DEFINE motion but do not TRIGGER it)', () => {
    const css = `
      @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes slide { from { transform: translateX(-10px) } to { transform: none } }
      @keyframes bounce { 0% { transform: scale(1) } 50% { transform: scale(1.1) } 100% { transform: scale(1) } }
      @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      @keyframes ripple { from { opacity: 1 } to { opacity: 0 } }
    `;
    // Five @keyframes blocks, zero triggers → silent.
    const html = doc(`<style>${css}</style>`);
    expect(motionBudget.detect(parseHtml(html), ctx)).toHaveLength(0);
  });

  it('counts inline-style triggers', () => {
    const html = doc(
      '',
      `<div style="animation: a 1s">1</div>` +
        `<div style="animation: a 1s">2</div>` +
        `<div style="animation: a 1s">3</div>` +
        `<div style="animation-name: b">4</div>`,
    );
    const findings = motionBudget.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('motion-budget:over:4');
  });

  it('combines <style> rules + inline triggers in a single count', () => {
    const css = `
      .a { animation: a 1s; }
      .b { animation: b 1s; }
    `;
    const html = doc(
      `<style>${css}</style>`,
      `<div style="animation: c 1s">x</div>` + `<div style="animation: d 1s">y</div>`,
    );
    const findings = motionBudget.detect(parseHtml(html), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('motion-budget:over:4');
  });

  it('honours a caller-provided budget via params', () => {
    const css = `
      .a { animation: a 1s; }
      .b { animation: b 1s; }
    `;
    const html = doc(`<style>${css}</style>`);
    // Budget 1: 2 triggers → fires.
    const tight = motionBudget.detect(parseHtml(html), { params: { budget: 1 } });
    expect(tight).toHaveLength(1);
    expect(tight[0].id).toBe('motion-budget:over:2');
    // Budget 10: 2 triggers → silent.
    expect(motionBudget.detect(parseHtml(html), { params: { budget: 10 } })).toHaveLength(0);
  });

  it('is idempotent', () => {
    const html = doc(`<style>.a { animation: x 1s } .b { animation: x 1s } .c { animation: x 1s } .d { animation: x 1s }</style>`);
    const tree = parseHtml(html);
    const a = motionBudget.detect(tree, ctx).map((f) => f.id);
    const b = motionBudget.detect(tree, ctx).map((f) => f.id);
    expect(b).toEqual(a);
  });

  it('apply() does not mutate and returns the same findings as detect()', () => {
    const html = doc(`<style>.a { animation: x 1s } .b { animation: x 1s } .c { animation: x 1s } .d { animation: x 1s }</style>`);
    const tree = parseHtml(html);
    const before = motionBudget.detect(tree, ctx).map((f) => f.id);
    const applied = motionBudget.apply(tree, ctx).map((f) => f.id);
    const after = motionBudget.detect(tree, ctx).map((f) => f.id);
    expect(applied).toEqual(before);
    expect(after).toEqual(before);
  });
});
