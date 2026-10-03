import { describe, it, expect } from 'vitest';
import { parseHtml } from '../src/working-rep.js';
import type { OperatorContext } from '../src/operator.js';
import { slideCount } from '../src/operators/deck/slide-count.js';
import { deckRegistry } from '../src/operators/deck/index.js';
import { isDeck, countSlides } from '../src/deck/intake.js';
import { RenderRuntime, DECK_VIEWPORT, canLaunchRuntime } from '../src/render-runtime.js';
import { detectSlideOverflowAsync } from '../src/operators/deck/render/slide-bounds.js';
import { detectDeckTextOverlapAsync } from '../src/operators/deck/render/text-overlap.js';

const ctx: OperatorContext = { params: {} };

function deck(n: number): string {
  return (
    '<div class="slide-deck">' +
    '<section class="slide"></section>'.repeat(n) +
    '</div>'
  );
}

describe('slide-count rail (static)', () => {
  it('warns when there are no slides', () => {
    const f = slideCount.detect(parseHtml('<div></div>'), ctx);
    expect(f).toHaveLength(1);
    expect(f[0].id).toBe('slide-count:none');
  });

  it('is clear within the 8–15 range', () => {
    expect(slideCount.detect(parseHtml(deck(10)), ctx)).toEqual([]);
  });

  it('warns under the minimum', () => {
    const f = slideCount.detect(parseHtml(deck(3)), ctx);
    expect(f.some((x) => x.id.startsWith('slide-count:under'))).toBe(true);
    expect(f.every((x) => x.outcome === 'warning')).toBe(true);
  });

  it('warns over the maximum', () => {
    const f = slideCount.detect(parseHtml(deck(20)), ctx);
    expect(f.some((x) => x.id.startsWith('slide-count:over'))).toBe(true);
  });
});

describe('deck intake', () => {
  it('isDeck detects slide markup, rejects a plain page', () => {
    expect(isDeck(deck(2))).toBe(true);
    expect(isDeck('<main>a website</main>')).toBe(false);
  });

  it('countSlides counts .slide, not the .slide-deck container', () => {
    expect(countSlides(deck(5))).toBe(5);
  });
});

describe('deckRegistry', () => {
  it('includes the deck geometric and invariant rails without reference-brand taste rules', () => {
    const reg = deckRegistry();
    for (const n of [
      'slide-count',
      'slide-no-overflow',
      'body-text-floor',
      'no-text-overlap',
      'token-normalize',
      'lang-attr',
    ]) {
      expect(reg.has(n)).toBe(true);
    }
    // collateral A4-page rails are NOT in the deck set
    expect(reg.has('square-page-corners')).toBe(false);
    expect(reg.has('column-count')).toBe(false);
    expect(reg.has('retired-token')).toBe(false);
  });
});

// Render rails need Chromium — gate on OFFSCRIPT_PLAYWRIGHT=1, skip cleanly without.
describe('deck render rails (guarded)', () => {
  it('slide-no-overflow flags content past the 1920×1080 box', async () => {
    if (!(await canLaunchRuntime())) return;
    const html = `<!doctype html><html><body>
      <section class="slide" style="position:relative;width:1920px;height:1080px;margin:0">
        <div style="position:absolute;left:1900px;top:10px;width:300px;height:60px">spills off the right edge</div>
      </section></body></html>`;
    const rt = await RenderRuntime.launch({ viewport: DECK_VIEWPORT });
    try {
      const rc = await rt.loadHtml(html);
      const findings = await detectSlideOverflowAsync(rc, parseHtml(html));
      expect(findings.some((f) => f.id.startsWith('slide-no-overflow'))).toBe(true);
      expect(findings.every((f) => f.outcome === 'escalated')).toBe(true);
    } finally {
      await rt.close();
    }
  }, 30_000);

  it('a clean single slide produces no overflow/overlap findings', async () => {
    if (!(await canLaunchRuntime())) return;
    const html = `<!doctype html><html><body>
      <section class="slide" style="position:relative;width:1920px;height:1080px;margin:0;overflow:hidden">
        <h1 style="position:absolute;left:80px;top:80px;font-size:64px">Clean slide</h1>
      </section></body></html>`;
    const rt = await RenderRuntime.launch({ viewport: DECK_VIEWPORT });
    try {
      const rc = await rt.loadHtml(html);
      expect(await detectSlideOverflowAsync(rc, parseHtml(html))).toEqual([]);
      expect(await detectDeckTextOverlapAsync(rc, parseHtml(html))).toEqual([]);
    } finally {
      await rt.close();
    }
  }, 30_000);
});
