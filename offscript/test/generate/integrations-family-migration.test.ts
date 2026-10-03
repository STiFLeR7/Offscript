/**
 * Sprint W43 — Semantic Corpus Migration (Integrations family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: both Integrations component bodies must be a VALID, fully-covered,
 * non-weak, placeholder-free W17 template body, the family must read 2/2 migrated, and no two bodies may
 * be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the two `concept:role:integrations`
 * variants are integration-grid (a grid where each connection needs a line of copy) and integrations (a
 * lighter marquee where the marks speak for themselves). `logo-marquee` lists `serves:integrations` but
 * specializes `concept:role:social-proof-logos` — its marks signal TRUST, not COMPATIBILITY, exactly the
 * boundary the Integrations governance draws ("reach for Social proof / logos instead when the marks
 * signal trust rather than compatibility"). It is a Social-proof member (migrated in W38) and NOT an
 * Integrations member. `family-integrations` is the abstract family-role aggregator, not a component.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Integrations';

/** The 2 realized Integrations variants (components.md Variant appendix). */
const INTEGRATION_SLUGS = ['integration-grid', 'integrations'];

describe('W43 — Integrations family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 2/2 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(2);
    expect(fam!.migrated).toBe(2);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(INTEGRATION_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('logo-marquee is NOT an Integrations member (it is social-proof-logos — trust, not compatibility)', () => {
    const c = bySlug.get('logo-marquee');
    expect(c).toBeDefined();
    expect(c!.family).not.toBe(FAMILY);
  });

  it('no two Integrations bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = INTEGRATION_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(INTEGRATION_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
