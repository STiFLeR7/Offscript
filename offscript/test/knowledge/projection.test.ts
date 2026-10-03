/**
 * PKG-3 — Derived Planner Projection Layer.
 *
 * The projection is the planner-facing read model DERIVED from canonical knowledge
 * (PKG-2 altitudes + inheritance bridge, joined with the COMPOSITION.md variant facts).
 * It owns nothing; canonical owns everything. These tests prove: derivation from real
 * canonical data, provenance (one owner per fact), downward-only inheritance,
 * determinism (delete + regenerate → byte-identical), derived-only parity with the
 * existing planner catalog, growth-safety (new canonical → projection grows, zero code
 * change), and fail-loud on a broken join.
 */
import { describe, it, expect } from 'vitest';
import {
  buildProjection,
  loadProjection,
  regenerateProjection,
  _resetProjectionCache,
  serializeProjection,
  discoverProjectionSources,
  validateProjection,
  assertProjection,
  type ProjectedVariant,
} from '../../src/knowledge/projection.js';
import { parseFamilyModel } from '../../src/knowledge/inheritance.js';
import { altitudeRank } from '../../src/knowledge/altitudes.js';
import { loadCompositionCatalog } from '../../src/generate/composition-md.js';
import { compositionRowToFragmentEntry } from '../../src/generate/catalog.js';

const COMP_SRC = 'resources/design_processes/website/component-governance/COMPOSITION.md';
const COMPONENTS_SRC = 'resources/design_processes/website/component-governance/components.md';

describe('PKG-3 projection — derived from the real canonical website knowledge', () => {
  const proj = buildProjection('website');

  it('projects every selectable section variant (64), covering 15 families', () => {
    expect(proj.variants.length).toBe(64);
    expect(proj.families.length).toBe(15);
  });

  it('every projected variant inherits a non-empty family + carries its angle', () => {
    for (const v of proj.variants) {
      expect(v.family, v.variant).not.toBe('');
      expect(v.angle.length, v.variant).toBeGreaterThan(0);
    }
  });

  it('inheritance reflects the canonical bridge (variant → family)', () => {
    const fam = (slug: string) => proj.variants.find((v) => v.variant === slug)?.family;
    expect(fam('hero-bento')).toBe('Hero');
    expect(fam('feature-trio')).toBe('Feature / value-prop');
    expect(fam('footer-dark')).toBe('Footer');
  });
});

describe('PKG-3 projection — provenance: every fact traces to exactly one canonical owner', () => {
  const proj = buildProjection('website');

  it('each variant attributes role+differentiation to components.md @ family, composition to COMPOSITION.md @ variant', () => {
    const v = proj.variants.find((x) => x.variant === 'hero-bento')!;
    const role = v.provenance.find((p) => p.fact === 'role')!;
    const diff = v.provenance.find((p) => p.fact === 'differentiation')!;
    const comp = v.provenance.find((p) => p.fact === 'composition')!;
    expect(role.source).toBe(COMPONENTS_SRC);
    expect(role.altitude).toBe('family');
    expect(diff.source).toBe(COMPONENTS_SRC);
    expect(diff.altitude).toBe('family');
    expect(comp.source).toBe(COMP_SRC);
    expect(comp.altitude).toBe('variant');
  });

  it('no fact has two owners (one owner per fact)', () => {
    for (const v of proj.variants) {
      const byFact = new Map<string, Set<string>>();
      for (const p of v.provenance) {
        if (!byFact.has(p.fact)) byFact.set(p.fact, new Set());
        byFact.get(p.fact)!.add(p.source);
      }
      for (const [fact, owners] of byFact) {
        expect(owners.size, `${v.variant}/${fact}`).toBe(1);
      }
    }
  });

  it('inheritance is downward-only — no provenance altitude is below the variant altitude', () => {
    const variantRank = altitudeRank('variant');
    for (const v of proj.variants) {
      for (const p of v.provenance) {
        expect(altitudeRank(p.altitude), `${v.variant}/${p.fact}`).toBeLessThanOrEqual(variantRank);
      }
    }
  });
});

describe('PKG-3 projection — validation passes on real canonical data', () => {
  it('validateProjection finds zero violations', () => {
    expect(validateProjection(buildProjection('website'))).toEqual([]);
  });

  it('assertProjection passes and returns the projection', () => {
    const p = assertProjection('website');
    expect(p.variants.length).toBe(64);
  });

  it('discoverProjectionSources reports the two canonical sources with their altitudes', () => {
    const srcs = discoverProjectionSources('website');
    const byAlt = (a: string) => srcs.find((s) => s.altitude === a)?.source;
    expect(byAlt('family')).toBe(COMPONENTS_SRC);
    expect(byAlt('variant')).toBe(COMP_SRC);
  });
});

