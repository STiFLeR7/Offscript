/**
 * P19 — Designer Workspace Foundation. RED-first.
 *
 * Investigation (see docs/internals/P19-DESIGNER-WORKSPACE-FOUNDATION.md §3)
 * evaluated three architectures: (A) extend ReviewPackage — rejected, a
 * ReviewPackage is scoped to ONE run's diagnostic content and doctor/ must
 * never gain a value-level dependency on designer-author/designer-feedback
 * to discover/aggregate their packages; (B) a bare aggregation function with
 * no persisted artifact — rejected, the brief requires an immutable,
 * replayable snapshot with its own manifest/package/IO, not a live query;
 * (C) a NEW, independent `DesignerWorkspace` package that REFERENCES
 * (never embeds) already-built `ReviewPackage` / `ProposalPackage` /
 * `ProposalReviewReport` / `FeedbackPackage` objects — chosen.
 *
 * `buildDesignerWorkspace` computes only two kinds of thing from its inputs:
 * (1) a `WorkspaceArtifactReference` per supplied package — {kind, id,
 * sha256} indexing what already exists, exactly like `ReviewPackage.artifacts`
 * indexes review-report.md/doctor-report.json/score.json; (2) a
 * `WorkspaceReviewProgress` — raw counts (total/resolved/unresolved) derived
 * by set-deduplicating `DesignerFeedback.subject` references against
 * `ReviewPackage.findingCount` / the supplied proposal count. Nothing here
 * infers quality or generates a recommendation — every number is either a
 * caller-supplied count or a distinct-id tally.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage, type ReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { buildProposalPackage } from '../../src/designer-author/proposal-package.js';
import { reviewProposal } from '../../src/designer-author/proposal-review.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { materializeOverlayCandidate } from '../../src/designer-author/overlay-materialization.js';
import { recordOverlayActivation } from '../../src/designer-author/overlay-activation.js';
import { buildActivationPackage } from '../../src/designer-author/overlay-activation-package.js';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
import { buildFeedbackPackage } from '../../src/designer-feedback/designer-feedback-package.js';
import {
  DesignerWorkspaceError,
  buildDesignerWorkspace,
} from '../../src/designer-workspace/designer-workspace.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

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

function sampleReviewPackage(client = 'example-brand', track = 'website'): ReviewPackage {
  const doctorInput: DoctorReportInput = {
    subject: `projects/${client}/${track}`,
    generatedAt: '2026-07-11T00:00:00.000Z',
    health: health([
      { producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' },
      { producer: 'contrast', level: 'critical-warning', where: 'contrast:footer', what: 'off-tone', why: 'human judgement', nature: 'subjective' },
    ]),
    perRail: [],
    frozen: [],
  };
  const doctorReport = buildDoctorReport(doctorInput);
  const reviewReport = buildReviewReport(doctorReport);
  return buildReviewPackage({
    client,
    track,
    doctorReport,
    score: scoreFindingsByRail({ subject: doctorInput.subject, applied: [], perRail: [] }),
    reviewReport,
    reviewReportMarkdown: renderReviewReport(reviewReport),
    validationSummary: 'Run headline: REVIEW-REQUIRED...',
  });
}

function sampleProposalPackage(marker = 'a') {
  const proposal = buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: `A well-formed proposed hero section ${marker}.`,
    },
    { now: () => '2026-07-11T00:00:00.000Z' },
  );
  return { proposal, pkg: buildProposalPackage({ proposal }, { now: () => '2026-07-11T00:01:00.000Z' }) };
}

function sampleFeedbackPackage(subjectKind: 'doctor-finding' | 'proposal', subjectId: string, status: 'accept' | 'needs-change' | 'defer' = 'accept') {
  const feedback = recordDesignerFeedback(
    { subject: { kind: subjectKind, id: subjectId }, reviewer: 'designer:hill', status, note: 'ok' },
    { now: () => '2026-07-11T00:02:00.000Z' },
  );
  return buildFeedbackPackage({ feedback }, { now: () => '2026-07-11T00:03:00.000Z' });
}

/** Walks the full P13-P16 overlay lifecycle (Candidate -> Approval -> Materialization ->
 *  Activation) to produce a real ActivationPackage — the terminal, already-packaged
 *  artifact P17 confirmed is the overlay lifecycle's intentional terminus. */
