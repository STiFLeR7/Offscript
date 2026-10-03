/**
 * WS3a (EA-018 / EA-019) — fragment EXTRACTION tests.
 *
 * WS3a is the dormant first half of the WS3 reconstruction transform: lift the band-root
 * element (the single `<section>`, else the first anchorable top-level `<body>` element per
 * EA-018 Phase 3) + the per-component `<head>` `<style>` from a section exemplar, dropping
 * document chrome / the colors_and_type.css link / preview-only attrs (`data-screen-label`).
 * It does NOT scope selectors, wrap in `<div data-crf>`, stamp the marker, or read through
 * `loadFragmentHtml` — those are WS3b. Pure extraction against the SURVIVING charter corpus
 * (`resources/design_processes/website/exemplars/sections/`). No live caller (dormant).
 *
 * Covers: I1 (content preserved), I8 (chrome-free), fail-loud F1 (no exemplar) / F2 (no band),
 * determinism, and corpus-wide robustness (every exemplar extracts, chrome-free).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  extractBand,
  extractBandForSlug,
  exemplarSectionPath,
  scopeBandCss,
  reconstructBand,
  reconstructBandForSlug,
  type ExtractedBand,
} from '../../src/generate/reconstruct-band.js';
import { parseCss } from '../../src/css-rep.js';

/** The CSS text inside a reconstructed band's single `<style>` (or '' when absent). */
function bandStyleCss(band: string): string {
  const m = band.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

/** Assert every non-keyframe rule selector in `css` is scoped under the data-crf root (I3). */
function assertAllScoped(css: string, rootSel: string): void {
  const root = parseCss(css);
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule' && /keyframes$/i.test((parent as { name: string }).name)) {
      return; // keyframe step selectors (0%, from, to) are never prefixed
    }
    for (const sel of rule.selectors) {
      expect(sel.startsWith(rootSel), `selector escaped root: ${sel}`).toBe(true);
    }
  });
}

/** All real catalog slugs present in the surviving corpus (component-<slug>.html). */
function corpusSlugs(): string[] {
  const dir = dirname(exemplarSectionPath('x'));
  return readdirSync(dir)
    .filter((f) => /^component-.+\.html$/.test(f))
    .map((f) => f.replace(/^component-/, '').replace(/\.html$/, ''))
    .sort();
}

// Precise document-chrome markers. NB: `<head>` (with bracket) — never `<head` — so the
// legitimate semantic `<header>` tag (preserved verbatim per I1) is not a false positive.
const CHROME_MARKERS = ['<!doctype', '<!DOCTYPE', '<html', '<head>', '</head>', '<body>', 'colors_and_type.css'];

describe('reconstruct-band — extractBand (WS3a: I1 content preserved / I8 chrome-free)', () => {
  it('extracts a section-rooted exemplar: band kept, chrome + preview attr dropped', () => {
    const band = extractBandForSlug('feature-trio');
    // I1 — the section content + classes are preserved verbatim.
    expect(band.section).toMatch(/<section\b/);
    expect(band.section).toContain('ft-section');
    // I8 — no document chrome, no token-sheet link, no preview-only attr.
    for (const m of CHROME_MARKERS) expect(band.section).not.toContain(m);
    expect(band.section).not.toContain('data-screen-label');
    // The per-component style is lifted as raw, unscoped CSS with token var()s intact (I1/I6).
    expect(band.style).toContain('var(--cr-');
    expect(band.style).toContain('.ft-');
  });

  it('lifts the per-component <head> <style> as raw CSS (not the <style> tag)', () => {
    const band = extractBandForSlug('hero-actions');
    expect(band.section.length).toBeGreaterThan(0);
    expect(band.style).not.toContain('<style');
    expect(band.style).not.toContain('</style>');
  });

  it('handles an anchorable non-section band root (footer-mega → <footer>)', () => {
    const band = extractBandForSlug('footer-mega');
    expect(band.section).toMatch(/<footer\b/);
    for (const m of CHROME_MARKERS) expect(band.section).not.toContain(m);
  });

  it('handles a div-rooted band exemplar (stat-tiles → <div>)', () => {
    const band = extractBandForSlug('stat-tiles');
    expect(band.section).toMatch(/<div\b/);
    for (const m of CHROME_MARKERS) expect(band.section).not.toContain(m);
  });

  it('tolerates an exemplar with no <head> <style> (style = "")', () => {
    // component-faq.html carries no head <style> (headstyle=0) — extraction must not throw.
    const band = extractBandForSlug('faq');
    expect(band.section.length).toBeGreaterThan(0);
    expect(typeof band.style).toBe('string');
  });
});

