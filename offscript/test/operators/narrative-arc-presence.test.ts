import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { Archetype, ArchetypeModel, ArchetypeAssignment } from '../../src/archetype.js';
import { narrativeArcPresence } from '../../src/operators/narrative-arc-presence.js';

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

describe('narrative-arc-presence operator (Tier-0)', () => {
  it('is Tier 0', () => {
    expect(narrativeArcPresence.tier).toBe(0);
  });

  it('a valid declared arc → clear (no model needed)', () => {
    expect(narrativeArcPresence.detect(TREE, ctxWith(undefined, { arc: 'AIDA' }))).toHaveLength(0);
    expect(narrativeArcPresence.detect(TREE, ctxWith(undefined, { arc: 'pas' }))).toHaveLength(0);
    expect(narrativeArcPresence.detect(TREE, ctxWith(undefined, { arc: 'BAB' }))).toHaveLength(0);
  });

  it('a declared but unrecognised arc → warning', () => {
    const findings = narrativeArcPresence.detect(TREE, ctxWith(undefined, { arc: 'STAR' }));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('narrative-arc-presence:unknown-arc');
    expect(findings[0].outcome).toBe('warning');
  });

  it('an inferable sequence (hero → … → cta) → clear', () => {
    const seq: Archetype[] = ['hero', 'feature-grid', 'metrics', 'pricing', 'cta-banner', 'footer'];
    expect(narrativeArcPresence.detect(TREE, ctxWith(model(seq)))).toHaveLength(0);
  });

  it('a sequence with no action stage → not recoverable warning', () => {
    const seq: Archetype[] = ['hero', 'feature-grid', 'feature-spotlight', 'testimonial'];
    const findings = narrativeArcPresence.detect(TREE, ctxWith(model(seq)));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('narrative-arc-presence:not-recoverable');
  });

  it('a sequence that opens at the ask (action before any opening) → not recoverable', () => {
    const seq: Archetype[] = ['pricing', 'faq', 'cta-banner', 'footer'];
    const findings = narrativeArcPresence.detect(TREE, ctxWith(model(seq)));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('narrative-arc-presence:not-recoverable');
  });

  it('declared arc takes precedence over an otherwise-unrecoverable sequence', () => {
    const seq: Archetype[] = ['pricing', 'faq', 'footer'];
    expect(narrativeArcPresence.detect(TREE, ctxWith(model(seq), { arc: 'aida' }))).toHaveLength(0);
  });

  it('no declared arc and no model → single warning', () => {
    const findings = narrativeArcPresence.detect(TREE, ctxWith(undefined));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('narrative-arc-presence:no-archetype-model');
  });
});
