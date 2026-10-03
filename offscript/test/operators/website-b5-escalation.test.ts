import { describe, it, expect } from 'vitest';
import { narrativeArcPresence } from '../../src/operators/narrative-arc-presence.js';
import { archetypeNeighbourCollisions } from '../../src/operators/archetype-neighbour-collisions.js';
import { failureToFinding } from '../../src/operators/render/render-visibility-floor.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { collateralRegistry } from '../../src/operators/collateral/index.js';
import { deckRegistry } from '../../src/operators/deck/index.js';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { ArchetypeModel, Archetype } from '../../src/archetype.js';

const TREE = parseHtml('<html><body></body></html>');
const model = (seq: Archetype[]): ArchetypeModel =>
  new Map(seq.map((a, i) => [`s${i}`, { archetype: a, decidedBy: 'declared' as const, confidence: 1 }]));

describe('B5 — soft signals now escalate', () => {
  it('narrative-arc not-recoverable escalates', () => {
    const f = narrativeArcPresence.detect(TREE, { params: {}, archetypeModel: model(['hero', 'feature-grid']) } as OperatorContext);
    expect(f[0].id).toBe('narrative-arc-presence:not-recoverable');
    expect(f[0].outcome).toBe('escalated');
  });
  it('narrative-arc no-model stays a warning (skip)', () => {
    const f = narrativeArcPresence.detect(TREE, { params: {} } as OperatorContext);
    expect(f[0].outcome).toBe('warning');
  });
  it('neighbour collide escalates; buffer stays warn', () => {
    const collide = archetypeNeighbourCollisions.detect(TREE, { params: {}, archetypeModel: model(['hero', 'pricing']) } as OperatorContext);
    expect(collide[0].outcome).toBe('escalated');
    const buffer = archetypeNeighbourCollisions.detect(TREE, { params: {}, archetypeModel: model(['hero', 'process']) } as OperatorContext);
    expect(buffer[0].outcome).toBe('warning');
  });
  it('render-visibility-floor failure escalates', () => {
    const fin = failureToFinding({ path: [0, 1], sample: 'x', textColor: '#111', bgColor: '#111', luminanceDelta: 0 } as any);
    expect(fin.outcome).toBe('escalated');
  });
});

describe('B5 — track isolation (collateral/deck unaffected)', () => {
  // render-visibility-floor is intentionally NOT in this loop: it's a render-tier
  // operator (runWebsiteRenderRails), not a defaultRegistry member — its isolation is
  // structural (collateral render path calls a4-bounds/text-overlap/page-fill instead).
  for (const name of ['narrative-arc-presence', 'accent-saturation-budget', 'archetype-neighbour-collisions']) {
    it(`"${name}" is website-only`, () => {
      expect(defaultRegistry().get(name)).toBeDefined();
      expect(collateralRegistry().get(name)).toBeUndefined();
      expect(deckRegistry().get(name)).toBeUndefined();
    });
  }
});
