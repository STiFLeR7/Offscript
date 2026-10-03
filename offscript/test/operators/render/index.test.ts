import { describe, it, expect } from 'vitest';
import { renderOperators } from '../../../src/operators/render/index.js';

describe('render-operator sub-registry', () => {
  it('exports a typed Operator[] array (may be empty at any given checkpoint)', () => {
    expect(Array.isArray(renderOperators)).toBe(true);
  });

  it('includes render-shorthand-sanity (Task 4)', () => {
    expect(renderOperators.some((o) => o.name === 'render-shorthand-sanity')).toBe(true);
  });

  it('includes render-overflow-bounds (Task 5)', () => {
    expect(renderOperators.some((o) => o.name === 'render-overflow-bounds')).toBe(true);
  });

  it('includes render-visibility-floor (Task 6)', () => {
    expect(renderOperators.some((o) => o.name === 'render-visibility-floor')).toBe(true);
  });

  it('includes kit-vs-live (Task 8)', () => {
    expect(renderOperators.some((o) => o.name === 'kit-vs-live')).toBe(true);
  });

  it('every entry has the canonical Operator shape (name + tier + detect + apply)', () => {
    for (const op of renderOperators) {
      expect(typeof op.name).toBe('string');
      expect([0, 1, 2]).toContain(op.tier);
      expect(typeof op.detect).toBe('function');
      expect(typeof op.apply).toBe('function');
    }
  });

  it('operator names are unique within the sub-registry', () => {
    const names = renderOperators.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
