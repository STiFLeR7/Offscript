/**
 * Sprint W41 — Semantic Corpus Migration (FAQ family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 FAQ component bodies must be a VALID, fully-covered,
 * non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no two bodies may
 * be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four `concept:role:faq`
 * variants are faq, faq-centered, faq-single, faq-split. The "pricing-plus-FAQ band" named in the
 * governance is `subscription-faq`, which specializes a Pricing role (not `concept:role:faq`) — it is a
 * Pricing member and out of scope. The authored boundary: when the answers are really features carrying
 * a creative panel, reach for an expandable Feature / value-prop role. `family-faq` is the abstract
 * family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'FAQ';

/** The 4 realized FAQ variants (components.md Variant appendix). */
const FAQ_SLUGS = ['faq', 'faq-centered', 'faq-single', 'faq-split'];

describe('W41 — FAQ family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(FAQ_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('subscription-faq is NOT a FAQ member (it is a Pricing plan band, not concept:role:faq)', () => {
    const c = bySlug.get('subscription-faq');
    if (c) expect(c.family).not.toBe(FAMILY);
  });

  it('no two FAQ bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = FAQ_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(FAQ_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
