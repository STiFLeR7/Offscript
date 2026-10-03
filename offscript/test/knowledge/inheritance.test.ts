/**
 * PKG-2 — inheritance resolution + ownership/inheritance validators.
 * Validated against the REAL canonical components.md, plus injected canonical text
 * to prove growth-safety and fail-loud behaviour.
 */
import { describe, it, expect } from 'vitest';
import {
  parseFamilyModel,
  resolveFamily,
  validateOwnership,
  reconcileFamilyLabels,
  buildKnowledgeReport,
  assertCanonicalKnowledge,
} from '../../src/knowledge/inheritance.js';

describe('PKG-2 inheritance — the real canonical website bridge', () => {
  const model = parseFamilyModel('website');

  it('parses 17 families and 79 variants from components.md', () => {
    expect(model.families.length).toBe(17);
    expect(model.variants.length).toBe(79);
  });

  it('resolves a variant to its owning family', () => {
    expect(resolveFamily('hero-bento', model)).toBe('Hero');
    expect(resolveFamily('feature-trio', model)).toBe('Feature / value-prop');
    expect(resolveFamily('footer-dark', model)).toBe('Footer');
  });

  it('throws on an orphan variant (no owning family)', () => {
    expect(() => resolveFamily('not-a-real-variant', model)).toThrow(/orphan/i);
  });

  it('every variant resolves to exactly one family (no orphans across the bridge)', () => {
    for (const v of model.variants) {
      expect(model.variantToFamily.get(v.variant), v.variant).toBe(v.family);
    }
  });
});

describe('PKG-2 inheritance — ownership invariants hold on real data', () => {
  it('validateOwnership finds zero violations', () => {
    expect(validateOwnership(parseFamilyModel('website'))).toEqual([]);
  });

  it('assertCanonicalKnowledge passes and reports 17/79', () => {
    const report = assertCanonicalKnowledge('website');
    expect(report.violations).toEqual([]);
    expect(report.familyCount).toBe(17);
    expect(report.variantCount).toBe(79);
  });

  it('buildKnowledgeReport assigns each canonical source its altitude (ownership map)', () => {
    const report = buildKnowledgeReport('website');
    const byTail = (suffix: string) =>
      report.sourceAltitudes.find((s) => s.source.replace(/\\/g, '/').endsWith(suffix))?.altitude;
    expect(byTail('component-governance/components.md')).toBe('family');
    expect(byTail('component-governance/COMPOSITION.md')).toBe('variant');
    expect(byTail('rulebooks/numerics.md')).toBe('runtime');
    expect(byTail('colors_and_type.css')).toBe('brand');
    expect(byTail('PHILOSOPHY.md')).toBe('universal');
  });

  it('reports benign heading/appendix label drift WITHOUT failing (governance untouched)', () => {
    const drift = reconcileFamilyLabels(parseFamilyModel('website'));
    // The appendix abbreviates two headings; this is an observation, never a violation.
    expect(drift).toContain('Call-to-action');
    expect(drift).toContain('Atoms & transitions');
    expect(assertCanonicalKnowledge('website').violations).toEqual([]); // drift ≠ violation
  });
});

// ── Growth-safety: adding assets needs NO code change (Repository Validation evidence) ──

const GROWTH_RAW = `
## Hero
Role text for hero.
## Variant appendix — all 79 mapped to family
### Opening
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Hero | hero-bento | proof tiles. |
| Hero | hero-future | a brand-new hero variant added tomorrow. |
| Spatial system | iso-overview | a brand-new FAMILY + variant added tomorrow. |
`;

describe('PKG-2 inheritance — growth-safe (new assets participate with zero code change)', () => {
  const grown = parseFamilyModel('website', GROWTH_RAW);

  it('a new variant under an existing family resolves with no code change', () => {
    expect(resolveFamily('hero-future', grown)).toBe('Hero');
  });

  it('a brand-new family + variant participates with no code change', () => {
    expect(grown.families).toContain('Spatial system');
    expect(resolveFamily('iso-overview', grown)).toBe('Spatial system');
  });

  it('the grown model is still ownership-valid', () => {
    expect(validateOwnership(grown)).toEqual([]);
  });
});

// ── Fail-loud on ambiguity / malformation ──

describe('PKG-2 inheritance — fails loud on ownership ambiguity & malformation', () => {
  it('a variant owned by two families → duplicate-variant violation', () => {
    const raw = `
## Variant appendix — x
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Hero | dup | one. |
| Footer | dup | two. |
`;
    const v = validateOwnership(parseFamilyModel('website', raw));
    expect(v.some((x) => x.kind === 'duplicate-variant')).toBe(true);
  });

  it('a name that is both a variant and a family → variant-is-family violation', () => {
    const raw = `
## Variant appendix — x
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Hero | hero-bento | a. |
| Footer | Hero | b. |
`;
    const v = validateOwnership(parseFamilyModel('website', raw));
    expect(v.some((x) => x.kind === 'variant-is-family')).toBe(true);
  });

  it('a variant that is its own family → self-family (cycle) violation', () => {
    const raw = `
## Variant appendix — x
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Solo | Solo | self. |
`;
    const v = validateOwnership(parseFamilyModel('website', raw));
    expect(v.some((x) => x.kind === 'self-family')).toBe(true);
  });

  it('missing Variant appendix → parse throws (the bridge is required)', () => {
    expect(() => parseFamilyModel('website', '## Hero\nonly a heading, no appendix.')).toThrow(
      /Variant appendix/i,
    );
  });
});