describe('PKG-3 projection — derived only (no knowledge unavailable in canonical)', () => {
  it('every projected composition fact equals the planner catalog entry for that variant', () => {
    const proj = buildProjection('website');
    const rows = loadCompositionCatalog();
    for (const row of rows) {
      const fe = compositionRowToFragmentEntry(row);
      const v = proj.variants.find((x) => x.variant === row.slug)!;
      expect(v, row.slug).toBeDefined();
      expect(v.serves).toEqual(fe.serves);
      expect(v.surface).toEqual(fe.surface);
      expect(v.layout).toEqual(fe.layout);
      expect(v.blocks).toEqual(fe.blocks);
      expect(v.interaction).toEqual(fe.interaction);
      expect(v.direction).toEqual(fe.direction);
      expect(v.limits).toEqual(fe.limits);
    }
  });
});

describe('PKG-3 projection — deterministic: delete + regenerate is byte-identical', () => {
  it('two independent builds serialize identically', () => {
    expect(serializeProjection(buildProjection('website'))).toBe(
      serializeProjection(buildProjection('website')),
    );
  });

  it('regenerate (cache-bypass) equals load (cached) — same planner surface', () => {
    _resetProjectionCache();
    const loaded = serializeProjection(loadProjection('website'));
    const regen = serializeProjection(regenerateProjection('website'));
    expect(regen).toBe(loaded);
  });

  it('provenance sources are OS-stable (forward-slash, repo-relative)', () => {
    const proj = buildProjection('website');
    for (const v of proj.variants) {
      for (const p of v.provenance) {
        expect(p.source, p.source).not.toContain('\\');
        expect(p.source.startsWith('resources/'), p.source).toBe(true);
      }
    }
  });
});

// ── Growth-safety: new canonical → projection grows with ZERO code change ──

const GROWTH_RAW = `
## Hero
## Spatial system
## Variant appendix — x
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Hero | hero-bento | proof tiles. |
| Spatial system | iso-overview | a brand-new family + variant added tomorrow. |
`;

function row(slug: string, serves: string[], surface: string) {
  return {
    name: slug,
    slug,
    cat: 'section' as const,
    layout: ['grid'],
    surface,
    interaction: [] as string[],
    serves,
    blocks: ['headline'],
    direction: `direction for ${slug}`,
    limits: {},
  };
}

describe('PKG-3 projection — growth-safe (new component → projection regenerates, no code change)', () => {
  const model = parseFamilyModel('website', GROWTH_RAW);
  const rows = [row('hero-bento', ['hero'], 'ink'), row('iso-overview', ['feature'], 'paper')];
  const grown = buildProjection('website', { model, rows, compositionSource: COMP_SRC });

  it('a brand-new family + variant participates in the projection', () => {
    expect(grown.variants.length).toBe(2);
    const iso = grown.variants.find((v) => v.variant === 'iso-overview')!;
    expect(iso.family).toBe('Spatial system');
    expect(grown.families).toContain('Spatial system');
  });

  it('the grown projection is still valid (provenance + inheritance intact)', () => {
    expect(validateProjection(grown)).toEqual([]);
  });
});

// ── Fail-loud on a broken join ──

describe('PKG-3 projection — fails loud on a broken canonical join', () => {
  const model = parseFamilyModel('website', GROWTH_RAW);

  it('a COMPOSITION variant with no family in the bridge → orphan-variant violation', () => {
    const rows = [row('hero-bento', ['hero'], 'ink'), row('ghost', ['feature'], 'paper')];
    const p = buildProjection('website', { model, rows, compositionSource: COMP_SRC });
    const v = validateProjection(p);
    expect(v.some((x) => x.kind === 'orphan-variant')).toBe(true);
  });

  it('assertProjection throws when the join is broken', () => {
    const rows = [row('hero-bento', ['hero'], 'ink'), row('ghost', ['feature'], 'paper')];
    expect(() => assertProjection('website', { model, rows, compositionSource: COMP_SRC })).toThrow(
      /orphan-variant/i,
    );
  });

  it('the same variant projected twice → duplicate-projection violation', () => {
    const rows = [row('hero-bento', ['hero'], 'ink'), row('hero-bento', ['hero'], 'ink')];
    const p = buildProjection('website', { model, rows, compositionSource: COMP_SRC });
    expect(validateProjection(p).some((x) => x.kind === 'duplicate-projection')).toBe(true);
  });
});

// Type-only: ProjectedVariant shape is exported (compile guard).
const _typeGuard: ProjectedVariant | undefined = undefined;
void _typeGuard;
