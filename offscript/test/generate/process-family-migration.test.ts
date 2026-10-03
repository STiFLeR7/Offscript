/**
 * Sprint W39 — Semantic Corpus Migration (Process / how-it-works family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: both Process / how-it-works component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 2/2 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the two
 * `concept:role:process-how-it-works` variants are how-it-works (the canonical sticky multi-step walk)
 * and get-started (the lighter closing-half lead-in to the ask). The authored boundary: parallel items
 * defer to a Feature / value-prop role — this family exists only when the content is genuinely an
 * ordered, causal sequence. `family-process-how-it-works` is the abstract family-role aggregator, not a
 * component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Process / how-it-works';

/** The 2 realized Process / how-it-works variants (components.md Variant appendix). */
const PROCESS_SLUGS = ['get-started', 'how-it-works'];

describe('W39 — Process / how-it-works family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 2/2 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(2);
    expect(fam!.migrated).toBe(2);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(PROCESS_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('no two Process bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = PROCESS_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(PROCESS_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
