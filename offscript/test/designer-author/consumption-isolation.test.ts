/**
 * P10 — Designer Author Consumption: the isolation half of the sprint.
 *
 * "Proposal exists. Proposal travels. Proposal affects nothing." This file
 * proves that claim mechanically, the same way test/platform-harness.test.ts's
 * EXPECTED_CONSUMERS whitelist proves harness-consumption is exactly what was
 * wired and nothing more:
 *
 *   1. A repo-wide importer scan: the ONLY files that import anything from
 *      src/designer-author/ are the two sanctioned P10 consumers
 *      (doctor/review-package.ts, platform-harness.ts) plus designer-author's
 *      own internal files. In particular: the planner (generate/plan.ts), the
 *      selectors (catalog.ts, website-composition.ts, selection-policy.ts,
 *      semantic-selection.ts, family-selection.ts, website-selection-signal.ts),
 *      the catalog gate (catalog-gate.ts), generation (author.ts,
 *      authoring-seam.ts), validation (validate.ts, reauthor-loop.ts),
 *      overlays (overlay.ts), and governance (governance-*.ts,
 *      governance-score.ts) import NOTHING from designer-author — if any of
 *      them ever did, this test fails immediately.
 *   2. A falsification test: two ReviewPackages built from IDENTICAL
 *      DoctorReport/score/reviewReport/validationSummary but with DIFFERENT,
 *      adversarially-fabricated `proposals` metadata produce IDENTICAL
 *      headlineStatus/systematicRatio/findingCount/validationSummary/artifact
 *      hashes — proving a proposal can travel inside the package without ever
 *      influencing the diagnostic content that package reports on.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));
const SCRIPTS_ROOT = fileURLToPath(new URL('../../scripts', import.meta.url));

const EXPECTED_DESIGNER_AUTHOR_CONSUMERS = [
  'src/doctor/review-package.ts',
  'src/platform-harness.ts',
  // P18: type-only AuthorProposal reference so a caller can derive a FeedbackSubject
  // without hand-typing the identity.id path — see designer-feedback-subjects.ts's
  // own isolation test proving the import is type-only.
  'src/designer-feedback/designer-feedback-subjects.ts',
  // P19: type-only ProposalPackage/ProposalReviewReport references so a Workspace can
  // index them by {kind, id, sha256} without duplicating their content — see
  // designer-workspace.ts's own isolation test proving every import is type-only.
  'src/designer-workspace/designer-workspace.ts',
  // P20: type-only ProposalPackage reference so a Session can optionally index proposal
  // packages collected during the session — see designer-review-session.ts's own
  // isolation test proving every import is type-only.
  'src/designer-review-session/designer-review-session.ts',
  // P57: the second integration sprint's Author Contract Adapter — the sanctioned boundary that
  // sources a proposal's identity/scope (origin.client + origin.track) from the immutable P55
  // Generation Contract and calls the UNMODIFIED generateProposal/generateProposalPackage. This is
  // the same deliberate whitelist-growth as the P56 doctor-report EXPECTED_CONSUMERS edit: a new
  // sanctioned Author consumer, registered here; designer-author SOURCE stays byte-unchanged.
  'src/project/author-contract-adapter.ts',
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('P10 — repo-wide designer-author importer whitelist', () => {
  it('the ONLY files outside src/designer-author/ that import from it are the two sanctioned P10 consumers', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter((f) => {
      const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');
      return !rel.startsWith('src/designer-author/');
    });
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](?:\.\.?\/)*designer-author\//.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_DESIGNER_AUTHOR_CONSUMERS].sort());
  });

  it('the planner (generate/plan.ts) imports nothing from designer-author', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'plan.ts'), 'utf8');
    expect(text).not.toMatch(/designer-author/);
  });

  it('none of the selector modules import from designer-author', () => {
    const selectorFiles = [
      'generate/catalog.ts',
      'generate/website-composition.ts',
      'generate/selection-policy.ts',
      'generate/semantic-selection.ts',
      'generate/family-selection.ts',
      'generate/website-selection-signal.ts',
    ];
    for (const rel of selectorFiles) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-author`).not.toMatch(/designer-author/);
    }
  });

  it('the catalog gate does not import from designer-author', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'catalog-gate.ts'), 'utf8');
    expect(text).not.toMatch(/designer-author/);
  });

  it('generation and validation modules do not import from designer-author', () => {
    for (const rel of ['generate/author.ts', 'generate/authoring-seam.ts', 'generate/validate.ts', 'generate/reauthor-loop.ts']) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-author`).not.toMatch(/designer-author/);
    }
  });

  it('overlay.ts does not import from designer-author', () => {
    const text = readFileSync(join(SRC_ROOT, 'overlay.ts'), 'utf8');
    expect(text).not.toMatch(/designer-author/);
  });

  it('the production driver (validate-loop-driver.ts) is untouched — no designer-author import', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'validate-loop-driver.ts'), 'utf8');
    expect(text).not.toMatch(/designer-author/);
  });
});

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
    generatedAt: '2026-07-10T00:00:00.000Z',
    health: health([{ producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' }]),
    perRail: [],
    frozen: [],
  };
}

function sampleScore() {
  return scoreFindingsByRail({ subject: 'projects/example-brand/collateral', applied: [], perRail: [] });
}

function baseReviewPackageInput() {
  const doctorReport = buildDoctorReport(sampleDoctorInput());
  const reviewReport = buildReviewReport(doctorReport);
  return {
    client: 'example-brand',
    track: 'collateral',
    doctorReport,
    score: sampleScore(),
    reviewReport,
    reviewReportMarkdown: renderReviewReport(reviewReport),
    validationSummary: 'Run headline: SUCCESS...',
  };
}

function fabricatedProposal(marker: string) {
  return buildAuthorProposal({
    kind: 'section',
    origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'collateral', authoredBy: 'designer:adversary' },
    semanticFamily: 'family-hero',
    content: `FABRICATED CONTENT ${marker} — designed to look like it should change the score`,
    status: 'promotion-recommended',
  });
}

describe('P10 — falsification: a fabricated proposal never influences the review package it travels inside', () => {
  it('headlineStatus, systematicRatio, findingCount, validationSummary, and every artifact hash are identical with vs. without proposals attached', () => {
    const input = baseReviewPackageInput();
    const withoutProposals = buildReviewPackage(input);
    const withProposals = buildReviewPackage({ ...input, proposals: [fabricatedProposal('A'), fabricatedProposal('B')] });

    expect(withProposals.headlineStatus).toBe(withoutProposals.headlineStatus);
    expect(withProposals.systematicRatio).toBe(withoutProposals.systematicRatio);
    expect(withProposals.findingCount).toBe(withoutProposals.findingCount);
    expect(withProposals.validationSummary).toBe(withoutProposals.validationSummary);
    expect(withProposals.artifacts).toEqual(withoutProposals.artifacts);
    expect(withProposals.metadata.replayIdentity).toBe(withoutProposals.metadata.replayIdentity);
  });

  it('two DIFFERENT sets of fabricated proposals still produce identical scoring/validation fields', () => {
    const input = baseReviewPackageInput();
    const a = buildReviewPackage({ ...input, proposals: [fabricatedProposal('one')] });
    const b = buildReviewPackage({ ...input, proposals: [fabricatedProposal('two'), fabricatedProposal('three')] });
    expect(a.headlineStatus).toBe(b.headlineStatus);
    expect(a.systematicRatio).toBe(b.systematicRatio);
    expect(a.artifacts).toEqual(b.artifacts);
  });

  it('omitting proposals entirely produces a package with no `proposals` key at all — byte-identical to pre-P10 shape', () => {
    const pkg = buildReviewPackage(baseReviewPackageInput());
    expect('proposals' in pkg).toBe(false);
  });
});
