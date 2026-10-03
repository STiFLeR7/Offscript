/**
 * Sprint W27 — Semantic Corpus Migration (Stats / Outcomes family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Stats / outcomes component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and
 * no two bodies may be byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Stats / outcomes';

/** The 4 realized Stats / outcomes variants (components.md Variant appendix). */
const STATS_SLUGS = ['outcome-stats', 'stat-band', 'stat-cards', 'stat-tiles'];

describe('W27 — Stats / outcomes family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(STATS_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('no two Stats / outcomes bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = STATS_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(STATS_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
