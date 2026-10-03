import { describe, it, expect } from 'vitest';
import { buildContext } from '../src/generate/context.js';
import { buildCanonicalFooter, stripPageFoot, injectCanonicalFooter } from '../src/generate/footer.js';
import { parseFragment, serializeHtml, visitElements } from '../src/working-rep.js';

describe('buildCanonicalFooter', () => {
  const ctx = buildContext('example-brand', 'collateral');

  it('is deterministic (two calls byte-identical)', () => {
    const a = buildCanonicalFooter(ctx, []);
    const b = buildCanonicalFooter(ctx, []);
    expect(a).toBe(b);
  });
  it('emits a single <footer class="cr-page-foot"> with two spans, var()-only (no hex)', () => {
    const f = buildCanonicalFooter(ctx, []);
    expect(f).toMatch(/<footer class="cr-page-foot"/);
    expect((f.match(/<span/g) ?? []).length).toBe(2);
    expect(f).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
  it('uses the fictional display name without inventing a domain', () => {
    const f = buildCanonicalFooter(ctx, []);
    expect(f).toContain('Example Brand');
    expect(f).not.toContain('example-brand.com');
    expect(f).not.toContain('Dr. Scribe');
    expect(f).not.toContain('Figures illustrative');
    expect(f).not.toContain('Agentic Process Automation');
  });
  it('pins with margin-top:auto', () => {
    expect(buildCanonicalFooter(ctx, [])).toMatch(/margin-top:\s*auto/);
  });
});

describe('stripPageFoot + injectCanonicalFooter', () => {
  const dirty =
    '<div id="p"><p>body</p><footer class="cr-page-foot" style="border-top:1px solid var(--x)">' +
    '<span>old.com</span><span>An autonomous digital worker</span></footer></div>';

  it('strips every .cr-page-foot (idempotent)', () => {
    const t = parseFragment(dirty);
    stripPageFoot(t);
    let feet = 0;
    visitElements(t, (el) => { if (el.tagName === 'footer') feet++; });
    expect(feet).toBe(0);
    stripPageFoot(t); // idempotent — no throw, still zero
    feet = 0;
    visitElements(t, (el) => { if (el.tagName === 'footer') feet++; });
    expect(feet).toBe(0);
  });

  it('injects the canonical footer as the LAST child of the fragment root', () => {
    const t = parseFragment(dirty);
    stripPageFoot(t);
    injectCanonicalFooter(t, '<footer class="cr-page-foot"><span>example-brand.com</span><span>desc</span></footer>');
    const html = serializeHtml(t);
    expect(html).toContain('example-brand.com');
    expect(html).not.toContain('An autonomous digital worker');
    // exactly one footer remains
    expect((html.match(/<footer class="cr-page-foot"/g) ?? []).length).toBe(1);
    // it is the last child of #p
    expect(html).toMatch(/<\/footer><\/div>$/);
  });
});


describe('canonical project footer identity', () => {
  it('uses the supplied contract subject without a reference domain or commercial tagline', () => {
    const ctx = buildContext('example-brand', 'collateral');
    ctx.client = 'orchid-studio';
    ctx.brandSource = 'client';
    ctx.brandContract = { schemaVersion: 1, subject: 'Orchid <Studio>', generatedAt: '2026-01-01T00:00:00Z', decidedBy: 'human', slots: {} };
    const footer = buildCanonicalFooter(ctx, []);
    expect(footer).toContain('Orchid &#x3C;Studio>');
    expect(footer).not.toContain('example-brand.com');
    expect(footer).not.toContain('AI strategy');
    expect(footer).not.toContain('orchidstudio.com');
  });
  it('uses an explicit project parent URL hostname', () => {
    const ctx = buildContext('example-brand', 'collateral');
    ctx.brandSource = 'client';
    ctx.brief.brand = 'Orchid Studio';
    ctx.brief.parentUrl = 'https://orchid.example/about';
    const footer = buildCanonicalFooter(ctx, []);
    expect(footer).toContain('orchid.example');
    expect(footer).toContain('Orchid Studio');
    expect(footer).not.toContain('example-brand.com');
  });
  it('omits an invalid project URL instead of deriving a domain from a display name', () => {
    const ctx = buildContext('example-brand', 'collateral');
    ctx.brandSource = 'client';
    ctx.brief.brand = 'Orchid Studio';
    ctx.brief.parentUrl = 'not a url';
    expect(buildCanonicalFooter(ctx, [])).not.toContain('.com');
  });
});
