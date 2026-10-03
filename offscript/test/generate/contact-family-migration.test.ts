/**
 * Sprint W44 — Semantic Corpus Migration (Contact / lead form family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 6 Contact / lead form component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 6/6 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the six
 * `concept:role:contact-lead-form` variants are book-demo, contact, contact-form, contact-methods,
 * contact-us, demo-modal. The authored boundary: when the next step is a single freely-chosen action
 * rather than handing over information, reach for a call-to-action role (these components mostly list
 * `serves:cta`, but they specialize contact-lead-form — an input task, not a bare ask).
 * `family-contact-lead-form` is the abstract family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Contact / lead form';

/** The 6 realized Contact / lead form variants (components.md Variant appendix). */
const CONTACT_SLUGS = ['book-demo', 'contact', 'contact-form', 'contact-methods', 'contact-us', 'demo-modal'];

describe('W44 — Contact / lead form family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 6/6 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(6);
    expect(fam!.migrated).toBe(6);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(CONTACT_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('no two Contact bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = CONTACT_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(CONTACT_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
