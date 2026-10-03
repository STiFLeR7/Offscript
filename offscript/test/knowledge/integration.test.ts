/**
 * Sprint 2 — Repository Builder: integration against the REAL materialized Offscript
 * repository (offscript/repository/, the committed component-governance slice).
 *
 * Fixture repositories cover isolated unit behavior; this proves the architecture holds
 * on production content: the real repository validates, derives both graphs + diagnostics
 * + statistics, and is byte-deterministic across rebuilds — without manual intervention.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildRepository } from '../../src/knowledge/builder.js';
import { loadRepository } from '../../src/knowledge/source/index.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));

describe('buildRepository — the real materialized repository', () => {
  it('validates and derives all artifacts without intervention', () => {
    const r = buildRepository({ root: REAL_REPO });
    // The component-governance slice materializes 17 families + their variants.
    expect(r.assetCount).toBeGreaterThanOrEqual(17);
    expect(r.diagnostics.validation.status).toBe('clean');
    // Every materialized asset is a canonical component.
    expect(r.statistics.assetsByKind).toEqual({ component: r.assetCount });
    expect(r.statistics.assetsByScope).toEqual({ canonical: r.assetCount });
    // Families produce role concepts; variants specialize them → semantic graph is dense.
    expect(r.semanticGraph.edges.length).toBeGreaterThan(0);
    // The manifest records all four derived artifacts.
    expect(Object.keys(r.manifest.artifacts).sort()).toEqual([
      'dependency-graph',
      'diagnostics',
      'semantic-graph',
      'statistics',
    ]);
  });

  it('is deterministic: two builds yield identical identity + artifact digests', () => {
    const a = buildRepository({ root: REAL_REPO });
    const b = buildRepository({ root: REAL_REPO });
    expect(b.manifest.buildIdentity).toBe(a.manifest.buildIdentity);
    expect(b.manifest.artifacts).toEqual(a.manifest.artifacts);
  });

  // Sprint 2.1 — Stage 1 enrichment: every variant carries authored serves/surface/limits.
  it('carries Stage-1 selection metadata on every variant (serves + surface)', () => {
    const { assets } = loadRepository(REAL_REPO);
    // Variants specialize a role concept; families produce one. Selection facts ride variants.
    const variants = assets.filter((a) => a.semantics.specializes.length > 0);
    expect(variants.length).toBeGreaterThanOrEqual(79);
    for (const v of variants) {
      const serves = v.capabilities.satisfies.filter((t) => t.startsWith('serves:'));
      const surface = v.capabilities.satisfies.filter((t) => t.startsWith('surface:'));
      expect(serves.length, `serves on ${v.identity.id}`).toBeGreaterThan(0);
      expect(surface.length, `surface on ${v.identity.id}`).toBeGreaterThan(0);
    }
  });

  it('migrates known authored facts faithfully (hero-bento)', () => {
    const { assets } = loadRepository(REAL_REPO);
    const hero = assets.find((a) => a.identity.id === 'canonical::hero-bento');
    expect(hero).toBeDefined();
    expect(hero!.capabilities.satisfies).toContain('serves:hero');
    expect(hero!.capabilities.satisfies).toContain('surface:base');
  });

  it('families carry NO selection facts (facts ride variants, not roles)', () => {
    const { assets } = loadRepository(REAL_REPO);
    const families = assets.filter((a) => a.semantics.produces.length > 0);
    for (const f of families) {
      expect(f.capabilities.satisfies, `family ${f.identity.id}`).toEqual([]);
    }
  });

  it('the enriched repository still validates clean', () => {
    const r = buildRepository({ root: REAL_REPO });
    expect(r.diagnostics.validation.status).toBe('clean');
  });
});
