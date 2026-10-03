/**
 * Sprint W48 — Semantic Corpus Migration (Resources / insights / news family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Resources component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four
 * `concept:role:resources-insights-news` variants are latest-insights, latest-news, resources-carousel,
 * resources-insights. The authored boundary: this is the "substance" role — real, current articles /
 * insights / press with resolving links, offering depth without forcing it. `footer-links` lists
 * `serves:resources` but specializes `concept:role:footer` (migrated in W45) — it is a Footer member, not
 * Resources. `family-resources-insights-news` is the abstract family-role aggregator, not a component
 * member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Resources / insights / news';

/** The 4 realized Resources / insights / news variants (components.md Variant appendix). */
const RESOURCES_SLUGS = ['latest-insights', 'latest-news', 'resources-carousel', 'resources-insights'];

describe('W48 — Resources / insights / news family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(RESOURCES_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('footer-links is NOT a Resources member (serves:resources but specializes footer)', () => {
    const c = bySlug.get('footer-links');
    if (c) expect(c.family).not.toBe(FAMILY);
  });

  it('no two Resources bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = RESOURCES_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(RESOURCES_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
