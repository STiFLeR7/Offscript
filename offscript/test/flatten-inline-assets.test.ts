import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { flattenKit, flattenFromKit } from '../src/flatten/index.js';
import { inlineAssets } from '../src/flatten/inline-assets.js';
import { detectKitLayout } from '../src/intake.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const assetKit = join(here, '..', 'fixtures', 'asset-kit');

describe('inlineAssets — asset-kit fixture', () => {
  it('rewrites every relative <img src> and CSS url(...) to a data: URI', () => {
    const { html, warnings } = flattenKit(assetKit);

    // No relative parent-walks survive in the body EXCEPT the deliberately
    // missing one (which is left as-is + warned).
    const relSrcs = [...html.matchAll(/src="(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
    expect(relSrcs).toEqual(['../../assets/missing.svg']);

    // No relative url(...) refs survive in inlined CSS (no missing url() in fixture).
    expect(html).not.toMatch(/url\(["']?\.\.\//);
    expect(html).not.toMatch(/url\(["']?\.\//);

    // The SVG logo became a utf8-encoded data URI.
    expect(html).toContain('data:image/svg+xml;utf8,');

    // The TTF font became a base64 data URI.
    expect(html).toContain('data:font/ttf;base64,');

    // The PNG background became a base64 data URI (kit-root resolved from the
    // <style> block AND harness-dir resolved from the inline style attr both
    // produce image/png).
    expect(html).toContain('data:image/png;base64,');

    // Already-absolute external URLs are left untouched.
    expect(html).toContain('https://example.com/remote.png');
    expect(html).toContain('https://example.com/external.png');

    // Already-`data:` URIs from the source are left intact (idempotent at the URL level).
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');

    // The missing asset produced a warning but did NOT crash the build.
    expect(warnings.some((w) => w.includes('missing.svg'))).toBe(true);
  });

  it('is idempotent — a second pass produces the same HTML and no new asset warnings', () => {
    const kit = detectKitLayout(assetKit);
    const first = flattenFromKit(kit);
    const second = inlineAssets(first.html, kit);
    expect(second.html).toBe(first.html);
    // Second pass walks an already-data: doc; the only un-rewritable refs left
    // are the missing one (still unresolved) and any absolute URLs.
    expect(second.warnings.filter((w) => w.includes('inline-assets:')).length).toBe(
      // first.warnings includes lucide/head warnings too; restrict to inline-assets.
      first.warnings.filter((w) => w.includes('inline-assets:')).length,
    );
  });

  it('leaves already-absolute and data: URLs unchanged when called directly', () => {
    const kit = detectKitLayout(assetKit);
    const input = `<!doctype html><html><head></head><body>
      <img src="https://example.com/x.png">
      <img src="//cdn.example.com/y.png">
      <img src="data:image/png;base64,AAAA">
      <a href="#anchor">a</a>
    </body></html>`;
    const { html, warnings } = inlineAssets(input, kit);
    expect(html).toContain('https://example.com/x.png');
    expect(html).toContain('//cdn.example.com/y.png');
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(warnings.length).toBe(0);
  });
});

// Guarded real-CR smoke: only runs if a gitignored, OLD-LAYOUT CR kit is present
// locally — i.e. a directory carrying a standalone colors_and_type.css to flatten.
// Post-website-pivot the engine emits a SELF-CONTAINED index.html (tokens inlined,
// no separate kit file), so a deliverable dir is not a flattenable kit; requiring
// colors_and_type.css keeps this smoke off self-contained output instead of throwing
// "Invalid kit: missing colors_and_type.css".
const crKit = resolveWorkingDir(DEFAULT_CLIENT, 'website');
const haveCR =
  existsSync(crKit) &&
  statSync(crKit).isDirectory() &&
  existsSync(join(crKit, 'colors_and_type.css'));

describe.runIf(haveCR)('inlineAssets — real Example Brand kit', () => {
  it('produces a self-contained HTML with no surviving relative refs', () => {
    const { html } = flattenKit(crKit);
    // Body asset refs.
    expect(html.match(/src="\.\.\//g) ?? []).toEqual([]);
    expect(html.match(/src="\.\//g) ?? []).toEqual([]);
    // CSS url(...) refs.
    expect(html.match(/url\(["']?\.\.\//g) ?? []).toEqual([]);
    expect(html.match(/url\(["']?\.\//g) ?? []).toEqual([]);
  });
});
