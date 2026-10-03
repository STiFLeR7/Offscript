/**
 * score/ — by-kind score (WP1.E.3 / WP1.7).
 *
 * After a harden run (mechanical + actuator), Offscript produces findings across
 * rails at different tiers and outcomes. This module aggregates them into the
 * §10 systematic/bespoke ratio and a per-rail breakdown — the §8.3 headline
 * number that makes the bet measurable.
 *
 * Bucketing rule (work-done + residual):
 *   - Tier-0 bucket = `auto-remediated` findings from the MECHANICAL `applied`
 *                     runs whose operator is tier-0 (work the tier-0 ops did),
 *                     PLUS any tier-0 `auto-remediated` findings still in the
 *                     residual (defensive — should be 0 if apply is verified).
 *   - Tier-1 bucket = same shape, but for tier-1 operators.
 *   - Tier-2 bucket = a TRUE architectural defect — a residual 'escalated'
 *                     finding from a genuinely TIER-2 rail (single-element,
 *                     anchor-fragile, bespoke-frozen), plus any tier-2
 *                     `auto-remediated`/unknown-op work-done (defensive).
 *   - qualityConcerns = a residual 'escalated' finding from a TIER-0/TIER-1 rail —
 *                     an *expected architectural rail* that flagged a planner/
 *                     realization concern it could not auto-fix. It is anchor-
 *                     durable (replayable), NOT a bespoke freeze, so it is a
 *                     QUALITY signal, excluded from the architectural ratio.
 *   - Warnings      = ANY residual finding with outcome 'warning' (advisory QA
 *                     notes; not in ratio).
 *   - systematicRatio = (tier0 + tier1) / (tier0 + tier1 + tier2) — systematic over
 *                     CLASSIFIED architectural work; qualityConcerns and warnings
 *                     are excluded from the denominator. 0 when there is no
 *                     classified work, rounded to 4dp.
 *
 * W29 CORRECTION. Before W29 EVERY 'escalated' finding fell into `tier2`
 * regardless of the emitting rail's declared tier. That inverted the metric:
 * a valid tier-1 planner rail (e.g. `archetype-neighbour-collisions`) escalating
 * was miscounted as a bespoke architectural defect, so genuinely-authored sites
 * scored BELOW verbatim-paste sites (which trip no rails). The metric now buckets
 * an escalation by the RAIL'S declared tier — only true tier-2 (bespoke) defects
 * reduce architectural purity; tier-0/1 escalations surface as `qualityConcerns`.
 * See docs/internals/SPRINT-W29-SYSTEMATIC-METRIC-CORRECTION.md.
 *
 * Reading only the residual undercounts the §10 bet: a clean mechanical pass
 * fixes hundreds of token literals etc., then the score sees only the
 * judgment-rail leftovers and reports ~0%. Counting WORK DONE (the mechanical
 * `applied` array) restores the numerator — see WP1.G item 2.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Finding, Operator, Tier } from './operator.js';
import type { OperatorRun } from './engine.js';
import type { GovernanceReport } from './governance-score.js';

export interface ScoreBuckets {
  tier0: number;
  tier1: number;
  /** TRUE architectural defects only — 'escalated' findings from genuinely
   *  tier-2 (bespoke) rails, plus defensive tier-2 work-done. Reduces the ratio. */
  tier2: number;
  /** W29 — 'escalated' findings from tier-0/tier-1 rails: expected architectural
   *  rails flagging a planner/realization quality concern they couldn't auto-fix.
   *  Anchor-durable, NOT bespoke; excluded from the systematic ratio (observability). */
  qualityConcerns: number;
  warnings: number;
  total: number;
}

export interface RailBreakdown {
  name: string;
  tier: Tier;
  counts: {
    'auto-remediated': number;
    escalated: number;
    warning: number;
  };
}

