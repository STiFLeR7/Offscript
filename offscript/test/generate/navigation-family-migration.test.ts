/**
 * Sprint W47 — Semantic Corpus Migration (Navigation family).
 *
 * Authors prose semantic BODIES only (no code, no frontmatter, no runtime). The W25 corpus auditor is
 * the measurement instrument: the single Navigation component body must be a VALID, fully-covered,
 * non-weak, placeholder-free W17 template body, and the family must read 1/1 migrated.
 *
 * Family membership is grounded in the component role, not the name: the one `concept:role:navigation`
 * variant is nav. Navigation is a canonical family (produced by `family-navigation`; W23 registry has
 * `family-navigation.md`); there is no separate `concept:role:header` role — Navigation IS the top-bar
 * family. The authored boundary (family Avoid-When / Sibling Differences): lighter wayfinding at the
 * page's CLOSE is the footer's link set, not this role — so `footer-links` (`serves:nav`, but specializes
 * `concept:role:footer`, migrated in W45) is a Footer member, not Navigation. `family-navigation` is the
 * abstract family-role aggregator, not a component member.
 */
import { describe, it, expect } from 'vitest';
import { auditCorpus, type ComponentAudit } from '../../src/generate/semantic-corpus-audit.js';

const FAMILY = 'Navigation';

/** The single realized Navigation variant (components.md Variant appendix). */
const NAV_SLUGS = ['nav'];

describe('W47 — Navigation family is fully migrated', () => {
  const report = auditCorpus();
  const bySlug = new Map<string, ComponentAudit>(report.components.map((c) => [c.slug, c]));

  it('the family reads 1/1 migrated at 100% coverage', () => {
    const fam = report.familyCoverage.find((f) => f.family === FAMILY);
    expect(fam).toBeDefined();
    expect(fam!.total).toBe(1);
    expect(fam!.migrated).toBe(1);
    expect(fam!.coveragePct).toBe(100);
  });

  it.each(NAV_SLUGS)('%s is a valid, fully-covered, non-weak W17 body', (slug) => {
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

  it('footer-links is NOT a Navigation member (serves:nav but specializes footer)', () => {
    const c = bySlug.get('footer-links');
    if (c) expect(c.family).not.toBe(FAMILY);
  });

  it('corpus copiedClusters remains 0 (no body duplicated across the whole corpus)', () => {
    expect(report.copiedClusters.length).toBe(0);
  });
});