describe('reconstruct-band — fail-loud (WS3a F1 / F2)', () => {
  it('F1: a slug with no exemplar file throws loud', () => {
    expect(() => extractBandForSlug('__not_a_real_slug__')).toThrow(/F1|no exemplar/);
  });

  it('F2: a document with no extractable band root throws loud', () => {
    const html = '<!doctype html><html><head></head><body><p>just a paragraph</p></body></html>';
    expect(() => extractBand(html)).toThrow(/F2|no extractable/);
  });
});

describe('reconstruct-band — determinism (WS3a I4)', () => {
  it('repeated extraction of the same slug is byte-identical', () => {
    const a = extractBandForSlug('feature-trio');
    const b = extractBandForSlug('feature-trio');
    expect(a).toEqual(b);
    expect(a.section).toBe(b.section);
    expect(a.style).toBe(b.style);
  });
});

describe('reconstruct-band — corpus-wide robustness (every exemplar extracts, chrome-free)', () => {
  it('every surviving exemplar yields a non-empty chrome-free band', () => {
    const slugs = corpusSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(70);
    for (const slug of slugs) {
      let band: ExtractedBand;
      expect(() => (band = extractBandForSlug(slug)), slug).not.toThrow();
      band = extractBandForSlug(slug);
      expect(band.section.length, slug).toBeGreaterThan(0);
      for (const m of CHROME_MARKERS) expect(band.section, `${slug} leaked ${m}`).not.toContain(m);
      expect(band.section, `${slug} kept preview attr`).not.toContain('data-screen-label');
    }
  });
});

// ── WS3b — Reconstruction: scoping + wrapper + marker ────────────────────────

describe('reconstruct-band — scopeBandCss (WS3b: I3 isolation / I6 token preservation)', () => {
  it('descendant-scopes every rule selector under [data-crf="<slug>"]', () => {
    const out = scopeBandCss('.ft-card{color:var(--cr-ink)} .ft-grid{gap:8px}', 'feature-trio');
    assertAllScoped(out, '[data-crf="feature-trio"]');
    // I6 — token var() refs are preserved verbatim (never inlined/rewritten).
    expect(out).toContain('var(--cr-ink)');
  });

  it('maps a body / :root / html selector to the root itself (no escape)', () => {
    const out = scopeBandCss('body{margin:0} :root{--x:1} html .a{color:red}', 'hero-actions');
    const root = parseCss(out);
    root.walkRules((r) => {
      expect(r.selector, `bare global escaped: ${r.selector}`).not.toMatch(/^\s*(body|html|:root)\b/);
      expect(r.selector.startsWith('[data-crf="hero-actions"]')).toBe(true);
    });
  });

  it('scopes selectors INSIDE @media, never the keyframe steps inside @keyframes', () => {
    const css = '@media (max-width:600px){.a{color:red}} @keyframes fade{from{opacity:0}to{opacity:1}}';
    const out = scopeBandCss(css, 'x');
    assertAllScoped(out, '[data-crf="x"]');
    // keyframe step selectors stay literal (from/to/percentages)
    const root = parseCss(out);
    root.walkRules((r) => {
      const p = r.parent as { type?: string; name?: string } | undefined;
      if (p?.type === 'atrule' && /keyframes$/i.test(p.name ?? '')) {
        expect(r.selector).toMatch(/^(from|to|\d+%)/);
      }
    });
  });

  it('namespaces @keyframes names + rewrites animation references (I3 collision-free)', () => {
    const out = scopeBandCss('@keyframes fade{from{opacity:0}to{opacity:1}} .a{animation:fade 1s ease}', 'hero');
    expect(out).toContain('fade__crf-hero');
    const root = parseCss(out);
    root.walkDecls((d) => {
      if (/^animation/i.test(d.prop)) expect(d.value).toContain('fade__crf-hero');
    });
  });

  it('is idempotent — scoping twice equals scoping once (I5)', () => {
    const css = '@keyframes fade{to{opacity:1}} body{margin:0} .a{animation:fade 1s; color:var(--cr-ink)}';
    const once = scopeBandCss(css, 'feature-trio');
    const twice = scopeBandCss(once, 'feature-trio');
    expect(twice).toBe(once);
  });

  it('tolerates a malformed <style> block (F7) without throwing', () => {
    expect(() => scopeBandCss('[data-crf="x"] ; no shared CSS.', 'x')).not.toThrow();
  });
});

