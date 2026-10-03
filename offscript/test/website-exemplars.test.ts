/**
 * Website exemplars — SEEDED reference fragments (A3, Phase 3).
 *
 * The website track authors from governance, but each section's authoring request is
 * now threaded with a curated REFERENCE fragment: the 17 rail-clean exemplars under
 * `resources/design_processes/website/exemplars/fragments/`. `selectExemplar(
 * archetype, 'website')` therefore resolves to a non-empty fragment for every mapped
 * archetype (it no longer degrades to '' — that was the empty-dir interim state, now
 * superseded by the seeded set; see test/operators/website-exemplar-fragments.test.ts).
 *
 * The on-disk STUDY SET — the read-only
 * `resources/design_processes/website/exemplars/sections/component-*.html` files
 * (the design-team's gold-standard component studies) — remains the broader steer.
 * This test asserts:
 *   1. the website exemplar lookup resolves to a non-empty fragment
 *   2. the on-disk study set is present (the 79 component-*.html files)
 * plus the house sheet brand facts (Instrument Sans; --cr-brand → --cr-accent-blue → #26B7FF;
 * --cr-ink → --cr-neutral-1000 → #171716).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { selectExemplar } from '../src/generate/author-contract.js';

const SECTIONS_DIR = join(
  process.cwd(),
  'resources',
  'design_processes',
  'website',
  'exemplars',
  'sections',
);
const SHEET = join(
  process.cwd(),
  'resources',
  'design_processes',
  'website',
  'colors_and_type.css',
);

// Representative website archetypes — each now resolves to a seeded reference
// fragment (the 17 curated exemplars, A3).
const ARCHETYPES = ['hero', 'logo-bar', 'feature-grid', 'pricing', 'faq', 'cta-banner', 'footer'];

describe('website exemplars are seeded reference fragments (A3)', () => {
  for (const archetype of ARCHETYPES) {
    it(`selectExemplar('${archetype}', 'website') resolves to a fragment`, () => {
      expect(
        selectExemplar(archetype, 'website'),
        `${archetype} must resolve to a seeded reference fragment — the website track ` +
          `threads a curated exemplar into its authoring request`,
      ).not.toBe('');
    });
  }

  it('the on-disk component study set is present (79 component-*.html files)', () => {
    const studies = readdirSync(SECTIONS_DIR).filter(
      (f) => f.startsWith('component-') && f.endsWith('.html'),
    );
    expect(
      studies.length,
      'the gold-standard component studies are the concrete on-disk steer',
    ).toBe(79);
  });

  it('the house sheet is themed to Instrument Sans (display + body, one family)', () => {
    const css = readFileSync(SHEET, 'utf8');
    expect(css).toMatch(/--cr-font-display:\s*"Instrument Sans"/);
    expect(css).toMatch(/--cr-font-body:\s*var\(--cr-font-display\)/);
  });

  it('the house sheet carries the brand tokens (--cr-brand → #26B7FF, --cr-ink → #171716)', () => {
    const css = readFileSync(SHEET, 'utf8');
    expect(css).toMatch(/--cr-brand:\s*var\(--cr-accent-blue\)/);
    expect(css).toMatch(/--cr-accent-blue:\s*var\(--cr-blue-500\)/);
    expect(css).toMatch(/--cr-blue-500:\s*#26B7FF/);
    expect(css).toMatch(/--cr-ink:\s*var\(--cr-neutral-1000\)/);
    expect(css).toMatch(/--cr-neutral-1000:\s*#171716/);
  });
});
