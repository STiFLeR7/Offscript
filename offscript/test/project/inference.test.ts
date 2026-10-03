/**
 * P50 — Inference engine. Combines attributable evidence into candidate facts: corroborating
 * sources reinforce a value, disagreeing credible sources produce a conflict, and an authoritative
 * (interview / CERTAIN) source overrides discovered context rather than conflicting with it.
 */
import { describe, it, expect } from 'vitest';
import { CONFIDENCE, answersToEvidence, type Evidence } from '../../src/project/evidence.js';
import { inferFacts, knownValues, DEFAULT_CONFIDENCE_THRESHOLD } from '../../src/project/inference.js';

const NOW = '2026-01-01T00:00:00Z';
function ev(field: string, value: unknown, source: string, confidence: number): Evidence {
  return { field, value, source, confidence, timestamp: NOW, origin: `origin:${source}` };
}

describe('P50 inference engine', () => {
  it('a single credible evidence yields a fact carrying its value + confidence', () => {
    const [f] = inferFacts([ev('brand', 'Acme', 'brand-kit', 0.8)]);
    expect(f.field).toBe('brand');
    expect(f.value).toBe('Acme');
    expect(f.confidence).toBe(0.8);
    expect(f.conflicting).toBe(false);
    expect(f.sources).toEqual(['brand-kit']);
  });

  it('MERGES corroborating evidence for the same value (confidence reinforced, sources unioned)', () => {
    const [f] = inferFacts([
      ev('brand', 'Acme', 'existing-brief', CONFIDENCE.HIGH),
      ev('brand', 'Acme', 'brand-kit', 0.8),
    ]);
    expect(f.value).toBe('Acme');
    expect(f.confidence).toBeCloseTo(1.0, 5); // 0.9 + 0.1 corroboration bump, capped at 1
    expect(f.sources).toEqual(['brand-kit', 'existing-brief']); // sorted, deduped
    expect(f.conflicting).toBe(false);
  });

  it('flags a CONFLICT when two distinct values are each independently credible', () => {
    const [f] = inferFacts([
      ev('brand', 'Acme Corp', 'existing-brief', CONFIDENCE.HIGH), // 0.9 wins
      ev('brand', 'Acme', 'brand-kit', 0.8),
    ]);
    expect(f.value).toBe('Acme Corp');
    expect(f.conflicting).toBe(true);
    expect(f.alternatives).toEqual([{ value: 'Acme', confidence: 0.8, sources: ['brand-kit'] }]);
  });

  it('a weak dissenting value below threshold does NOT create a conflict', () => {
    const [f] = inferFacts([
      ev('brand', 'Acme', 'brand-kit', 0.8),
      ev('brand', 'acme', 'workspace-manifest', CONFIDENCE.LOW), // 0.3 — too weak to conflict
    ]);
    expect(f.value).toBe('Acme');
    expect(f.conflicting).toBe(false);
    expect(f.alternatives).toEqual([]); // sub-threshold competitors excluded
  });

  it('an AUTHORITATIVE interview answer overrides discovered context instead of conflicting', () => {
    const [f] = inferFacts([
      ev('brand', 'Acme Corp', 'interview', CONFIDENCE.CERTAIN), // human said so
      ev('brand', 'Acme', 'brand-kit', 0.8),
    ]);
    expect(f.value).toBe('Acme Corp');
    expect(f.authoritative).toBe(true);
    expect(f.conflicting).toBe(false); // the interview is ground truth, not a conflicting peer
  });

  it('is deterministic and field-sorted regardless of input order', () => {
    const a = inferFacts([ev('tone', 'bold', 's', 0.8), ev('brand', 'Acme', 's', 0.8)]).map((f) => f.field);
    const b = inferFacts([ev('brand', 'Acme', 's', 0.8), ev('tone', 'bold', 's', 0.8)]).map((f) => f.field);
    expect(a).toEqual(['brand', 'tone']);
    expect(a).toEqual(b);
  });

  it('knownValues() returns only non-conflicting facts at/above threshold, keyed by field', () => {
    const facts = inferFacts([
      ev('brand', 'Acme', 'brand-kit', 0.8), // known
      ev('audience', 'devs', 'workspace-manifest', CONFIDENCE.LOW), // 0.3 — below threshold
      ev('tone', 'x', 'a', 0.9),
      ev('tone', 'y', 'b', 0.9), // conflict — excluded
    ]);
    // only 'brand' survives: audience is sub-threshold, tone is conflicting
    expect(knownValues(facts)).toEqual({ brand: 'Acme' });
  });

  it('the default confidence threshold that suppresses interviews is 0.7', () => {
    expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it('answersToEvidence maps gathered answers to CERTAIN interview evidence', () => {
    const evs = answersToEvidence({ oneLiner: 'X', mustInclude: ['a', 'b'] }, NOW);
    const byField = Object.fromEntries(evs.map((e) => [e.field, e]));
    expect(byField['one-liner'].value).toBe('X');
    expect(byField['one-liner'].confidence).toBe(CONFIDENCE.CERTAIN);
    expect(byField['one-liner'].source).toBe('interview');
    expect(byField['must-include'].value).toEqual(['a', 'b']);
    expect(evs.every((e) => e.timestamp === NOW)).toBe(true);
  });
});
