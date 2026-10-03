/**
 * P18 — Designer Feedback Consumption: the isolation half of the sprint.
 *
 * "Feedback exists. Feedback travels. Feedback affects nothing." Mirrors
 * test/designer-author/consumption-isolation.test.ts's exact two-part proof:
 *
 *   1. A repo-wide importer scan: the ONLY file outside src/designer-feedback/
 *      that imports anything from it is the one sanctioned P18 consumer
 *      (doctor/review-package.ts). In particular: the planner, selectors,
 *      catalog gate, generation/validation modules, overlay.ts, and
 *      governance import NOTHING from designer-feedback — if any of them
 *      ever did, this test fails immediately.
 *   2. A falsification test: two ReviewPackages built from IDENTICAL
 *      DoctorReport/score/reviewReport/validationSummary but with DIFFERENT,
 *      adversarially-fabricated `designerFeedback` produce IDENTICAL
 *      headlineStatus/systematicRatio/findingCount/validationSummary/artifact
 *      hashes — proving feedback can travel inside the package without ever
 *      influencing the diagnostic content that package reports on.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));
const SCRIPTS_ROOT = fileURLToPath(new URL('../../scripts', import.meta.url));

const EXPECTED_DESIGNER_FEEDBACK_CONSUMERS = [
  'src/doctor/review-package.ts',
  // P19: type-only FeedbackPackage reference so a Workspace can index it by
  // {kind, id, sha256} and dedup DesignerFeedback.subject for progress counts,
  // without duplicating its content — see designer-workspace.ts's own isolation test.
  'src/designer-workspace/designer-workspace.ts',
  // P20: type-only FeedbackPackage reference so a Session can optionally index feedback
  // packages collected during the session — see designer-review-session.ts's own
  // isolation test proving every import is type-only.
  'src/designer-review-session/designer-review-session.ts',
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

describe('P18 — repo-wide designer-feedback importer whitelist', () => {
  it('the ONLY file outside src/designer-feedback/ that imports from it is the one sanctioned P18 consumer', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter((f) => {
      const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');
      return !rel.startsWith('src/designer-feedback/');
    });
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](?:\.\.?\/)*designer-feedback\//.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_DESIGNER_FEEDBACK_CONSUMERS].sort());
  });

  it('the planner (generate/plan.ts) imports nothing from designer-feedback', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'plan.ts'), 'utf8');
    expect(text).not.toMatch(/designer-feedback/);
  });

  it('none of the selector modules import from designer-feedback', () => {
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
      expect(text, `${rel} must not import designer-feedback`).not.toMatch(/designer-feedback/);
    }
  });

  it('the catalog gate does not import from designer-feedback', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'catalog-gate.ts'), 'utf8');
    expect(text).not.toMatch(/designer-feedback/);
  });

  it('generation and validation modules do not import from designer-feedback', () => {
    for (const rel of ['generate/author.ts', 'generate/authoring-seam.ts', 'generate/validate.ts', 'generate/reauthor-loop.ts']) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-feedback`).not.toMatch(/designer-feedback/);
    }
  });

  it('overlay.ts does not import from designer-feedback', () => {
    const text = readFileSync(join(SRC_ROOT, 'overlay.ts'), 'utf8');
    expect(text).not.toMatch(/designer-feedback/);
  });

  it('the production driver (validate-loop-driver.ts) is untouched — no designer-feedback import', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'validate-loop-driver.ts'), 'utf8');
    expect(text).not.toMatch(/designer-feedback/);
  });

  it('designer-author/ does not import from designer-feedback (two independent programs, no cross-coupling)', () => {
    const files = collectTsFiles(join(SRC_ROOT, 'designer-author'));
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, `${relative(REPO_ROOT, f)} must not import designer-feedback`).not.toMatch(/designer-feedback/);
    }
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

function fabricatedFeedback(marker: string) {
  return recordDesignerFeedback({
    subject: { kind: 'doctor-finding', id: 'contrast:hero' },
    reviewer: 'designer:adversary',
    status: 'needs-change',
    note: `FABRICATED NOTE ${marker} — designed to look like it should change the score`,
  });
}

describe('P18 — falsification: fabricated feedback never influences the review package it travels inside', () => {
  it('headlineStatus, systematicRatio, findingCount, validationSummary, and every artifact hash are identical with vs. without designerFeedback attached', () => {
    const input = baseReviewPackageInput();
    const without = buildReviewPackage(input);
    const withFeedback = buildReviewPackage({ ...input, designerFeedback: [fabricatedFeedback('A'), fabricatedFeedback('B')] });

    expect(withFeedback.headlineStatus).toBe(without.headlineStatus);
    expect(withFeedback.systematicRatio).toBe(without.systematicRatio);
    expect(withFeedback.findingCount).toBe(without.findingCount);
    expect(withFeedback.validationSummary).toBe(without.validationSummary);
    expect(withFeedback.artifacts).toEqual(without.artifacts);
    expect(withFeedback.metadata.replayIdentity).toBe(without.metadata.replayIdentity);
  });

  it('two DIFFERENT sets of fabricated feedback still produce identical scoring/validation fields', () => {
    const input = baseReviewPackageInput();
    const a = buildReviewPackage({ ...input, designerFeedback: [fabricatedFeedback('one')] });
    const b = buildReviewPackage({ ...input, designerFeedback: [fabricatedFeedback('two'), fabricatedFeedback('three')] });
    expect(a.headlineStatus).toBe(b.headlineStatus);
    expect(a.systematicRatio).toBe(b.systematicRatio);
    expect(a.artifacts).toEqual(b.artifacts);
  });

  it('omitting designerFeedback entirely produces a package with no `designerFeedback` key at all', () => {
    const pkg = buildReviewPackage(baseReviewPackageInput());
    expect('designerFeedback' in pkg).toBe(false);
  });
});
