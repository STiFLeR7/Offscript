import { describe, it, expect } from 'vitest';
import { loadReference } from '../src/references.js';

describe('loadReference', () => {
  it('loads a governance markdown file by name (no extension)', () => {
    // Post-website-pivot the old guardrail docs (anti-slop-checklist / theme-orchestration)
    // were removed from resources/design_processes/website/. loadReference is generic
    // (reads <name>.md from that dir), so repoint at top-level website governance docs that
    // DO exist in the new layout — this still exercises loadReference meaningfully.
    expect(loadReference('PURPOSE')).toContain('# Purpose');
    expect(loadReference('PHILOSOPHY')).toContain('PHILOSOPHY-WEBSITE');
  });

  it('throws for an unknown reference', () => {
    expect(() => loadReference('does-not-exist')).toThrow();
  });
});
