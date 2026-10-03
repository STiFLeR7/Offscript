/**
 * Sprint W38 — Semantic Corpus Migration (Social proof / logos family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Social proof / logos component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four
 * `concept:role:social-proof-logos` variants are backed-by, logo-marquee, logo-strip, results-proof.
 * `results-proof` reads as a testimonial/outcome hybrid but specializes `concept:role:social-proof-logos`
 * (its proof is a MARK, not a voice) — it was excluded from W37 Testimonials and is IN scope here, the
 * mirror of that decision. A bare number defers to Stats / outcomes; a human voice defers to Testimonials.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Social proof / logos';

/** The 4 realized Social proof / logos variants (components.md Variant appendix). */
const SOCIAL_PROOF_SLUGS = ['backed-by', 'logo-marquee', 'logo-strip', 'results-proof'];

describe('W38 — Social proof / logos family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(SOCIAL_PROOF_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('results-proof IS a Social proof member (a mark, not a voice — the mirror of W37)', () => {
    const c = bySlug.get('results-proof');
    expect(c).toBeDefined();
    expect(c!.family).toBe(FAMILY);
  });

  it('no two Social proof bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = SOCIAL_PROOF_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(SOCIAL_PROOF_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
