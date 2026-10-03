/**
 * WS6 (EA-018 / EA-019) — Assembly tests.
 *
 * WS6 reconnects the dormant shell-rooted assembly: `assembleWebsitePage` pastes the
 * WS3b-reconstructed `data-crf` bands into the supplied shell's <main> (led by the P2
 * curation comment), and `injectAnchor` stamps the planner anchor `id` + `data-archetype`
 * onto each band's own `data-crf` root (WS3b stamps `data-crf`; WS6 adds id/archetype). The
 * shell is a SUPPLIED INPUT (WS4 provides it in production; tests provide one here) — the
 * deleted `catalogShellPath` default is gone. DORMANT: no live caller; WS9b wires the
 * plan→reconstruct→bands→assemble orchestration. AC: page-level AC-1/AC-2/AC-6.
 */

import { describe, it, expect } from 'vitest';
import {
  assembleWebsitePage,
  injectAnchor,
  type WebsiteBand,
} from '../../src/generate/website-assembly.js';
import { reconstructBandForSlug } from '../../src/generate/reconstruct-band.js';

// The exact PASTE_MARKER the shell carries (mirrors website-assembly.ts).
const PASTE_MARKER = '<!-- ▼ paste fragments here, in band order ▼ -->';

const SHELL = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<title>placeholder</title>',
  '<link rel="stylesheet" href="../colors_and_type.css">',
  '<link rel="preload" href="../fonts/Inter.woff2" as="font">',
  '</head>',
  '<body>',
  '<main>',
  PASTE_MARKER,
  '</main>',
  '</body>',
  '</html>',
].join('\n');

const BAND = (): WebsiteBand => ({
  html: '<div data-crf="hero-actions"><style>[data-crf="hero-actions"] .h{color:var(--cr-ink)}</style><section class="h">Hero</section></div>',
  slug: 'hero-actions',
  id: 'hero',
  archetype: 'hero',
});

describe('website-assembly — injectAnchor (WS6: planner metadata onto the data-crf root)', () => {
  it('stamps id + data-archetype on the band root, preserving the data-crf marker', () => {
    const out = injectAnchor(BAND().html, 'hero-actions', 'hero', 'hero');
    expect(out).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
  });

  it('is idempotent — a band that already carries an id is unchanged', () => {
    const once = injectAnchor(BAND().html, 'hero-actions', 'hero', 'hero');
    const twice = injectAnchor(once, 'hero-actions', 'hero', 'hero');
    expect(twice).toBe(once);
  });

  it('returns a band with no data-crf root unchanged (no false stamping)', () => {
    const noMarker = '<section id="x">no marker</section>';
    expect(injectAnchor(noMarker, 'hero-actions', 'hero', 'hero')).toBe(noMarker);
  });

  it('targets only the element marker, never the scoped CSS selector', () => {
    // The <style> carries [data-crf="hero-actions"]; the id must land on the <div>, not there.
    const out = injectAnchor(BAND().html, 'hero-actions', 'hero', 'hero');
    expect((out.match(/id="hero"/g) ?? []).length).toBe(1);
    expect(out).toContain('[data-crf="hero-actions"] .h'); // selector untouched
  });
});

describe('website-assembly — assembleWebsitePage (WS6: bands into the supplied shell)', () => {
  it('replaces the paste marker with the anchored band in <main>', () => {
    const out = assembleWebsitePage({ bands: [BAND()], curationComment: '', shell: SHELL });
    expect(out).not.toContain('paste fragments here');
    expect(out).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
  });

  it('leads <main> with the curation comment (AC-6 provenance)', () => {
    const comment = '<!--\n| intent | surface | candidates | chosen | mode | reason |\n-->';
    const out = assembleWebsitePage({ bands: [BAND()], curationComment: comment, shell: SHELL });
    expect(out).toContain(comment);
    expect(out.indexOf('intent | surface')).toBeLessThan(out.indexOf('data-crf="hero-actions"'));
  });

  it('rewrites the shell token-sheet + fonts refs from ../ to working-dir ./', () => {
    const out = assembleWebsitePage({ bands: [BAND()], curationComment: '', shell: SHELL });
    expect(out).toContain('href="colors_and_type.css"');
    expect(out).not.toContain('../colors_and_type.css');
    expect(out).toContain('href="fonts/Inter.woff2"');
  });

  it('substitutes the <title> when supplied', () => {
    const out = assembleWebsitePage({ bands: [BAND()], curationComment: '', shell: SHELL, title: 'Acme' });
    expect(out).toContain('<title>Acme</title>');
    expect(out).not.toContain('<title>placeholder</title>');
  });

  it('inlines the behaviour script before </body>', () => {
    const out = assembleWebsitePage({
      bands: [BAND()],
      curationComment: '',
      shell: SHELL,
      behaviourScript: 'window.__cr=1',
    });
    expect(out).toContain('<script>window.__cr=1</script>');
    expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('</body>'));
  });

  it('preserves multiple bands in order, each anchored', () => {
    const a = { ...BAND() };
    const b: WebsiteBand = {
      html: '<div data-crf="feature-trio"><section class="ft">F</section></div>',
      slug: 'feature-trio',
      id: 'features',
      archetype: 'feature-grid',
    };
    const out = assembleWebsitePage({ bands: [a, b], curationComment: '', shell: SHELL });
    expect(out).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
    expect(out).toContain('<div data-crf="feature-trio" id="features" data-archetype="feature-grid">');
    expect(out.indexOf('data-crf="hero-actions"')).toBeLessThan(out.indexOf('data-crf="feature-trio"'));
  });

  it('is deterministic — repeated assembly is byte-identical', () => {
    const opts = { bands: [BAND()], curationComment: '<!--\n| c |\n-->', shell: SHELL, title: 'X' };
    expect(assembleWebsitePage(opts)).toBe(assembleWebsitePage(opts));
  });
});

describe('website-assembly — WS3b → WS6 contract (reconstructed band assembles + anchors)', () => {
  it('assembles a real WS3b-reconstructed band and stamps the planner anchor', () => {
    const band: WebsiteBand = {
      html: reconstructBandForSlug('hero-actions'),
      slug: 'hero-actions',
      id: 'hero',
      archetype: 'hero',
    };
    const out = assembleWebsitePage({ bands: [band], curationComment: '', shell: SHELL });
    // WS3b marker preserved (slug == fragmentId) + WS6 anchor added (planner metadata survives).
    expect(out).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
    expect(out).toContain('<style>'); // the scoped band style rode through assembly
    expect(out).not.toContain(PASTE_MARKER);
  });
});
