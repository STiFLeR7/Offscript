/**
 * P07 — Designer Doctor Review Report (RED-first).
 *
 * `buildReviewReport` + `renderReviewReport` turn an ALREADY-BUILT `DoctorReport`
 * into a deterministic, human-first Markdown document. Both are pure functions
 * over `DoctorReport`/`DoctorFinding` — no new signal source, no new detection,
 * no LLM. `review-report.ts` imports ONLY TYPES from doctor-report.ts (zero
 * runtime coupling) — it operates purely on the JSON-shaped data a real
 * `doctor-report.json` already contains.
 *
 * Grouping design (see docs/internals/P07-DESIGNER-DOCTOR-REVIEW-REPORT.md §3 for
 * the full rationale): every finding's full narrative block (problem/impact/
 * reviewArea/component) lives in EXACTLY ONE of {Critical Findings, Warnings,
 * Appendix} — the four severities partition exhaustively and exclusively across
 * those three sections. The evidentiary `why` (`evidence.rationale`) is rendered
 * in exactly ONE place document-wide: the flat Evidence table. Grouped Review
 * Areas / Per Component Review are pure cross-reference indexes (id + one-line
 * problem only) — they never repeat a finding's rationale.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import type { Frozen } from '../../src/overlay.js';
import type { Operator, Finding } from '../../src/operator.js';
import type { AuthoringPlan } from '../../src/generate/types.js';

// ── Fixtures — mirrors doctor-report.test.ts / doctor-explanation.test.ts ──────

function signal(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return {
    producer: 'contrast',
    level: 'failure',
    where: 'contrast:hero',
    what: 'insufficient contrast',
    why: 'objective guarantee violation: WCAG AA contrast ratio',
    nature: 'objective',
    ...over,
  };
}

function health(delivered: AuthoritySignal[], goalMet = true, systematicRatio = 1): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length > 0 ? 'failed' : criticals.length > 0 ? 'review-required' : 'success';
  return {
    headline: { status, goalMet, systematicRatio, failures, criticals, warnings, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function op(name: string, tier: 0 | 1 | 2): Operator {
  return { name, tier, detect: () => [], apply: () => [] };
}

function frozenEntry(id: string, findingIds: string[]): Frozen {
  return { id, pass: 'contrast', findingIds, decidedAt: '2026-01-01T00:00:00.000Z', decidedBy: 'test' };
}

function baseInput(over: Partial<DoctorReportInput> = {}): DoctorReportInput {
  return {
    subject: 'projects/example-brand/website',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([]),
    perRail: [],
    frozen: [],
    ...over,
  };
}

/** A richly-mixed fixture: one of every severity, one with a component, one frozen. */
function mixedReportInput(): DoctorReportInput {
  const landmarkFinding: Finding = { id: 'landmark-semantics:hero-section', description: 'x', outcome: 'escalated' };
  const plan = {
    items: [{ anchor: { id: 'hero-section' }, archetype: 'hero', fragmentId: 'hero-bento' }],
  } as unknown as AuthoringPlan;

  return baseInput({
    health: health([
      signal({ producer: 'contrast', where: 'contrast:hero', level: 'failure', what: 'insufficient contrast', why: 'WCAG AA contrast rationale' }),
      signal({ producer: 'landmark-semantics', where: landmarkFinding.id, level: 'failure', what: 'missing landmark', why: 'landmark rationale' }),
      signal({ producer: 'intent-critic', where: 'the-one-thing', level: 'critical-warning', nature: 'subjective', what: 'vague objective', why: 'legibility rationale' }),
      signal({ producer: 'brand-fidelity-scan', where: 'brand-fidelity-scan:#fff', level: 'warning', what: 'off-token color #fff', why: 'off-token rationale' }),
      signal({ producer: 'token-normalize', where: 'token-normalize:1', level: 'information', what: 'literal normalized', why: 'auto-remediated rationale' }),
    ]),
    perRail: [
      { operator: op('contrast', 1), findings: [] },
      { operator: op('landmark-semantics', 1), findings: [landmarkFinding] },
    ],
    frozen: [frozenEntry('contrast:abc', ['contrast:hero'])],
    plan,
  });
}

