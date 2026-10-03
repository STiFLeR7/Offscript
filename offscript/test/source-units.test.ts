import { describe, it, expect } from 'vitest';
import {
  extractMustIncludeUnits,
  segmentBody,
  extractSourceUnits,
  type SourceUnit,
} from '../src/generate/source-units.js';

// W2-S1 — Source Unit Extraction (two-tier model).
// Governed by docs/internals/W2-EXECUTION-PACKAGE.md (Contract 1: must-include entry +
// multi-boundary body segment) and W2-FIDELITY-FAILURE-OWNERSHIP.md.
// EXTRACTION ONLY — produces units; does NOT bind (W2-S2), score, or emit signals.
// The load-bearing objective: a heading-less brief must NEVER collapse to zero body
// segments (the live R1 root cause: plan.ts splitBodyChunks → chunks.length===0).

describe('Tier 1 — must-include units', () => {
  it('turns each must-include entry into a Tier-1 unit, preserving the text', () => {
    const units = extractMustIncludeUnits(['Hero', 'Feature grid', 'Pricing']);
    expect(units).toHaveLength(3);
    expect(units.every((u) => u.tier === 1 && u.kind === 'must-include')).toBe(true);
    expect(units.map((u) => u.label)).toEqual(['Hero', 'Feature grid', 'Pricing']);
    expect(units[1].slug).toBe('feature-grid');
    expect(units[0].content).toBe('Hero'); // content faithful to source
  });

  it('returns no Tier-1 units for an empty must-include list', () => {
    expect(extractMustIncludeUnits([])).toEqual([]);
  });
});

describe('Tier 2 — heading-based segmentation (existing format still works)', () => {
  it('splits on markdown headings, keeping label + verbatim content', () => {
    const body = `## How It Works\nMaker proposes, checker approves.\n## Pricing\n18% flat.`;
    const segs = segmentBody(body);
    expect(segs).toHaveLength(2);
    expect(segs[0].kind).toBe('heading');
    expect(segs[0].label).toBe('How It Works');
    expect(segs[0].slug).toBe('how-it-works');
    expect(segs[0].content).toContain('Maker proposes');
    expect(segs[1].label).toBe('Pricing');
    expect(segs[1].content).toContain('18% flat');
  });

  it('strips heading enumerators in the label (## 2. How It Works → How It Works)', () => {
    const segs = segmentBody(`## 2. How It Works\nbody`);
    expect(segs[0].label).toBe('How It Works');
    expect(segs[0].slug).toBe('how-it-works');
  });
});

describe('Tier 2 — bold lead-in segmentation', () => {
  it('treats a leading **Bold:** line as a segment boundary', () => {
    const body = `**Statutory Determinism:** GST 18% applies to every line.\n**Audit Trail:** every step is logged.`;
    const segs = segmentBody(body);
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => s.kind === 'bold-leadin')).toBe(true);
    expect(segs[0].label).toBe('Statutory Determinism');
    expect(segs[0].content).toContain('GST 18%');
    expect(segs[1].label).toBe('Audit Trail');
  });

  it('recognises a bulleted bold lead-in (- **Term:** …)', () => {
    const body = `- **Reliability:** four nines.\n- **Scale:** ten regions.`;
    const segs = segmentBody(body);
    expect(segs).toHaveLength(2);
    expect(segs[0].kind).toBe('bold-leadin');
    expect(segs[0].label).toBe('Reliability');
  });
});

describe('Tier 2 — blank-line block segmentation (no headings, no bold)', () => {
  it('splits a heading-less body into blank-line-delimited blocks', () => {
    const body = `First paragraph about the product.\n\nSecond paragraph about the audience.`;
    const segs = segmentBody(body);
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => s.kind === 'blank-block')).toBe(true);
    expect(segs[0].content).toContain('First paragraph');
    expect(segs[1].content).toContain('Second paragraph');
  });
});

describe('the R1 killer — a heading-less brief NEVER collapses to zero segments', () => {
  it('a single unbroken paragraph (no heading, no bold, no blank line) yields ONE coarse segment', () => {
    const body = `One long paragraph with no markdown structure whatsoever, just prose.`;
    const segs = segmentBody(body);
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs).toHaveLength(1);
    expect(segs[0].content).toBe(body);
  });

  it('any non-empty heading-less body produces at least one segment (no silent loss)', () => {
    for (const body of [
      'plain text',
      'line one\nline two\nline three',
      'block A\n\nblock B\n\nblock C',
    ]) {
      expect(segmentBody(body).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('an empty / whitespace-only body yields zero segments (legitimately nothing to lose)', () => {
    expect(segmentBody('')).toEqual([]);
    expect(segmentBody('   \n  \n')).toEqual([]);
  });
});

describe('preamble is preserved, never dropped (the old splitBodyChunks bug)', () => {
  it('text before the first heading becomes its own leading segment', () => {
    const body = `Intro context that precedes any heading.\n\n## Section A\nthe section body.`;
    const segs = segmentBody(body);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].content).toContain('Intro context');
    expect(segs[segs.length - 1].label).toBe('Section A');
  });
});

describe('mixed boundaries + content fidelity', () => {
  it('recognises headings and bold lead-ins together as boundaries', () => {
    const body = `## Overview\nthe overview.\n**Note:** a bold aside.`;
    const segs = segmentBody(body);
    expect(segs).toHaveLength(2);
    expect(segs[0].kind).toBe('heading');
    expect(segs[1].kind).toBe('bold-leadin');
  });

  it('every segment carries its source text verbatim (no content loss)', () => {
    const body = `## A\nalpha line.\n## B\nbeta line.`;
    const joined = segmentBody(body)
      .map((s) => s.content)
      .join('\n');
    expect(joined).toContain('alpha line');
    expect(joined).toContain('beta line');
  });
});

describe('extractSourceUnits — combined two-tier extraction', () => {
  it('returns Tier-1 must-include units and Tier-2 body segments together', () => {
    const result = extractSourceUnits({
      mustInclude: ['Hero', 'Pricing'],
      body: `## Hero\nthe hero copy.\n\nsome trailing prose.`,
    });
    expect(result.tier1).toHaveLength(2);
    expect(result.tier1.every((u: SourceUnit) => u.tier === 1)).toBe(true);
    expect(result.tier2.length).toBeGreaterThanOrEqual(1);
    expect(result.tier2.every((u: SourceUnit) => u.tier === 2)).toBe(true);
  });

  it('a brief with must-includes but a heading-less body still yields Tier-2 segments', () => {
    const result = extractSourceUnits({
      mustInclude: ['Hero'],
      body: `just one paragraph of prose, no headings at all.`,
    });
    expect(result.tier1).toHaveLength(1);
    expect(result.tier2.length).toBeGreaterThanOrEqual(1); // R1 killer at the combined level
  });
});
