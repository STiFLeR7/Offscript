/**
 * P20 — Designer Review Session Foundation. RED-first.
 *
 * Investigation (see docs/internals/P20-DESIGNER-REVIEW-SESSION-FOUNDATION.md
 * §3) evaluated three architectures: (A) extend Workspace — rejected,
 * Workspace is defined as an IMMUTABLE snapshot (P19's own words) and a
 * session's whole purpose is to carry state (open/closed) ACROSS TIME,
 * which would contradict Workspace's own identity discipline; (B) reference
 * Workspace only — insufficient on its own, since the brief also names
 * ReviewPackage/ProposalPackage/FeedbackPackage as things a Session "may
 * reference" (evidence gathered DURING the session, after the referenced
 * Workspace snapshot was taken); (C) reference Workspace AND, optionally,
 * individual artifacts directly — CHOSEN, mirroring Workspace's own
 * {kind, id, sha256} reference pattern one level up.
 *
 * "The Session owns workflow. The Workspace owns evidence." (the brief,
 * verbatim) — `DesignerReviewSession` therefore represents ONLY: who
 * opened/closed it, when, its current state, a progress checkpoint copied
 * verbatim from the referenced Workspace's own `.progress` (a scalar
 * summary, not re-embedded content — the SAME discipline Workspace itself
 * used against ReviewPackage's `findingCount` in P19), and a list of
 * artifact references. It infers no quality and generates no
 * recommendation — every field is a caller-supplied fact, a verbatim copy
 * of an already-computed scalar, or a hash of an already-built object.
 *
 * Identity: unlike every P09-P19 model (which EXCLUDES its own timestamp
 * from identity so re-recording the identical fact yields the identical
 * id), a Session's `openedAt` IS part of its identity — deliberately,
 * because two sessions opened by the same reviewer against the same
 * workspace at DIFFERENT times are two DIFFERENT sessions (an event, not a
 * decision-fact). `closedAt` remains EXCLUDED — closing a session must
 * never change its `id`, since it is the SAME session, now closed (see the
 * "id survives the open -> close transition" test below).
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
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { materializeOverlayCandidate } from '../../src/designer-author/overlay-materialization.js';
import { recordOverlayActivation } from '../../src/designer-author/overlay-activation.js';
import { buildActivationPackage } from '../../src/designer-author/overlay-activation-package.js';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
import { buildFeedbackPackage } from '../../src/designer-feedback/designer-feedback-package.js';
import { buildDesignerWorkspace, type DesignerWorkspace } from '../../src/designer-workspace/designer-workspace.js';
import {
  DesignerReviewSessionError,
  openReviewSession,
  closeReviewSession,
} from '../../src/designer-review-session/designer-review-session.js';
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
    generatedAt: '2026-07-12T00:00:00.000Z',
    health: health([{ producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' }]),
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
    validationSummary: 'Run headline: SUCCESS...',
  });
}

function sampleWorkspace(): DesignerWorkspace {
  return buildDesignerWorkspace(
    { client: 'example-brand', track: 'website', reviewPackage: sampleReviewPackage() },
    { now: () => '2026-07-12T00:10:00.000Z' },
  );
}

function sampleProposalPackage(marker = 'a') {
  const proposal = buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: `A well-formed proposed hero section ${marker}.`,
    },
    { now: () => '2026-07-12T00:05:00.000Z' },
  );
  return buildProposalPackage({ proposal }, { now: () => '2026-07-12T00:06:00.000Z' });
}

function sampleFeedbackPackage(subjectId = 'contrast:hero') {
  const feedback = recordDesignerFeedback(
    { subject: { kind: 'doctor-finding', id: subjectId }, reviewer: 'designer:hill', status: 'accept', note: 'ok' },
    { now: () => '2026-07-12T00:07:00.000Z' },
  );
  return buildFeedbackPackage({ feedback }, { now: () => '2026-07-12T00:08:00.000Z' });
}

/** Walks the full P13-P16 overlay lifecycle to produce a real ActivationPackage —
 *  the terminal, already-packaged artifact P17 confirmed is the lifecycle's terminus. */
function sampleActivationPackage(marker = 'a') {
  const proposal = buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: `A well-formed proposed hero section ${marker}.`,
    },
    { now: () => '2026-07-12T00:15:00.000Z' },
  );
  const { candidate } = translateProposalToOverlayCandidate(proposal, { now: () => '2026-07-12T00:16:00.000Z' });
  const approval = recordOverlayApproval(
    { candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'looks good' },
    { now: () => '2026-07-12T00:17:00.000Z' },
  );
  const { materialized } = materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-12T00:18:00.000Z' });
  const activation = recordOverlayActivation(materialized, { activatedBy: 'designer:hill' }, { now: () => '2026-07-12T00:19:00.000Z' });
  return buildActivationPackage({ activation }, { now: () => '2026-07-12T00:20:00.000Z' });
}

