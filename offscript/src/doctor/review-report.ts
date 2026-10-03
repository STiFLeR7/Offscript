/**
 * P07 — Designer Doctor Review Report.
 *
 * Transforms an ALREADY-BUILT `DoctorReport` into a deterministic, human-first
 * Markdown document. Two pure functions, no side effects, no I/O, no clock read:
 *
 *   buildReviewReport(report)  → ReviewReport   (a deterministic grouped model)
 *   renderReviewReport(review) → string          (deterministic Markdown)
 *
 * Zero runtime coupling to doctor-report.ts — every import below is `import
 * type`. This module operates purely on the JSON-shaped `DoctorReport` data a
 * real `doctor-report.json` already contains; it authors no new detection, no
 * new validation, and calls no LLM.
 *
 * GROUPING RATIONALE (evaluated per the brief: component / reviewArea / severity
 * / category — chosen to minimize repeated information):
 *
 *   - The four DoctorSeverity values partition `report.findings` EXHAUSTIVELY
 *     and EXCLUSIVELY into three narrative sections: critical|concern →
 *     Critical Findings, advisory → Warnings, informational → Appendix. Every
 *     finding's full narrative block (problem/impact/reviewArea/component)
 *     therefore appears in EXACTLY ONE section, by construction.
 *   - `category` was evaluated as a primary grouping axis and rejected: it
 *     already correlates strongly with `reviewArea` (content→review-content,
 *     intent→review-intent, structural→everything else — see P06 §4), so
 *     grouping by both would mostly repeat the same partition twice under two
 *     different names. `reviewArea` is used instead — it is the more
 *     actionable axis ("what should I inspect") and is shown as an inline
 *     field within Grouped Review Areas rather than a separate axis.
 *   - `evidence.rationale` (the "why") is rendered in exactly ONE place
 *     document-wide: the flat Evidence table. Grouped Review Areas and Per
 *     Component Review are pure cross-reference indexes (id + rail + severity
 *     + one-line problem) — they never repeat a finding's rationale, which is
 *     what keeps the document from restating the same evidentiary text under
 *     three different headings.
 *   - `evidence.anchor` is not rendered as its own column: it is ALWAYS
 *     identical to the finding's own `id` (doctor-report.ts's `buildFinding`
 *     sets `evidence.anchor = signal.where = id`, unconditionally) — a
 *     genuinely redundant field this report declines to duplicate.
 */
import type { DoctorReport, DoctorFinding, DoctorSeverity, DoctorRecommendationKind } from './doctor-report.js';
import type { Tier } from '../operator.js';

// ─────────────────────────────────────────────────────────────────────────────
// The deterministic, grouped model.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewReportGroup {
  readonly key: string;
  readonly findings: readonly DoctorFinding[];
}

export interface ReviewReportEvidenceRow {
  readonly id: string;
  readonly rail: string;
  readonly rationale: string;
  readonly tier?: Tier;
}

export interface ReviewReportSeverityCounts {
  readonly informational: number;
  readonly advisory: number;
  readonly concern: number;
  readonly critical: number;
}

export interface ReviewReportCategoryCounts {
  readonly structural: number;
  readonly content: number;
  readonly intent: number;
}

export interface ReviewReportMetrics {
  readonly bySeverity: ReviewReportSeverityCounts;
  readonly byCategory: ReviewReportCategoryCounts;
  /** only the review-area kinds that actually occur, sorted alphabetically by kind. */
  readonly byReviewArea: ReadonlyArray<{ readonly kind: DoctorRecommendationKind; readonly count: number }>;
}

export interface ReviewReport {
  readonly subject: string;
  readonly generatedAt: string;
  readonly headlineStatus: DoctorReport['headlineStatus'];
  readonly systematicRatio: number;
  readonly findingCount: number;
  /** severity critical | concern — full narrative detail. */
  readonly criticalFindings: readonly DoctorFinding[];
  /** severity advisory — full narrative detail. */
  readonly warnings: readonly DoctorFinding[];
  /** severity informational — full narrative detail ("what can safely wait"). */
  readonly appendix: readonly DoctorFinding[];
  /** ALL findings, grouped by explanation.reviewArea — cross-reference only. */
  readonly reviewAreaGroups: readonly ReviewReportGroup[];
  /** findings that carry a component, grouped by component — cross-reference only. */
  readonly componentGroups: readonly ReviewReportGroup[];
  /** one row per finding — the sole place `evidence.rationale` is rendered. */
  readonly evidence: readonly ReviewReportEvidenceRow[];
  readonly metrics: ReviewReportMetrics;
}

