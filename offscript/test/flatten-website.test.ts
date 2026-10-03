/**
 * WS8 (EA-018 / EA-019) — Flatten Integration: the dormant flatten stage now consumes the
 * validated assembled page using REPOINTED asset/css/font roots.
 *
 * The deleted v2 catalog css/fonts/assets are gone; WS8 repoints `catalogCssPath`,
 * `catalogFontsDir`, and `v2AssetSource` (paths.ts) to the SURVIVING website brand roots
 * under `design_processes/website/` (colors_and_type.css + fonts/ + assets/). All flatten
 * SEMANTICS are preserved (inline / subset / dedup / copy-on-use). This suite proves:
 *   - the repointed roots resolve to real surviving governance (path repoint),
 *   - flatten consumes a validated WS6-shape page + the WS7 gate still PASSES on the
 *     flattened form, with the Curation Table comment + `data-crf` wrappers byte-surviving
 *     (F-1 / F-2),
 *   - the hermetic copy-on-use asset logic is unchanged (F-3/F-4).
 *
 * DORMANT: `flattenWebsite`/`copyOnUseAssets` have no live caller (WS9b wires them into the
 * orchestrator). The catalog is INJECTED (synthetic FragmentEntry[]) for the gate so F-2 is
 * verified hermetically, independent of COMPOSITION.md drift. Font-bytes assertions SKIP
 * without pyftsubset (the page still flattens — full fonts inlined).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flattenWebsite, copyOnUseAssets } from '../src/flatten/flatten-website.js';
import { runValidatePageGate } from '../src/generate/catalog-gate.js';
import type { FragmentEntry } from '../src/generate/catalog.js';
import { pyftsubsetAvailable } from '../src/flatten/subset-fonts.js';
import { catalogCssPath, catalogFontsDir, v2AssetSource, designProcessesDir } from '../src/paths.js';

// ── Synthetic catalog for the gate (mirrors WS7's hermetic catalog) ──────────────

function entry(slug: string, serves: string[], surface: string, layout: string): FragmentEntry {
  return {
    slug,
    serves,
    surface: [surface],
    layout: [layout],
    interaction: [],
    blocks: [],
    direction: '',
    limits: {},
    cat: 'section',
  };
}

const CAT: FragmentEntry[] = [
  entry('hero-actions', ['hero'], 'ink', 'split'),
  entry('hero-bento', ['hero'], 'light', 'bento'),
  entry('footer-dark', ['footer'], 'warm', 'stack'),
  entry('footer-cta', ['footer'], 'light', 'cta-row'),
];

// A WS6-shape assembled page: curation comment leads <main>, anchored data-crf bands, a
// linked token sheet + a relative font url() (the multi-file form flatten consumes).
function assembledPage(): string {
  const comment = [
    '<!--',
    '| intent | surface | candidates | chosen | mode | reason |',
    '| --- | --- | --- | --- | --- | --- |',
    '| hero | ink | hero-actions, hero-bento | hero-actions | as-is | ink surface split layout, chosen over hero-bento |',
    '| footer | warm | footer-dark, footer-cta | footer-dark | as-is | warm surface stack layout, chosen over footer-cta |',
    '-->',
  ].join('\n');
  return [
    '<!doctype html><html><head>',
    '<link rel="stylesheet" href="colors_and_type.css">',
    '<style>@font-face{font-family:InterTest;src:url(fonts/Inter-Bold.ttf)}</style>',
    '</head><body>',
    '<main>',
    comment,
    '<div data-crf="hero-actions" id="hero" data-archetype="hero"><section class="h">Hero</section></div>',
    '<div data-crf="footer-dark" id="foot" data-archetype="footer"><section class="f">Footer</section></div>',
    '</main>',
    '</body></html>',
  ].join('\n');
}

// ── (1) Repointed roots resolve to surviving governance (the WS8 path repoint) ────

describe('flatten-website — WS8 repointed roots resolve to surviving governance', () => {
  it('catalogCssPath → the surviving website brand sheet (not the deleted catalog dir)', () => {
    expect(catalogCssPath()).toBe(join(designProcessesDir('website'), 'colors_and_type.css'));
    expect(existsSync(catalogCssPath())).toBe(true);
  });

  it('catalogFontsDir → the surviving website fonts dir', () => {
    expect(catalogFontsDir()).toBe(join(designProcessesDir('website'), 'fonts'));
    expect(existsSync(catalogFontsDir())).toBe(true);
  });

  it('v2AssetSource default → the surviving website assets root (env override preserved)', () => {
    const prev = process.env.V2_ASSET_SOURCE;
    delete process.env.V2_ASSET_SOURCE;
    try {
      expect(v2AssetSource()).toBe(join(designProcessesDir('website'), 'assets'));
      expect(existsSync(v2AssetSource())).toBe(true);
      process.env.V2_ASSET_SOURCE = '/tmp/some-assets';
      expect(v2AssetSource()).toBe('/tmp/some-assets'); // signature stable
    } finally {
      if (prev === undefined) delete process.env.V2_ASSET_SOURCE;
      else process.env.V2_ASSET_SOURCE = prev;
    }
  });
});

// ── (2) Flatten a validated assembly; gate survives (F-1 / F-2) ───────────────────

describe('flatten-website — flatten the validated assembly + gate survives (F-1/F-2)', () => {
  let baseDir: string;
  let result: ReturnType<typeof flattenWebsite>;

  beforeAll(() => {
    // Stage the multi-file siblings the page links, FROM THE REPOINTED surviving roots,
    // exactly as the orchestrator (WS9b) will.
    baseDir = mkdtempSync(join(tmpdir(), 'offscript-flat-'));
    cpSync(catalogCssPath(), join(baseDir, 'colors_and_type.css'));
    cpSync(catalogFontsDir(), join(baseDir, 'fonts'), { recursive: true });
    result = flattenWebsite({ html: assembledPage(), baseDir });
  });

  afterAll(() => rmSync(baseDir, { recursive: true, force: true }));

  it('inlines the linked token sheet (no <link rel=stylesheet>, a flattened <style> instead)', () => {
    expect(result.html).not.toMatch(/<link\b[^>]*rel=["']stylesheet["']/i);
    expect(result.html).toContain('data-flattened="colors_and_type.css"');
  });

  it('inlines the referenced font — no relative fonts/ ref remains', () => {
    expect(result.html).not.toMatch(/url\(\s*['"]?fonts\/Inter-Bold\.ttf/i);
    expect(result.html).toContain('data:'); // a data: URI replaced the relative font ref
  });

  it.skipIf(!pyftsubsetAvailable())('the FONT payload is ≪ 2.3 MB and strictly smaller than full (the bloat fix)', () => {
    expect(result.stats.fonts).toBeGreaterThan(0);
    expect(result.stats.fontBytesAfter).toBeLessThan(result.stats.fontBytesBefore);
    expect(result.stats.fontBytesAfter).toBeLessThan(2_300_000);
  });

  it('F-1: the Curation Table comment + data-crf wrappers byte-survive the flatten', () => {
    expect(result.html).toContain('| intent | surface | candidates | chosen | mode | reason |');
    expect(result.html).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
    expect(result.html).toContain('<div data-crf="footer-dark" id="foot" data-archetype="footer">');
  });

  it('F-2: the WS7 curation gate still PASSES on the flattened form', () => {
    const gate = runValidatePageGate(result.html, CAT);
    expect(gate.pass, gate.raw).toBe(true);
  });

  it('is deterministic: repeated flatten of the same input is byte-identical', () => {
    expect(flattenWebsite({ html: assembledPage(), baseDir }).html).toBe(
      flattenWebsite({ html: assembledPage(), baseDir }).html,
    );
  });

  it('is idempotent: re-flattening the output changes nothing material', () => {
    const again = flattenWebsite({ html: result.html, baseDir });
    expect(again.html).not.toMatch(/<link\b[^>]*rel=["']stylesheet["']/i);
    expect(again.html).not.toMatch(/url\(\s*['"]?fonts\/Inter-Bold\.ttf/i);
  });
});

// ── (3) Hermetic copy-on-use asset inlining (AP5.3 / F-3/F-4) — logic unchanged ──

describe('flatten-website — copy-on-use image assets (AP5.3)', () => {
  it('inlines an ../assets/* ref from the asset source and leaves unresolved ones', () => {
    const assetSource = mkdtempSync(join(tmpdir(), 'offscript-assets-'));
    const baseDir = mkdtempSync(join(tmpdir(), 'offscript-flatbase-'));
    try {
      mkdirSync(join(assetSource, 'avatars'), { recursive: true });
      // a 1x1 transparent PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      writeFileSync(join(assetSource, 'avatars', 'leader-1.jpg'), png);
      const html =
        '<!doctype html><html><body><main>' +
        '<!-- | intent | surface | candidates | chosen | mode | reason | -->' +
        '<div data-crf="about-value"><img src="../assets/avatars/leader-1.jpg">' +
        '<img src="../assets/avatars/missing.jpg"></div></main></body></html>';
      const r = flattenWebsite({ html, baseDir, assetSource });
      expect(r.html).toContain('data:image/'); // resolved asset inlined
      expect(r.html).toContain('../assets/avatars/missing.jpg'); // unresolved left as-is
      expect(r.stats.assetsInlined).toBe(1);
      expect(r.warnings.join(' ')).toMatch(/missing\.jpg.*unresolved/);
    } finally {
      rmSync(assetSource, { recursive: true, force: true });
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('dedups a CSS background used by N selectors — base64 inlined ONCE, hoisted to a :root var', () => {
    const assetSource = mkdtempSync(join(tmpdir(), 'offscript-assets-'));
    const baseDir = mkdtempSync(join(tmpdir(), 'offscript-flatbase-'));
    try {
      mkdirSync(join(assetSource, 'creative-background'), { recursive: true });
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      writeFileSync(join(assetSource, 'creative-background', 'blur-7.png'), png);
      // SAME background referenced by three different selectors.
      const html =
        '<!doctype html><html><head><style>' +
        '.a{background:url("../assets/creative-background/blur-7.png")}' +
        '.b{background:url("../assets/creative-background/blur-7.png") no-repeat}' +
        '.c{background-image:url("../assets/creative-background/blur-7.png")}' +
        '</style></head><body><main>' +
        '<!-- | intent | surface | candidates | chosen | mode | reason | -->' +
        '<div data-crf="x"></div></main></body></html>';
      const r = flattenWebsite({ html, baseDir, assetSource });
      // the base64 payload appears exactly ONCE (in the :root block), not 3×
      const inlines = r.html.match(/data:image\/[a-z+]*;base64,/g) ?? [];
      expect(inlines).toHaveLength(1);
      // three var() dereferences replaced the three url()s
      expect((r.html.match(/var\(--flat-img-0\)/g) ?? []).length).toBe(3);
      expect(r.html).toContain('<style data-flat-assets>:root{--flat-img-0:url(data:image/');
      expect(r.stats.assetsInlined).toBe(1);
      // no raw url(...assets...) left
      expect(r.html).not.toMatch(/url\(["']?\.\.\/assets/);
    } finally {
      rmSync(assetSource, { recursive: true, force: true });
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('prefers a web/ optimized variant when inlining a heavy <img src> (flat form)', () => {
    const assetSource = mkdtempSync(join(tmpdir(), 'offscript-assets-'));
    const baseDir = mkdtempSync(join(tmpdir(), 'offscript-flatbase-'));
    try {
      mkdirSync(join(assetSource, 'creative-background', 'web'), { recursive: true });
      // a "heavy" master PNG + a tiny web JPG variant beside it
      writeFileSync(join(assetSource, 'creative-background', 'blur-7.png'), Buffer.alloc(50_000, 1));
      const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ==', 'base64');
      writeFileSync(join(assetSource, 'creative-background', 'web', 'blur-7.jpg'), jpg);
      const html =
        '<main><!-- | intent | surface | candidates | chosen | mode | reason | -->' +
        '<div data-crf="x"><img src="../assets/creative-background/blur-7.png"></div></main>';
      const r = flattenWebsite({ html, baseDir, assetSource });
      expect(r.html).toContain('data:image/jpeg;base64,'); // the web JPG, not the PNG master
      expect(r.html).not.toContain('data:image/png;base64,'); // the 50 KB PNG was NOT inlined
    } finally {
      rmSync(assetSource, { recursive: true, force: true });
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('copyOnUseAssets prefers the web/ variant and mirrors its path', () => {
    const assetSource = mkdtempSync(join(tmpdir(), 'offscript-assets-'));
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-out-'));
    try {
      mkdirSync(join(assetSource, 'creative-background', 'web'), { recursive: true });
      writeFileSync(join(assetSource, 'creative-background', 'blur-7.png'), Buffer.alloc(50_000, 1));
      writeFileSync(join(assetSource, 'creative-background', 'web', 'blur-7.jpg'), Buffer.from('jpg'));
      const html = '<main><div data-crf="x"><img src="../assets/creative-background/blur-7.png"></div></main>';
      const r = copyOnUseAssets({ html, outDir, assetSource });
      expect(r.html).toContain('src="assets/creative-background/web/blur-7.jpg"'); // ref → web variant
      expect(existsSync(join(outDir, 'assets', 'creative-background', 'web', 'blur-7.jpg'))).toBe(true);
      expect(existsSync(join(outDir, 'assets', 'creative-background', 'blur-7.png'))).toBe(false); // master not copied
    } finally {
      rmSync(assetSource, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('copyOnUseAssets copies only referenced assets to a sibling assets/ and rewrites refs', () => {
    const assetSource = mkdtempSync(join(tmpdir(), 'offscript-assets-'));
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-out-'));
    try {
      mkdirSync(join(assetSource, 'avatars'), { recursive: true });
      writeFileSync(join(assetSource, 'avatars', 'leader-1.jpg'), Buffer.from('jpgbytes'));
      writeFileSync(join(assetSource, 'avatars', 'unused.jpg'), Buffer.from('nope'));
      const html = '<main><div data-crf="x"><img src="../assets/avatars/leader-1.jpg"></div></main>';
      const r = copyOnUseAssets({ html, outDir, assetSource });
      expect(r.copied).toBe(1); // only the referenced asset traveled, not unused.jpg
      expect(r.html).toContain('src="assets/avatars/leader-1.jpg"'); // rewritten to sibling
      expect(existsSync(join(outDir, 'assets', 'avatars', 'leader-1.jpg'))).toBe(true);
      expect(existsSync(join(outDir, 'assets', 'avatars', 'unused.jpg'))).toBe(false);
    } finally {
      rmSync(assetSource, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── W50 Track 2: legacy-layout asset refs still resolve (basename fallback) ──────
// The curated exemplar fragments carry flat/legacy refs (`../assets/logo-color.svg`,
// `../assets/creative-background/blur-7.png`) that do NOT mirror the nested v2 library
// layout (`assets/logo/…`, `assets/imagery/backgrounds/…`). resolveImageRef must fall
// back to a deterministic basename search so the deployable is ACTUALLY self-contained.
import { designProcessesDir, v2AssetSource } from '../src/paths.js';

describe('W50 Track 2 — legacy-layout asset refs inline via basename fallback', () => {
  const baseDir = designProcessesDir('website');
  const assetSource = v2AssetSource();

  it('inlines a flat logo ref (`../assets/logo-color.svg`) that really lives at assets/logo/', () => {
    const html = `<!doctype html><html><head></head><body><img src="../assets/logo-color.svg" alt="x"></body></html>`;
    const r = flattenWebsite({ html, baseDir, assetSource });
    expect(r.html).not.toContain('../assets/logo-color.svg');
    expect(r.html).toContain('data:image/svg+xml');
    expect(r.stats.assetsInlined).toBeGreaterThanOrEqual(1);
  });

  it('inlines a flat texture ref (`../assets/texture-grain.png`) that lives at assets/imagery/textures/', () => {
    const html = `<!doctype html><html><head></head><body><div style="background:url('../assets/texture-grain.png')"></div></body></html>`;
    const r = flattenWebsite({ html, baseDir, assetSource });
    expect(r.html).not.toContain('../assets/texture-grain.png');
    expect(r.html).toContain('data:image');
  });

  it('resolves a legacy web-variant ref (`web/blur-7.jpg`) to the optimized `-web` sibling', () => {
    const html = `<div style="--img:url('../assets/creative-background/web/blur-7.jpg')"></div>`;
    const r = flattenWebsite({ html, baseDir, assetSource });
    expect(r.html).not.toContain('../assets/creative-background/web/blur-7.jpg');
    expect(r.html).toContain('data:image');
    expect(r.warnings.some((w) => w.includes('blur-7.jpg'))).toBe(false);
  });

  it('leaves a genuinely-missing asset unresolved (no false positive) and warns', () => {
    const html = `<img src="../assets/does-not-exist-anywhere.png">`;
    const r = flattenWebsite({ html, baseDir, assetSource });
    expect(r.html).toContain('../assets/does-not-exist-anywhere.png');
    expect(r.warnings.some((w) => w.includes('does-not-exist-anywhere.png'))).toBe(true);
  });
});