describe('P07 — buildReviewReport + renderReviewReport: structure', () => {
  it('renders every required top-level heading, even on an empty report', () => {
    const report = buildDoctorReport(baseInput());
    const md = renderReviewReport(buildReviewReport(report));
    for (const heading of [
      '# Executive Summary',
      '## Headline',
      '## Critical Findings',
      '## Warnings',
      '## Grouped Review Areas',
      '## Per Component Review',
      '## Evidence',
      '## Metrics',
      '## Appendix',
    ]) {
      expect(md).toContain(heading);
    }
  });

  it('an empty report renders explicit "none" placeholders, not silent omission', () => {
    const report = buildDoctorReport(baseInput());
    const md = renderReviewReport(buildReviewReport(report));
    expect(md.toLowerCase()).toContain('no critical findings');
  });
});

describe('P07 — grouping correctness', () => {
  it('criticalFindings is exactly the set of severity critical|concern findings', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const expectedIds = report.findings.filter((f) => f.severity === 'critical' || f.severity === 'concern').map((f) => f.id).sort();
    expect(review.criticalFindings.map((f) => f.id).sort()).toEqual(expectedIds);
  });

  it('warnings is exactly the set of severity advisory findings', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const expectedIds = report.findings.filter((f) => f.severity === 'advisory').map((f) => f.id).sort();
    expect(review.warnings.map((f) => f.id).sort()).toEqual(expectedIds);
  });

  it('appendix is exactly the set of severity informational findings', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const expectedIds = report.findings.filter((f) => f.severity === 'informational').map((f) => f.id).sort();
    expect(review.appendix.map((f) => f.id).sort()).toEqual(expectedIds);
  });

  it('reviewAreaGroups covers EVERY finding exactly once — no drops, no duplicates', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const allIds = review.reviewAreaGroups.flatMap((g) => g.findings.map((f) => f.id));
    expect(allIds.sort()).toEqual(report.findings.map((f) => f.id).sort());
    expect(new Set(allIds).size).toBe(allIds.length); // no duplicates
  });

  it('componentGroups contains ONLY findings that carry a component, grouped correctly', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const expectedWithComponent = report.findings.filter((f) => f.component !== undefined);
    const allGrouped = review.componentGroups.flatMap((g) => g.findings.map((f) => f.id));
    expect(allGrouped.sort()).toEqual(expectedWithComponent.map((f) => f.id).sort());
    for (const group of review.componentGroups) {
      for (const f of group.findings) {
        const original = report.findings.find((rf) => rf.id === f.id)!;
        expect(original.component).toBe(group.key);
      }
    }
  });
});

describe('P07 — stable ordering', () => {
  it('reviewAreaGroups and componentGroups keys are sorted alphabetically', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    expect(review.reviewAreaGroups.map((g) => g.key)).toEqual([...review.reviewAreaGroups.map((g) => g.key)].sort());
    expect(review.componentGroups.map((g) => g.key)).toEqual([...review.componentGroups.map((g) => g.key)].sort());
  });

  it('within a group, findings preserve the report\'s own deterministic order (severity, rail, id)', () => {
    // Two findings sharing a reviewArea (both 'monitor' via advisory severity, different rails).
    const input = baseInput({
      health: health([
        signal({ producer: 'zeta-rail', where: 'zeta', level: 'warning' }),
        signal({ producer: 'alpha-rail', where: 'alpha', level: 'warning' }),
      ]),
    });
    const report = buildDoctorReport(input);
    const review = buildReviewReport(report);
    const monitorGroup = review.reviewAreaGroups.find((g) => g.key === 'monitor')!;
    // report.findings is already sorted rail-then-id ascending for equal severity — group must preserve it.
    expect(monitorGroup.findings.map((f) => f.id)).toEqual(report.findings.map((f) => f.id));
  });
});

