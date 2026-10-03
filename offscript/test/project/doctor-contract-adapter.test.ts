/**
 * P56 — Doctor Contract Adapter (unit). The adapter injects ONLY the contract-owned identity fields
 * (subject / client / track) from the Generation Contract and passes the run-owned diagnostic surface
 * (health / perRail / frozen / plan / score) through verbatim. It never modifies Designer Doctor.
 */
import { describe, it, expect } from 'vitest';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import { buildDoctorReport } from '../../src/doctor/doctor-report.js';
import {
  doctorContractFromLegacy,
  doctorContractFromPlan,
  doctorSubjectFromContract,
  doctorInputFromContract,
  buildDoctorReportFromContract,
  reviewPackageInputFromContract,
  type DoctorRuntimeInputs,
} from '../../src/project/doctor-contract-adapter.js';

// ── Fixtures (hand-built diagnostic surface — same shape the Doctor tests use) ──
function signal(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return { producer: 'contrast', level: 'failure', where: 'contrast:hero', what: 'insufficient contrast', why: 'WCAG AA', nature: 'objective', ...over };
}
function health(delivered: AuthoritySignal[]): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length ? 'failed' : criticals.length ? 'review-required' : 'success';
  return {
    headline: { status, goalMet: true, systematicRatio: 1, failures, criticals, warnings, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}
const runtime = (): DoctorRuntimeInputs => ({ generatedAt: '2026-01-01T00:00:00Z', health: health([signal()]), perRail: [], frozen: [] });

describe('P56 doctor contract adapter', () => {
  it('derives the run subject "<client>/<track>" from the contract identity + scope', () => {
    const contract = doctorContractFromLegacy({ client: 'acme', deliverables: ['website'] });
    expect(doctorSubjectFromContract(contract, 'website')).toBe('acme/website');
  });

  it('injects the subject and passes the run diagnostics through VERBATIM (same refs)', () => {
    const contract = doctorContractFromLegacy({ client: 'acme', deliverables: ['website'] });
    const rt = runtime();
    const input = doctorInputFromContract(contract, 'website', rt);
    expect(input.subject).toBe('acme/website');
    expect(input.health).toBe(rt.health); // verbatim — not rebuilt
    expect(input.perRail).toBe(rt.perRail);
    expect(input.frozen).toBe(rt.frozen);
    expect(input.generatedAt).toBe(rt.generatedAt);
  });

  it('is a scope gate: a track outside the contract scope is refused (Doctor stops deciding scope)', () => {
    const contract = doctorContractFromLegacy({ client: 'acme', deliverables: ['website'] });
    expect(() => doctorInputFromContract(contract, 'collateral', runtime())).toThrow(/scope|collateral/i);
  });

  it('review-package input sources client from the contract, validates the track, passes the rest through', () => {
    const contract = doctorContractFromLegacy({ client: 'acme', deliverables: ['website', 'collateral'] });
    const report = buildDoctorReportFromContract(contract, 'website', runtime());
    const pkgInput = reviewPackageInputFromContract(contract, 'collateral', {
      doctorReport: report,
      score: { generatedAt: report.generatedAt, subject: 'x', buckets: {}, systematicRatio: 1, railBreakdown: [] } as never,
      reviewReport: { findings: [] } as never,
      reviewReportMarkdown: '# r',
      validationSummary: 'ok',
    });
    expect(pkgInput.client).toBe('acme');
    expect(pkgInput.track).toBe('collateral');
    expect(pkgInput.doctorReport).toBe(report); // verbatim
  });

  it('a native P55 plan projects to the same {client, deliverables} contract view', () => {
    // doctorContractFromPlan reads only identity.client + scope.included from a frozen GenerationPlan.
    const view = doctorContractFromPlan({ identity: { client: 'acme' }, scope: { included: ['website'] } } as never);
    expect(view).toEqual({ client: 'acme', deliverables: ['website'] });
  });

  it('OLD-API compatibility: the contract path equals a direct buildDoctorReport call', () => {
    const rt = runtime();
    const viaContract = buildDoctorReportFromContract(doctorContractFromLegacy({ client: 'acme', deliverables: ['website'] }), 'website', rt);
    const direct = buildDoctorReport({ subject: 'acme/website', ...rt });
    expect(viaContract).toEqual(direct);
  });
});
