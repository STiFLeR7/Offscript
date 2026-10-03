/**
 * PKG-4A — projection contract completion: the router consumes the projection.
 *
 * PKG-4 left the composition router (assignWebsiteCompositions) reading COMPOSITION.md
 * directly because the projection did not expose the variant display name. PKG-4A
 * completes the projection contract: the projection now carries `name`, and
 * `projectedCompositionRows()` reconstructs the full CompositionRow view the router
 * consumes — at byte parity with loadCompositionCatalog(). These tests pin that the
 * projection is now field-complete for the planner and that the row view is identical.
 */
import { describe, it, expect } from 'vitest';
import { loadCompositionCatalog } from '../../src/generate/composition-md.js';
import { loadProjection, projectedCompositionRows } from '../../src/knowledge/projection.js';

describe('PKG-4A projection contract — the full CompositionRow view is projection-derived', () => {
  it('every projected variant carries the canonical display name (COMPOSITION.md)', () => {
    const proj = loadProjection('website');
    const bySlug = new Map(loadCompositionCatalog().map((r) => [r.slug, r]));
    for (const v of proj.variants) {
      expect(v.name, v.variant).toBe(bySlug.get(v.variant)!.name);
    }
  });

  it('projectedCompositionRows() deep-equals loadCompositionCatalog() (router parity)', () => {
    expect(projectedCompositionRows('website')).toEqual(loadCompositionCatalog());
  });

  it('the projected row view exposes every CompositionRow field the router reads', () => {
    const rows = projectedCompositionRows('website');
    const sample = rows[0];
    for (const key of ['name', 'slug', 'serves', 'surface', 'direction', 'layout', 'blocks', 'limits'] as const) {
      expect(sample, key).toHaveProperty(key);
    }
  });
});
