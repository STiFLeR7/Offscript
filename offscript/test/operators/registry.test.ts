import { describe, it, expect } from 'vitest';
import { defaultRegistry } from '../../src/operators/index.js';
import { archetypeTag } from '../../src/operators/archetype-tag.js';
import { sectionCountRhythm } from '../../src/operators/section-count-rhythm.js';
import { narrativeArcPresence } from '../../src/operators/narrative-arc-presence.js';
import { ctaChoreography } from '../../src/operators/cta-choreography.js';
import { archetypeNeighbourCollisions } from '../../src/operators/archetype-neighbour-collisions.js';
import { renderOperators } from '../../src/operators/render/index.js';

describe('defaultRegistry — M2 Track B registration', () => {
  it('registers all five Group B operators', () => {
    const reg = defaultRegistry();
    expect(reg.get('archetype-tag')).toBe(archetypeTag);
    expect(reg.get('section-count-rhythm')).toBe(sectionCountRhythm);
    expect(reg.get('narrative-arc-presence')).toBe(narrativeArcPresence);
    expect(reg.get('cta-choreography')).toBe(ctaChoreography);
    expect(reg.get('archetype-neighbour-collisions')).toBe(archetypeNeighbourCollisions);
  });

  it('spreads Track A renderOperators into the registry', () => {
    const reg = defaultRegistry();
    expect(renderOperators.length).toBeGreaterThan(0);
    for (const op of renderOperators) {
      expect(reg.get(op.name)).toBe(op);
    }
  });

  it('orders archetype-tag BEFORE the rails that read ctx.archetypeModel', () => {
    const names = [...defaultRegistry().keys()];
    const tagIdx = names.indexOf('archetype-tag');
    expect(tagIdx).toBeGreaterThanOrEqual(0);
    for (const consumer of [
      'section-count-rhythm',
      'narrative-arc-presence',
      'cta-choreography',
      'archetype-neighbour-collisions',
    ]) {
      expect(names.indexOf(consumer)).toBeGreaterThan(tagIdx);
    }
  });

  it('keys every entry by its operator name (no stale aliases)', () => {
    for (const [name, op] of defaultRegistry()) {
      expect(op.name).toBe(name);
    }
  });
});
