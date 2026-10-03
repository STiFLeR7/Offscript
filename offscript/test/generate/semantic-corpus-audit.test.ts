/**
 * Sprint W25 — Semantic Corpus Auditor (RED-first).
 *
 * A READ-ONLY observability tool that measures the completeness of the W17 per-component semantic
 * bodies across `repository/canonical/*`. It NEVER generates, rewrites, or consumes — it only
 * measures. These tests pin: the pure per-body measurement (coverage / sections / words / placeholder
 * / empty / weak / validation+breaches), the strict fail-loud validator, the corpus aggregation
 * (copied clusters, family coverage, top missing dimensions), report immutability, the duplicate-slug
 * and digest-mismatch integrity fail-louds, deterministic replay, and a real-corpus smoke.
 */
import { describe, it, expect } from 'vitest';
import {
  auditBody,
  assertBodyValid,
  auditCorpus,
  verifyCorpusAuditReplay,
  CorpusAuditError,
  DEFAULT_AUDIT_THRESHOLDS,
} from '../../src/generate/semantic-corpus-audit.js';

// ── a valid 7-section W17 body, sections overridable ──
const W17 = ['Purpose', 'Choose when', 'Avoid when', 'Character', 'Composition', 'Contract', 'Judgement'] as const;
function w17Body(overrides: Partial<Record<(typeof W17)[number], string>> = {}, opts: { lede?: string } = {}): string {
  const lines: string[] = ['# demo', '', opts.lede ?? 'A demo component descriptor lede.', ''];
  for (const s of W17) {
    lines.push(`## ${s}`);
    lines.push(overrides[s] ?? 'Several plain words of genuine design rationale go right here today.');
    lines.push('');
  }
  return lines.join('\n');
}

describe('W25 — auditBody: a fully-migrated valid body', () => {
  it('reports 100% coverage, valid, no breaches, no missing sections', () => {
    const a = auditBody('demo', w17Body());
    expect(a.validation).toBe('valid');
    expect(a.hasBody).toBe(true);
    expect(a.coveragePct).toBe(100);
    expect(a.missingSections).toEqual([]);
    expect(a.breaches).toEqual([]);
    expect(a.weak).toBe(false);
    expect(typeof a.digest).toBe('string');
    expect(a.totalWords).toBeGreaterThan(0);
  });
});

describe('W25 — auditBody: a shallow (un-migrated) descriptor', () => {
  it('classifies no-semantic-body, 0% coverage, all 7 dimensions missing', () => {
    const a = auditBody('agent-status', '# agent-status\n\nA live-metric status mock; a creative filler panel.\n');
    expect(a.validation).toBe('no-semantic-body');
    expect(a.hasBody).toBe(false);
    expect(a.coveragePct).toBe(0);
    expect([...a.missingSections].sort()).toEqual([...W17].sort());
    expect(a.weak).toBe(false); // shallow ⇒ "missing body", not "weak body"
  });
});

describe('W25 — auditBody: partial / unknown / duplicate / empty / ordering breaches', () => {
  it('records missing sections on a partial body (invalid, recorded not thrown)', () => {
    const partial = '# x\n\nlede\n\n## Purpose\nwhy.\n\n## Choose when\nwhen.\n\n## Avoid when\nnope.\n';
    const a = auditBody('x', partial);
    expect(a.validation).toBe('invalid');
    expect(a.hasBody).toBe(true);
    expect(a.missingSections).toContain('Character');
    expect(a.missingSections).toContain('Judgement');
    expect(a.coveragePct).toBe(Math.round((3 / 7) * 100));
    expect(a.breaches.some((b) => /missing/i.test(b))).toBe(true);
  });

  it('detects an unknown section', () => {
    const a = auditBody('x', w17Body() + '\n## Bananas\n\noops\n');
    expect(a.validation).toBe('invalid');
    expect(a.unknownSections).toContain('Bananas');
    expect(a.breaches.some((b) => /unknown/i.test(b))).toBe(true);
  });

  it('detects a duplicate section', () => {
    const a = auditBody('x', w17Body() + '\n## Purpose\n\nagain.\n');
    expect(a.validation).toBe('invalid');
    expect(a.duplicateSections).toContain('Purpose');
    expect(a.breaches.some((b) => /duplicate/i.test(b))).toBe(true);
  });

  it('detects an empty semantic section (present heading, blank content)', () => {
    const a = auditBody('x', w17Body({ Contract: '' }));
    expect(a.emptySections).toContain('Contract');
    expect(a.coveragePct).toBe(Math.round((6 / 7) * 100)); // empty section is not "covered"
    expect(a.validation).toBe('invalid');
  });

  it('detects invalid section ordering', () => {
    // a body where the 7 sections appear out of canonical order
    const lines = ['# x', '', 'lede', ''];
    for (const s of ['Judgement', 'Purpose', 'Choose when', 'Avoid when', 'Character', 'Composition', 'Contract']) {
      lines.push(`## ${s}`, 'content here words.', '');
    }
    const a = auditBody('x', lines.join('\n'));
    expect(a.orderingOk).toBe(false);
    expect(a.breaches.some((b) => /order/i.test(b))).toBe(true);
  });
});

