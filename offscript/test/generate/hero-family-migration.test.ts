/**
 * Sprint W35 — Semantic Corpus Migration (Hero family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 4 Hero component bodies must be a VALID, fully-covered,
 * non-weak, placeholder-free W17 template body, the family must read 4/4 migrated, and no two bodies
 * may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the four `concept:role:hero`
 * variants are hero-actions / hero-agent / hero-bento / hero-lending. `hero-horizon-light` specializes
 * `concept:role:call-to-action` and is therefore NOT a Hero-family member (it is out of scope — the CTA
 * family is a separate, later migration).
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Hero';

/** The 4 realized Hero variants (role concept:role:hero; components.md Variant appendix). */
const HERO_SLUGS = ['hero-actions', 'hero-agent', 'hero-bento', 'hero-lending'];

describe('W35 — Hero family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 4/4 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(4);
    expect(fam!.migrated).toBe(4);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(HERO_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('no two Hero bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = HERO_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(HERO_SLUGS.length);
  });

  it('hero-horizon-light is NOT in the Hero family (it is call-to-action by role — out of scope)', () => {
    const c = bySlug.get('hero-horizon-light');
    expect(c).toBeDefined();
    expect(c!.family).not.toBe(FAMILY);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
