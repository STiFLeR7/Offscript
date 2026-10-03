/**
 * P18 — Designer Feedback Foundation. RED-first.
 *
 * Investigation (see docs/internals/P18-DESIGNER-FEEDBACK-FOUNDATION.md §3)
 * grounds this module directly in `doctor/review-package.ts`'s own
 * `REVIEW_CONTRACT` — its `'designer-feedback'` stage has, since P08,
 * explicitly named the gap this sprint closes: "A human designer reads
 * Critical Findings and Warnings and records a decision per finding (e.g.
 * accept / needs-change / defer) OUTSIDE this package. Doctor does not
 * collect, store, transmit, or process any designer response — there is no
 * feedback channel back into Offscript today." `FeedbackStatus`'s three values
 * are lifted VERBATIM from that sentence, not invented.
 *
 * This is the FIRST genuinely human-decision-shaped artifact with ZERO
 * coupling to any domain module — unlike `overlay-approval.ts` (P14), which
 * imports `OverlayCandidate`/`ProposalReviewReport` types to snapshot
 * `candidateId`/`sourceProposalId`, `recordDesignerFeedback` accepts a plain
 * `{kind, id}` subject reference the caller assembles. The engine transports
 * facts (subject reference, reviewer, status, structured note); it computes
 * and infers nothing. Domain-aware convenience helpers that DO import
 * `DoctorFinding`/`AuthorProposal` types live in a separate file,
 * designer-feedback-subjects.ts — see that file's own tests.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DesignerFeedbackError,
  recordDesignerFeedback,
  type DesignerFeedback,
  type FeedbackSubject,
} from '../../src/designer-feedback/designer-feedback.js';

function findingSubject(id = 'contrast:hero'): FeedbackSubject {
  return { kind: 'doctor-finding', id };
}

function proposalSubject(id = 'abc123'): FeedbackSubject {
  return { kind: 'proposal', id };
}

describe('recordDesignerFeedback — captures only facts', () => {
  it('produces a deep-frozen DesignerFeedback', () => {
    const feedback = recordDesignerFeedback(
      { subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: 'looks correct, no action needed' },
      { now: () => '2026-07-10T00:00:00.000Z' },
    );
    expect(Object.isFrozen(feedback)).toBe(true);
    expect(Object.isFrozen(feedback.subject)).toBe(true);
  });

  it('carries subject, reviewer, status, and note verbatim — never generated, never inferred', () => {
    const feedback = recordDesignerFeedback(
      { subject: findingSubject('contrast:footer'), reviewer: 'designer:amina', status: 'needs-change', note: 'contrast ratio reads as off-brand here' },
      { now: () => '2026-07-10T00:00:00.000Z' },
    );
    expect(feedback.subject).toEqual({ kind: 'doctor-finding', id: 'contrast:footer' });
    expect(feedback.reviewer).toBe('designer:amina');
    expect(feedback.status).toBe('needs-change');
    expect(feedback.note).toBe('contrast ratio reads as off-brand here');
    expect(feedback.recordedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('supports a proposal subject reference identically to a doctor-finding subject reference', () => {
    const feedback = recordDesignerFeedback({
      subject: proposalSubject('proposal-id-1'),
      reviewer: 'designer:hill',
      status: 'defer',
      note: 'revisit after brand-kit v2 lands',
    });
    expect(feedback.subject).toEqual({ kind: 'proposal', id: 'proposal-id-1' });
  });

  describe('validation — fail loud on missing facts', () => {
    it('throws DesignerFeedbackError when subject.id is empty', () => {
      expect(() =>
        recordDesignerFeedback({ subject: { kind: 'doctor-finding', id: '  ' }, reviewer: 'designer:hill', status: 'accept', note: 'ok' }),
      ).toThrow(DesignerFeedbackError);
    });

    it('throws DesignerFeedbackError when subject.kind is not doctor-finding/proposal', () => {
      expect(() =>
        recordDesignerFeedback({
          subject: { kind: 'something-else' as unknown as 'proposal', id: 'x' },
          reviewer: 'designer:hill',
          status: 'accept',
          note: 'ok',
        }),
      ).toThrow(DesignerFeedbackError);
    });

    it('throws DesignerFeedbackError when reviewer is empty', () => {
      expect(() => recordDesignerFeedback({ subject: findingSubject(), reviewer: '   ', status: 'accept', note: 'ok' })).toThrow(
        DesignerFeedbackError,
      );
    });

    it('throws DesignerFeedbackError when note is empty', () => {
      expect(() => recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: '' })).toThrow(
        DesignerFeedbackError,
      );
    });

    it('throws DesignerFeedbackError when status is not accept/needs-change/defer', () => {
      expect(() =>
        recordDesignerFeedback({
          subject: findingSubject(),
          reviewer: 'designer:hill',
          status: 'maybe' as unknown as 'accept',
          note: 'ok',
        }),
      ).toThrow(DesignerFeedbackError);
    });
  });
});

describe('deterministic identity / replay stability', () => {
  it('same facts (same now) produce a deep-equal feedback on every call', () => {
    const now = () => '2026-07-10T00:00:00.000Z';
    const input = { subject: findingSubject(), reviewer: 'designer:hill', status: 'accept' as const, note: 'ok' };
    expect(recordDesignerFeedback(input, { now })).toEqual(recordDesignerFeedback(input, { now }));
  });

  it('changing ONLY the clock leaves id and every other fact identical — id is content-derived, not time-derived', () => {
    const input = { subject: findingSubject(), reviewer: 'designer:hill', status: 'accept' as const, note: 'ok' };
    const a = recordDesignerFeedback(input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = recordDesignerFeedback(input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.subject).toEqual(b.subject);
    expect(a.reviewer).toBe(b.reviewer);
    expect(a.status).toBe(b.status);
    expect(a.note).toBe(b.note);
    expect(a.recordedAt).not.toBe(b.recordedAt);
  });

  it('a different subject id produces a different id', () => {
    const a = recordDesignerFeedback({ subject: findingSubject('contrast:hero'), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    const b = recordDesignerFeedback({ subject: findingSubject('contrast:footer'), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different subject kind (same id) produces a different id', () => {
    const a = recordDesignerFeedback({ subject: findingSubject('shared-id'), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    const b = recordDesignerFeedback({ subject: proposalSubject('shared-id'), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different status produces a different id', () => {
    const a = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    const b = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'needs-change', note: 'ok' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different reviewer produces a different id', () => {
    const a = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: 'ok' });
    const b = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:amina', status: 'accept', note: 'ok' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different note produces a different id', () => {
    const a = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: 'note one' });
    const b = recordDesignerFeedback({ subject: findingSubject(), reviewer: 'designer:hill', status: 'accept', note: 'note two' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('P18 — isolation: the core model has zero coupling to any domain module', () => {
  it('designer-feedback.ts imports nothing beyond node:crypto — no doctor/, designer-author/, overlay.js, generate/, node:fs', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-feedback/designer-feedback.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line, `unexpected import: ${line}`).toMatch(/node:crypto/);
    }
  });

  it('never calls a filesystem or overlay-store function — string-scan the whole file for forbidden call sites', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-feedback/designer-feedback.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(', 'readFileSync(', 'writeFileSync(', 'mkdirSync(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
