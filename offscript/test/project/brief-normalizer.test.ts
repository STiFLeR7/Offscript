/**
 * P49 — Brief Normalizer: the single convergence point.
 *
 * Both brief sources build a common NormalizedBriefInput and serialize it HERE. That is what
 * guarantees "equivalent information ⇒ byte-identical Canonical Brief", and that the output is a
 * valid brief.md the UNCHANGED pipeline (src/generate/brief.ts parseBrief) reads without loss.
 */
import { describe, it, expect } from 'vitest';
import { normalizeBrief, type NormalizedBriefInput } from '../../src/project/brief-normalizer.js';
import { parseBrief } from '../../src/generate/brief.js';

const FULL: NormalizedBriefInput = {
  track: 'website',
  oneLiner: 'Ship on-brand sites fast',
  brand: 'Acme',
  audience: 'Growth teams',
  goals: ['Drive signups', 'Explain value'],
  mustInclude: ['hero', 'features', 'faq', 'footer'],
  tone: 'confident, plain',
  successCriteria: ['signup lift'],
  sourceDoc: 'source.md',
  provenance: { packetId: 'p-123', sourceHash: 'abc' },
  body: 'Long-form grounding copy.',
};

describe('P49 brief normalizer', () => {
  it('round-trips through the UNCHANGED pipeline parser with no field loss', () => {
    const md = normalizeBrief(FULL);
    const b = parseBrief(md);
    expect(b.track).toBe('website');
    expect(b.oneLiner).toBe(FULL.oneLiner);
    expect(b.brand).toBe('Acme');
    expect(b.audience).toBe('Growth teams');
    expect(b.goals).toEqual(FULL.goals);
    expect(b.mustInclude).toEqual(FULL.mustInclude);
    expect(b.tone).toBe(FULL.tone);
    expect(b.successCriteria).toEqual(FULL.successCriteria);
    expect(b.sourceDoc).toBe('source.md');
    expect(b.provenance).toEqual(FULL.provenance);
    expect(b.body).toBe('Long-form grounding copy.');
  });

  it('is deterministic — same input ⇒ identical bytes', () => {
    expect(normalizeBrief(FULL)).toBe(normalizeBrief({ ...FULL }));
  });

  it('CONVERGENCE — equivalent information from two independent callers ⇒ byte-identical brief', () => {
    // Same logical info, different object identity / key insertion order.
    const fromManual: NormalizedBriefInput = {
      oneLiner: FULL.oneLiner, track: FULL.track, audience: FULL.audience, brand: FULL.brand,
      mustInclude: [...FULL.mustInclude!], goals: [...FULL.goals!], tone: FULL.tone,
      successCriteria: [...FULL.successCriteria!], provenance: { ...FULL.provenance! },
      sourceDoc: FULL.sourceDoc, body: FULL.body,
    };
    expect(normalizeBrief(fromManual)).toBe(normalizeBrief(FULL));
  });

  it('minimal input (track + one-liner) still produces a valid, parseable brief', () => {
    const md = normalizeBrief({ track: 'collateral', oneLiner: 'A crisp one-pager' });
    const b = parseBrief(md);
    expect(b.track).toBe('collateral');
    expect(b.oneLiner).toBe('A crisp one-pager');
    // absent optionals must not appear as empty frontmatter keys
    expect(md).not.toMatch(/^brand:/m);
    expect(md).not.toMatch(/^source-doc:/m);
  });

  it('fails loud when the required minimum is missing', () => {
    expect(() => normalizeBrief({ track: 'website', oneLiner: '' })).toThrow(/one-liner/i);
  });
});
