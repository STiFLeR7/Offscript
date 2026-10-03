import { describe, it, expect } from 'vitest';
import { attachSourceContent } from '../../src/generate/section-notes.js';
import type { PlanItem } from '../../src/generate/types.js';

function item(intent: string, content?: string): PlanItem {
  return { anchor: { id: 'x', anchor: 'x' }, archetype: 'ContentPage', tokenRoles: [], intent, content };
}

describe('attachSourceContent', () => {
  const source = [
    '## Zone Topology',
    'Zone 1 is the untrusted edge.',
    '## Determinism',
    'The core is replayable.',
  ].join('\n');

  it('fills content for pages the brief body left empty', () => {
    const items = [item('Zone Topology'), item('Determinism')];
    const warnings: string[] = [];
    attachSourceContent(items, source, warnings);
    expect(items[0].content).toContain('untrusted edge');
    expect(items[1].content).toContain('replayable');
  });

  it('never overwrites content the brief body already provided', () => {
    const items = [item('Zone Topology', 'BRIEF COPY WINS')];
    attachSourceContent(items, source, []);
    expect(items[0].content).toBe('BRIEF COPY WINS');
  });

  it('is a no-op on empty source', () => {
    const items = [item('Zone Topology')];
    attachSourceContent(items, '', []);
    expect(items[0].content).toBeUndefined();
  });

  it('matches a unique substring (intent superset of one source heading)', () => {
    const items = [item('Zone Topology Overview')];
    attachSourceContent(items, source, []);
    expect(items[0].content).toContain('untrusted edge');
  });

  it('does not match when the intent contains two source headings (ambiguous)', () => {
    const ambiguousSource = [
      '## Zone',
      'First zone chunk.',
      '## Topology',
      'Second topology chunk.',
    ].join('\n');
    const items = [item('Zone Topology')]; // contains both "zone" and "topology"
    const warnings: string[] = [];
    attachSourceContent(items, ambiguousSource, warnings);
    expect(items[0].content).toBeUndefined();
    // both chunks went unmatched → the advisory warning fires
    expect(warnings.some((w) => w.includes('source sections matched no page'))).toBe(true);
  });
});