describe('openReviewSession — represents only workflow state', () => {
  it('produces a deep-frozen, open DesignerReviewSession', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' }, { now: () => '2026-07-12T01:00:00.000Z' });
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.artifacts)).toBe(true);
    expect(Object.isFrozen(session.progressCheckpoint)).toBe(true);
    expect(session.state).toBe('open');
    expect(session.closedAt).toBeUndefined();
    expect('closedAt' in session).toBe(false);
  });

  it('carries workspaceId, reviewer, and openedAt verbatim', () => {
    const workspace = sampleWorkspace();
    const session = openReviewSession({ workspace, reviewer: 'designer:amina' }, { now: () => '2026-07-12T01:00:00.000Z' });
    expect(session.workspaceId).toBe(workspace.id);
    expect(session.reviewer).toBe('designer:amina');
    expect(session.openedAt).toBe('2026-07-12T01:00:00.000Z');
  });

  it('progressCheckpoint is a verbatim copy of the referenced workspace\'s own progress', () => {
    const workspace = sampleWorkspace();
    const session = openReviewSession({ workspace, reviewer: 'designer:hill' });
    expect(session.progressCheckpoint).toEqual(workspace.progress);
  });

  describe('artifact reference integrity', () => {
    it('references the workspace by its own id, hashed over the exact object supplied', () => {
      const workspace = sampleWorkspace();
      const session = openReviewSession({ workspace, reviewer: 'designer:hill' });
      const ref = session.artifacts.find((a) => a.kind === 'workspace')!;
      expect(ref.id).toBe(workspace.id);
    });

    it('may additionally reference a ReviewPackage/ProposalPackage/FeedbackPackage/overlay-activation collected during the session', () => {
      const reviewPackage = sampleReviewPackage();
      const proposalPackage = sampleProposalPackage();
      const feedbackPackage = sampleFeedbackPackage();
      const activationPackage = sampleActivationPackage();
      const session = openReviewSession({
        workspace: sampleWorkspace(),
        reviewer: 'designer:hill',
        reviewPackages: [reviewPackage],
        proposalPackages: [proposalPackage],
        feedbackPackages: [feedbackPackage],
        overlayActivationPackages: [activationPackage],
      });
      const kinds = session.artifacts.map((a) => a.kind).sort();
      expect(kinds).toEqual(['feedback-package', 'overlay-activation', 'proposal-package', 'review-package', 'workspace']);
    });

    it('references each overlayActivationPackage by its own manifest.activationId — P21: closes the seam P19 §2 inventoried but never wired', () => {
      const activationPackage = sampleActivationPackage();
      const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill', overlayActivationPackages: [activationPackage] });
      const ref = session.artifacts.find((a) => a.kind === 'overlay-activation')!;
      expect(ref).toBeDefined();
      expect(ref.id).toBe(activationPackage.manifest.activationId);
    });

    it('never embeds the full referenced object anywhere in the serialized session', () => {
      const proposalPackage = sampleProposalPackage('UNIQUE-PROPOSAL-MARKER');
      const activationPackage = sampleActivationPackage();
      const session = openReviewSession({
        workspace: sampleWorkspace(),
        reviewer: 'designer:hill',
        proposalPackages: [proposalPackage],
        overlayActivationPackages: [activationPackage],
      });
      const serialized = JSON.stringify(session);
      expect(serialized).not.toContain('UNIQUE-PROPOSAL-MARKER');
      expect(serialized).not.toContain('activatedBy');
    });
  });

  describe('validation — fail loud', () => {
    it('throws DesignerReviewSessionError when reviewer is empty', () => {
      expect(() => openReviewSession({ workspace: sampleWorkspace(), reviewer: '  ' })).toThrow(DesignerReviewSessionError);
    });

    it('throws DesignerReviewSessionError when workspace.id is missing/malformed', () => {
      const malformed = { ...sampleWorkspace(), id: '' };
      expect(() => openReviewSession({ workspace: malformed as unknown as DesignerWorkspace, reviewer: 'designer:hill' })).toThrow(
        DesignerReviewSessionError,
      );
    });
  });
});

