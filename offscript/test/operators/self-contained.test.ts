import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import { selfContained } from '../../src/operators/self-contained.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const ctx: OperatorContext = { params: {} };

describe('self-contained operator (Tier-0 single-file invariant rail)', () => {
  it('is Tier 0', () => expect(selfContained.tier).toBe(0));

  it('flags an external <script src> (CDN runtime)', () => {
    const f = selfContained.detect(parseHtml(doc(`<script src="https://unpkg.com/lucide@latest"></script>`)), ctx);
    expect(f.some((x) => x.id.startsWith('self-contained:external-script'))).toBe(true);
    expect(f[0].outcome).toBe('warning');
  });

  it('flags an external stylesheet <link>', () => {
    const f = selfContained.detect(parseHtml(doc(`<link rel="stylesheet" href="https://fonts.googleapis.com/x.css">`)), ctx);
    expect(f.some((x) => x.id.startsWith('self-contained:external-stylesheet'))).toBe(true);
  });

  it('flags an un-materialised data-lucide placeholder', () => {
    const f = selfContained.detect(parseHtml(doc(`<i data-lucide="check"></i>`)), ctx);
    expect(f.some((x) => x.id.startsWith('self-contained:data-lucide'))).toBe(true);
  });

  it('flags @import / url(https://) inside a <style> block', () => {
    const f = selfContained.detect(parseHtml(doc(`<style>@import url(https://x.com/a.css);</style>`)), ctx);
    expect(f.some((x) => x.id.startsWith('self-contained:css-external-ref'))).toBe(true);
  });

  it('passes a self-contained fragment (inline <script>, inline <svg>, data: refs)', () => {
    const tree = parseHtml(doc(
      `<section id="s"><svg><path d="M0 0"/></svg>` +
        `<style>.x{background:url(data:image/png;base64,AAAA);}</style>` +
        `<script>(function(){document.getElementById('s').classList.add('has-js');})();</script></section>`,
    ));
    expect(selfContained.detect(tree, ctx)).toHaveLength(0);
  });
});
