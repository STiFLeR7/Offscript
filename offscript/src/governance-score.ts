import type { GovernanceTrace } from './actuation-governed.js';

/**
 * Governance instrumentation (spec §5): the per-pass governed-loop traces folded
 * into one report so "controlled flexibility" is a MEASURED property of a run,
 * not a stated one. Attached to RunScore as `governance`.
 */
export interface GovernanceReport {
  subject: string;
  passes: GovernanceTrace[];
  totals: {
    passes: number;
    passed: number;
    escalated: number;
    /** total anti-slop tells still present at convergence across passes. */
    slopIntroduced: number;
    /** total fidelity drift findings still present at convergence across passes. */
    drift: number;
    /** total actuator invocations across passes. */
    loops: number;
    /** fraction of passes that ended in bounds (0 when no passes ran). */
    inBoundsRatio: number;
  };
}

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

export function buildGovernanceReport(input: {
  subject: string;
  traces: GovernanceTrace[];
}): GovernanceReport {
  const { subject, traces } = input;
  const passed = traces.filter((t) => t.status === 'passed').length;
  const escalated = traces.filter((t) => t.status === 'escalated').length;
  const slopIntroduced = traces.reduce((s, t) => s + t.slopIntroduced, 0);
  const drift = traces.reduce((s, t) => s + t.drift, 0);
  const loops = traces.reduce((s, t) => s + t.loops, 0);
  const inBoundsCount = traces.filter((t) => t.inBounds).length;
  const inBoundsRatio = traces.length === 0 ? 0 : round4(inBoundsCount / traces.length);

  return {
    subject,
    passes: [...traces].sort((a, b) => (a.pass < b.pass ? -1 : a.pass > b.pass ? 1 : 0)),
    totals: { passes: traces.length, passed, escalated, slopIntroduced, drift, loops, inBoundsRatio },
  };
}

export function formatGovernanceReport(report: GovernanceReport): string {
  const lines: string[] = [];
  lines.push(`Offscript governance report (M3 — controlled flexibility, measured)`);
  lines.push(`  subject: ${report.subject}`);
  lines.push('');
  lines.push(`  ${'pass'.padEnd(20)} loops  rails  slop  drift  in-bounds  status`);
  for (const p of report.passes) {
    lines.push(
      `  ${p.pass.padEnd(20)} ${String(p.loops).padStart(5)}  ` +
        `${(p.railsClear ? 'clear' : 'FAIL').padEnd(5)}  ${String(p.slopIntroduced).padStart(4)}  ` +
        `${String(p.drift).padStart(5)}  ${(p.inBounds ? 'yes' : 'NO').padEnd(9)}  ${p.status}`,
    );
  }
  lines.push('');
  lines.push(
    `  totals: ${report.totals.passed}/${report.totals.passes} passed · ` +
      `slop=${report.totals.slopIntroduced} · drift=${report.totals.drift} · ` +
      `in-bounds ratio = ${report.totals.inBoundsRatio.toFixed(4)}`,
  );
  return lines.join('\n');
}
