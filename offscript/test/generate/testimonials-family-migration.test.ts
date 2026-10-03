/**
 * Sprint W37 — Semantic Corpus Migration (Testimonials / case studies family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 6 Testimonials / case-studies component bodies must be
 * a VALID, fully-covered, non-weak, placeholder-free W17 template body, the family must read 6/6
 * migrated, and no two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the six
 * `concept:role:testimonials-case-studies` variants are case-carousel, customer-story,
 * reviews-carousel, testimonial-bento, testimonial-slider, testimonial-stack. `results-proof` reads as
 * proof but specializes `concept:role:social-proof-logos` (a mark, not a voice) and is therefore NOT a
 * Testimonials member — it is out of scope (Social proof is a separate, later migration).
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Testimonials / case studies';

/** The 6 realized Testimonials / case-studies variants (components.md Variant appendix). */
const TESTIMONIAL_SLUGS = [
  'case-carousel',
  'customer-story',
  'reviews-carousel',
  'testimonial-bento',
  'testimonial-slider',
  'testimonial-stack',
];

describe('W37 — Testimonials / case studies family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 6/6 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(6);
    expect(fam!.migrated).toBe(6);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(TESTIMONIAL_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('results-proof is NOT a Testimonials member (it is social-proof-logos — a mark, not a voice)', () => {
    const c = bySlug.get('results-proof');
    expect(c).toBeDefined();
    expect(c!.family).not.toBe(FAMILY);
  });

  it('no two Testimonials bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = TESTIMONIAL_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(TESTIMONIAL_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
