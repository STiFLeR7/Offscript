/**
 * freeze-wiring — bridge from rail findings to durable overlay/ entries.
 *
 * WP1.F.1. WP1.E.1 delivered the overlay/ library (`freezeFromDecisionLog`,
 * `writeOverlay`); this module is the bridge that the harden orchestrator
 * uses to convert escalated findings into frozen bespoke regions on disk.
 *
 * Per the bounded-LLM vision (§6, §8.2): findings whose outcome is
 * `escalated` name regions the systematic core cannot bring into bounds.
 * Those become "you owned X; upstream changed; re-decide" entries —
 * stored, but never replayed. Warnings (brand-fidelity QA notes) are NOT
 * frozen: a warning is advisory, not a region claim.
 */
import type { Operator, Finding } from './operator.js';
import type { DecisionLogEntry } from './actuation.js';
import { freezeFromDecisionLog, writeOverlay } from './overlay.js';

export interface PerRailFindings {
  operator: Operator;
  findings: Finding[];
}

export interface FreezeOptions {
  /** absolute path to <outDir>/overlay */
  overlayDir: string;
  /** the per-rail residual findings from the harden orchestrator's gate pass */
  perRail: PerRailFindings[];
  /** identity for the Frozen.decidedBy field (e.g. 'offscript-harden:v1') */
  decidedBy: string;
  /** optional HTML snapshot to write alongside each Frozen */
  snapshotHtml?: string;
  /** optional reason note threaded onto every Frozen written this call */
  reason?: string;
}

export interface WroteOverlay {
  /** absolute path to the written overlay JSON file */
  overlayPath: string;
  /** the Frozen.id that was written (pass:decidedAt) */
  frozenId: string;
  /** ids of the findings rolled into this overlay entry */
  findingIds: string[];
}

/**
 * For each rail with at least one escalated finding, synthesise a
 * DecisionLogEntry-shaped record, freeze it, and write it to overlayDir.
 * Warnings and auto-remediated findings are ignored. Returns one
 * WroteOverlay per file written (empty array if nothing escalated).
 *
 * Idempotent by virtue of `writeOverlay`'s content-compare (it leaves the
 * file untouched if the JSON is byte-identical) — but note: each call
 * stamps a fresh `decidedAt`, so re-running this function with the same
 * input does write a NEW file (different id). Idempotency at the
 * file-system layer means "re-writing the SAME Frozen object is a no-op";
 * for orchestrator-level idempotency, callers should not re-freeze when
 * the overlay already records the same finding ids (the
 * `filterFrozenFindings` API in overlay.ts handles that read-side).
 */
export function freezeEscalatedFindings(options: FreezeOptions): WroteOverlay[] {
  const { overlayDir, perRail, decidedBy, snapshotHtml, reason } = options;
  const out: WroteOverlay[] = [];

  for (const { operator, findings } of perRail) {
    const escalated = findings.filter((f) => f.outcome === 'escalated');
    if (escalated.length === 0) continue;

    const entry: DecisionLogEntry = {
      pass: operator.name,
      rails: [operator.name],
      status: 'escalated',
      loops: 0,
      residualViolations: escalated,
    };

    const opts: { decidedBy: string; snapshotHtml?: string; reason?: string } = { decidedBy };
    if (snapshotHtml !== undefined) opts.snapshotHtml = snapshotHtml;
    if (reason !== undefined) opts.reason = reason;
    const frozen = freezeFromDecisionLog(entry, opts);
    const overlayPath = writeOverlay(overlayDir, frozen);
    out.push({
      overlayPath,
      frozenId: frozen.id,
      findingIds: escalated.map((f) => f.id),
    });
  }

  return out;
}