describe('W25 — auditBody: placeholder + weak detection', () => {
  it('flags placeholder text', () => {
    const a = auditBody('x', w17Body({ Purpose: 'TODO: write this later.' }));
    expect(a.placeholder).toBe(true);
  });

  it('flags weak bodies below the configurable thresholds', () => {
    const thin = auditBody('x', w17Body({}, {}), { thresholds: { minBodyWords: 9999, minSectionWords: 1 } });
    expect(thin.weak).toBe(true);
    const ok = auditBody('x', w17Body(), { thresholds: { minBodyWords: 1, minSectionWords: 1 } });
    expect(ok.weak).toBe(false);
  });

  it('exposes default thresholds', () => {
    expect(DEFAULT_AUDIT_THRESHOLDS.minBodyWords).toBeGreaterThan(0);
    expect(DEFAULT_AUDIT_THRESHOLDS.minSectionWords).toBeGreaterThan(0);
  });
});

describe('W25 — assertBodyValid: strict fail-loud validator', () => {
  it('passes for a valid 7-section body', () => {
    expect(() => assertBodyValid(w17Body(), 'demo')).not.toThrow();
  });
  it('throws for a missing required section', () => {
    expect(() => assertBodyValid('# x\n\n## Purpose\nwhy.\n', 'x')).toThrow(CorpusAuditError);
    expect(() => assertBodyValid('# x\n\n## Purpose\nwhy.\n', 'x')).toThrow(/missing/i);
  });
  it('throws for an unknown section', () => {
    expect(() => assertBodyValid(w17Body() + '\n## Bananas\n\noops\n', 'x')).toThrow(/unknown/i);
  });
  it('throws for an invalid ordering', () => {
    const lines = ['# x', ''];
    for (const s of ['Judgement', 'Purpose', 'Choose when', 'Avoid when', 'Character', 'Composition', 'Contract']) {
      lines.push(`## ${s}`, 'words here now.', '');
    }
    expect(() => assertBodyValid(lines.join('\n'), 'x')).toThrow(/order/i);
  });
});

