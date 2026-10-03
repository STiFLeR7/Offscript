import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { Archetype, ArchetypeModel, ArchetypeAssignment } from '../../src/archetype.js';
import { archetypeNeighbourCollisions } from '../../src/operators/archetype-neighbour-collisions.js';

const TREE = parseHtml('<!doctype html><html><body></body></html>'); // unused by this Tier-1 rail

const assign = (archetype: Archetype): ArchetypeAssignment => ({
  archetype,
  decidedBy: 'inferred',
  confidence: 1,
});

const model = (archetypes: Archetype[]): ArchetypeModel =>
  new Map(archetypes.map((a, i) => [`s${i}`, assign(a)]));

const ctxWith = (archetypeModel?: ArchetypeModel): OperatorContext => ({ params: {}, archetypeModel });

const ids = (findings: { id: string }[]) => findings.map((f) => f.id);

describe('archetype-neighbour-collisions operator (Tier-1)', () => {
  it('is Tier 1', () => {
    expect(archetypeNeighbourCollisions.tier).toBe(1);
  });

  it('hero → pricing collides (✗) → escalated', () => {
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['hero', 'pricing'])));
    expect(ids(findings)).toEqual(['archetype-neighbour-collisions:collide:s0->s1']);
    expect(findings[0].outcome).toBe('escalated');
  });

  it('hero → logo-bar flows (✓) → clear', () => {
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['hero', 'logo-bar'])));
    expect(findings).toHaveLength(0);
  });

  it('hero → process needs a buffer (~) → warning', () => {
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['hero', 'process'])));
    expect(ids(findings)).toEqual(['archetype-neighbour-collisions:buffer:s0->s1']);
  });

  it('faq → faq collides (✗)', () => {
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['faq', 'faq'])));
    expect(ids(findings)).toEqual(['archetype-neighbour-collisions:collide:s0->s1']);
  });

  it('testimonial-wall maps onto the Test column (hero → testimonial-wall = ~)', () => {
    const findings = archetypeNeighbourCollisions.detect(
      TREE,
      ctxWith(model(['hero', 'testimonial-wall'])),
    );
    expect(ids(findings)).toEqual(['archetype-neighbour-collisions:buffer:s0->s1']);
  });

  it('an archetype outside the matrix (sub-hero) is a neutral neighbour → no verdict', () => {
    const findings = archetypeNeighbourCollisions.detect(
      TREE,
      ctxWith(model(['hero', 'sub-hero', 'feature-grid'])),
    );
    // hero→sub-hero skipped (sub-hero not in matrix); sub-hero→grid skipped too
    expect(findings).toHaveLength(0);
  });

  it('flags every offending adjacency across a sequence', () => {
    // hero→pricing (x), pricing→logo-bar (x), logo-bar→pricing (~)
    const seq: Archetype[] = ['hero', 'pricing', 'logo-bar', 'pricing'];
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(seq)));
    expect(ids(findings).sort()).toEqual([
      'archetype-neighbour-collisions:buffer:s2->s3',
      'archetype-neighbour-collisions:collide:s0->s1',
      'archetype-neighbour-collisions:collide:s1->s2',
    ]);
  });

  it('a well-ordered page → clear', () => {
    const seq: Archetype[] = ['hero', 'logo-bar', 'feature-grid', 'feature-spotlight', 'cta-banner', 'footer'];
    expect(archetypeNeighbourCollisions.detect(TREE, ctxWith(model(seq)))).toHaveLength(0);
  });

  it('no archetype model → single warning', () => {
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(undefined));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('archetype-neighbour-collisions:no-archetype-model');
  });

  // M-4: contact / resources were added in the Phase-3 vocab expansion and map to null
  // (outside the §7.3 matrix) — neutral neighbours that carry no verdict.
  it('contact is a neutral neighbour → no verdict on either side', () => {
    expect(archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['hero', 'contact'])))).toHaveLength(0);
    expect(archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['contact', 'pricing'])))).toHaveLength(0);
  });

  it('resources is a neutral neighbour → no verdict', () => {
    expect(archetypeNeighbourCollisions.detect(TREE, ctxWith(model(['resources', 'faq'])))).toHaveLength(0);
  });

  it('a neutral neighbour does not suppress collisions on either side of it', () => {
    // hero→pricing (x) ... contact neutral (skips its two pairs) ... faq→faq (x)
    const seq: Archetype[] = ['hero', 'pricing', 'contact', 'faq', 'faq'];
    const findings = archetypeNeighbourCollisions.detect(TREE, ctxWith(model(seq)));
    expect(ids(findings).sort()).toEqual([
      'archetype-neighbour-collisions:collide:s0->s1',
      'archetype-neighbour-collisions:collide:s3->s4',
    ]);
  });
});
