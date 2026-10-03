import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { Archetype, ArchetypeModel, ArchetypeAssignment } from '../../src/archetype.js';
import { sectionCountRhythm } from '../../src/operators/section-count-rhythm.js';

const TREE = parseHtml('<!doctype html><html><body></body></html>'); // unused by this Tier-0 rail

const assign = (archetype: Archetype): ArchetypeAssignment => ({
  archetype,
  decidedBy: 'inferred',
  confidence: 1,
});

const model = (archetypes: Archetype[]): ArchetypeModel =>
  new Map(archetypes.map((a, i) => [`s${i}`, assign(a)]));

const ctxWith = (archetypeModel?: ArchetypeModel, params: Record<string, unknown> = {}): OperatorContext => ({
  params,
  archetypeModel,
});

/** A healthy 7-section / 6-distinct page with no adjacent repeats. */
const HEALTHY: Archetype[] = [
  'hero',
  'logo-bar',
  'feature-grid',
  'feature-spotlight',
  'metrics',
  'pricing',
  'footer',
];

describe('section-count-rhythm operator (Tier-0)', () => {
  it('is Tier 0', () => {
    expect(sectionCountRhythm.tier).toBe(0);
  });

  it('a healthy page (7 sections, 6 distinct, no repeats) → clear', () => {
    const findings = sectionCountRhythm.detect(TREE, ctxWith(model(HEALTHY)));
    expect(findings).toHaveLength(0);
  });

  it('too few sections → warning', () => {
    const findings = sectionCountRhythm.detect(TREE, ctxWith(model(['hero', 'pricing', 'footer'])));
    expect(findings.some((f) => f.id === 'section-count-rhythm:too-few-sections')).toBe(true);
    expect(findings.every((f) => f.outcome === 'warning')).toBe(true);
  });

  it('too many sections → warning', () => {
    const ten: Archetype[] = [
      'hero',
      'logo-bar',
      'feature-grid',
      'feature-spotlight',
      'process',
      'metrics',
      'testimonial',
      'case-study',
      'pricing',
      'faq',
    ];
    const findings = sectionCountRhythm.detect(TREE, ctxWith(model(ten)));
    expect(findings.some((f) => f.id === 'section-count-rhythm:too-many-sections')).toBe(true);
  });

  it('too few distinct archetypes (enough sections) → warning', () => {
    // 6 sections but only 2 distinct archetypes (and adjacency avoided by interleaving)
    const lowVariety: Archetype[] = [
      'feature-grid',
      'testimonial',
      'feature-grid',
      'testimonial',
      'feature-grid',
      'testimonial',
    ];
    const findings = sectionCountRhythm.detect(TREE, ctxWith(model(lowVariety)));
    expect(findings.some((f) => f.id === 'section-count-rhythm:too-few-archetypes')).toBe(true);
  });

  it('adjacent same-archetype sections → one warning per offending pair', () => {
    const repeats: Archetype[] = [
      'hero',
      'feature-grid',
      'feature-grid', // repeat 1
      'metrics',
      'testimonial',
      'testimonial', // repeat 2
      'footer',
    ];
    const findings = sectionCountRhythm.detect(TREE, ctxWith(model(repeats)));
    const adj = findings.filter((f) => f.id.startsWith('section-count-rhythm:adjacent-repeat:'));
    expect(adj).toHaveLength(2);
  });

  it('respects param-overridable bounds', () => {
    // 3 sections is fine if the floor is lowered to 3
    const findings = sectionCountRhythm.detect(
      TREE,
      ctxWith(model(['hero', 'pricing', 'footer']), { minSections: 3, minDistinct: 3 }),
    );
    expect(findings.some((f) => f.id.includes('too-few'))).toBe(false);
  });

  it('no archetype model → single warning', () => {
    const findings = sectionCountRhythm.detect(TREE, ctxWith(undefined));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('section-count-rhythm:no-archetype-model');
  });
});
