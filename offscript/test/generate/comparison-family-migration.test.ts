/**
 * Sprint W46 — Semantic Corpus Migration (Comparison family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 2 Comparison component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 2/2 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the two `concept:role:comparison`
 * variants are compare-table and comparison. The authored boundary (family Avoid-When): when the axis is
 * purely cost and packaging, reach for a pricing role. `pricing-packages` and `pricing-tabbed` list
 * `serves:comparison` but specialize `concept:role:pricing` (migrated in W42) — they are Pricing members,
 * not Comparison. `family-comparison` is the abstract family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Comparison';

/** The 2 realized Comparison variants (components.md Variant appendix). */
const COMPARISON_SLUGS = ['compare-table', 'comparison'];

describe('W46 — Comparison family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 2/2 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(2);
    expect(fam!.migrated).toBe(2);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(COMPARISON_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
    const a = bySlug.get(slug);
    expect(a, `expected ${slug} in the corpus`).toBeDefined();
    expect(a!.family).toBe(FAMILY);
    expect(a!.hasBody).toBe(true);
    expect(a!.validation).toBe('valid');
    expect(a!.coveragePct).toBe(100);
    expect(a!.breaches).toEqual([]);
    expect(a!.weak).toBe(false);
    expect(a!.placeholder).toBe(false);
    expect(a!.missingSections).toEqual([]);
    expect(a!.emptySections).toEqual([]);
  });

  it.each(['pricing-packages', 'pricing-tabbed'])(
    '%s is NOT a Comparison member (serves:comparison but specializes pricing)',
    (slug) => {
      const c = bySlug.get(slug);
      if (c) expect(c.family).not.toBe(FAMILY);
    },
  );

  it('no two Comparison bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = COMPARISON_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(COMPARISON_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