function sampleActivationPackage(marker = 'a') {
  const { proposal } = sampleProposalPackage(marker);
  const { candidate } = translateProposalToOverlayCandidate(proposal, { now: () => '2026-07-11T00:10:00.000Z' });
  const approval = recordOverlayApproval(
    { candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'looks good' },
    { now: () => '2026-07-11T00:11:00.000Z' },
  );
  const { materialized } = materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-11T00:12:00.000Z' });
  const activation = recordOverlayActivation(materialized, { activatedBy: 'designer:hill' }, { now: () => '2026-07-11T00:13:00.000Z' });
  return buildActivationPackage({ activation }, { now: () => '2026-07-11T00:14:00.000Z' });
}

describe('buildDesignerWorkspace — organizes references, never duplicates content', () => {
  it('produces a deep-frozen DesignerWorkspace', () => {
    const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() }, { now: () => '2026-07-11T01:00:00.000Z' });
    expect(Object.isFrozen(ws)).toBe(true);
    expect(Object.isFrozen(ws.artifacts)).toBe(true);
    expect(Object.isFrozen(ws.progress)).toBe(true);
  });

  it('carries client/track/createdAt verbatim', () => {
    const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website' }, { now: () => '2026-07-11T01:00:00.000Z' });
    expect(ws.client).toBe('example-brand');
    expect(ws.track).toBe('website');
    expect(ws.createdAt).toBe('2026-07-11T01:00:00.000Z');
  });

  it('a workspace may be built with no artifacts at all — an empty session', () => {
    const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website' });
    expect(ws.artifacts).toEqual([]);
    expect(ws.progress).toEqual({
      totalFindings: 0,
      resolvedFindings: 0,
      unresolvedFindings: 0,
      totalProposals: 0,
      resolvedProposals: 0,
      unresolvedProposals: 0,
      totalFeedback: 0,
    });
  });

  describe('artifact reference integrity', () => {
    it('references the reviewPackage by its own replayIdentity, hashed over the exact object supplied', () => {
      const reviewPackage = sampleReviewPackage();
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage });
      const ref = ws.artifacts.find((a) => a.kind === 'review-package')!;
      expect(ref.id).toBe(reviewPackage.metadata.replayIdentity);
    });

    it('references each proposalPackage by its own manifest.proposalId', () => {
      const { pkg } = sampleProposalPackage();
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', proposalPackages: [pkg] });
      const ref = ws.artifacts.find((a) => a.kind === 'proposal-package')!;
      expect(ref.id).toBe(pkg.manifest.proposalId);
    });

    it('references each proposalReview by its own subject', () => {
      const { proposal } = sampleProposalPackage();
      const review = reviewProposal(proposal, { now: () => '2026-07-11T00:05:00.000Z' });
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', proposalReviews: [review] });
      const ref = ws.artifacts.find((a) => a.kind === 'proposal-review')!;
      expect(ref.id).toBe(review.subject);
    });

    it('references each feedbackPackage by its own manifest.feedbackId', () => {
      const feedbackPkg = sampleFeedbackPackage('doctor-finding', 'contrast:hero');
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', feedbackPackages: [feedbackPkg] });
      const ref = ws.artifacts.find((a) => a.kind === 'feedback-package')!;
      expect(ref.id).toBe(feedbackPkg.manifest.feedbackId);
    });

    it('references each overlayActivationPackage by its own manifest.activationId — P21: closes the seam P19 §2 inventoried but never wired', () => {
      const activationPkg = sampleActivationPackage();
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', overlayActivationPackages: [activationPkg] });
      const ref = ws.artifacts.find((a) => a.kind === 'overlay-activation')!;
      expect(ref).toBeDefined();
      expect(ref.id).toBe(activationPkg.manifest.activationId);
    });

    it('never embeds the full referenced object anywhere in the serialized workspace', () => {
      const { proposal, pkg: proposalPkg } = sampleProposalPackage('UNIQUE-PROPOSAL-MARKER');
      const feedbackPkg = sampleFeedbackPackage('doctor-finding', 'contrast:hero');
      const activationPkg = sampleActivationPackage('UNIQUE-ACTIVATION-MARKER');
      const ws = buildDesignerWorkspace({
        client: 'example-brand',
        track: 'website',
        reviewPackage: sampleReviewPackage(),
        proposalPackages: [proposalPkg],
        proposalReviews: [reviewProposal(proposal)],
        feedbackPackages: [feedbackPkg],
        overlayActivationPackages: [activationPkg],
      });
      const serialized = JSON.stringify(ws);
      expect(serialized).not.toContain('UNIQUE-PROPOSAL-MARKER');
      expect(serialized).not.toContain(proposal.content);
      expect(serialized).not.toContain('activatedBy');
    });
  });

  describe('review progress — raw counts only, never inferred quality', () => {
    it('totalFindings mirrors reviewPackage.findingCount verbatim', () => {
      const reviewPackage = sampleReviewPackage();
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage });
      expect(ws.progress.totalFindings).toBe(reviewPackage.findingCount);
    });

    it('totalProposals mirrors the supplied proposalPackages count', () => {
      const a = sampleProposalPackage('a');
      const b = sampleProposalPackage('b');
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', proposalPackages: [a.pkg, b.pkg] });
      expect(ws.progress.totalProposals).toBe(2);
    });

    it('resolvedFindings counts DISTINCT doctor-finding subjects covered by feedback — duplicates do not double-count', () => {
      const first = sampleFeedbackPackage('doctor-finding', 'contrast:hero', 'needs-change');
      const second = sampleFeedbackPackage('doctor-finding', 'contrast:hero', 'accept'); // same subject, revised decision
      const ws = buildDesignerWorkspace({
        client: 'example-brand',
        track: 'website',
        reviewPackage: sampleReviewPackage(),
        feedbackPackages: [first, second],
      });
      expect(ws.progress.resolvedFindings).toBe(1);
      expect(ws.progress.totalFeedback).toBe(2);
    });

    it('resolvedProposals counts DISTINCT proposal subjects covered by feedback, independent of resolvedFindings', () => {
      const { pkg } = sampleProposalPackage();
      const findingFeedback = sampleFeedbackPackage('doctor-finding', 'contrast:hero');
      const proposalFeedback = sampleFeedbackPackage('proposal', pkg.manifest.proposalId);
      const ws = buildDesignerWorkspace({
        client: 'example-brand',
        track: 'website',
        reviewPackage: sampleReviewPackage(),
        proposalPackages: [pkg],
        feedbackPackages: [findingFeedback, proposalFeedback],
      });
      expect(ws.progress.resolvedFindings).toBe(1);
      expect(ws.progress.resolvedProposals).toBe(1);
      expect(ws.progress.unresolvedProposals).toBe(0);
    });

    it('unresolvedFindings = totalFindings - resolvedFindings, floored at 0', () => {
      const reviewPackage = sampleReviewPackage(); // findingCount = 2
      const feedbackPkg = sampleFeedbackPackage('doctor-finding', 'contrast:hero');
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage, feedbackPackages: [feedbackPkg] });
      expect(ws.progress.totalFindings).toBe(2);
      expect(ws.progress.resolvedFindings).toBe(1);
      expect(ws.progress.unresolvedFindings).toBe(1);
    });

    it('unresolvedFindings never goes negative even if feedback references more distinct findings than totalFindings', () => {
      const reviewPackage = sampleReviewPackage(); // findingCount = 2
      const feedbackPkgs = [
        sampleFeedbackPackage('doctor-finding', 'contrast:hero'),
        sampleFeedbackPackage('doctor-finding', 'contrast:footer'),
        sampleFeedbackPackage('doctor-finding', 'stale-finding-from-a-different-run'),
      ];
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage, feedbackPackages: feedbackPkgs });
      expect(ws.progress.resolvedFindings).toBe(3);
      expect(ws.progress.unresolvedFindings).toBe(0);
    });

    it('produces no field beyond the declared counts — no generated recommendation, no quality label', () => {
      const ws = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() });
      expect(Object.keys(ws.progress).sort()).toEqual(
        ['resolvedFindings', 'resolvedProposals', 'totalFeedback', 'totalFindings', 'totalProposals', 'unresolvedFindings', 'unresolvedProposals'].sort(),
      );
    });
  });

  describe('validation — fail loud, integrity cross-check against a supplied reviewPackage', () => {
    it('throws DesignerWorkspaceError when client is empty', () => {
      expect(() => buildDesignerWorkspace({ client: '  ', track: 'website' })).toThrow(DesignerWorkspaceError);
    });

    it('throws DesignerWorkspaceError when track is empty', () => {
      expect(() => buildDesignerWorkspace({ client: 'example-brand', track: '' })).toThrow(DesignerWorkspaceError);
    });

    it('throws DesignerWorkspaceError when client does not match the supplied reviewPackage.metadata.client', () => {
      const reviewPackage = sampleReviewPackage('example-brand', 'website');
      expect(() => buildDesignerWorkspace({ client: 'forgeline', track: 'website', reviewPackage })).toThrow(DesignerWorkspaceError);
    });

    it('throws DesignerWorkspaceError when track does not match the supplied reviewPackage.metadata.track', () => {
      const reviewPackage = sampleReviewPackage('example-brand', 'website');
      expect(() => buildDesignerWorkspace({ client: 'example-brand', track: 'collateral', reviewPackage })).toThrow(DesignerWorkspaceError);
    });
  });
});