describe('W25 — auditCorpus: aggregation over injected components', () => {
  const components = [
    { slug: 'good-one', body: w17Body() },
    { slug: 'good-two', body: w17Body() }, // identical body ⇒ a copied cluster with good-one
    { slug: 'shallow-a', body: '# a\n\nA one-line descriptor.\n' },
    { slug: 'shallow-b', body: '# b\n\nAnother one-line descriptor.\n' },
    { slug: 'partial', body: '# p\n\n## Purpose\nwhy.\n\n## Choose when\nwhen.\n' },
  ];

  it('computes corpus metrics', () => {
    const r = auditCorpus({ components });
    expect(r.totalComponents).toBe(5);
    expect(r.semanticBodies).toBe(3); // good-one, good-two, partial have ## sections
    expect(r.missingBodies).toBe(2); // the two shallow descriptors
    expect(r.fullyCovered).toBe(2); // the two valid bodies
    expect(r.avgBodyWords).toBeGreaterThan(0);
    expect(r.components).toHaveLength(5);
  });

  it('detects copied bodies (identical body across components)', () => {
    const r = auditCorpus({ components });
    const cluster = r.copiedClusters.find((c) => c.slugs.includes('good-one'));
    expect(cluster).toBeDefined();
    expect([...cluster!.slugs].sort()).toEqual(['good-one', 'good-two']);
  });

  it('ranks top missing dimensions', () => {
    const r = auditCorpus({ components });
    expect(r.topMissingDimensions.length).toBeGreaterThan(0);
    expect(r.topMissingDimensions[0]).toHaveProperty('section');
    expect(r.topMissingDimensions[0]).toHaveProperty('count');
  });

  it('produces a deeply-immutable report', () => {
    const r = auditCorpus({ components });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.components)).toBe(true);
    expect(Object.isFrozen(r.components[0])).toBe(true);
    expect(() => {
      // @ts-expect-error — runtime immutability check
      r.totalComponents = 999;
    }).toThrow();
  });

  it('is deterministic — same input ⇒ identical digest', () => {
    expect(auditCorpus({ components }).digest).toBe(auditCorpus({ components }).digest);
  });

  it('fails loud on a duplicate component slug (integrity)', () => {
    expect(() => auditCorpus({ components: [{ slug: 'dup', body: w17Body() }, { slug: 'dup', body: w17Body() }] }))
      .toThrow(CorpusAuditError);
  });
});

describe('W25 — verifyCorpusAuditReplay: deterministic replay proof', () => {
  it('re-audits and confirms an identical digest', () => {
    const components = [{ slug: 'x', body: w17Body() }];
    expect(() => verifyCorpusAuditReplay({ components })).not.toThrow();
    const r = verifyCorpusAuditReplay({ components });
    expect(r.digest).toBe(auditCorpus({ components }).digest);
  });
});

describe('W25 — real corpus smoke', () => {
  it('audits the real canonical corpus: 96 packages, 70 migrated bodies (W17 gold + W26 Feature + W27 Stats + W35 Hero + W36 CTA + W37 Testimonials + W38 Social proof + W39 Process + W40 Team + W41 FAQ + W42 Pricing + W43 Integrations + W44 Contact + W45 Footer + W46 Comparison + W47 Navigation + W48 Resources)', () => {
    const r = auditCorpus();
    expect(r.totalComponents).toBe(96);
    // W17: 3 gold; W26: 12 Feature / value-prop; W27: 4 Stats / outcomes; W35: 3 Hero; W36: 4 CTA;
    // W37: 6 Testimonials / case studies; W38: 4 Social proof / logos; W39: 2 Process / how-it-works;
    // W40: 4 Team / about; W41: 4 FAQ; W42: 4 Pricing; W43: 2 Integrations; W44: 6 Contact / lead form;
    // W45: 5 Footer; W46: 2 Comparison; W47: 1 Navigation; W48: 4 Resources / insights / news ⇒ 70.
    expect(r.semanticBodies).toBe(70);
    const migrated = r.components.filter((c) => c.hasBody).map((c) => c.slug).sort();
    expect(migrated.length).toBe(70);
    expect(migrated).toEqual(expect.arrayContaining(['cta-banner', 'feature-bento', 'hero-bento']));
    expect(r.missingBodies).toBe(26);
    // copied-body detection is exact-digest; every reported cluster has ≥2 members (vacuously true
    // when none). The current corpus has zero byte-identical bodies (the family bodies differ by H1).
    expect(r.copiedClusters.every((c) => c.slugs.length >= 2)).toBe(true);
    // deterministic across runs
    expect(auditCorpus().digest).toBe(r.digest);
  });

  it('reports family coverage grouped by family', () => {
    const r = auditCorpus();
    expect(r.familyCoverage.length).toBeGreaterThan(0);
    for (const f of r.familyCoverage) {
      expect(f).toHaveProperty('family');
      expect(f).toHaveProperty('total');
      expect(f).toHaveProperty('migrated');
      expect(f.migrated).toBeLessThanOrEqual(f.total);
    }
  });
});
