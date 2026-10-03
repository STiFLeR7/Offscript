import { describe, it, expect } from 'vitest';
import {
  routedStudyPointer,
  routedClassFor,
} from '../../src/generate/author-contract.js';
import type { ContentShape } from '../../src/generate/content-signal.js';

const sig = (...s: ContentShape[]): ContentShape[] => s;

describe('routedClassFor (Option 2 — routed intelligence class)', () => {
  it('spatial signal → spatial (wins over diagram)', () => {
    expect(routedClassFor(sig('spatial', 'process'))).toBe('spatial');
  });
  it('process / comparison / diagram → diagram', () => {
    expect(routedClassFor(sig('process'))).toBe('diagram');
    expect(routedClassFor(sig('comparison'))).toBe('diagram');
    expect(routedClassFor(sig('diagram'))).toBe('diagram');
  });
  it('non-rich shapes → no class routed', () => {
    expect(routedClassFor(sig('generic'))).toBe('');
  });

  // ── W54 — Data Visualization parity ────────────────────────────────────────
  describe('W54 — chart parity (stats signal)', () => {
    it('stats signal → chart', () => {
      expect(routedClassFor(sig('stats'))).toBe('chart');
      expect(routedClassFor(sig('stats', 'list'))).toBe('chart');
    });
    it('diagram/spatial still outrank chart when co-occurring (unchanged priority)', () => {
      expect(routedClassFor(sig('stats', 'diagram'))).toBe('diagram');
      expect(routedClassFor(sig('stats', 'spatial'))).toBe('spatial');
    });
  });
});

describe('routedStudyPointer (Option 1 — precise, content-routed, ungated)', () => {
  it('process page → the process diagram exemplar', () => {
    expect(routedStudyPointer(sig('process'))).toBe('diagrams/process.html');
  });
  it('comparison → the comparison exemplar', () => {
    expect(routedStudyPointer(sig('comparison'))).toBe('diagrams/comparison.html');
  });
  it('generic relational → hub-spoke default', () => {
    expect(routedStudyPointer(sig('diagram'))).toBe('diagrams/hub-spoke.html');
  });
  it('spatial → the layer-stack exemplar (spatial wins)', () => {
    expect(routedStudyPointer(sig('spatial', 'diagram'))).toBe('spatial/layer-stack.html');
  });
  it('non-rich shapes → no pointer', () => {
    expect(routedStudyPointer(sig('generic'))).toBe('');
  });
  it('website track → isolated (no collateral pointer)', () => {
    expect(routedStudyPointer(sig('process'), 'website')).toBe('');
  });

  // ── W54 — Data Visualization parity ────────────────────────────────────────
  describe('W54 — chart parity (stats signal)', () => {
    it('stats page → the benchmark-bars data-viz exemplar (governance §8: bar chart is first in the hierarchy)', () => {
      expect(routedStudyPointer(sig('stats'))).toBe('data-visualization/benchmark-bars.html');
    });
    it('diagram/spatial still outrank chart when co-occurring (unchanged priority)', () => {
      expect(routedStudyPointer(sig('stats', 'diagram'))).toBe('diagrams/hub-spoke.html');
      expect(routedStudyPointer(sig('stats', 'spatial'))).toBe('spatial/layer-stack.html');
    });
    it('website track → isolated (no collateral pointer)', () => {
      expect(routedStudyPointer(sig('stats'), 'website')).toBe('');
    });
  });
});
