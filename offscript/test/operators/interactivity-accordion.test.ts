import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { interactivityAccordion } from '../../src/operators/interactivity-accordion.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { MECHANICAL_OPERATORS } from '../../src/flatten/harden.js';

const ctx = { params: {} };

const doc = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

const accordionFixture = (items = 4) => {
  let rows = '';
  for (let i = 0; i < items; i++) {
    rows += `<div class="row"><button class="hdr">Q${i + 1}</button><div class="body">A${i + 1}</div></div>`;
  }
  return doc(`<div class="faq">${rows}</div>`);
};

describe('interactivity-accordion operator', () => {
  it('is registered in the default registry under its name', () => {
    expect(defaultRegistry().get('interactivity-accordion')).toBe(interactivityAccordion);
    expect(interactivityAccordion.tier).toBe(1);
  });

  it('is in MECHANICAL_OPERATORS after responsive-breakpoints and before lang-attr', () => {
    const idx = (n: string) => MECHANICAL_OPERATORS.indexOf(n as never);
    expect(idx('interactivity-accordion')).toBeGreaterThan(idx('responsive-breakpoints'));
    expect(idx('interactivity-accordion')).toBeLessThan(idx('lang-attr'));
  });

  it('detects a 4-item accordion container (1 finding)', () => {
    const tree = parseHtml(accordionFixture(4));
    const findings = interactivityAccordion.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('auto-remediated');
    expect(findings[0].id.startsWith('interactivity-accordion:')).toBe(true);
  });

  it('apply assigns 4 unique ids, adds ARIA, appends a single <script id="offscript-interactivity">', () => {
    const tree = parseHtml(accordionFixture(4));
    interactivityAccordion.apply(tree, ctx);
    const out = serializeHtml(tree);

    // distinct stable ids by document order
    for (let i = 0; i < 4; i++) {
      expect(out).toContain(`id="offscript-acc-0-${i}-h"`);
      expect(out).toContain(`id="offscript-acc-0-${i}-b"`);
    }
    // aria wiring
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-controls="offscript-acc-0-0-b"');
    expect(out).toContain('aria-hidden="true"');
    // script appended once
    expect(out).toContain('<script id="offscript-interactivity">');
    expect(out.match(/<script id="offscript-interactivity">/g)).toHaveLength(1);
  });

  it('no accordion shape → 0 findings, no script appended', () => {
    const tree = parseHtml(doc('<div><p>hi</p><p>bye</p></div>'));
    const findings = interactivityAccordion.detect(tree, ctx);
    expect(findings).toHaveLength(0);
    interactivityAccordion.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).not.toContain('offscript-interactivity');
    expect(out).not.toContain('offscript-acc-');
  });

  it('idempotent: apply twice produces identical output', () => {
    const tree1 = parseHtml(accordionFixture(4));
    interactivityAccordion.apply(tree1, ctx);
    const once = serializeHtml(tree1);

    const tree2 = parseHtml(accordionFixture(4));
    interactivityAccordion.apply(tree2, ctx);
    interactivityAccordion.apply(tree2, ctx);
    const twice = serializeHtml(tree2);

    expect(twice).toBe(once);
  });

  it('script source is under 1500 bytes', () => {
    const tree = parseHtml(accordionFixture(2));
    interactivityAccordion.apply(tree, ctx);
    const out = serializeHtml(tree);
    const m = /<script id="offscript-interactivity">([\s\S]*?)<\/script>/.exec(out);
    expect(m).not.toBeNull();
    const src = m![1];
    expect(src.length).toBeLessThan(1500);
  });

  it('all bodies start collapsed (aria-hidden="true", display:none)', () => {
    const tree = parseHtml(accordionFixture(3));
    interactivityAccordion.apply(tree, ctx);
    const out = serializeHtml(tree);
    // 3 bodies should each have aria-hidden=true and display:none
    const ariaHiddenCount = (out.match(/aria-hidden="true"/g) ?? []).length;
    expect(ariaHiddenCount).toBeGreaterThanOrEqual(3);
    const displayNoneCount = (out.match(/display:none/g) ?? []).length;
    expect(displayNoneCount).toBeGreaterThanOrEqual(3);
    // no body has aria-expanded=true (all collapsed at start)
    expect(out).not.toContain('aria-expanded="true"');
  });

  it('non-button header gets role="button"', () => {
    const tree = parseHtml(
      doc(
        '<div class="acc">' +
          '<div class="r"><div style="cursor:pointer"><svg></svg>Q1</div><div>A1</div></div>' +
          '<div class="r"><div style="cursor:pointer"><svg></svg>Q2</div><div>A2</div></div>' +
          '</div>',
      ),
    );
    interactivityAccordion.apply(tree, ctx);
    const out = serializeHtml(tree);
    expect(out).toContain('role="button"');
  });
});
