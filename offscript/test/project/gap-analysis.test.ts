/**
 * P50 — Gap analysis. After inference, each REQUIRED field is bucketed Known / Unknown /
 * Conflicting / Low-confidence. Only the non-Known fields become interview questions (in required
 * order), so a fully-evidenced project asks nothing.
 */
import { describe, it, expect } from 'vitest';
import { CONFIDENCE, type Evidence } from '../../src/project/evidence.js';
import { inferFacts } from '../../src/project/inference.js';
import { analyzeGaps } from '../../src/project/gap-analysis.js';

const NOW = '2026-01-01T00:00:00Z';
function ev(field: string, value: unknown, source: string, confidence: number): Evidence {
  return { field, value, source, confidence, timestamp: NOW, origin: source };
}
const REQUIRED = ['one-liner', 'audience', 'must-include'];

describe('P50 gap analysis', () => {
  it('buckets a partially-evidenced project and asks only the unresolved required fields', () => {
    const facts = inferFacts([ev('audience', 'Growth teams', 'brand-kit', 0.8)]);
    const g = analyzeGaps(REQUIRED, facts);
    expect(g.known).toEqual(['audience']);
    expect(g.unknown).toEqual(['one-liner', 'must-include']);
    expect(g.questions).toEqual(['one-liner', 'must-include']); // required order preserved
  });

  it('a conflicting required field becomes a (conflict) question, not a silent pick', () => {
    const facts = inferFacts([
      ev('audience', 'Devs', 'existing-brief', CONFIDENCE.HIGH),
      ev('audience', 'Marketers', 'brand-kit', 0.8),
    ]);
    const g = analyzeGaps(REQUIRED, facts);
    expect(g.conflicting).toEqual(['audience']);
    expect(g.questions).toContain('audience');
  });

  it('a low-confidence required field is still a question (evidence too weak to trust)', () => {
    const facts = inferFacts([ev('audience', 'someone', 'workspace-manifest', CONFIDENCE.LOW)]);
    const g = analyzeGaps(REQUIRED, facts);
    expect(g.lowConfidence).toEqual(['audience']);
    expect(g.questions).toContain('audience');
  });

  it('SUPPRESSES the interview entirely when every required field is known', () => {
    const facts = inferFacts([
      ev('one-liner', 'Ship fast', 'existing-brief', CONFIDENCE.HIGH),
      ev('audience', 'Growth teams', 'existing-brief', CONFIDENCE.HIGH),
      ev('must-include', ['hero', 'footer'], 'existing-brief', CONFIDENCE.HIGH),
    ]);
    const g = analyzeGaps(REQUIRED, facts);
    expect(g.questions).toEqual([]);
    expect(g.known).toEqual(REQUIRED);
  });

  it('no evidence at all ⇒ every required field is a question (full interview)', () => {
    const g = analyzeGaps(REQUIRED, []);
    expect(g.questions).toEqual(REQUIRED);
    expect(g.unknown).toEqual(REQUIRED);
  });
});
