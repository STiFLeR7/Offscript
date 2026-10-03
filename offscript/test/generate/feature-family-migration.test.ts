/**
 * Sprint W26 — Semantic Corpus Migration (Feature / Value Proposition family).
 *
 * This sprint authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25
 * corpus auditor is the measurement instrument: every one of the 13 Feature / value-prop component
 * bodies must be a VALID, fully-covered, non-weak, placeholder-free W17 template body, the family must
 * read 13/13 migrated, and no two bodies may be byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Feature / value-prop';

/** The 13 realized Feature / value-prop variants (components.md Variant appendix). */
const FEATURE_SLUGS = [
  'about-value', 'feature-accordion', 'feature-bento', 'feature-stack', 'feature-steps',
  'feature-trio', 'mission-reveal', 'more-solutions', 'sticky-cards', 'tabbed-showcase',
  'value-prop', 'value-stats', 'value-who',
];

describe('W26 — Feature / value-prop family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 13/13 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(13);
    expect(fam!.migrated).toBe(13);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(FEATURE_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
    const a = bySlug.get(slug);
    expect(a, `expected ${slug} in the corpus`).toBeDefined();
    expect(a!.hasBody).toBe(true);
    expect(a!.validation).toBe('valid');
    expect(a!.coveragePct).toBe(100);
    expect(a!.breaches).toEqual([]);
    expect(a!.weak).toBe(false);
    expect(a!.placeholder).toBe(false);
    expect(a!.missingSections).toEqual([]);
    expect(a!.emptySections).toEqual([]);
  });

  it('no two Feature / value-prop bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = FEATURE_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(FEATURE_SLUGS.length);
  });
});
