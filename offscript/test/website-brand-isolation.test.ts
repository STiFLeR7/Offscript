import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBrandContract, designProcessesDir, designPrinciplesDir } from '../src/paths.js';

/**
 * WEB-P0 — website→collateral brand-contamination guard.
 *
 * With no website-specific colors_and_type.css on disk, resolveBrandContract(_,'website')
 * falls through to design_principles/ (the collateral navy/periwinkle/legacy-indigo brand).
 * A website run would then silently adopt the wrong brand. These tests pin the website track
 * to its OWN sheet (Instrument Sans, --cr-brand → --cr-accent-blue → #26B7FF, --cr-ink →
 * --cr-neutral-1000 → #171716) and assert it is NOT the collateral sheet — the isolation that
 * is rule #1.
 */
describe('website brand isolation (contamination guard)', () => {
  it('website resolves to the website sheet, NOT design_principles', () => {
    const dir = resolveBrandContract('example-brand', 'website');
    expect(dir).toBe(designProcessesDir('website'));
    expect(dir).not.toBe(designPrinciplesDir());
    expect(existsSync(join(dir, 'colors_and_type.css'))).toBe(true);
  });

  it('the website sheet carries the website vocabulary, not the collateral navy/periwinkle', () => {
    const dir = resolveBrandContract('example-brand', 'website');
    const css = readFileSync(join(dir, 'colors_and_type.css'), 'utf8');
    // website near-black, NOT collateral #020B1B navy
    expect(css).toMatch(/--cr-ink:\s*var\(--cr-neutral-1000\)/i);
    expect(css).toMatch(/--cr-neutral-1000:\s*#171716/i);
    expect(css).toMatch(/--cr-brand:\s*var\(--cr-accent-blue\)/i); // action blue, via the accent chain
    expect(css).toMatch(/--cr-font-display:\s*"Instrument Sans"/i); // Instrument Sans (Urbanist retired)
  });
});
