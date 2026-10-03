/**
 * Flatten — font subsetting (Path C / P5, AP5.2): kill the 2.3 MB full-TTF bloat.
 *
 * The Path-C website page links `colors_and_type.css`, whose @font-face blocks reference
 * the full TTF families (`./fonts/Inter-Regular.ttf` … — Inter alone is 1.37 MB across
 * four weights). Inlining those verbatim is the 2.3 MB deliverable bloat PRISM flagged.
 * This module SUBSETS each referenced font to the glyph set the page actually uses, via
 * the `fonttools` `pyftsubset` CLI (the de-facto standard subsetter; already on the box —
 * see the external-dependencies note in CLAUDE.md). A marketing page draws ~200–400 unique
 * codepoints, so each weight drops from ~340 KB to ~25–40 KB — a ~10× cut.
 *
 * FORMAT (dossier sanctions "woff2 OR subset-TTF"):
 *   - woff2 when the Brotli Python extension is present (`pyftsubset --flavor=woff2`) —
 *     the smallest output (~half of subset-TTF again).
 *   - subset-TTF otherwise — no extra dependency, still the ~10× win. The code auto-detects
 *     and upgrades to woff2 the moment `pip install brotli` is run; nothing else changes.
 *
 * GRACEFUL DEGRADATION (mirrors css-rep's tolerant parse): if `pyftsubset` is not on PATH,
 * subsetting is SKIPPED — the caller inlines the full font and pushes a warning. The
 * deliverable still ships (just larger); a missing dev tool never breaks the pipeline.
 * Determinism: pyftsubset is deterministic for a fixed input + glyph set; we sort the
 * codepoint set so the same page always yields the same subset bytes.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Result of subsetting one font file. */
export interface SubsetResult {
  /** the subset font as a `data:` URI (woff2 or font/ttf), ready to drop into `src:url(...)`. */
  dataUri: string;
  /** subset byte count (the raw font, pre-base64). */
  bytes: number;
  /** the emitted format. */
  format: 'woff2' | 'ttf';
}

let _pyftsubset: boolean | undefined;
let _brotli: boolean | undefined;

/** Is `pyftsubset` (fonttools) invokable? Cached. */
export function pyftsubsetAvailable(): boolean {
  if (_pyftsubset !== undefined) return _pyftsubset;
  try {
    execFileSync('pyftsubset', ['--help'], { stdio: 'ignore' });
    _pyftsubset = true;
  } catch {
    _pyftsubset = false;
  }
  return _pyftsubset;
}

/** Is the Brotli Python extension present (→ woff2 output)? Cached. */
export function brotliAvailable(): boolean {
  if (_brotli !== undefined) return _brotli;
  try {
    execFileSync('python', ['-c', 'import brotli'], { stdio: 'ignore' });
    _brotli = true;
  } catch {
    _brotli = false;
  }
  return _brotli;
}

/**
 * Collect the unique codepoints the page actually renders. Strips HTML comments (the
 * Curation Table lives in one), `<script>` and `<style>` bodies (their source text is not
 * rendered glyphs), then the remaining tags — leaving the visible text. A printable-ASCII
 * baseline (0x20–0x7E) is always included so digits / punctuation that a late JS render or
 * a `::before content` might introduce are never dropped. Returns a string suitable for
 * `pyftsubset --text=` (deduped + sorted for determinism).
 */
export function collectUsedText(html: string): string {
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // decode the handful of entities that map to glyphs we'd otherwise miss
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  const set = new Set<number>();
  for (let i = 0x20; i <= 0x7e; i++) set.add(i); // printable-ASCII baseline
  for (const ch of visible) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x20) set.add(cp);
  }
  return [...set]
    .sort((a, b) => a - b)
    .map((cp) => String.fromCodePoint(cp))
    .join('');
}

/**
 * Subset one font file to `usedText` and return it as a `data:` URI. Returns `null` when
 * `pyftsubset` is unavailable OR the font path doesn't exist (the caller then inlines the
 * full font + warns). woff2 when Brotli is present, else subset-TTF.
 */
export function subsetFontToDataUri(absFontPath: string, usedText: string): SubsetResult | null {
  if (!existsSync(absFontPath) || !pyftsubsetAvailable()) return null;
  const woff2 = brotliAvailable();
  const dir = mkdtempSync(join(tmpdir(), 'offscript-subset-'));
  try {
    const textFile = join(dir, 'used.txt');
    writeFileSync(textFile, usedText, 'utf8');
    const outFile = join(dir, woff2 ? 'out.woff2' : 'out.ttf');
    const argv = [
      absFontPath,
      `--text-file=${textFile}`,
      `--output-file=${outFile}`,
      // keep all OpenType layout features for the retained glyphs (ligatures, kerning).
      "--layout-features=*",
    ];
    if (woff2) argv.push('--flavor=woff2');
    execFileSync('pyftsubset', argv, { stdio: 'ignore' });
    const buf = readFileSync(outFile);
    const mime = woff2 ? 'font/woff2' : 'font/ttf';
    return {
      dataUri: `data:${mime};base64,${buf.toString('base64')}`,
      bytes: buf.length,
      format: woff2 ? 'woff2' : 'ttf',
    };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
