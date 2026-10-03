/**
 * G4-S2 — Orphaned Compatibility Removal: remove the two `*FromLegacy` adapters G4-S1 proved have ZERO
 * production consumers. They are no longer compatibility — they are dead code.
 *
 * `authorContractFromLegacy` (author-contract-adapter.ts) had 0 production consumers (tests only). This
 * sprint removes it. `renderContractFromLegacy` was already retired in G2-S3; this guard re-affirms it,
 * so the file asserts the sprint's success criterion directly: BOTH orphaned bridges are unexported.
 *
 * This is the RED→GREEN guard: authored while `authorContractFromLegacy` was still a function (RED —
 * expected undefined), green after removal. Every RETAINED author/render helper is asserted present, so
 * the removal is surgical — nothing live was touched.
 */
import { describe, it, expect } from 'vitest';
import * as legacyAdapter from '../../src/project/legacy-execution-adapter.js';
import * as authorAdapter from '../../src/project/author-contract-adapter.js';

const legacy = legacyAdapter as Record<string, unknown>;
const author = authorAdapter as Record<string, unknown>;

describe('G4-S2 orphaned compatibility removal', () => {
  it('both orphaned `*FromLegacy` bridges are removed (no longer exported)', () => {
    expect(author.authorContractFromLegacy).toBeUndefined(); // removed this sprint
    expect(legacy.renderContractFromLegacy).toBeUndefined(); // already retired in G2-S3
  });

  it('every RETAINED author-contract helper remains exported (production-reachable — untouched)', () => {
    // authorContractFromPlan is built by orchestrateGeneration (the native path); the rest drive the
    // contract-sourced Author entry. None of these is an orphan — only the legacy bridge was.
    expect(typeof author.authorContractFromPlan).toBe('function');
    expect(typeof author.authorOriginFromContract).toBe('function');
    expect(typeof author.proposalRequestFromContract).toBe('function');
    expect(typeof author.generateProposalFromContract).toBe('function');
    expect(typeof author.generateProposalPackageFromContract).toBe('function');
  });

  it('the LIVE render/legacy execution-identity helpers remain exported (must NOT be retired)', () => {
    expect(typeof legacy.renderContractFromPlan).toBe('function');
    expect(typeof legacy.legacyExecutionIdentityFromContract).toBe('function');
    expect(typeof legacy.legacyExecutionIdentityFromLegacy).toBe('function'); // the legacy runtime branch's bridge — retained
  });
});
