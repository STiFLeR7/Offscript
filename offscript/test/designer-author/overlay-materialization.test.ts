/**
 * P15 — Overlay Materialization Foundation. RED-first.
 *
 * Investigation (see docs/internals/P15-OVERLAY-MATERIALIZATION-FOUNDATION.md
 * §3) re-inventories every Frozen field against BOTH an OverlayCandidate (P13)
 * and an OverlayApproval (P14). Confirms P14's approval does NOT close any of
 * P13's three genuinely unavailable fields (`pass`, `findingIds`,
 * `snapshotHtml` — no rail-actuation pass or operator Finding[] or real
 * generation-run snapshot exists for a proposal regardless of approval), but
 * DOES upgrade three of P13's `derived`-but-approximate fields
 * (`reason`/`decidedAt`/`decidedBy`) to genuinely authoritative
 * approval-sourced values: P13's `OverlayCandidate.decidedAt`/`decidedBy`
 * were necessarily proxies (translation time; the proposal's own author) —
 * OverlayApproval now supplies the TRUE decision moment and the TRUE decider.
 * `pass`/`findingIds` remain REQUIRED Frozen fields with no legitimate value
 * — reusing `Frozen` directly (Option A) is still not viable; this module is
 * therefore `MaterializedFrozenOverlay` (Option B), structurally compatible
 * with `Frozen` in field-correspondence, never literally `Frozen`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER, type AuthorProposal, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate, type OverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { reviewProposal } from '../../src/designer-author/proposal-review.js';
import { recordOverlayApproval, type OverlayApproval } from '../../src/designer-author/overlay-approval.js';
import {
  MATERIALIZED_FROZEN_FIELD_MAPPING,
  MaterializationError,
  materializeOverlayCandidate,
  type MaterializedFrozenOverlay,
} from '../../src/designer-author/overlay-materialization.js';
import type { Frozen } from '../../src/overlay.js';

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

function sampleApproval(
  candidate: OverlayCandidate = sampleCandidate(),
  overrides: { status?: 'approved' | 'rejected'; reviewer?: string; rationale?: string } = {},
): OverlayApproval {
  return recordOverlayApproval(
    {
      candidate,
      reviewer: overrides.reviewer ?? 'designer:amina',
      status: overrides.status ?? 'approved',
      rationale: overrides.rationale ?? 'matches brief intent, evidence checks out, ready to freeze',
    },
    { now: () => '2026-07-15T00:00:00.000Z' },
  );
}

// Compile-time exhaustiveness: if overlay.ts's Frozen gains/loses a field, this
// object literal fails to type-check — the same idiom proposal-overlay.test.ts
// (P13) uses.
const ALL_FROZEN_FIELDS: Record<keyof Frozen, true> = {
  id: true,
  pass: true,
  findingIds: true,
  snapshotHtml: true,
  reason: true,
  decidedAt: true,
  decidedBy: true,
};

describe('MATERIALIZED_FROZEN_FIELD_MAPPING — mapping correctness / exhaustiveness', () => {
  it('covers EXACTLY the 7 real Frozen fields — no more, no fewer', () => {
    expect(MATERIALIZED_FROZEN_FIELD_MAPPING.map((m) => m.frozenField).sort()).toEqual(Object.keys(ALL_FROZEN_FIELDS).sort());
  });

  it('is a closed, frozen, deterministic constant', () => {
    expect(Object.isFrozen(MATERIALIZED_FROZEN_FIELD_MAPPING)).toBe(true);
    for (const m of MATERIALIZED_FROZEN_FIELD_MAPPING) expect(Object.isFrozen(m)).toBe(true);
  });

  it('pass, findingIds, and snapshotHtml remain classified unavailable — P14 approval closes none of them', () => {
    for (const field of ['pass', 'findingIds', 'snapshotHtml'] as const) {
      const entry = MATERIALIZED_FROZEN_FIELD_MAPPING.find((m) => m.frozenField === field)!;
      expect(entry.kind).toBe('unavailable');
      expect(entry.materializedField).toBeUndefined();
      expect(entry.rationale.length).toBeGreaterThan(0);
    }
  });

  it('id remains classified derived — a new formula, not Frozen\'s own hash-of-findingIds', () => {
    const entry = MATERIALIZED_FROZEN_FIELD_MAPPING.find((m) => m.frozenField === 'id')!;
    expect(entry.kind).toBe('derived');
    expect(entry.materializedField).toBe('id');
  });

  it('reason, decidedAt, and decidedBy are classified approval — upgraded from P13\'s derived approximations', () => {
    for (const field of ['reason', 'decidedAt', 'decidedBy'] as const) {
      const entry = MATERIALIZED_FROZEN_FIELD_MAPPING.find((m) => m.frozenField === field)!;
      expect(entry.kind).toBe('approval');
      expect(typeof entry.materializedField).toBe('string');
    }
  });

  it('every entry with a materializedField names a field that actually exists on a real MaterializedFrozenOverlay', () => {
    const candidate = sampleCandidate();
    const materialized = materializeOverlayCandidate(candidate, sampleApproval(candidate)).materialized;
    const keys = new Set(Object.keys(materialized));
    for (const m of MATERIALIZED_FROZEN_FIELD_MAPPING) {
      if (m.materializedField !== undefined) expect(keys.has(m.materializedField)).toBe(true);
    }
  });

  it('is never derived from a run — identical across two independently-built materializations', () => {
    const a = materializeOverlayCandidate(sampleCandidate(), sampleApproval(sampleCandidate()));
    const c2 = sampleCandidate({ semanticFamily: 'family-cta' });
    const b = materializeOverlayCandidate(c2, sampleApproval(c2));
    expect(a.fieldMapping).toEqual(b.fieldMapping);
    expect(a.fieldMapping).toBe(MATERIALIZED_FROZEN_FIELD_MAPPING);
  });
});

describe('materializeOverlayCandidate — deterministic materialization', () => {
  it('produces a fully-populated, deep-frozen MaterializedFrozenOverlay', () => {
    const candidate = sampleCandidate();
    const approval = sampleApproval(candidate);
    const report = materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-16T00:00:00.000Z' });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.materialized)).toBe(true);
    expect(report.materialized.sourceCandidateId).toBe(candidate.id);
    expect(report.materialized.sourceApprovalId).toBe(approval.id);
    expect(report.materialized.sourceProposalId).toBe(candidate.sourceProposalId);
    expect(report.materializedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('reason is sourced from approval.decision.rationale — NOT from candidate.reason', () => {
    const candidate = sampleCandidate();
    const approval = sampleApproval(candidate, { rationale: 'a genuinely human rationale, not a template' });
    const report = materializeOverlayCandidate(candidate, approval);
    expect(report.materialized.reason).toBe('a genuinely human rationale, not a template');
    expect(report.materialized.reason).not.toBe(candidate.reason);
  });

  it('decidedAt is sourced from approval.decision.decidedAt — NOT from candidate.decidedAt (translation time)', () => {
    const candidate = sampleCandidate();
    const approval = sampleApproval(candidate);
    const report = materializeOverlayCandidate(candidate, approval);
    expect(report.materialized.decidedAt).toBe(approval.decision.decidedAt);
    expect(report.materialized.decidedAt).not.toBe(candidate.decidedAt);
  });

  it('decidedBy is sourced from approval.decision.reviewer — NOT from candidate.decidedBy (the proposal author)', () => {
    const candidate = sampleCandidate();
    const approval = sampleApproval(candidate, { reviewer: 'designer:amina' });
    const report = materializeOverlayCandidate(candidate, approval);
    expect(report.materialized.decidedBy).toBe('designer:amina');
    expect(report.materialized.decidedBy).not.toBe(candidate.decidedBy);
  });

  it('carries sourceReviewSubject through verbatim when the approval has one', () => {
    const candidate = sampleCandidate();
    const review = reviewProposal(sampleProposal());
    const approval = recordOverlayApproval({ candidate, review, reviewer: 'designer:amina', status: 'approved', rationale: 'clean review' });
    const report = materializeOverlayCandidate(candidate, approval);
    expect(report.materialized.sourceReviewSubject).toBe(review.subject);
  });

  it('omits sourceReviewSubject entirely when the approval has none', () => {
    const candidate = sampleCandidate();
    const report = materializeOverlayCandidate(candidate, sampleApproval(candidate));
    expect(report.materialized.sourceReviewSubject).toBeUndefined();
    expect('sourceReviewSubject' in report.materialized).toBe(false);
  });

  describe('missing-field handling — unavailable stays unavailable', () => {
    it('never has a `pass`, `findingIds`, or `snapshotHtml` key on the materialized object', () => {
      const candidate = sampleCandidate();
      const materialized = materializeOverlayCandidate(candidate, sampleApproval(candidate)).materialized as unknown as Record<string, unknown>;
      expect('pass' in materialized).toBe(false);
      expect('findingIds' in materialized).toBe(false);
      expect('snapshotHtml' in materialized).toBe(false);
    });
  });

  describe('approval dependency — materialization requires a real, matching, approved decision', () => {
    it('throws MaterializationError when the approval was for a DIFFERENT candidate', () => {
      const candidate = sampleCandidate();
      const otherCandidate = sampleCandidate({ semanticFamily: 'family-cta' });
      const mismatchedApproval = sampleApproval(otherCandidate);
      expect(() => materializeOverlayCandidate(candidate, mismatchedApproval)).toThrow(MaterializationError);
    });

    it('throws MaterializationError when the approval status is "rejected"', () => {
      const candidate = sampleCandidate();
      const rejection = sampleApproval(candidate, { status: 'rejected', rationale: 'off-brand tone' });
      expect(() => materializeOverlayCandidate(candidate, rejection)).toThrow(MaterializationError);
    });

    it('succeeds when the approval genuinely matches and is approved', () => {
      const candidate = sampleCandidate();
      const approval = sampleApproval(candidate);
      expect(() => materializeOverlayCandidate(candidate, approval)).not.toThrow();
    });
  });

  describe('replay stability / determinism', () => {
    it('same candidate + approval (same now) produces a deep-equal report on every call', () => {
      const candidate = sampleCandidate();
      const approval = sampleApproval(candidate);
      const now = () => '2026-07-16T00:00:00.000Z';
      expect(materializeOverlayCandidate(candidate, approval, { now })).toEqual(materializeOverlayCandidate(candidate, approval, { now }));
    });

    it('changing ONLY the clock leaves id and every fact but materializedAt identical', () => {
      const candidate = sampleCandidate();
      const approval = sampleApproval(candidate);
      const a = materializeOverlayCandidate(candidate, approval, { now: () => '2020-01-01T00:00:00.000Z' });
      const b = materializeOverlayCandidate(candidate, approval, { now: () => '2030-01-01T00:00:00.000Z' });
      expect(a.materialized.id).toBe(b.materialized.id);
      expect(a.materialized.reason).toBe(b.materialized.reason);
      expect(a.materialized.decidedAt).toBe(b.materialized.decidedAt);
      expect(a.materialized.decidedBy).toBe(b.materialized.decidedBy);
      expect(a.materializedAt).not.toBe(b.materializedAt);
    });

    it('a different candidate/approval pair produces a different materialized id', () => {
      const a = materializeOverlayCandidate(sampleCandidate(), sampleApproval(sampleCandidate()));
      const c2 = sampleCandidate({ semanticFamily: 'family-cta' });
      const b = materializeOverlayCandidate(c2, sampleApproval(c2));
      expect(a.materialized.id).not.toBe(b.materialized.id);
    });
  });

  describe('mapping correctness / integrity', () => {
    it('never mutates the input candidate or approval — both stay frozen and unchanged', () => {
      const candidate = sampleCandidate();
      const approval = sampleApproval(candidate);
      const beforeCandidate = JSON.stringify(candidate);
      const beforeApproval = JSON.stringify(approval);
      materializeOverlayCandidate(candidate, approval);
      expect(JSON.stringify(candidate)).toBe(beforeCandidate);
      expect(JSON.stringify(approval)).toBe(beforeApproval);
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(Object.isFrozen(approval)).toBe(true);
    });

    it('the fieldMapping on the report is EXACTLY MATERIALIZED_FROZEN_FIELD_MAPPING, not a fresh copy', () => {
      const candidate = sampleCandidate();
      const report = materializeOverlayCandidate(candidate, sampleApproval(candidate));
      expect(report.fieldMapping).toBe(MATERIALIZED_FROZEN_FIELD_MAPPING);
    });
  });
});

describe('P15 — falsification: materialization never touches the live Overlay store', () => {
  it('overlay-materialization.ts imports nothing from overlay.js as a VALUE, and nothing from node:fs', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-materialization.ts', 'utf8');
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
    const src = readFileSync(here + '../../src/designer-author/overlay-materialization.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(', 'filterFrozenFindings(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
