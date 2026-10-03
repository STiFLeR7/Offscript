/**
 * PKG-4 — planner catalog is projection-driven (parity).
 *
 * The planner's FragmentEntry catalog (loadFragmentCatalog) is now sourced from the
 * PKG-3 derived projection instead of reading COMPOSITION.md directly. Because the
 * projection derives the same variant facts in canonical order (proven in PKG-3), the
 * projection-backed catalog must be byte-for-byte identical to the prior
 * repository-derived catalog — the parity guarantee PKG-4 requires before any behavior
 * change. These tests pin that equivalence and prove the source is the projection.
 */
import { describe, it, expect } from 'vitest';
import { loadFragmentCatalog, compositionRowToFragmentEntry } from '../../src/generate/catalog.js';
import { loadCompositionCatalog } from '../../src/generate/composition-md.js';
import { loadProjection } from '../../src/knowledge/projection.js';

describe('PKG-4 catalog parity — projection-backed catalog equals the canonical-derived catalog', () => {
  it('loadFragmentCatalog() deep-equals the COMPOSITION.md row derivation (planner parity)', () => {
    const projectionBacked = loadFragmentCatalog();
    const rowDerived = loadCompositionCatalog().map(compositionRowToFragmentEntry);
    expect(projectionBacked).toEqual(rowDerived);
  });

  it('the planner catalog is sourced from the projection (same variants, same order)', () => {
    const catalog = loadFragmentCatalog();
    const variants = loadProjection('website').variants;
    expect(catalog.map((f) => f.slug)).toEqual(variants.map((v) => v.variant));
    // Field-level parity against the projection for every entry.
    catalog.forEach((f, i) => {
      const v = variants[i];
      expect(f.serves).toEqual(v.serves);
      expect(f.surface).toEqual(v.surface);
      expect(f.layout).toEqual(v.layout);
      expect(f.blocks).toEqual(v.blocks);
      expect(f.interaction).toEqual(v.interaction);
      expect(f.direction).toEqual(v.direction);
      expect(f.limits).toEqual(v.limits);
      expect(f.cat).toBe('section');
    });
  });

  it('the rows-injection path is unchanged (tests still drive a synthetic catalog)', () => {
    const rows = loadCompositionCatalog().slice(0, 3);
    const injected = loadFragmentCatalog(rows);
    expect(injected).toEqual(rows.map(compositionRowToFragmentEntry));
  });
});
