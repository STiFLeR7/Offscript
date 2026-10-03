/**
 * Sprint W36 — Semantic Corpus Migration (Call-to-action family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 5 Call-to-action component bodies must be a VALID,
 * fully-covered, non-weak, placeholder-free W17 template body, the family must read 5/5 migrated, and
 * no two bodies may be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the five
 * `concept:role:call-to-action` variants are cta-band, cta-banner, cta-footer-reveal, cta-orbit, and
 * hero-horizon-light. `hero-horizon-light` carries "hero" in its name but specializes
 * `concept:role:call-to-action` (components.md files it under Call-to-action: "a centered close, not a
 * hero"), so it IS a CTA-family member and IS in scope here — it was correctly excluded from the W35
 * Hero migration for exactly this reason.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Call-to-action';

/** The 5 realized Call-to-action variants (role concept:role:call-to-action; components.md appendix). */
const CTA_SLUGS = ['cta-band', 'cta-banner', 'cta-footer-reveal', 'cta-orbit', 'hero-horizon-light'];

describe('W36 — Call-to-action family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 5/5 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(5);
    expect(fam!.migrated).toBe(5);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(CTA_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('hero-horizon-light is a CTA-family member by role (not Hero, despite its name)', () => {
    const c = bySlug.get('hero-horizon-light');
    expect(c).toBeDefined();
    expect(c!.family).toBe(FAMILY);
  });

  it('no two Call-to-action bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = CTA_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(CTA_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