function groupBy(findings: readonly DoctorFinding[], keyOf: (f: DoctorFinding) => string | undefined): ReviewReportGroup[] {
  const byKey = new Map<string, DoctorFinding[]>();
  // Preserve `findings`' own (already-deterministic) relative order within each bucket —
  // iterate in the given order, push into the bucket, never re-sort within a bucket.
  for (const f of findings) {
    const key = keyOf(f);
    if (key === undefined) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(f);
    else byKey.set(key, [f]);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, findingsInGroup]) => Object.freeze({ key, findings: Object.freeze(findingsInGroup) }));
}

/**
 * Pure, total: no field on `ReviewReport` is anything but a filter/group/count
 * over `report.findings`, which `buildDoctorReport` already produced. No new
 * fact is introduced; nothing is recomputed from a raw signal.
 */
export function buildReviewReport(report: DoctorReport): ReviewReport {
  const criticalFindings = report.findings.filter((f) => f.severity === 'critical' || f.severity === 'concern');
  const warnings = report.findings.filter((f) => f.severity === 'advisory');
  const appendix = report.findings.filter((f) => f.severity === 'informational');

  const reviewAreaGroups = groupBy(report.findings, (f) => f.explanation.reviewArea);
  const componentGroups = groupBy(report.findings, (f) => f.component);

  const evidence: ReviewReportEvidenceRow[] = report.findings.map((f) =>
    Object.freeze({
      id: f.id,
      rail: f.rail,
      rationale: f.explanation.evidence.rationale,
      ...(f.tier !== undefined ? { tier: f.tier } : {}),
    }),
  );

  const bySeverity: Record<DoctorSeverity, number> = {
    informational: 0,
    advisory: 0,
    concern: 0,
    critical: 0,
  };
  const byCategory = { structural: 0, content: 0, intent: 0 };
  const reviewAreaCounts = new Map<DoctorRecommendationKind, number>();
  for (const f of report.findings) {
    bySeverity[f.severity] += 1;
    byCategory[f.category] += 1;
    reviewAreaCounts.set(f.explanation.reviewArea, (reviewAreaCounts.get(f.explanation.reviewArea) ?? 0) + 1);
  }
  const byReviewArea = [...reviewAreaCounts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([kind, count]) => Object.freeze({ kind, count }));

  return Object.freeze({
    subject: report.subject,
    generatedAt: report.generatedAt,
    headlineStatus: report.headlineStatus,
    systematicRatio: report.systematicRatio,
    findingCount: report.findingCount,
    criticalFindings: Object.freeze(criticalFindings),
    warnings: Object.freeze(warnings),
    appendix: Object.freeze(appendix),
    reviewAreaGroups: Object.freeze(reviewAreaGroups),
    componentGroups: Object.freeze(componentGroups),
    evidence: Object.freeze(evidence),
    metrics: Object.freeze({
      bySeverity: Object.freeze(bySeverity),
      byCategory: Object.freeze(byCategory),
      byReviewArea: Object.freeze(byReviewArea),
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// The renderer — deterministic Markdown, no hidden state.
// ─────────────────────────────────────────────────────────────────────────────

function renderFindingBlock(f: DoctorFinding): string {
  const lines: string[] = [];
  lines.push(`### [${f.severity}] ${f.rail} — \`${f.id}\``);
  lines.push(`- Problem: ${f.explanation.problem}`);
  lines.push(`- Impact: ${f.explanation.impact}`);
  lines.push(`- Suggested review area: ${f.explanation.reviewArea}`);
  if (f.component !== undefined) lines.push(`- Component: \`${f.component}\``);
  if (f.overlayId !== undefined) lines.push(`- Overlay: \`${f.overlayId}\` (already frozen — re-decide, do not regenerate)`);
  return lines.join('\n');
}

function renderFindingBlocks(findings: readonly DoctorFinding[], emptyLabel: string): string {
  if (findings.length === 0) return `_${emptyLabel}_`;
  return findings.map(renderFindingBlock).join('\n\n');
}

function renderGroups(groups: readonly ReviewReportGroup[], emptyLabel: string): string {
  if (groups.length === 0) return `_${emptyLabel}_`;
  return groups
    .map((g) => {
      const rows = g.findings
        .map((f) => `  - [${f.severity}] ${f.rail} — \`${f.id}\` — ${f.explanation.problem}`)
        .join('\n');
      return `- **${g.key}** (${g.findings.length})\n${rows}`;
    })
    .join('\n');
}

/**
 * The two-line executive summary (status/counts + a "where to start" pointer).
 * Extracted as its own export — P08's ReviewPackage reuses this SAME text
 * verbatim for its own `executiveSummary` field, rather than re-deriving it, so
 * the package's summary and the review report's own Executive Summary section
 * are always the identical text, computed once. Deterministic given the same
 * `ReviewReport` — no clock, no random, no I/O.
 */
export function renderExecutiveSummary(review: ReviewReport): string {
  const total = review.findingCount;
  const criticalCount = review.criticalFindings.length;
  const warningCount = review.warnings.length;
  const resolvedCount = review.appendix.length;
  const statusLine =
    `Status **${review.headlineStatus.toUpperCase()}** — ${total} finding(s): ` +
    `${criticalCount} need review now, ${warningCount} worth a spot-check, ` +
    `${resolvedCount} already resolved automatically (safe to skip).`;
  const pointerLine =
    criticalCount > 0
      ? `Start with **Critical Findings** below.`
      : warningCount > 0
        ? `No critical findings — skim **Warnings** when convenient.`
        : `Nothing needs review.`;
  return `${statusLine}\n${pointerLine}`;
}

/** Deterministic given the same `ReviewReport` — no clock, no random, no I/O. */
export function renderReviewReport(review: ReviewReport): string {
  const lines: string[] = [];

  lines.push(`# Executive Summary`);
  lines.push('');
  lines.push(renderExecutiveSummary(review));
  lines.push('');

  lines.push(`## Headline`);
  lines.push('');
  lines.push(`- Subject: \`${review.subject}\``);
  lines.push(`- Generated: ${review.generatedAt}`);
  lines.push(`- Status: ${review.headlineStatus}`);
  lines.push(`- Systematic ratio: ${(review.systematicRatio * 100).toFixed(2)}%`);
  lines.push(`- Findings: ${review.findingCount}`);
  lines.push('');

  lines.push(`## Critical Findings`);
  lines.push('');
  lines.push(renderFindingBlocks(review.criticalFindings, 'No critical findings.'));
  lines.push('');

  lines.push(`## Warnings`);
  lines.push('');
  lines.push(renderFindingBlocks(review.warnings, 'No warnings.'));
  lines.push('');

  lines.push(`## Grouped Review Areas`);
  lines.push('');
  lines.push(renderGroups(review.reviewAreaGroups, 'No findings.'));
  lines.push('');

  lines.push(`## Per Component Review`);
  lines.push('');
  lines.push(renderGroups(review.componentGroups, 'No findings resolved to a specific component.'));
  lines.push('');

  lines.push(`## Evidence`);
  lines.push('');
  if (review.evidence.length === 0) {
    lines.push('_No findings._');
  } else {
    lines.push('| id | rail | tier | why |');
    lines.push('| --- | --- | --- | --- |');
    for (const e of review.evidence) {
      lines.push(`| \`${e.id}\` | ${e.rail} | ${e.tier ?? '—'} | ${e.rationale} |`);
    }
  }
  lines.push('');

  lines.push(`## Metrics`);
  lines.push('');
  lines.push(`By severity: informational=${review.metrics.bySeverity.informational}, advisory=${review.metrics.bySeverity.advisory}, concern=${review.metrics.bySeverity.concern}, critical=${review.metrics.bySeverity.critical}`);
  lines.push(`By category: structural=${review.metrics.byCategory.structural}, content=${review.metrics.byCategory.content}, intent=${review.metrics.byCategory.intent}`);
  if (review.metrics.byReviewArea.length > 0) {
    lines.push(`By review area: ${review.metrics.byReviewArea.map((r) => `${r.kind}=${r.count}`).join(', ')}`);
  }
  lines.push('');

  lines.push(`## Appendix`);
  lines.push('');
  lines.push(`_Resolved automatically — no action required._`);
  lines.push('');
  lines.push(renderFindingBlocks(review.appendix, 'Nothing resolved automatically this run.'));

  return lines.join('\n') + '\n';
}
