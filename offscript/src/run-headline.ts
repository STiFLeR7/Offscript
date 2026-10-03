import { type AuthoritySignal, signalFromFinding } from './authority.js';
import type { Finding } from './operator.js';

/**
 * W1-S3 — Headline Integrity under LOUD-MARK.
 *
 * Truthful run reporting built additively on the W1-S1 authority module. It makes
 * the audited "success-over-failure" illusion impossible: the run's authoritative
 * headline status is derived from the authority signals, so a Failure can never
 * coexist with a clean SUCCESS headline.
 *
 * Governance (frozen): docs/internals/W1-S3-EXECUTION-PACKAGE.md (Phase 2.5
 * three-status model), OFFSCRIPT-V3-AUTHORITY-SIGNAL-OWNERSHIP-CONTRACT.md,
 * OFFSCRIPT-V3-EXECUTION-CHARTER.md (run policy: LOUD-MARK).
 *
 * Hard invariants:
 *   - STATUS FROM SIGNALS ONLY. `goalMet` and `systematicRatio` are SEPARATE
 *     reporting axes, carried verbatim — never recomputed, replaced, merged, or
 *     derived from one another (charter D4: two axes stay two numbers).
 *   - THREE DISTINCT STATUSES, never collapsed: SUCCESS (no failure, no critical),
 *     REVIEW REQUIRED (≥1 critical, 0 failures — subjective observability),
 *     FAILED (≥1 failure — objective guarantee violation).
 *   - AUTHORITY PRESERVED. Signals are partitioned by reference, never mutated,
 *     escalated, downgraded, or synthesised. A critical never becomes a failure.
 *   - OBSERVABILITY, NEVER CONTROL FLOW. Nothing here throws-to-terminate, exits,
 *     gates, or alters execution. A headline is a statement about a run, not an
 *     action on it (the same firewall as W1-S1/S2).
 */

/** The three mutually-exclusive headline statuses (Phase 2.5). */
export type HeadlineStatus = 'success' | 'review-required' | 'failed';

export interface RunHeadline {
  /** derived from the authority signals ONLY (Phase 2.5 precedence). */
  status: HeadlineStatus;
  /** separate reporting axis — the loop's existing goal decision, carried verbatim. */
  goalMet: boolean;
  /** separate reporting axis — the architecture-purity number, carried verbatim. */
  systematicRatio: number;
  /** the failure signals that drove the status (same objects, never mutated). */
  failures: AuthoritySignal[];
  /** the critical-warning signals (kept visible even when status is FAILED). */
  criticals: AuthoritySignal[];
  /**
   * GAP-2 — the warning signals (delivered-but-degraded). A SEPARATE reporting axis:
   * warnings NEVER affect `status` (precedence is failure → critical → success, see
   * buildRunHeadline). Carried so the readout can surface them under any status, so a
   * degraded-but-passing run is never rendered completely clean.
   */
  warnings: AuthoritySignal[];
  /** total signals considered (for the readout). */
  signalCount: number;
}

/**
 * Build the run headline. Status is a pure function of the authority signals:
 *   any failure → 'failed'; else any critical-warning → 'review-required'; else 'success'.
 * `goalMet` and `systematicRatio` are passed through verbatim into their own fields.
 * Pure; never throws; never mutates the signals.
 */
export function buildRunHeadline(input: {
  signals: readonly AuthoritySignal[];
  goalMet: boolean;
  systematicRatio: number;
}): RunHeadline {
  const failures = input.signals.filter((s) => s.level === 'failure');
  const criticals = input.signals.filter((s) => s.level === 'critical-warning');
  // GAP-2: warnings are collected as a separate axis — they do NOT participate in the
  // status precedence below (a warning never gates, escalates, or changes the status).
  const warnings = input.signals.filter((s) => s.level === 'warning');

  // Precedence is ordering, not synthesis: a failure leads; a lone critical is
  // review-required; otherwise success. A critical is never upgraded to a failure.
  const status: HeadlineStatus =
    failures.length > 0 ? 'failed' : criticals.length > 0 ? 'review-required' : 'success';

  return {
    status,
    goalMet: input.goalMet,
    systematicRatio: input.systematicRatio,
    failures,
    criticals,
    warnings,
    signalCount: input.signals.length,
  };
}

/** Display label per status (truthful, distinct). */
const STATUS_LABEL: Record<HeadlineStatus, string> = {
  success: 'SUCCESS',
  'review-required': 'REVIEW REQUIRED',
  failed: 'FAILED',
};

/**
 * Human-readable headline block. Shows all three independent axes (status,
 * Goal Met, ratio) side-by-side, plus the failure / critical counts and their
 * attribution. Pure; deterministic for a given headline.
 */
export function formatRunHeadline(h: RunHeadline): string {
  const lines: string[] = [];
  const pct = (h.systematicRatio * 100).toFixed(2);
  lines.push(`Run headline: ${STATUS_LABEL[h.status]}`);
  lines.push(
    `  axes (independent): status=${STATUS_LABEL[h.status]} · goalMet=${h.goalMet ? 'YES' : 'NO'} · ` +
      `systematicRatio=${h.systematicRatio.toFixed(4)} (${pct}%)`,
  );
  if (h.status === 'failed') {
    lines.push(
      `  ${h.failures.length} Failure(s) — objective guarantee violation(s); run continued under LOUD-MARK:`,
    );
    for (const f of h.failures) lines.push(`    ✗ [${f.producer}] ${f.what} @ ${f.where} — ${f.why}`);
    if (h.criticals.length > 0) {
      lines.push(`  ${h.criticals.length} Critical Warning(s) also present (human review):`);
      for (const c of h.criticals) lines.push(`    ⚑ [${c.producer}] ${c.what} @ ${c.where}`);
    }
  } else if (h.status === 'review-required') {
    lines.push(`  ${h.criticals.length} Critical Warning(s) — human review required (no objective failure):`);
    for (const c of h.criticals) lines.push(`    ⚑ [${c.producer}] ${c.what} @ ${c.where} — ${c.why}`);
  } else {
    lines.push(`  No Failures and no Critical Warnings.`);
  }
  // GAP-2: surface Warnings under EVERY status (incl. SUCCESS) so a degraded-but-
  // passing run is never rendered completely clean. Warnings do not affect status.
  if (h.warnings.length > 0) {
    lines.push(`  ${h.warnings.length} Warning(s) — delivered-but-degraded (not a guarantee violation):`);
    for (const w of h.warnings) lines.push(`    ⚠ [${w.producer}] ${w.what} @ ${w.where}`);
  }
  return lines.join('\n');
}

/**
 * Run-level bridge: turn the validate stage's per-rail findings into authority
 * signals via the frozen W1-S1 outcome→authority mapping. Pure and read-only —
 * the source findings are never mutated. Each finding becomes an OBJECTIVE signal
 * (rails are deterministic producers); existing rails emit no critical-warnings,
 * so today this yields only information / warning / failure — the headline is
 * future-ready for the W2/W3 critical producers without change.
 *
 * The parameter is a minimal structural shape (not the loop's `PerRailEntry`) so
 * this module stays decoupled from reauthor-loop.ts.
 */
export function signalsFromPerRail(
  perRail: ReadonlyArray<{ operator: { name: string }; findings: readonly Finding[] }>,
): AuthoritySignal[] {
  const signals: AuthoritySignal[] = [];
  for (const { operator, findings } of perRail) {
    for (const f of findings) {
      signals.push(signalFromFinding(f, { producer: operator.name, where: f.id }));
    }
  }
  return signals;
}
