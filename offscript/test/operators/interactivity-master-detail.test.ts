import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { interactivityMasterDetail } from '../../src/operators/interactivity-master-detail.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { MECHANICAL_OPERATORS } from '../../src/flatten/harden.js';

const ctx = { params: {} };

const doc = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

/** CR-FAQ-shaped fixture: a grid parent with a flex-column master list of N
 * cursor:pointer items and a sibling detail panel block. */
const masterDetailFixture = (items = 4) => {
  let qs = '';
  for (let i = 0; i < items; i++) {
    const bg = i === 0 ? '#149DFF' : '#EDFAFF';
    qs += `<div style="background:${bg};cursor:pointer;padding:30px 40px">Question ${i + 1}?</div>`;
  }
  const master = `<div style="display:flex;flex-direction:column;gap:20px">${qs}</div>`;
  const panel = `<div style="background:#04111C;color:#fff;padding:60px"><div>Question 1?</div><div>Answer body text here.</div></div>`;
  const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">${master}${panel}</div>`;
  return doc(`<section>${grid}</section>`);
};

describe('interactivity-master-detail operator', () => {
  it('is registered in the default registry under its name', () => {
    expect(defaultRegistry().get('interactivity-master-detail')).toBe(interactivityMasterDetail);
    expect(interactivityMasterDetail.tier).toBe(1);
  });

  it('is in MECHANICAL_OPERATORS immediately after interactivity-accordion', () => {
    const idx = (n: string) => MECHANICAL_OPERATORS.indexOf(n as never);
    expect(idx('interactivity-master-detail')).toBe(idx('interactivity-accordion') + 1);
    expect(idx('interactivity-master-detail')).toBeLessThan(idx('lang-attr'));
  });

  it('detects a CR-FAQ-shaped master-detail container (1 finding)', () => {
    const tree = parseHtml(masterDetailFixture(4));
    const findings = interactivityMasterDetail.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('auto-remediated');
    expect(findings[0].id.startsWith('interactivity-master-detail:')).toBe(true);
    expect(findings[0].description).toContain('4 master items');
  });

  it('apply assigns ids, ARIA, panel attrs, appends single <script id="offscript-interactivity-md">', () => {
    const tree = parseHtml(masterDetailFixture(4));
    interactivityMasterDetail.apply(tree, ctx);
    const out = serializeHtml(tree);

    // 4 master items with stable ids in document order
    for (let i = 0; i < 4; i++) {
      expect(out).toContain(`id="offscript-md-0-${i}"`);
      expect(out).toContain(`data-offscript-md-index="${i}"`);
    }
    // role + tabindex + master id grouping
    expect(out).toContain('role="button"');
    expect(out).toContain('tabindex="0"');
    expect(out).toContain('data-offscript-md-master="0"');
    // panel region
    expect(out).toContain('id="offscript-md-0-panel"');
    expect(out).toContain('role="region"');
    expect(out).toContain('aria-live="polite"');
    // aria-pressed: item 0 is true (minority bg), others false
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('aria-pressed="false"');
    // aria-controls wired to panel
    expect(out).toContain('aria-controls="offscript-md-0-panel"');
    // script appended once
    expect(out).toContain('<script id="offscript-interactivity-md">');
    expect(out.match(/<script id="offscript-interactivity-md">/g)).toHaveLength(1);
  });

  it('no master-detail shape → 0 findings, no script appended', () => {
    const tree = parseHtml(doc('<div><p>hi</p><p>bye</p></div>'));
    const findings = interactivityMasterDetail.detect(tree, ctx);
    expect(findings).toHaveLength(0);
    interactivityMasterDetail.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('offscript-interactivity-md');
    expect(out).not.toContain('offscript-md-');
  });

  it('idempotent: apply twice produces identical output', () => {
    const tree1 = parseHtml(masterDetailFixture(4));
    interactivityMasterDetail.apply(tree1, ctx);
    const once = serializeHtml(tree1);

    const tree2 = parseHtml(masterDetailFixture(4));
    interactivityMasterDetail.apply(tree2, ctx);
    interactivityMasterDetail.apply(tree2, ctx);
    const twice = serializeHtml(tree2);

    expect(twice).toBe(once);
  });

  it('script source is under 1500 bytes', () => {
    const tree = parseHtml(masterDetailFixture(3));
    interactivityMasterDetail.apply(tree, ctx);
    const out = serializeHtml(tree);
    const m = /<script id="offscript-interactivity-md">([\s\S]*?)<\/script>/.exec(out);
    expect(m).not.toBeNull();
    const src = m![1];
    expect(src.length).toBeLessThan(1500);
  });

  it('only 2 master items (< 3 threshold) → 0 findings', () => {
    const body =
      '<div style="display:grid;grid-template-columns:1fr 1fr">' +
      '<div><div style="cursor:pointer">A</div><div style="cursor:pointer">B</div></div>' +
      '<div>panel</div>' +
      '</div>';
    const tree = parseHtml(doc(body));
    expect(interactivityMasterDetail.detect(tree, ctx)).toHaveLength(0);
  });

  it('detects with master on the right side too (children order swapped)', () => {
    const qs = [0, 1, 2]
      .map((i) => `<div style="cursor:pointer;background:${i === 1 ? '#aaa' : '#fff'}">Question ${i}?</div>`)
      .join('');
    const master = `<div style="display:flex;flex-direction:column">${qs}</div>`;
    const panel = `<div>Answer</div>`;
    // panel FIRST, master SECOND
    const body = `<div style="display:grid;grid-template-columns:1fr 1fr">${panel}${master}</div>`;
    const tree = parseHtml(doc(body));
    const findings = interactivityMasterDetail.detect(tree, ctx);
    expect(findings).toHaveLength(1);
  });
});