describe('reconstruct-band — reconstructBand (WS3b: wrapper + marker generation)', () => {
  const extracted: ExtractedBand = {
    section: '<section class="ft-section"><h2>Hi</h2></section>',
    style: '.ft-section{color:var(--cr-ink)}',
  };

  it('wraps content in exactly one <div data-crf="<slug>"> with the scoped style inside', () => {
    const band = reconstructBand(extracted, 'feature-trio');
    expect(band.startsWith('<div data-crf="feature-trio">')).toBe(true);
    expect(band.trimEnd().endsWith('</div>')).toBe(true);
    // I7 — exactly one marker ELEMENT (the wrapper). NB: the scoped CSS selector
    // `[data-crf="feature-trio"]` legitimately repeats the string — that is scoping, not a
    // second marker; count the element form only.
    expect((band.match(/<div data-crf="feature-trio">/g) ?? []).length).toBe(1);
    expect(band).toContain('<section class="ft-section">');
    assertAllScoped(bandStyleCss(band), '[data-crf="feature-trio"]');
    expect(band).toContain('var(--cr-ink)'); // I6
  });

  it('the root carries NO id / data-archetype (those are WS6, not WS3)', () => {
    const band = reconstructBand(extracted, 'feature-trio');
    const openTag = band.slice(0, band.indexOf('>') + 1);
    expect(openTag).not.toMatch(/\bid=/);
    expect(openTag).not.toContain('data-archetype');
  });

  it('emits no empty <style> when the exemplar carried no styles', () => {
    const band = reconstructBand({ section: '<div class="x">y</div>', style: '' }, 'stat-tiles');
    expect(band).not.toContain('<style>');
    expect(band).toContain('data-crf="stat-tiles"');
  });
});

describe('reconstruct-band — reconstructBandForSlug (WS3a→WS3b contract; determinism)', () => {
  it('extraction → reconstruction yields a scoped, marked band for a real slug', () => {
    const band = reconstructBandForSlug('feature-trio');
    expect(band).toMatch(/^<div data-crf="feature-trio">/);
    expect(band).toContain('ft-section');
    assertAllScoped(bandStyleCss(band), '[data-crf="feature-trio"]');
    expect(bandStyleCss(band)).toContain('var(--cr-'); // I6
    // chrome-free root (no leaked document chrome / token-sheet link)
    for (const m of CHROME_MARKERS) expect(band).not.toContain(m);
  });

  it('is deterministic — repeated reconstruction is byte-identical (I4)', () => {
    expect(reconstructBandForSlug('hero-actions')).toBe(reconstructBandForSlug('hero-actions'));
  });

  it('F1 — a slug with no exemplar throws loud', () => {
    expect(() => reconstructBandForSlug('__not_a_real_slug__')).toThrow(/F1|no exemplar/);
  });
});
