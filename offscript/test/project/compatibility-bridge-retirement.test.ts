/**
 * G2-S3 — Compatibility Bridge Retirement: retire the FIRST compatibility bridge proven unnecessary.
 *
 * Consumer inventory (this session, grep-verified) showed `renderContractFromLegacy` (the render tier's
 * legacy-lift bridge) has ZERO consumers — no production caller (directly or transitively via
 * generate.ts), and not even a test. Its siblings are all live: `renderContractFromPlan` is built by
 * `orchestrateGeneration`; the LEGACY execution path sources identity from `legacyExecutionIdentityFromLegacy`
 * (G2-S2) and its ReviewPackage from `doctorContractFromLegacy` (G2-S1) — never from the render-lift bridge.
 * The render/ReviewPackage identity migration is complete (G2-S1/S2), so it carries no future dependency
 * either. This test retires it and guards the retirement: the orphaned bridge is gone, every live helper
 * remains, and every RETAINED bridge (with a documented future-migration dependency) is untouched.
 *
 * Behaviour / replay / ReviewPackage / Doctor / Author unchanged is proven by the FULL suite staying green
 * (it exercises the byte-identity tests from G1/G2-S1/S2) plus the live-CLI smoke in the G2-S3 report —
 * removing an unexecuted function changes no code path.
 */
import { describe, it, expect } from 'vitest';
import * as legacyAdapter from '../../src/project/legacy-execution-adapter.js';
import * as doctorAdapter from '../../src/project/doctor-contract-adapter.js';
import * as authorAdapter from '../../src/project/author-contract-adapter.js';

const legacy = legacyAdapter as Record<string, unknown>;
const doctor = doctorAdapter as Record<string, unknown>;
const author = authorAdapter as Record<string, unknown>;

describe('G2-S3 compatibility bridge retirement', () => {
  it('the orphaned render-lift bridge `renderContractFromLegacy` is retired (no longer exported)', () => {
    expect(legacy.renderContractFromLegacy).toBeUndefined();
  });

  it('the LIVE render helpers remain exported (production-reachable — must NOT be retired)', () => {
    // renderContractFromPlan: built by orchestrateGeneration. legacyExecutionIdentityFrom*: the live
    // native (contract) + legacy (bridge) execution-identity projections threaded into DesignContext.
    expect(typeof legacy.renderContractFromPlan).toBe('function');
    expect(typeof legacy.legacyExecutionIdentityFromContract).toBe('function');
    expect(typeof legacy.legacyExecutionIdentityFromLegacy).toBe('function');
  });

  it('retained compatibility bridges with a documented future-migration dependency are untouched', () => {
    // doctorContractFromLegacy: LIVE (G2-S1 legacy ReviewPackage builder).
    expect(typeof doctor.doctorContractFromLegacy).toBe('function');
    expect(typeof doctor.buildReviewPackageFromContract).toBe('function');
    // Doctor drivers — future: DoctorReport subject reconciliation + nativeDoctorReport promotion.
    expect(typeof doctor.doctorContractFromPlan).toBe('function');
    expect(typeof doctor.buildDoctorReportFromContract).toBe('function');
    // Author bridges — future: designer-author workflow (nativeAuthorProposal promotion).
    // (`authorContractFromLegacy` was removed in G4-S2 — see orphaned-compatibility-removal.test.ts.)
    expect(typeof author.authorContractFromPlan).toBe('function');
    expect(typeof author.generateProposalFromContract).toBe('function');
  });
});
