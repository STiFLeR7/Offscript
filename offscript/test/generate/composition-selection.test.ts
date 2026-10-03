/**
 * Sprint 2.1 — Stage 1: the COMPOSITION.md selection reader.
 *
 * The existing parseCompositionCatalog returns SECTION rows only (the router's universe).
 * Stage-1 enrichment needs the selection cells (serves / surface / limits) for EVERY
 * variant — sections AND atoms — so parseCompositionSelection returns all rows, keeping
 * surface as the full authored list. This must not change the existing section parser.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCompositionSelection,
  loadCompositionSelection,
  parseCompositionCatalog,
} from '../../src/generate/composition-md.js';

const MD = `
Prose before the table.

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero bento | \`preview/component-hero-bento.html\` | section | bento | base | reveal-only | hero, feature | tiles | The flagship. {maxPerPage:1} |
| Buttons | \`preview/component-buttons.html\` | atom | atom | base, contrast | static | nav | cta-row | Atom: canonical CTA styles |
`;

describe('parseCompositionSelection — all rows (sections + atoms)', () => {
  const rows = parseCompositionSelection(MD);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  it('includes BOTH section and atom rows', () => {
    expect(bySlug.has('hero-bento')).toBe(true);
    expect(bySlug.has('buttons')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('keeps surface as the full authored list', () => {
    expect(bySlug.get('buttons')!.surface).toEqual(['base', 'contrast']);
    expect(bySlug.get('hero-bento')!.surface).toEqual(['base']);
  });

  it('carries serves and parsed limits', () => {
    expect(bySlug.get('hero-bento')!.serves).toEqual(['hero', 'feature']);
    expect(bySlug.get('hero-bento')!.limits.maxPerPage).toBe(1);
    expect(bySlug.get('buttons')!.serves).toEqual(['nav']);
  });

  it('does NOT change the existing section-only catalog parser', () => {
    const sections = parseCompositionCatalog(MD);
    expect(sections.map((r) => r.slug)).toEqual(['hero-bento']); // atom excluded, unchanged
  });
});

describe('loadCompositionSelection — the real authored catalog', () => {
  const rows = loadCompositionSelection();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  it('reads the full bijection: every authored variant row (sections + atoms)', () => {
    // 65 sections + 14 atoms in the real COMPOSITION.md
    expect(rows.length).toBeGreaterThanOrEqual(79);
    expect(bySlug.has('hero-bento')).toBe(true); // a section
    expect(bySlug.has('divider')).toBe(true); // an atom
  });

  it('every real row carries non-empty serves and surface', () => {
    for (const r of rows) {
      expect(r.serves.length, `serves for ${r.slug}`).toBeGreaterThan(0);
      expect(r.surface.length, `surface for ${r.slug}`).toBeGreaterThan(0);
    }
  });
});
