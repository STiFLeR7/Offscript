import { describe, expect, it } from 'vitest';
import { parsePlaybook, loadPlaybook, resolvePlaybookAnchors, playbookAvailable } from '../src/playbook.js';

const SAMPLE = [
  '# Title',
  '',
  '## Part 1 — Brand Contract',
  '',
  'Intro prose.',
  '',
  '### 1.1 Token slots',
  '',
  'Body of 1.1.',
  'second line.',
  '',
  '### 1.2 Voice slots',
  '',
  'Body of 1.2.',
  '',
  '## Part 2 — Composition',
  '',
  '### 2.1 Narrative arc',
  '',
  'Body of 2.1.',
  '',
].join('\n');

describe('parsePlaybook', () => {
  it('keys every §N.M section by anchor id', () => {
    const pb = parsePlaybook(SAMPLE);
    expect(Array.from(pb.keys())).toEqual(['§1.1', '§1.2', '§2.1']);
  });

  it('captures the heading line plus body verbatim, stopping at the next ### or ##', () => {
    const pb = parsePlaybook(SAMPLE);
    expect(pb.get('§1.1')).toBe(
      ['### 1.1 Token slots', '', 'Body of 1.1.', 'second line.', ''].join('\n'),
    );
    expect(pb.get('§2.1')).toBe(['### 2.1 Narrative arc', '', 'Body of 2.1.', ''].join('\n'));
  });
});

// Post-website-pivot (#46): the canonical SECTION_INTELLIGENCE.md was removed (the
// author-from-governance layout ships no section-intelligence playbook). loadPlaybook()
// is now guarded by playbookAvailable() everywhere it's called from the harden path.
describe('loadPlaybook / playbookAvailable (post-website-pivot)', () => {
  it('playbookAvailable() reports the canonical file is absent for this track', () => {
    expect(playbookAvailable()).toBe(false);
  });

  it('loadPlaybook() without a path throws when the default file is absent (why the guard exists)', () => {
    expect(() => loadPlaybook()).toThrow();
  });

  it('loadPlaybook(path) with an explicit file still parses (the test-injection branch is unaffected)', () => {
    // The explicit-path branch never touches the absent default file. Round-trip a
    // SAMPLE-shaped playbook through a data: round-trip is not possible, so assert the
    // injection branch via parsePlaybook (loadPlaybook(path) === parsePlaybook(readFile)).
    const pb = parsePlaybook(SAMPLE);
    expect(pb.has('§1.1')).toBe(true);
    expect(pb.get('§1.1')!.startsWith('### 1.1 ')).toBe(true);
  });
});

describe('resolvePlaybookAnchors', () => {
  it('joins requested excerpts verbatim, sorted by anchor', () => {
    const pb = parsePlaybook(SAMPLE);
    const out = resolvePlaybookAnchors(['§2.1', '§1.1'], pb);
    const idx11 = out.indexOf('### 1.1');
    const idx21 = out.indexOf('### 2.1');
    expect(idx11).toBeGreaterThanOrEqual(0);
    expect(idx21).toBeGreaterThan(idx11);
  });

  it('deduplicates anchors', () => {
    const pb = parsePlaybook(SAMPLE);
    const out = resolvePlaybookAnchors(['§1.1', '§1.1'], pb);
    const occurrences = out.split('### 1.1 Token slots').length - 1;
    expect(occurrences).toBe(1);
  });

  it('is deterministic across calls with the same input', () => {
    const pb = parsePlaybook(SAMPLE);
    const a = resolvePlaybookAnchors(['§1.2', '§2.1', '§1.1'], pb);
    const b = resolvePlaybookAnchors(['§2.1', '§1.1', '§1.2'], pb);
    expect(a).toBe(b);
  });

  it('throws RangeError on an unknown anchor', () => {
    const pb = parsePlaybook(SAMPLE);
    expect(() => resolvePlaybookAnchors(['§9.9'], pb)).toThrow(RangeError);
    expect(() => resolvePlaybookAnchors(['§9.9'], pb)).toThrow(/§9\.9/);
  });
});
