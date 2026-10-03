/**
 * Sprint W83 — Track-Neutral Governance Reference Resolution.
 *
 * Closes the W82 root cause: a governance pack is authored ONCE per client, track-independent,
 * but each track's planner assigns its own section ids for the same brief content. This module
 * is the single shared classifier every id-referencing Governance Model consumer (progression,
 * mechanism) uses to resolve a governance-authored id against the CURRENT track's plan.
 *
 * See docs/internals/SPRINT-W83-TRACK-NEUTRAL-GOVERNANCE-REFERENCES.md.
 */
import { describe, it, expect } from 'vitest';
import { resolveGovernanceReferences } from '../../src/generate/reasoning/governance-reference.js';
import { WEBSITE_DEFAULT_SECTION_IDS } from '../../src/generate/plan.js';

describe('W83 — resolveGovernanceReferences', () => {
  it('classifies an id present in the current plan as present, in original order', () => {
    const planIdSet = new Set(['a', 'b', 'c']);
    const r = resolveGovernanceReferences(['c', 'a', 'b'], 'website', planIdSet);
    expect(r.present).toEqual(['c', 'a', 'b']);
    expect(r.elsewhere.size).toBe(0);
    expect(r.unresolved).toEqual([]);
  });

  it('classifies a genuinely unrecognized id as unresolved (fail-loud territory)', () => {
    const planIdSet = new Set(['a', 'b']);
    const r = resolveGovernanceReferences(['a', 'ghost'], 'website', planIdSet);
    expect(r.unresolved).toEqual(['ghost']);
    expect(r.present).toEqual(['a']);
  });

  it('classifies a website structural-default id as "elsewhere" when the current track is collateral', () => {
    const planIdSet = new Set(['real-page']); // collateral plan — no 'hero' padding default exists
    const r = resolveGovernanceReferences(['hero', 'real-page', 'footer'], 'collateral', planIdSet);
    expect(r.present).toEqual(['real-page']);
    expect([...r.elsewhere].sort()).toEqual(['footer', 'hero']);
    expect(r.unresolved).toEqual([]);
  });

  it('does NOT exempt a track from its OWN structural defaults — website plans still require them present', () => {
    const planIdSet = new Set(['content-section']); // website plan WITHOUT the 'hero' padding item present
    const r = resolveGovernanceReferences(['hero'], 'website', planIdSet);
    // 'hero' is website's OWN default — referencing it while generating website but it being
    // absent from THIS plan is a genuine coverage problem, not a cross-track exemption.
    expect(r.present).toEqual([]);
    expect(r.elsewhere.size).toBe(0);
    expect(r.unresolved).toEqual(['hero']);
  });

  it('every WEBSITE_DEFAULT_SECTION_IDS entry is recognized as elsewhere when currentTrack is collateral', () => {
    const planIdSet = new Set<string>();
    const r = resolveGovernanceReferences([...WEBSITE_DEFAULT_SECTION_IDS], 'collateral', planIdSet);
    expect(r.unresolved).toEqual([]);
    expect(r.elsewhere.size).toBe(WEBSITE_DEFAULT_SECTION_IDS.size);
  });

  it('is a pure function — no mutation of inputs, deterministic across repeated calls', () => {
    const ids = ['x', 'hero', 'y'];
    const planIdSet = new Set(['x', 'y']);
    const a = resolveGovernanceReferences(ids, 'collateral', planIdSet);
    const b = resolveGovernanceReferences(ids, 'collateral', planIdSet);
    expect(a).toEqual(b);
    expect(ids).toEqual(['x', 'hero', 'y']); // untouched
  });

  it('collateral and deck currently contribute no structural defaults of their own', () => {
    const planIdSet = new Set<string>();
    // Referencing a bogus id while generating website: collateral/deck have no defaults to exempt it via.
    const r = resolveGovernanceReferences(['not-a-real-id'], 'website', planIdSet);
    expect(r.unresolved).toEqual(['not-a-real-id']);
  });
});
