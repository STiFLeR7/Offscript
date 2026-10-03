/**
 * Phase 5 — Track parity: generate-collateral tests
 *
 * Verifies that authorDocument + validate work for the collateral track via the
 * same scripted-author pipeline smoke path as the website track.
 *
 * Coverage:
 *  (a) authorDocument(collateral ctx) → isCollateral(html) true, cr-page count
 *      matches plan items, self-contained (no relative url("fonts/ refs, data:font
 *      present), deterministic (twice → byte-identical).
 *  (b) validate(collateralHtml, collateralCtx) → RunScore via collateralRegistry
 *      (buckets.total ≥ 1, static rails ran).
 *  (c) Regression: website path produces non-cr-doc section output (isCollateral false).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import { validate } from '../src/generate/validate.js';
import { isCollateral } from '../src/collateral/intake.js';
import { parseHtml } from '../src/working-rep.js';

// ── Shared collateral fixture ─────────────────────────────────────────────────

let collateralHtml: string;
let collateralCtx: ReturnType<typeof buildContext>;
let collateralItemCount: number;

beforeAll(async () => {
  collateralCtx = buildContext('example-brand', 'collateral');
  const p = plan(collateralCtx);
  collateralItemCount = p.items.length;
  const { html } = await authorDocument(p, collateralCtx, defaultScriptedAuthor());
  collateralHtml = html;
});

// ── (a) authorDocument — collateral-shaped output ─────────────────────────────

describe('authorDocument — collateral track produces cr-doc structure', () => {
  it('isCollateral(html) === true (class="cr-doc" present)', () => {
    expect(isCollateral(collateralHtml)).toBe(true);
  });

  it('cr-page count matches plan item count', () => {
    // Count <section class="cr-page ..."> wrappers (the cover carries extra modifier
    // classes — cr-page--bleed cr-page--dark — so match the section-wrapper prefix, not
    // an exact class="cr-page" string).
    const matches = collateralHtml.match(/<section class="cr-page\b/g);
    const crPageCount = matches ? matches.length : 0;
    expect(crPageCount).toBe(collateralItemCount);
    // The cover is a full-bleed dark page (matches the house handoff — no white frame).
    expect(collateralHtml).toMatch(/<section class="cr-page cr-page--bleed cr-page--dark">/);
    // Also assert the range is within collateral bounds (1–4)
    expect(crPageCount).toBeGreaterThanOrEqual(1);
    expect(crPageCount).toBeLessThanOrEqual(4);
  });

  it('output parses as valid HTML (no throw)', () => {
    expect(() => parseHtml(collateralHtml)).not.toThrow();
  });

  it('self-contained: no surviving relative url("fonts/ refs', () => {
    expect(collateralHtml).not.toMatch(/url\(\s*["']?fonts\//);
    expect(collateralHtml).not.toMatch(/url\(\s*["']?\.{1,2}\//);
  });

  it('self-contained: data:font URI present (brand font inlined)', () => {
    expect(collateralHtml).toMatch(/data:font/);
  });

  it('zero-JS charter: collateral assembly emits NO <script> (behaviour library is website-only)', () => {
    // Structural track-isolation proof for the engine behaviour embed: the
    // website-only behavior.js is gated on track === 'website' in authorDocument,
    // so collateral output must carry no script tag at all.
    expect(collateralHtml).not.toContain('<script');
  });

  it('deterministic: two calls produce byte-identical HTML', async () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const { html: html1 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    const { html: html2 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html1).toBe(html2);
  });

  it('contains minimal A4 inline style (collateral inlineStyle emitted)', () => {
    // The COLLATERAL_INLINE_STYLE is emitted as a second <style> block
    expect(collateralHtml).toContain('.cr-page');
    expect(collateralHtml).toContain('210mm');
  });

  it('emits the uniform footer-pin rule (every .cr-page-foot absolutely pinned to the bottom margin)', () => {
    // House furniture, not a per-author choice: the engine pins .cr-page-foot ABSOLUTELY
    // into the bottom margin so the baseline is identical on every page AND the footer
    // adds zero content-flow height (a margin-top:auto flow footer overflowed the page
    // on content-dense pages once auto-margin collapsed to 0). Requires .cr-page relative.
    expect(collateralHtml).toMatch(/\.cr-page\s*\{[^}]*position:\s*relative/);
    expect(collateralHtml).toMatch(/\.cr-doc\s+\.cr-page-foot\s*\{[^}]*position:\s*absolute[^}]*bottom:\s*8mm/);
  });

  it('embeds the Example Brand logo lockup (both variants, once, as SVG data-URIs)', () => {
    // House rule: the brand mark is the real SVG wordmark (white on dark, colour on white),
    // never a text wordmark. The engine embeds both lockups ONCE as background data-URIs so a
    // header just references the class. Guards the "No logo of Example Brand" fix.
    expect(collateralHtml).toMatch(
      /\.cr-logo-mark--white\s*\{\s*background-image:\s*url\("data:image\/svg\+xml;base64,/,
    );
    expect(collateralHtml).toMatch(
      /\.cr-logo-mark--color\s*\{\s*background-image:\s*url\("data:image\/svg\+xml;base64,/,
    );
    // Embedded once each (not repeated per page).
    expect((collateralHtml.match(/\.cr-logo-mark--white \{ background-image/g) ?? []).length).toBe(1);
    expect((collateralHtml.match(/\.cr-logo-mark--color \{ background-image/g) ?? []).length).toBe(1);
  });

  it('each plan item anchor id appears inside a cr-page context', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    // All anchor ids are present in the html
    for (const item of p.items) {
      expect(collateralHtml).toContain(`id="${item.anchor.id}"`);
    }
  });
});

// ── (a2) canonical footer — every page identical (Issue 2 fix) ────────────────

describe('canonical footer — every page identical (Issue 2 fix)', () => {
  it('emits exactly plan.items.length footers, all byte-identical', () => {
    const feet = collateralHtml.match(/<footer class="cr-page-foot"[\s\S]*?<\/footer>/g) ?? [];
    expect(feet.length).toBe(collateralItemCount);
    const first = feet[0];
    for (const f of feet) expect(f).toBe(first);
  });
  it('footer carries project identity without inventing a domain or commercial tagline', () => {
    const feet = collateralHtml.match(/<footer class="cr-page-foot"[\s\S]*?<\/footer>/g) ?? [];
    expect(feet.length).toBeGreaterThan(0);
    for (const foot of feet) {
      expect(foot).toContain('Example Brand');
      expect(foot).not.toContain('example-brand.com');
      expect(foot).not.toContain('AI strategy');
    }
    // Every wrong-project right span Fix C removed must be absent — including
    // "An autonomous digital worker" (Dr. Scribe's tagline), which was NOT Example Brand's.
    expect(collateralHtml).not.toContain('An autonomous digital worker');
    expect(collateralHtml).not.toContain('Dr. Scribe');
    expect(collateralHtml).not.toContain('Figures illustrative');
    expect(collateralHtml).not.toContain('Agentic Process Automation');
  });
});

// ── (b) validate — collateralRegistry runs, score populated ──────────────────

describe('validate — collateral track runs collateralRegistry (static rails)', () => {
  it('returns a RunScore with systematicRatio in [0,1]', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-collateral-validate-a-'));
    try {
      const result = await validate(collateralHtml, collateralCtx, { outDir });
      expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
      expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('buckets.total ≥ 1 (static rails fired, not vacuous)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-collateral-validate-b-'));
    try {
      const result = await validate(collateralHtml, collateralCtx, { outDir });
      expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('per-rail breakdown is non-empty (collateralRegistry ops ran)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-collateral-validate-c-'));
    try {
      const result = await validate(collateralHtml, collateralCtx, { outDir });
      expect(result.perRail.length).toBeGreaterThan(0);
      for (const entry of result.perRail) {
        expect(typeof entry.operator.name).toBe('string');
        expect(Array.isArray(entry.findings)).toBe(true);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('collateral-specific rails are present in perRail (square-page-corners, column-count)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-collateral-validate-d-'));
    try {
      const result = await validate(collateralHtml, collateralCtx, { outDir });
      const railNames = result.perRail.map((r) => r.operator.name);
      expect(railNames).toContain('square-page-corners');
      expect(railNames).toContain('column-count');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes score.json to outDir', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-collateral-validate-e-'));
    try {
      await validate(collateralHtml, collateralCtx, { outDir });
      expect(existsSync(join(outDir, 'score.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (c) Regression: website path is NOT isCollateral ─────────────────────────
//
// NOTE: the house colors_and_type.css ITSELF contains .cr-doc / .cr-page
// selectors (the house CSS defines those layout classes). So both website and
// collateral HTML have "cr-doc" in the <style> block. The discriminator is
// isCollateral() which checks for a class="cr-doc" HTML attribute — only the
// collateral path emits <main class="cr-doc">.

describe('authorDocument — website path regression (unchanged)', () => {
  it('website output is NOT collateral (isCollateral false)', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(isCollateral(html)).toBe(false);
  });

  it('website output is self-contained #root-rooted (<div id="root">, no <main> shell)', async () => {
    // Post-pivot (author-from-governance): the website deliverable is a single
    // self-contained document mounted in <div id="root"> (like collateral), NOT a
    // v2 _shell.html <main> paste zone. cr-doc/cr-page wrappers stay collateral-only
    // (asserted separately below).
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html).toContain('<div id="root">');
    expect(html).not.toMatch(/<main\b/);
  });

  it('website output does NOT have class="cr-doc" attribute (no cr-doc wrapper)', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    // The website path must not emit a class="cr-doc" wrapper element
    expect(html).not.toMatch(/class\s*=\s*["'][^"']*\bcr-doc\b/);
  });

  it('website output does NOT have class="cr-page" attribute (no cr-page wrappers)', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    // The website path must not emit class="cr-page" wrapper elements
    expect(html).not.toMatch(/class\s*=\s*["'][^"']*\bcr-page\b/);
  });
});