export interface RunScore {
  generatedAt: string;
  subject: string;
  buckets: ScoreBuckets;
  /** (tier0 + tier1) / (tier0 + tier1 + tier2) — the §10 systematic/bespoke ratio.
   *  Warnings are excluded from the denominator. 0 when there is no classified work. */
  systematicRatio: number;
  railBreakdown: RailBreakdown[];
  /** M3 governance instrumentation — present only when a governed actuator ran. */
  governance?: GovernanceReport;
  /** Fix D — the house-governance version this run authored against, e.g.
   *  "v2 RE-THEME — PROPOSED, gate-1 draft" or "unversioned". Observability only;
   *  never enters ratio math. */
  governanceVersion?: string;
  /** E2 — the execution provenance: which author contract produced the artifact
   *  this score evaluated (e.g. "scripted" deterministic double vs "subagent"
   *  in-session). Observability only; never computed from findings, never in ratio math. */
  authorMode?: string;
}

/** Round to 4 decimal places, returning a finite number. */
function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

/**
 * Build a RunScore from BOTH the mechanical `applied` work-done array and the
 * per-rail residual findings list. Registry order is preserved in
 * `railBreakdown`. `subject` is a free-form label (typically the kit directory).
 *
 * `applied` carries the mechanical operators' auto-remediated work (the
 * numerator of the §10 ratio); `perRail` carries the residual judgment-rail
 * gaps (escalated → tier2, warning → warnings) plus any auto-remediated
 * leftovers from a mechanical op that didn't fully verify.
 */
export function scoreFindingsByRail(input: {
  subject: string;
  applied: OperatorRun[];
  perRail: Array<{ operator: Operator; findings: Finding[] }>;
  /** Fix D — house-governance version this run targeted; passed through to the
   *  result, never computed from findings, never in ratio math. Observability only. */
  governanceVersion?: string;
  /** E2 — execution provenance (author contract); passed through verbatim to the
   *  result, never computed from findings, never in ratio math. Observability only. */
  authorMode?: string;
}): RunScore {
  const buckets: ScoreBuckets = {
    tier0: 0,
    tier1: 0,
    tier2: 0,
    qualityConcerns: 0,
    warnings: 0,
    total: 0,
  };
  // name → tier lookup, sourced from perRail (the registry-shaped side of the
  // input). Used to attribute `applied` work-done findings to a tier bucket.
  const tierByName = new Map<string, Tier>();
  for (const { operator } of input.perRail) tierByName.set(operator.name, operator.tier);

  // name → live RailBreakdown entry, so we can fold `applied`'s work-done
  // auto-remediated counts into the matching rail row alongside the residual.
  const breakdownByName = new Map<string, RailBreakdown>();
  const railBreakdown: RailBreakdown[] = [];
  for (const { operator } of input.perRail) {
    const row: RailBreakdown = {
      name: operator.name,
      tier: operator.tier,
      counts: { 'auto-remediated': 0, escalated: 0, warning: 0 },
    };
    railBreakdown.push(row);
    breakdownByName.set(operator.name, row);
  }

  // 1) Count WORK DONE from the mechanical applied runs — auto-remediated
  //    findings produced by `apply` are the numerator of the §10 ratio.
  for (const run of input.applied) {
    const tier = tierByName.get(run.operator);
    const row = breakdownByName.get(run.operator);
    for (const f of run.findings) {
      if (f.outcome !== 'auto-remediated') continue; // applied only contributes work-done
      if (row) row.counts['auto-remediated'] += 1;
      if (tier === 0) buckets.tier0 += 1;
      else if (tier === 1) buckets.tier1 += 1;
      // Tier-2 ops shouldn't be in the replayable core; if one ever shows up
      // its work-done counts as bespoke — drop into tier2. Same for unknown ops.
      else buckets.tier2 += 1;
    }
  }

  // 2) Walk the per-rail RESIDUAL — escalated → tier2 (bespoke freeze),
  //    warning → warnings, and any leftover auto-remediated → its rail tier
  //    (defensive; verified mechanical ops leave no residue).
  for (const { operator, findings } of input.perRail) {
    const row = breakdownByName.get(operator.name);
    for (const f of findings) {
      if (row) row.counts[f.outcome] += 1;
      if (f.outcome === 'auto-remediated') {
        if (operator.tier === 0) buckets.tier0 += 1;
        else if (operator.tier === 1) buckets.tier1 += 1;
        else buckets.tier2 += 1;
      } else if (f.outcome === 'escalated') {
        // W29: bucket by the EMITTING rail's declared tier. Only a genuinely
        // tier-2 (single-element, anchor-fragile) rail escalating is a TRUE
        // architectural defect (bespoke freeze). A tier-0/tier-1 rail escalating
        // is an expected architectural rail flagging a quality concern it could
        // not auto-fix — anchor-durable, not bespoke — so it does not reduce
        // architectural purity.
        if (operator.tier === 2) buckets.tier2 += 1;
        else buckets.qualityConcerns += 1;
      } else if (f.outcome === 'warning') {
        buckets.warnings += 1;
      }
    }
  }

  buckets.total =
    buckets.tier0 + buckets.tier1 + buckets.tier2 + buckets.qualityConcerns + buckets.warnings;
  // The §10 systematic/bespoke ratio is systematic (tier0+tier1) over CLASSIFIED
  // work only (tier0+tier1+tier2). Warnings are advisory QA notes — excluded from
  // the denominator (matching the bucket label), so a clean page with 0 bespoke
  // escalations scores 1.0 regardless of how many advisories it carries. (`total`
  // still sums everything for the display line.)
  const classified = buckets.tier0 + buckets.tier1 + buckets.tier2;
  const systematicRatio =
    classified === 0 ? 0 : round4((buckets.tier0 + buckets.tier1) / classified);

  return {
    generatedAt: new Date().toISOString(),
    subject: input.subject,
    buckets,
    systematicRatio,
    railBreakdown,
    ...(input.governanceVersion !== undefined
      ? { governanceVersion: input.governanceVersion }
      : {}),
    ...(input.authorMode !== undefined ? { authorMode: input.authorMode } : {}),
  };
}

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer(value), 2) + '\n';
}

