/**
 * Sprint W45 — Semantic Corpus Migration (Footer family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: every one of the 5 Footer component bodies must be a VALID, fully-covered,
 * non-weak, placeholder-free W17 template body, the family must read 5/5 migrated, and no two bodies may
 * be byte-identical.
 *
 * Family membership is grounded in the component role, not the name: the five `concept:role:footer`
 * variants are footer-cta, footer-dark, footer-links, footer-mega, footer-orbit. The authored boundary:
 * a footer's job is wayfinding — the closing orientation frame — never the primary ask. `cta-footer-reveal`
 * carries "footer" in its name and lists `serves:footer`, but it specializes `concept:role:call-to-action`
 * (the quiet close that eases INTO the footer) — it is a CTA member, not a Footer member.
 * `family-footer` is the abstract family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Footer';

/** The 5 realized Footer variants (components.md Variant appendix). */
const FOOTER_SLUGS = ['footer-cta', 'footer-dark', 'footer-links', 'footer-mega', 'footer-orbit'];

describe('W45 — Footer family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 5/5 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(5);
    expect(fam!.migrated).toBe(5);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(FOOTER_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('cta-footer-reveal is NOT a Footer member (footer by name, call-to-action by role)', () => {
    const c = bySlug.get('cta-footer-reveal');
    if (c) expect(c.family).not.toBe(FAMILY);
  });

  it('no two Footer bodies are byte-identical (no duplicated semantic content)', () => {
    const digests = FOOTER_SLUGS.map((s) => bySlug.get(s)!.digest);
    expect(new Set(digests).size).toBe(FOOTER_SLUGS.length);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