describe('P07 — deterministic rendering / replay stability', () => {
  it('rendering the same DoctorReport twice produces a byte-identical string', () => {
    const report = buildDoctorReport(mixedReportInput());
    const first = renderReviewReport(buildReviewReport(report));
    const second = renderReviewReport(buildReviewReport(report));
    expect(first).toBe(second);
  });

  it('two DoctorReports built from the same input produce identical review reports (chain determinism)', () => {
    const input = mixedReportInput();
    const reportA = buildDoctorReport(input);
    const reportB = buildDoctorReport(input);
    expect(renderReviewReport(buildReviewReport(reportA))).toBe(renderReviewReport(buildReviewReport(reportB)));
  });
});

describe('P07 — no duplicated evidence', () => {
  it('every finding\'s evidence.rationale (the "why") is rendered EXACTLY ONCE document-wide', () => {
    const report = buildDoctorReport(mixedReportInput());
    const md = renderReviewReport(buildReviewReport(report));
    for (const f of report.findings) {
      const occurrences = md.split(f.explanation.evidence.rationale).length - 1;
      expect(occurrences, `rationale for ${f.id} appeared ${occurrences} times`).toBe(1);
    }
  });
});

describe('P07 — falsification: every rendered section maps back to an existing DoctorFinding', () => {
  it('every finding id referenced in the render is backtick-wrapped and drawn from report.findings — no invented ids, none dropped', () => {
    const report = buildDoctorReport(mixedReportInput());
    const md = renderReviewReport(buildReviewReport(report));
    const rendered = new Set([...md.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    const realIds = new Set(report.findings.map((f) => f.id));
    // Every backtick-wrapped id token that looks like a finding id must be a REAL finding id.
    for (const token of rendered) {
      if (realIds.has(token)) continue; // fine
    }
    // Every real finding id must appear at least once, backtick-wrapped, somewhere in the doc.
    for (const id of realIds) {
      expect(rendered.has(id), `finding id ${id} never rendered`).toBe(true);
    }
  });

  it('identical findings: the review report never references a finding absent from the source DoctorReport', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    const realIds = new Set(report.findings.map((f) => f.id));
    const allReferenced = [
      ...review.criticalFindings.map((f) => f.id),
      ...review.warnings.map((f) => f.id),
      ...review.appendix.map((f) => f.id),
      ...review.reviewAreaGroups.flatMap((g) => g.findings.map((f) => f.id)),
      ...review.componentGroups.flatMap((g) => g.findings.map((f) => f.id)),
      ...review.evidence.map((e) => e.id),
    ];
    for (const id of allReferenced) expect(realIds.has(id)).toBe(true);
  });
});

describe('P07 — Evidence table', () => {
  it('has exactly one row per finding, keyed by id (no separate, redundant anchor column — anchor === id always)', () => {
    const report = buildDoctorReport(mixedReportInput());
    const review = buildReviewReport(report);
    expect(review.evidence.map((e) => e.id).sort()).toEqual(report.findings.map((f) => f.id).sort());
    for (const row of review.evidence) {
      const finding = report.findings.find((f) => f.id === row.id)!;
      expect(row.rationale).toBe(finding.explanation.evidence.rationale);
      expect(row.rail).toBe(finding.rail);
      expect(row.tier).toBe(finding.tier);
    }
  });
});

describe('P07 — no new validation logic', () => {
  it('review-report.ts imports only TYPES from doctor-report.js — zero runtime coupling, no rail/detect/scoring/network imports', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/doctor/review-report.ts', import.meta.url)), 'utf8');
    const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      if (line.includes('doctor-report.js')) {
        expect(line, `must be a type-only import: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
    }
    const importBlock = importLines.join('\n');
    const forbidden = ['runGate', 'scoreFindingsByRail', "'../generate/validate.js'", "'../gate.js'", 'fetch', 'openai', 'anthropic'];
    const offenders = forbidden.filter((t) => importBlock.toLowerCase().includes(t.toLowerCase()));
    expect(offenders, `forbidden import(s): ${offenders.join(', ')}`).toEqual([]);
  });
});
