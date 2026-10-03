/**
 * Sprint 10A — Feature Mapping port. componentsForFeature() must read
 * design/creative/governance/creative/FEATURE-MAPPING.md (mirrored into
 * resources/design_processes/creative/) through the existing reference-loading
 * boundary, never a second hardcoded copy of the seven-row table.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { componentsForFeature } from '../src/feature-mapping.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/feature-mapping.ts', import.meta.url));

// The exact, documented component lists — component COUNT deliberately not uniform (4 rows of 4,
// 3 rows of 5), preserved from the source rather than normalized. See FEATURE-MAPPING.md.
const EXPECTED: Record<string, string[]> = {
  automation: ['workflow builder', 'execution status', 'automation timeline', 'success notification'],
  search: ['search bar', 'results', 'filters', 'suggestions'],
  analytics: ['charts', 'KPI cards', 'trend lines', 'comparisons'],
  security: ['permissions', 'audit logs', 'verification status', 'alerts'],
  collaboration: ['comments', 'assignments', 'mentions', 'activity feed', 'presence'],
  'ai-intelligence': ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'],
  configuration: ['settings panel', 'toggle / segmented control', 'form fields', 'scope selector', 'a preview of the effect'],
};

describe('componentsForFeature — all seven documented features', () => {
  for (const [feature, expected] of Object.entries(EXPECTED)) {
    it(`resolves "${feature}" to its exact documented component list (${expected.length} items)`, () => {
      expect(componentsForFeature(feature)).toEqual(expected);
    });
  }
});

describe('componentsForFeature — determinism', () => {
  it('returns identical results across repeated calls', () => {
    expect(componentsForFeature('automation')).toEqual(componentsForFeature('automation'));
    expect(componentsForFeature('ai-intelligence')).toEqual(componentsForFeature('ai-intelligence'));
  });
});

describe('componentsForFeature — unknown feature behavior', () => {
  it('returns an empty array for an unrecognized feature, never throws', () => {
    expect(() => componentsForFeature('not-a-real-feature')).not.toThrow();
    expect(componentsForFeature('not-a-real-feature')).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(componentsForFeature('')).toEqual([]);
  });
});

describe('componentsForFeature — returned data cannot mutate the source', () => {
  it('mutating one call\'s return value does not affect a subsequent call', () => {
    const first = componentsForFeature('automation');
    expect(() => {
      (first as string[]).push('injected');
    }).toThrow();
    const second = componentsForFeature('automation');
    expect(second).toEqual(EXPECTED.automation);
    expect(second).not.toContain('injected');
  });

  it('two calls return distinct array instances (never the same mutable reference)', () => {
    const a = componentsForFeature('search');
    const b = componentsForFeature('search');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('feature-mapping.ts — the document is the source of truth, not a second hardcoded table', () => {
  it('the implementation source file contains none of the documented component strings verbatim', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    const allComponents = Object.values(EXPECTED).flat();
    for (const component of allComponents) {
      expect(src).not.toContain(component);
    }
  });

  it('the implementation source file does not embed the seven-row markdown table', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/workflow builder.*search bar/s);
    expect(src).not.toMatch(/\|\s*automation\s*\|/i);
  });
});