describe('deterministic assembly / replay stability', () => {
  it('same inputs (same now) produce a deep-equal workspace on every call', () => {
    const input = { client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() };
    const now = () => '2026-07-11T01:00:00.000Z';
    expect(buildDesignerWorkspace(input, { now })).toEqual(buildDesignerWorkspace(input, { now }));
  });

  it('changing ONLY the clock leaves id/artifacts/progress identical — id is content-derived, not time-derived', () => {
    const input = { client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() };
    const a = buildDesignerWorkspace(input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = buildDesignerWorkspace(input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.artifacts).toEqual(b.artifacts);
    expect(a.progress).toEqual(b.progress);
    expect(a.createdAt).not.toBe(b.createdAt);
  });

  it('supplying the SAME set of proposalPackages in a DIFFERENT order produces the same id and the same artifacts ordering', () => {
    const a = sampleProposalPackage('a');
    const b = sampleProposalPackage('b');
    const forward = buildDesignerWorkspace({ client: 'example-brand', track: 'website', proposalPackages: [a.pkg, b.pkg] });
    const reverse = buildDesignerWorkspace({ client: 'example-brand', track: 'website', proposalPackages: [b.pkg, a.pkg] });
    expect(forward.id).toBe(reverse.id);
    expect(forward.artifacts).toEqual(reverse.artifacts);
  });

  it('a different set of referenced artifacts produces a different id', () => {
    const a = buildDesignerWorkspace({ client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() });
    const b = buildDesignerWorkspace({ client: 'example-brand', track: 'website' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('P19 — falsification: workspace assembly never mutates any referenced package', () => {
  it('the supplied ReviewPackage/ProposalPackage/ProposalReviewReport/FeedbackPackage/ActivationPackage all stay frozen and byte-identical', () => {
    const reviewPackage = sampleReviewPackage();
    const { proposal, pkg: proposalPkg } = sampleProposalPackage();
    const review = reviewProposal(proposal);
    const feedbackPkg = sampleFeedbackPackage('doctor-finding', 'contrast:hero');
    const activationPkg = sampleActivationPackage();
    const before = [reviewPackage, proposalPkg, review, feedbackPkg, activationPkg].map((x) => JSON.stringify(x));

    buildDesignerWorkspace({
      client: 'example-brand',
      track: 'website',
      reviewPackage,
      proposalPackages: [proposalPkg],
      proposalReviews: [review],
      feedbackPackages: [feedbackPkg],
      overlayActivationPackages: [activationPkg],
    });

    const after = [reviewPackage, proposalPkg, review, feedbackPkg, activationPkg].map((x) => JSON.stringify(x));
    expect(after).toEqual(before);
    for (const obj of [reviewPackage, proposalPkg, review, feedbackPkg, activationPkg]) {
      expect(Object.isFrozen(obj)).toBe(true);
    }
  });
});

describe('P19 — isolation: designer-workspace.ts never calls a package builder or touches the filesystem/overlay', () => {
  it('every doctor/, designer-author/, designer-feedback/ import is TYPE-ONLY — no builder function value-imported', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-workspace/designer-workspace.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes('doctor/') || line.includes('designer-author/') || line.includes('designer-feedback/')) {
        expect(line, `must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/overlay\.js/);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/governance/i);
    }
  });

  it('never calls buildReviewPackage/buildProposalPackage/recordDesignerFeedback/buildFeedbackPackage/reviewProposal/writeOverlay/readOverlay — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-workspace/designer-workspace.ts', 'utf8');
    for (const forbidden of [
      'buildReviewPackage(',
      'buildProposalPackage(',
      'recordDesignerFeedback(',
      'buildFeedbackPackage(',
      'reviewProposal(',
      'writeOverlay(',
      'readOverlay(',
      'freezeFromDecisionLog(',
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });
});
