/**
 * P14 — Overlay Candidate Approval Architecture. RED-first.
 *
 * Investigation (see docs/internals/P14-OVERLAY-CANDIDATE-APPROVAL-ARCHITECTURE.md
 * §3) traces the lifecycle Proposal -> Proposal Review -> Overlay Candidate ->
 * Frozen Overlay and finds every transition up to and including Overlay Candidate
 * is deterministic; nothing in that chain is a human decision. `DecisionLogEntry`
 * (actuation.ts) is the wrong reuse target — like `Frozen` in P13, its required
 * fields (`rails`, `loops`, `residualViolations`) name a rail-actuation pass an
 * OverlayCandidate never entered; reusing it would require fabrication. This
 * module is therefore a dedicated `OverlayApproval` model (Option B), the
 * FIRST genuinely human-decision-shaped artifact in the designer-author domain
 * — every prior P09-P13 module was deterministic transport or pure computation.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER, type AuthorProposal, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate, type OverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { reviewProposal, type ProposalReviewReport } from '../../src/designer-author/proposal-review.js';
import {
  OverlayApprovalError,
  recordOverlayApproval,
  type OverlayApproval,
} from '../../src/designer-author/overlay-approval.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function sampleProposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): AuthorProposal {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: origin(),
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section with a live workflow demo.',
      evidence: [{ description: 'brief calls for an agentic-product hero', reference: 'brief.md#hero' }],
      ...overrides,
    },
    { now: () => '2026-07-13T00:00:00.000Z' },
  );
}

function sampleCandidate(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): OverlayCandidate {
  return translateProposalToOverlayCandidate(sampleProposal(overrides), { now: () => '2026-07-13T01:00:00.000Z' }).candidate;
}

function sampleReview(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): ProposalReviewReport {
  return reviewProposal(sampleProposal(overrides), { now: () => '2026-07-13T00:30:00.000Z' });
}

describe('recordOverlayApproval — the approval model captures only facts', () => {
  it('produces a deep-frozen OverlayApproval', () => {
    const approval = recordOverlayApproval(
      { candidate: sampleCandidate(), reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief intent, evidence checks out' },
      { now: () => '2026-07-14T00:00:00.000Z' },
    );
    expect(Object.isFrozen(approval)).toBe(true);
    expect(Object.isFrozen(approval.decision)).toBe(true);
  });

  it('carries candidateId and sourceProposalId verbatim from the candidate, not fabricated', () => {
    const candidate = sampleCandidate();
    const approval = recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'looks right' });
    expect(approval.candidateId).toBe(candidate.id);
    expect(approval.sourceProposalId).toBe(candidate.sourceProposalId);
  });

  it('carries the reviewer, status, and rationale verbatim — never generated, never inferred', () => {
    const approval = recordOverlayApproval(
      { candidate: sampleCandidate(), reviewer: 'designer:amina', status: 'rejected', rationale: 'off-brand tone, does not match parent voice' },
      { now: () => '2026-07-14T00:00:00.000Z' },
    );
    expect(approval.decision.reviewer).toBe('designer:amina');
    expect(approval.decision.status).toBe('rejected');
    expect(approval.decision.rationale).toBe('off-brand tone, does not match parent voice');
    expect(approval.decision.decidedAt).toBe('2026-07-14T00:00:00.000Z');
  });

  it('records sourceReviewSubject when a ProposalReviewReport is supplied', () => {
    const review = sampleReview();
    const approval = recordOverlayApproval({ candidate: sampleCandidate(), review, reviewer: 'designer:hill', status: 'approved', rationale: 'review was clean' });
    expect(approval.sourceReviewSubject).toBe(review.subject);
  });

  it('omits sourceReviewSubject entirely when no review is supplied — not undefined-but-present', () => {
    const approval = recordOverlayApproval({ candidate: sampleCandidate(), reviewer: 'designer:hill', status: 'approved', rationale: 'reviewed informally' });
    expect(approval.sourceReviewSubject).toBeUndefined();
    expect('sourceReviewSubject' in approval).toBe(false);
  });

  describe('no automatic decisions', () => {
    it('a "blocked" ProposalReviewReport does not force rejection — the caller-supplied status wins regardless', () => {
      const blockedReview = reviewProposal(sampleProposal({ content: '' }));
      expect(blockedReview.reviewStatus).toBe('blocked');
      const approval = recordOverlayApproval({
        candidate: sampleCandidate(),
        review: blockedReview,
        reviewer: 'designer:hill',
        status: 'approved',
        rationale: 'human override: content will be filled in before materialization',
      });
      expect(approval.decision.status).toBe('approved');
    });

    it('a clean review does not force approval — a human can still reject', () => {
      const cleanReview = sampleReview();
      expect(cleanReview.reviewStatus).toBe('ready-for-review');
      const approval = recordOverlayApproval({
        candidate: sampleCandidate(),
        review: cleanReview,
        reviewer: 'designer:hill',
        status: 'rejected',
        rationale: 'passes quality checks but the direction is wrong',
      });
      expect(approval.decision.status).toBe('rejected');
    });
  });

  describe('validation — fail loud on missing facts, mirrors validateProposalGenerationRequest', () => {
    it('throws OverlayApprovalError when reviewer is empty', () => {
      expect(() => recordOverlayApproval({ candidate: sampleCandidate(), reviewer: '  ', status: 'approved', rationale: 'ok' })).toThrow(
        OverlayApprovalError,
      );
    });

    it('throws OverlayApprovalError when rationale is empty', () => {
      expect(() => recordOverlayApproval({ candidate: sampleCandidate(), reviewer: 'designer:hill', status: 'approved', rationale: '' })).toThrow(
        OverlayApprovalError,
      );
    });

    it('throws OverlayApprovalError when status is not approved/rejected', () => {
      expect(() =>
        recordOverlayApproval({
          candidate: sampleCandidate(),
          reviewer: 'designer:hill',
          status: 'pending' as unknown as 'approved',
          rationale: 'ok',
        }),
      ).toThrow(OverlayApprovalError);
    });
  });
});

describe('deterministic identity / replay stability', () => {
  it('same facts (same now) produce a deep-equal approval on every call', () => {
    const candidate = sampleCandidate();
    const now = () => '2026-07-14T00:00:00.000Z';
    const input = { candidate, reviewer: 'designer:hill', status: 'approved' as const, rationale: 'matches brief' };
    expect(recordOverlayApproval(input, { now })).toEqual(recordOverlayApproval(input, { now }));
  });

  it('changing ONLY the clock leaves id and every fact but decidedAt identical — id is content-derived, not time-derived', () => {
    const candidate = sampleCandidate();
    const input = { candidate, reviewer: 'designer:hill', status: 'approved' as const, rationale: 'matches brief' };
    const a = recordOverlayApproval(input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = recordOverlayApproval(input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.candidateId).toBe(b.candidateId);
    expect(a.decision.status).toBe(b.decision.status);
    expect(a.decision.reviewer).toBe(b.decision.reviewer);
    expect(a.decision.rationale).toBe(b.decision.rationale);
    expect(a.decision.decidedAt).not.toBe(b.decision.decidedAt);
  });

  it('a different status on the same candidate produces a different id', () => {
    const candidate = sampleCandidate();
    const approved = recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief' });
    const rejected = recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'rejected', rationale: 'matches brief' });
    expect(approved.id).not.toBe(rejected.id);
  });

  it('a different reviewer on the same candidate/decision produces a different id', () => {
    const candidate = sampleCandidate();
    const a = recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief' });
    const b = recordOverlayApproval({ candidate, reviewer: 'designer:amina', status: 'approved', rationale: 'matches brief' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different candidate produces a different id', () => {
    const a = recordOverlayApproval({ candidate: sampleCandidate(), reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief' });
    const b = recordOverlayApproval({
      candidate: sampleCandidate({ semanticFamily: 'family-cta' }),
      reviewer: 'designer:hill',
      status: 'approved',
      rationale: 'matches brief',
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe('P14 — falsification: approval never touches Overlay storage', () => {
  it('overlay-approval.ts imports nothing from overlay.js as a VALUE, and nothing from node:fs', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-approval.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes('overlay.js')) {
        expect(line, `overlay.js import must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/governance/i);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog/filterFrozenFindings — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-approval.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(', 'filterFrozenFindings(']) {
      expect(src).not.toContain(forbidden);
    }
  });

  it('recording an approval never mutates the input candidate or review — both stay frozen and unchanged', () => {
    const candidate = sampleCandidate();
    const review = sampleReview();
    const beforeCandidate = JSON.stringify(candidate);
    const beforeReview = JSON.stringify(review);
    recordOverlayApproval({ candidate, review, reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief' });
    expect(JSON.stringify(candidate)).toBe(beforeCandidate);
    expect(JSON.stringify(review)).toBe(beforeReview);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(review)).toBe(true);
  });
});
