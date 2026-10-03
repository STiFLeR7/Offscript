/**
 * Path C / P5 — font subsetting (AP5.2). The size-reduction tests spawn the real
 * `pyftsubset`; they SKIP when fonttools isn't installed (so default CI without the dev
 * tool stays green, mirroring the OFFSCRIPT_PLAYWRIGHT render-rail gating). The pure
 * `collectUsedText` logic always runs.
 */

import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { designProcessesDir } from '../src/paths.js';
import { join } from 'node:path';
import {
  collectUsedText,
  subsetFontToDataUri,
  pyftsubsetAvailable,
} from '../src/flatten/subset-fonts.js';

describe('subset-fonts — collectUsedText', () => {
  it('includes the printable-ASCII baseline (≥95 codepoints) regardless of input', () => {
    expect([...collectUsedText('')].length).toBeGreaterThanOrEqual(95);
  });

  it('keeps a non-ASCII glyph from VISIBLE text', () => {
    const text = collectUsedText('<p>40% faster — vetted</p>');
    expect(text).toContain('—'); // em-dash from the visible copy
  });

  it('excludes glyphs that only appear in comments / script / style bodies', () => {
    // ƒ (U+0192) appears ONLY inside a comment, a script, and a style — never rendered.
    const html = '<!-- ƒ --><script>var ƒ=1</script><style>.x{}/* ƒ */</style><p>hello</p>';
    expect(collectUsedText(html)).not.toContain('ƒ');
  });

  it('is deduped + sorted (deterministic for a fixed page)', () => {
    const a = collectUsedText('<p>banana</p>');
    const b = collectUsedText('<p>banana</p>');
    expect(a).toBe(b);
    expect([...a].length).toBe(new Set([...a]).size); // no duplicates
  });
});

describe.skipIf(!pyftsubsetAvailable())('subset-fonts — subsetFontToDataUri (real pyftsubset)', () => {
  // Post-pivot: fonts live at the website governance dir (the Path-C catalog/fonts is retired).
  const websiteFonts = join(designProcessesDir('website'), 'fonts');
  const interRegular = join(websiteFonts, 'Inter-Regular.ttf');

  it('shrinks a font to the used glyph set and returns a data: URI', () => {
    const full = statSync(interRegular).size;
    const r = subsetFontToDataUri(interRegular, collectUsedText('<p>The quick brown fox 0123456789</p>'));
    expect(r).not.toBeNull();
    expect(r!.dataUri.startsWith('data:font/')).toBe(true);
    expect(r!.bytes).toBeLessThan(full); // subset is strictly smaller than the full TTF
    expect(r!.bytes).toBeLessThan(full / 2); // and dramatically so (≥2× cut)
  });

  it('returns null for a non-existent font (caller then inlines full / warns)', () => {
    expect(subsetFontToDataUri(join(websiteFonts, 'Nope-Missing.ttf'), 'abc')).toBeNull();
  });
});
