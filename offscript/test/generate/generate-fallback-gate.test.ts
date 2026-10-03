import { describe, it, expect } from 'vitest';
import { readSubagentResponse, assertResponsesComplete } from '../../src/generate/subagent-response.js';

describe('readSubagentResponse', () => {
  it('returns the HTML when present', () => {
    expect(readSubagentResponse('hero', () => true, () => '<section id="hero">ok</section>')).toBe('<section id="hero">ok</section>');
  });
  it('returns null when absent (caller records the miss)', () => {
    expect(readSubagentResponse('hero', () => false, () => '')).toBeNull();
  });
});

describe('assertResponsesComplete — fail-loud gate (C1)', () => {
  it('does NOT throw when nothing is missing', () => {
    expect(() => assertResponsesComplete([])).not.toThrow();
  });
  it('THROWS listing ALL missing sections', () => {
    expect(() => assertResponsesComplete(['hero', 'cta'])).toThrowError(/hero.*cta|cta.*hero/);
  });
  it('error names the count and the missing ids', () => {
    try { assertResponsesComplete(['faq']); } catch (e) { expect((e as Error).message).toContain('faq.response.html'); return; }
    throw new Error('expected a throw');
  });
});
