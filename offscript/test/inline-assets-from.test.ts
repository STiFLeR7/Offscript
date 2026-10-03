import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineAssetsFrom } from '../src/flatten/inline-assets.js';

let base: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'offscript-inline-'));
  // 1x1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  writeFileSync(join(base, 'pic.png'), png);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('inlineAssetsFrom', () => {
  it('rewrites <img src> and <style> url() against an explicit base to data-URIs', () => {
    const html = `<html><head><style>.h{background:url("pic.png")}</style></head><body><img src="pic.png"></body></html>`;
    const { html: out, warnings } = inlineAssetsFrom(html, { markupBaseDir: base, styleBaseDir: base });
    expect(out).toContain('data:image/png;base64,');
    expect(out).not.toContain('src="pic.png"');
    expect(warnings).toHaveLength(0);
  });

  it('warns and leaves an unresolved ref as-is (never throws)', () => {
    const html = `<body><img src="missing.png"></body>`;
    const { html: out, warnings } = inlineAssetsFrom(html, { markupBaseDir: base, styleBaseDir: base });
    expect(out).toContain('missing.png');
    expect(warnings.some((w) => w.includes('missing.png'))).toBe(true);
  });
});
