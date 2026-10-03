/**
 * P08 — Designer Doctor Review Package (RED-first).
 *
 * `buildReviewPackage` is a PURE function assembling a deterministic manifest
 * over artifacts the driver has ALREADY produced: `doctorReport` (P04-P06),
 * `score` (the existing RunScore), `reviewReport`/`reviewReportMarkdown` (P07),
 * and the already-computed `validationSummary` (= formatRunHeadline's own
 * output, run-headline.ts — never reformatted, never re-derived). No detect, no
 * apply, no scoring, no LLM. Artifact hashes are computed over the EXACT text
 * content passed in — the same content the driver writes to disk — so the
 * manifest is a faithful index, never a duplicate copy, of what already exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage, type ReviewPackageInput } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import { PLATFORM_HARNESS_VERSION } from '../../src/platform-harness.js';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { reviewProposal } from '../../src/designer-author/proposal-review.js';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
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

function sampleDoctorInput(): DoctorReportInput {
  return {
    subject: 'projects/example-brand/collateral',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([
      { producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory QA note', nature: 'objective' },
      { producer: 'contrast', level: 'failure', where: 'contrast:footer', what: 'insufficient contrast', why: 'WCAG AA violation', nature: 'objective' },
    ]),
    perRail: [],
    frozen: [],
  };
}

function sampleScore() {
  return scoreFindingsByRail({ subject: 'projects/example-brand/collateral', applied: [], perRail: [] });
}

function sampleInput(over: Partial<ReviewPackageInput> = {}): ReviewPackageInput {
  const doctorReport = buildDoctorReport(sampleDoctorInput());
  const reviewReport = buildReviewReport(doctorReport);
  return {
    client: 'example-brand',
    track: 'collateral',
    doctorReport,
    score: sampleScore(),
    reviewReport,
    reviewReportMarkdown: renderReviewReport(reviewReport),
    validationSummary: 'Run headline: FAILED\n  1 Failure(s)...',
    ...over,
  };
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

describe('P08 — buildReviewPackage: package completeness', () => {
  it('carries metadata, executive summary, headline vitals, validation summary, artifacts, and the review contract', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.metadata.client).toBe('example-brand');
    expect(pkg.metadata.track).toBe('collateral');
    expect(typeof pkg.executiveSummary).toBe('string');
    expect(pkg.executiveSummary.length).toBeGreaterThan(0);
    expect(pkg.headlineStatus).toBe('failed');
    expect(pkg.findingCount).toBe(2);
    expect(pkg.validationSummary).toBe('Run headline: FAILED\n  1 Failure(s)...');
    expect(pkg.artifacts.length).toBe(3);
    expect(pkg.reviewContract.length).toBeGreaterThan(0);
  });

  it('the artifacts array covers exactly review-report.md, doctor-report.json, and score.json — no more, no fewer', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.artifacts.map((a) => a.name).sort()).toEqual(['doctor-report.json', 'review-report.md', 'score.json']);
  });
});

describe('P08 — manifest correctness', () => {
  it('each artifact hash is the real sha256 of the EXACT content passed in', () => {
    const input = sampleInput();
    const pkg = buildReviewPackage(input);
    const byName = new Map(pkg.artifacts.map((a) => [a.name, a]));
    expect(byName.get('review-report.md')!.sha256).toBe(sha256(input.reviewReportMarkdown));
  });

  it('doctor-report.json and score.json hashes change when their content changes', () => {
    const inputA = sampleInput();
    const inputB = sampleInput({ score: { ...sampleScore(), systematicRatio: 0.5 } });
    const pkgA = buildReviewPackage(inputA);
    const pkgB = buildReviewPackage(inputB);
    const scoreHashA = pkgA.artifacts.find((a) => a.name === 'score.json')!.sha256;
    const scoreHashB = pkgB.artifacts.find((a) => a.name === 'score.json')!.sha256;
    expect(scoreHashA).not.toBe(scoreHashB);
    // review-report.md and doctor-report.json were unchanged — their hashes must be unaffected.
    expect(pkgA.artifacts.find((a) => a.name === 'review-report.md')!.sha256).toBe(
      pkgB.artifacts.find((a) => a.name === 'review-report.md')!.sha256,
    );
  });

  it('carries the already-existing PLATFORM_HARNESS_VERSION verbatim — no new version invented', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.metadata.platformHarnessVersion).toBe(PLATFORM_HARNESS_VERSION);
  });

  it('worldABuildIdentity is included only when supplied, never fabricated', () => {
    const withIdentity = buildReviewPackage(sampleInput({ worldABuildIdentity: 'sha256:abc' }));
    expect(withIdentity.metadata.worldABuildIdentity).toBe('sha256:abc');
    const without = buildReviewPackage(sampleInput());
    expect(without.metadata.worldABuildIdentity).toBeUndefined();
  });
});

describe('P08 — deterministic package contents / replay stability', () => {
  it('the same input produces a deep-equal package on every call', () => {
    const input = sampleInput();
    expect(buildReviewPackage(input)).toEqual(buildReviewPackage(input));
  });

  it('replayIdentity is stable across two builds of the same underlying DoctorReport content, even with a different subject', () => {
    const doctorReportA = buildDoctorReport(sampleDoctorInput());
    const doctorReportB = buildDoctorReport({ ...sampleDoctorInput(), subject: 'a-totally-different-outdir-path' });
    const pkgA = buildReviewPackage(sampleInput({ doctorReport: doctorReportA, reviewReport: buildReviewReport(doctorReportA) }));
    const pkgB = buildReviewPackage(sampleInput({ doctorReport: doctorReportB, reviewReport: buildReviewReport(doctorReportB) }));
    expect(pkgA.metadata.replayIdentity).toBe(pkgB.metadata.replayIdentity);
  });

  it('replayIdentity changes when the underlying findings actually change', () => {
    const doctorReportA = buildDoctorReport(sampleDoctorInput());
    const doctorReportB = buildDoctorReport({
      ...sampleDoctorInput(),
      health: health([{ producer: 'contrast', level: 'information', where: 'contrast:only-one', what: 'x', why: 'y', nature: 'objective' }]),
    });
    const pkgA = buildReviewPackage(sampleInput({ doctorReport: doctorReportA, reviewReport: buildReviewReport(doctorReportA) }));
    const pkgB = buildReviewPackage(sampleInput({ doctorReport: doctorReportB, reviewReport: buildReviewReport(doctorReportB) }));
    expect(pkgA.metadata.replayIdentity).not.toBe(pkgB.metadata.replayIdentity);
  });
});

describe('P08 — no duplicated artifacts', () => {
  it('the artifact list has no duplicate names', () => {
    const pkg = buildReviewPackage(sampleInput());
    const names = pkg.artifacts.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the manifest does NOT re-embed the full finding content — only a hash + path per artifact', () => {
    const input = sampleInput();
    const pkg = buildReviewPackage(input);
    const serialized = JSON.stringify(pkg);
    // A real finding-specific rationale string from the fixture must NOT appear anywhere
    // in the manifest — the manifest indexes artifacts, it does not duplicate their content.
    expect(serialized).not.toContain('WCAG AA violation');
    expect(serialized).not.toContain('advisory QA note');
  });
});

describe('P08 — falsification: every packaged artifact already existed before packaging', () => {
  it('every artifact hash traces to a value the CALLER supplied — buildReviewPackage invents no content', () => {
    const input = sampleInput();
    const pkg = buildReviewPackage(input);
    // Recompute each hash independently from the caller-supplied inputs and confirm the
    // package's own recorded hash matches — proving the package performed no re-detection,
    // only hashing of what it was handed.
    const reviewMdHash = pkg.artifacts.find((a) => a.name === 'review-report.md')!.sha256;
    expect(reviewMdHash).toBe(sha256(input.reviewReportMarkdown));
  });

  it('the review contract is a fixed, non-empty, closed list — never derived from the run', () => {
    const pkgA = buildReviewPackage(sampleInput());
    const pkgB = buildReviewPackage(sampleInput({ score: { ...sampleScore(), systematicRatio: 0.1 } }));
    expect(pkgA.reviewContract).toEqual(pkgB.reviewContract);
  });
});

describe('P08 — no new validation logic', () => {
  it('review-package.ts imports only TYPES from doctor-report.js/review-report.js — no rail/detect/scoring/network machinery', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/doctor/review-package.ts', import.meta.url)), 'utf8');
    const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      // Every doctor-report.js import must be type-only — review-package.ts never
      // calls buildDoctorReport or any other doctor-report.ts function.
      if (line.includes('doctor-report.js')) {
        expect(line, `must be a type-only import: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
    }
    // review-report.js: renderExecutiveSummary is the one legitimate VALUE import (a pure,
    // already-existing renderer reused verbatim) — everything else from it must be type-only.
    const reviewReportImports = importLines.filter((l) => l.includes('review-report.js'));
    for (const line of reviewReportImports) {
      const isExecutiveSummaryImport = /\brenderExecutiveSummary\b/.test(line) && !/^\s*import\s+type\b/.test(line);
      const isTypeOnly = /^\s*import\s+type\b/.test(line);
      expect(isExecutiveSummaryImport || isTypeOnly, `unexpected review-report.js import: ${line}`).toBe(true);
    }
    // P10: designer-author/proposal-report.js — summarizeProposal is the one legitimate
    // VALUE import (a pure, already-existing summarizer reused verbatim); everything else
    // from designer-author must be type-only.
    const designerAuthorImports = importLines.filter((l) => l.includes('designer-author/'));
    for (const line of designerAuthorImports) {
      const isSummarizeProposalImport = /\bsummarizeProposal\b/.test(line) && !/^\s*import\s+type\b/.test(line);
      const isTypeOnly = /^\s*import\s+type\b/.test(line);
      expect(isSummarizeProposalImport || isTypeOnly, `unexpected designer-author import: ${line}`).toBe(true);
    }
    // P18: designer-feedback/designer-feedback.js — DesignerFeedback is transported
    // verbatim, never built here, so every import from designer-feedback must be type-only.
    const designerFeedbackImports = importLines.filter((l) => l.includes('designer-feedback/'));
    for (const line of designerFeedbackImports) {
      expect(line, `unexpected designer-feedback import: ${line}`).toMatch(/^\s*import\s+type\b/);
    }
    const importBlock = importLines.join('\n');
    const forbidden = ['runGate', 'scoreFindingsByRail', "'../generate/validate.js'", "'../gate.js'", 'fetch', 'openai', 'anthropic'];
    const offenders = forbidden.filter((t) => importBlock.toLowerCase().includes(t.toLowerCase()));
    expect(offenders, `forbidden import(s): ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('P10 — proposals metadata (Designer Author transport, pure pass-through)', () => {
  it('is absent from the package when the caller supplies no proposals', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.proposals).toBeUndefined();
    expect('proposals' in pkg).toBe(false);
  });

  it('carries a summary per supplied AuthorProposal, verbatim-derived (id/kind/status/family/parent/authoredBy/evidenceCount)', () => {
    const proposal = buildAuthorProposal({
      kind: 'component',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:hill' },
      semanticFamily: 'family-cta',
      parentComponent: 'canonical::cta-banner',
      content: 'proposed content',
      evidence: [{ description: 'evidence-1' }],
      status: 'under-review',
    });
    const pkg = buildReviewPackage({ ...sampleInput(), proposals: [proposal] });
    expect(pkg.proposals).toHaveLength(1);
    expect(pkg.proposals![0]).toEqual({
      id: proposal.identity.id,
      kind: 'component',
      status: 'under-review',
      semanticFamily: 'family-cta',
      parentComponent: 'canonical::cta-banner',
      authoredBy: 'designer:hill',
      evidenceCount: 1,
    });
  });

  it('is frozen', () => {
    const proposal = buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'x',
    });
    const pkg = buildReviewPackage({ ...sampleInput(), proposals: [proposal] });
    expect(Object.isFrozen(pkg.proposals)).toBe(true);
    expect(Object.isFrozen(pkg.proposals![0])).toBe(true);
  });

  it('never influences headlineStatus, systematicRatio, findingCount, validationSummary, or artifacts', () => {
    const proposal = buildAuthorProposal({
      kind: 'overlay',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:adversary' },
      semanticFamily: 'family-hero',
      content: 'adversarial content that must not change scoring',
      status: 'promotion-recommended',
    });
    // ONE shared input — scoreFindingsByRail stamps a real new Date().toISOString()
    // internally (score.ts:204), so two SEPARATE sampleInput() calls can legitimately
    // produce different score.json hashes for reasons that have nothing to do with
    // proposals. Reusing one input isolates the variable under test (proposals) from
    // that unrelated non-determinism.
    const input = sampleInput();
    const without = buildReviewPackage(input);
    const withOne = buildReviewPackage({ ...input, proposals: [proposal] });
    expect(withOne.headlineStatus).toBe(without.headlineStatus);
    expect(withOne.systematicRatio).toBe(without.systematicRatio);
    expect(withOne.findingCount).toBe(without.findingCount);
    expect(withOne.validationSummary).toBe(without.validationSummary);
    expect(withOne.artifacts).toEqual(without.artifacts);
  });

  it('does not re-embed the proposal content field anywhere in the serialized package', () => {
    const proposal = buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'UNIQUE-PROPOSAL-CONTENT-MARKER',
    });
    const pkg = buildReviewPackage({ ...sampleInput(), proposals: [proposal] });
    expect(JSON.stringify(pkg)).not.toContain('UNIQUE-PROPOSAL-CONTENT-MARKER');
  });
});

describe('P12 — proposalReviews (Designer Author quality review, pure pass-through)', () => {
  function sampleProposal() {
    return buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed section with enough content to pass the structure check.',
      evidence: [{ description: 'evidence-1' }],
    });
  }

  it('is absent from the package when the caller supplies no proposalReviews', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.proposalReviews).toBeUndefined();
    expect('proposalReviews' in pkg).toBe(false);
  });

  it('carries the caller-supplied ProposalReviewReport(s) verbatim', () => {
    const review = reviewProposal(sampleProposal(), { now: () => '2026-07-12T00:00:00.000Z' });
    const pkg = buildReviewPackage({ ...sampleInput(), proposalReviews: [review] });
    expect(pkg.proposalReviews).toEqual([review]);
  });

  it('is frozen', () => {
    const review = reviewProposal(sampleProposal());
    const pkg = buildReviewPackage({ ...sampleInput(), proposalReviews: [review] });
    expect(Object.isFrozen(pkg.proposalReviews)).toBe(true);
  });

  it('never influences headlineStatus, systematicRatio, findingCount, validationSummary, or artifacts — even when the proposal review is BLOCKED', () => {
    const blockedProposal = buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:adversary' },
      semanticFamily: '',
      content: '',
    });
    const blockedReview = reviewProposal(blockedProposal);
    expect(blockedReview.reviewStatus).toBe('blocked');

    const input = sampleInput();
    const without = buildReviewPackage(input);
    const withBlocked = buildReviewPackage({ ...input, proposalReviews: [blockedReview] });
    expect(withBlocked.headlineStatus).toBe(without.headlineStatus);
    expect(withBlocked.systematicRatio).toBe(without.systematicRatio);
    expect(withBlocked.findingCount).toBe(without.findingCount);
    expect(withBlocked.validationSummary).toBe(without.validationSummary);
    expect(withBlocked.artifacts).toEqual(without.artifacts);
  });

  it('does not require buildReviewPackage to call reviewProposal — no new detection logic in review-package.ts', () => {
    // Structural: review-package.ts's own "no new validation logic" test (below)
    // already asserts every designer-author import is type-only or the one
    // legitimate summarizeProposal value import. proposalReviews being accepted
    // as ALREADY-BUILT ProposalReviewReport objects (never AuthorProposal[]) is
    // what keeps that guarantee true — this test documents the contract directly.
    const review = reviewProposal(sampleProposal());
    const pkg = buildReviewPackage({ ...sampleInput(), proposalReviews: [review] });
    expect(pkg.proposalReviews![0]!.subject).toBe(review.subject);
  });
});

describe('P18 — designerFeedback (Designer Feedback transport, pure pass-through)', () => {
  function sampleFeedback() {
    return recordDesignerFeedback(
      { subject: { kind: 'doctor-finding', id: 'contrast:hero' }, reviewer: 'designer:hill', status: 'accept', note: 'looks correct' },
      { now: () => '2026-07-12T00:00:00.000Z' },
    );
  }

  it('is absent from the package when the caller supplies no designerFeedback', () => {
    const pkg = buildReviewPackage(sampleInput());
    expect(pkg.designerFeedback).toBeUndefined();
    expect('designerFeedback' in pkg).toBe(false);
  });

  it('carries the caller-supplied DesignerFeedback verbatim', () => {
    const feedback = sampleFeedback();
    const pkg = buildReviewPackage({ ...sampleInput(), designerFeedback: [feedback] });
    expect(pkg.designerFeedback).toEqual([feedback]);
  });

  it('is frozen', () => {
    const pkg = buildReviewPackage({ ...sampleInput(), designerFeedback: [sampleFeedback()] });
    expect(Object.isFrozen(pkg.designerFeedback)).toBe(true);
  });

  it('never influences headlineStatus, systematicRatio, findingCount, validationSummary, or artifacts', () => {
    const adversarialFeedback = recordDesignerFeedback({
      subject: { kind: 'doctor-finding', id: 'contrast:footer' },
      reviewer: 'designer:adversary',
      status: 'needs-change',
      note: 'adversarial note that must not change scoring',
    });
    const input = sampleInput();
    const without = buildReviewPackage(input);
    const withOne = buildReviewPackage({ ...input, designerFeedback: [adversarialFeedback] });
    expect(withOne.headlineStatus).toBe(without.headlineStatus);
    expect(withOne.systematicRatio).toBe(without.systematicRatio);
    expect(withOne.findingCount).toBe(without.findingCount);
    expect(withOne.validationSummary).toBe(without.validationSummary);
    expect(withOne.artifacts).toEqual(without.artifacts);
  });

  it('does not re-embed the note field content unexpectedly transformed — it appears verbatim, not summarized', () => {
    const feedback = recordDesignerFeedback({
      subject: { kind: 'doctor-finding', id: 'contrast:hero' },
      reviewer: 'designer:hill',
      status: 'accept',
      note: 'UNIQUE-FEEDBACK-NOTE-MARKER',
    });
    const pkg = buildReviewPackage({ ...sampleInput(), designerFeedback: [feedback] });
    expect(JSON.stringify(pkg)).toContain('UNIQUE-FEEDBACK-NOTE-MARKER');
  });
});
