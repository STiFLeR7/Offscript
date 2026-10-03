/**
 * Sprint W40 — Semantic Corpus Migration (Team / about family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Team / about component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no
 * two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four
 * `concept:role:team-about` variants are team-about, team-grid, team-leadership, team-visionaries.
 * "About" is not a separate role in this corpus — the About-page team component is `team-about`, the
 * team-plus-story hybrid within THIS family. The authored boundary: when the people are not part of the
 * credibility argument, reach for another proof role. `family-team-about` is the abstract family-role
 * aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Team / about';

/** The 4 realized Team / about variants (components.md Variant appendix). */
const TEAM_SLUGS = ['team-about', 'team-grid', 'team-leadership', 'team-visionaries'];

describe('W40 — Team / about family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(TEAM_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('no two Team bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = TEAM_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(TEAM_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
