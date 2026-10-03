/**
 * P18 — Designer Feedback subject helpers. RED-first.
 *
 * `feedbackSubjectForFinding`/`feedbackSubjectForProposal` are the ONLY two
 * places in the designer-feedback domain that import a real domain type
 * (`DoctorFinding` / `AuthorProposal`, both TYPE-ONLY) — kept in their own
 * file so designer-feedback.ts (the core model + identity/validation logic)
 * stays coupled to nothing but node:crypto (see that file's own isolation
 * tests). Both helpers derive a `FeedbackSubject` from fields the referenced
 * artifact ALREADY carries verbatim (`DoctorFinding.id`,
 * `AuthorProposal.identity.id`) — no new fact, no lookup, no I/O.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import { feedbackSubjectForFinding, feedbackSubjectForProposal } from '../../src/designer-feedback/designer-feedback-subjects.js';

function health(delivered: AuthoritySignal[]): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length > 0 ? 'failed' : criticals.length > 0 ? 'review-required' : 'success';
  return {
    headline: { status, goalMet: true, systematicRatio: 1, failures, criticals, warnings, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function sampleDoctorInput(): DoctorReportInput {
  return {
    subject: 'projects/example-brand/website',
    generatedAt: '2026-07-10T00:00:00.000Z',
    health: health([{ producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' }]),
    perRail: [],
    frozen: [],
  };
}

describe('feedbackSubjectForFinding', () => {
  it('derives {kind: "doctor-finding", id: finding.id} verbatim', () => {
    const report = buildDoctorReport(sampleDoctorInput());
    const finding = report.findings[0]!;
    expect(feedbackSubjectForFinding(finding)).toEqual({ kind: 'doctor-finding', id: finding.id });
  });

  it('returns a frozen object', () => {
    const report = buildDoctorReport(sampleDoctorInput());
    const subject = feedbackSubjectForFinding(report.findings[0]!);
    expect(Object.isFrozen(subject)).toBe(true);
  });

  it('never mutates the input finding — stays frozen and byte-identical', () => {
    const report = buildDoctorReport(sampleDoctorInput());
    const finding = report.findings[0]!;
    const before = JSON.stringify(finding);
    feedbackSubjectForFinding(finding);
    expect(JSON.stringify(finding)).toBe(before);
    expect(Object.isFrozen(finding)).toBe(true);
  });
});

describe('feedbackSubjectForProposal', () => {
  function sampleProposal() {
    return buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section.',
    });
  }

  it('derives {kind: "proposal", id: proposal.identity.id} verbatim', () => {
    const proposal = sampleProposal();
    expect(feedbackSubjectForProposal(proposal)).toEqual({ kind: 'proposal', id: proposal.identity.id });
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(feedbackSubjectForProposal(sampleProposal()))).toBe(true);
  });

  it('never mutates the input proposal — stays frozen and byte-identical', () => {
    const proposal = sampleProposal();
    const before = JSON.stringify(proposal);
    feedbackSubjectForProposal(proposal);
    expect(JSON.stringify(proposal)).toBe(before);
    expect(Object.isFrozen(proposal)).toBe(true);
  });
});

describe('P18 — isolation: subject helpers import domain types TYPE-ONLY', () => {
  it('every doctor-report.js / proposal.js import is type-only — no value import, no catalog/overlay/repository coupling', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-feedback/designer-feedback-subjects.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes('doctor-report.js') || line.includes('proposal.js')) {
        expect(line, `must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/overlay\.js/);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/governance/i);
    }
  });
});
