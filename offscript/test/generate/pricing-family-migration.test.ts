/**
 * Sprint W42 — Semantic Corpus Migration (Pricing family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Pricing component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four `concept:role:pricing`
 * variants are pricing, pricing-packages, pricing-tabbed, subscription-faq. `subscription-faq` reads as
 * FAQ but specializes `concept:role:pricing` (a plan band that folds in FAQ reassurance) — it was
 * excluded from W41 FAQ and is IN scope here, the mirror of that decision. The authored boundary: when
 * the question is feature parity rather than price, reach for a Comparison role. `family-pricing` is the
 * abstract family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Pricing';

/** The 4 realized Pricing variants (components.md Variant appendix). */
const PRICING_SLUGS = ['pricing', 'pricing-packages', 'pricing-tabbed', 'subscription-faq'];

describe('W42 — Pricing family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(PRICING_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('subscription-faq IS a Pricing member (a plan band, not a FAQ — the mirror of W41)', () => {
    const c = bySlug.get('subscription-faq');
    expect(c).toBeDefined();
    expect(c!.family).toBe(FAMILY);
  });

  it('no two Pricing bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = PRICING_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(PRICING_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