/** Pre-compute the sorted key union once so JSON.stringify uses it for every nested object. */
function sortedReplacer(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Write a RunScore as stable JSON (sorted keys, 2-space indent, trailing
 * newline). Idempotent: if the target file's content is identical, the file
 * is left untouched (mtime is not bumped).
 */
export function writeScore(filePath: string, score: RunScore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeIfChanged(filePath, stableStringify(score));
}

/**
 * Human-readable multi-line report. Stable / deterministic given the same
 * input (the only nondeterministic field is `generatedAt`, which is included
 * verbatim — pass the same RunScore twice and you get the same string).
 */
export function formatScoreReport(score: RunScore): string {
  const lines: string[] = [];
  lines.push(`Offscript by-kind score (WP1.7 — systematic/bespoke ratio)`);
  lines.push(`  subject:     ${score.subject}`);
  lines.push(`  generatedAt: ${score.generatedAt}`);
  lines.push('');
  lines.push(`Buckets (residual gate over the hardened doc):`);
  lines.push(`  tier-0 (global, auto-remediated):           ${score.buckets.tier0}`);
  lines.push(`  tier-1 (semantic category, auto-remediated): ${score.buckets.tier1}`);
  lines.push(`  tier-2 (true architectural defect / bespoke): ${score.buckets.tier2}`);
  lines.push(`  quality concerns (tier-0/1 escalations, excl. ratio): ${score.buckets.qualityConcerns}`);
  lines.push(`  warnings (QA notes, excluded from ratio):    ${score.buckets.warnings}`);
  lines.push(`  total:                                       ${score.buckets.total}`);
  lines.push('');
  const pct = (score.systematicRatio * 100).toFixed(2);
  lines.push(
    `  systematic ratio = (tier0 + tier1) / (tier0 + tier1 + tier2) = ${score.systematicRatio.toFixed(4)} (${pct}%)`,
  );
  lines.push('');
  lines.push(`Per-rail breakdown:`);
  // Column widths: name padded to widest, tier 1ch, counts fixed.
  const nameW = Math.max(4, ...score.railBreakdown.map((r) => r.name.length));
  const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length));
  lines.push(
    `  ${pad('rail', nameW)}  tier  auto-remediated  escalated  warning`,
  );
  lines.push(`  ${pad('-'.repeat(nameW), nameW)}  ----  ---------------  ---------  -------`);
  for (const r of score.railBreakdown) {
    const ar = String(r.counts['auto-remediated']).padStart(15);
    const es = String(r.counts.escalated).padStart(9);
    const wa = String(r.counts.warning).padStart(7);
    lines.push(`  ${pad(r.name, nameW)}   ${r.tier}    ${ar}  ${es}  ${wa}`);
  }
  return lines.join('\n');
}