describe('closeReviewSession — produces a new immutable fact, never mutates the input', () => {
  it('returns a DIFFERENT object with closedAt set and state "closed"', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' }, { now: () => '2026-07-12T01:00:00.000Z' });
    const closed = closeReviewSession(session, { now: () => '2026-07-12T02:00:00.000Z' });
    expect(closed).not.toBe(session);
    expect(closed.state).toBe('closed');
    expect(closed.closedAt).toBe('2026-07-12T02:00:00.000Z');
    expect(session.state).toBe('open');
    expect(session.closedAt).toBeUndefined();
  });

  it('the id survives the open -> close transition — same session, now closed', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' }, { now: () => '2026-07-12T01:00:00.000Z' });
    const closed = closeReviewSession(session, { now: () => '2026-07-12T02:00:00.000Z' });
    expect(closed.id).toBe(session.id);
  });

  it('every other field is copied verbatim from the open session', () => {
    const workspace = sampleWorkspace();
    const session = openReviewSession({ workspace, reviewer: 'designer:hill' }, { now: () => '2026-07-12T01:00:00.000Z' });
    const closed = closeReviewSession(session, { now: () => '2026-07-12T02:00:00.000Z' });
    expect(closed.workspaceId).toBe(session.workspaceId);
    expect(closed.reviewer).toBe(session.reviewer);
    expect(closed.openedAt).toBe(session.openedAt);
    expect(closed.progressCheckpoint).toEqual(session.progressCheckpoint);
    expect(closed.artifacts).toEqual(session.artifacts);
  });

  it('is deep-frozen', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' });
    const closed = closeReviewSession(session);
    expect(Object.isFrozen(closed)).toBe(true);
  });

  it('throws DesignerReviewSessionError when closing an already-closed session', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' });
    const closed = closeReviewSession(session);
    expect(() => closeReviewSession(closed)).toThrow(DesignerReviewSessionError);
  });

  it('never mutates the input session object', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' });
    const before = JSON.stringify(session);
    closeReviewSession(session);
    expect(JSON.stringify(session)).toBe(before);
    expect(Object.isFrozen(session)).toBe(true);
  });
});

describe('deterministic creation / replay stability', () => {
  it('same inputs (same now) produce a deep-equal session on every call', () => {
    const input = { workspace: sampleWorkspace(), reviewer: 'designer:hill' };
    const now = () => '2026-07-12T01:00:00.000Z';
    expect(openReviewSession(input, { now })).toEqual(openReviewSession(input, { now }));
  });

  it('two sessions opened at DIFFERENT times for the same workspace/reviewer get DIFFERENT ids — openedAt is event-identity', () => {
    const input = { workspace: sampleWorkspace(), reviewer: 'designer:hill' };
    const a = openReviewSession(input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = openReviewSession(input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different reviewer produces a different id', () => {
    const workspace = sampleWorkspace();
    const now = () => '2026-07-12T01:00:00.000Z';
    const a = openReviewSession({ workspace, reviewer: 'designer:hill' }, { now });
    const b = openReviewSession({ workspace, reviewer: 'designer:amina' }, { now });
    expect(a.id).not.toBe(b.id);
  });

  it('a different workspace produces a different id', () => {
    const now = () => '2026-07-12T01:00:00.000Z';
    const a = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' }, { now });
    const differentWorkspace = buildDesignerWorkspace({ client: 'example-brand', track: 'collateral' }, { now: () => '2026-07-12T00:11:00.000Z' });
    const b = openReviewSession({ workspace: differentWorkspace, reviewer: 'designer:hill' }, { now });
    expect(a.id).not.toBe(b.id);
  });

  it('changing only the close-time clock leaves everything but closedAt identical', () => {
    const session = openReviewSession({ workspace: sampleWorkspace(), reviewer: 'designer:hill' });
    const a = closeReviewSession(session, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = closeReviewSession(session, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.closedAt).not.toBe(b.closedAt);
  });
});

describe('P20 — falsification: session lifecycle never mutates any referenced artifact', () => {
  it('the supplied Workspace/ReviewPackage/ProposalPackage/FeedbackPackage/ActivationPackage all stay frozen and byte-identical', () => {
    const workspace = sampleWorkspace();
    const reviewPackage = sampleReviewPackage();
    const proposalPackage = sampleProposalPackage();
    const feedbackPackage = sampleFeedbackPackage();
    const activationPackage = sampleActivationPackage();
    const before = [workspace, reviewPackage, proposalPackage, feedbackPackage, activationPackage].map((x) => JSON.stringify(x));

    const session = openReviewSession({
      workspace,
      reviewer: 'designer:hill',
      reviewPackages: [reviewPackage],
      proposalPackages: [proposalPackage],
      feedbackPackages: [feedbackPackage],
      overlayActivationPackages: [activationPackage],
    });
    closeReviewSession(session);

    const after = [workspace, reviewPackage, proposalPackage, feedbackPackage, activationPackage].map((x) => JSON.stringify(x));
    expect(after).toEqual(before);
    for (const obj of [workspace, reviewPackage, proposalPackage, feedbackPackage, activationPackage]) {
      expect(Object.isFrozen(obj)).toBe(true);
    }
  });
});

describe('P20 — isolation: designer-review-session.ts never calls a package builder or touches the filesystem/overlay', () => {
  it('every doctor/, designer-author/, designer-feedback/, designer-workspace/ import is TYPE-ONLY', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-review-session/designer-review-session.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes('doctor/') || line.includes('designer-author/') || line.includes('designer-feedback/') || line.includes('designer-workspace/')) {
        expect(line, `must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/overlay\.js/);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/governance/i);
    }
  });

  it('never calls a builder function or overlay function — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-review-session/designer-review-session.ts', 'utf8');
    for (const forbidden of [
      'buildReviewPackage(',
      'buildProposalPackage(',
      'recordDesignerFeedback(',
      'buildFeedbackPackage(',
      'buildDesignerWorkspace(',
      'writeOverlay(',
      'readOverlay(',
      'freezeFromDecisionLog(',
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });
});
