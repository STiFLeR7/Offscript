/**
 * P49 — Capability discovery. Interviews are DRIVEN from project capability definitions, never
 * hardcoded: the missing REQUIRED artifacts are exactly the questions. Already-available info is
 * never asked again, and a Content-Core packet satisfies everything (no interview).
 */
import { describe, it, expect } from 'vitest';
import { discoverCapabilities } from '../../src/project/capability-discovery.js';

describe('P49 capability discovery', () => {
  it('derives required/optional/deliverables/sources from the project type definition', () => {
    const r = discoverCapabilities({ projectType: 'website' });
    expect(r.deliverables).toEqual(['website']);
    expect(r.required).toEqual(['one-liner', 'audience', 'must-include']);
    expect(r.briefSources).toContain('content-core');
    expect(r.missing).toEqual(r.required); // nothing available yet ⇒ all required are questions
    expect(r.ready).toBe(false);
  });

  it('never asks for information already available (missing excludes present)', () => {
    const r = discoverCapabilities({ projectType: 'website', available: ['audience', 'brand'] });
    expect(r.present).toEqual(['audience']); // only counts REQUIRED artifacts
    expect(r.missing).toEqual(['one-liner', 'must-include']);
    expect(r.ready).toBe(false);
  });

  it('a Content-Core packet satisfies everything ⇒ no interview questions, ready', () => {
    const r = discoverCapabilities({ projectType: 'website', packetPath: '/x/packet.md' });
    expect(r.missing).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.selectedSource).toBe('content-core');
  });

  it('with all required info available ⇒ ready via the manual source', () => {
    const r = discoverCapabilities({ projectType: 'social-campaign', available: ['one-liner', 'audience'] });
    expect(r.missing).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.selectedSource).toBe('manual');
  });
});
