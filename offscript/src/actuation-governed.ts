import type { Root } from 'hast';
import { parseHtml, serializeHtml } from './working-rep.js';
import { runGate } from './gate.js';
import type { Actuator } from './actuator.js';
import type { Finding, OperatorContext } from './operator.js';
import type { PassSpec } from './actuation.js';
import type { DecisionLogEntry } from './actuation.js';
import { antiSlopGovernance } from './operators/anti-slop-governance.js';
import { detectFidelityDrift } from './fidelity-comparator.js';

/** Per-pass governance instrumentation (spec §3, §5). */
export interface GovernanceTrace {
  pass: string;
  /** actuator invocations (0 = already in bounds). */
  loops: number;
  /** pass.rails clear at convergence/escalation. */
  railsClear: boolean;
  /**
   * anti-slop findings still present on the OUTPUT at convergence (brand-relative
   * slop tells). Governance gates the absolute output state, not just the delta:
   * the actuator must leave zero slop regardless of whether the input already
   * carried some — so read this strictly as "slop present at end".
   */
  slopIntroduced: number;
  /** fidelity drift findings still present at end (structural regressions vs the reference). */
  drift: number;
  /** true iff slopIntroduced === 0 && drift === 0. */
  inBounds: boolean;
  status: 'passed' | 'escalated';
}

export interface GovernedOutcome {
  html: string;
  log: DecisionLogEntry;
  governance: GovernanceTrace;
}

/** Run both governance rails against a candidate (anti-slop) vs the reference (fidelity). */
export function runGovernance(
  candidate: Root,
  reference: Root,
  ctx: OperatorContext,
): { slop: Finding[]; fidelity: Finding[] } {
  return {
    slop: antiSlopGovernance.detect(candidate, ctx),
    fidelity: detectFidelityDrift(reference, candidate, ctx),
  };
}

/**
 * The governed gate-loop (spec §3): invoke the actuator → re-parse → run the
 * pass rails AND the governance rails; converge only when BOTH are clear
 * (`passed`), else re-loop feeding the union of violations + governance findings
 * back as `priorViolations`, else escalate at `maxLoops`. Sibling to
 * `actuatePass` — that simpler loop stays for non-governed passes.
 */
export async function actuatePassGoverned(opts: {
  html: string;
  reference: string;
  ctx: OperatorContext;
  pass: PassSpec;
  actuator: Actuator;
  maxLoops?: number;
}): Promise<GovernedOutcome> {
  const maxLoops = opts.maxLoops ?? 3;
  if (maxLoops <= 0) throw new RangeError(`actuatePassGoverned: maxLoops must be >= 1, got ${maxLoops}`);

  const refTree = parseHtml(opts.reference);
  let current = opts.html;
  let tree = parseHtml(current);
  let railViolations = runGate(tree, opts.ctx, opts.pass.rails);
  let gov = runGovernance(tree, refTree, opts.ctx);
  let loops = 0;

  const notClean = (): boolean =>
    railViolations.length > 0 || gov.slop.length > 0 || gov.fidelity.length > 0;

  while (notClean() && loops < maxLoops) {
    const result = await opts.actuator.harden({
      pass: opts.pass.name,
      instruction: opts.pass.instruction,
      html: current,
      tokens: opts.ctx.tokens,
      priorViolations: [...railViolations, ...gov.slop, ...gov.fidelity],
    });
    tree = parseHtml(result.html);
    current = serializeHtml(tree);
    loops += 1;
    railViolations = runGate(tree, opts.ctx, opts.pass.rails);
    gov = runGovernance(tree, refTree, opts.ctx);
  }

  const railsClear = railViolations.length === 0;
  const inBounds = gov.slop.length === 0 && gov.fidelity.length === 0;
  const status: DecisionLogEntry['status'] = railsClear && inBounds ? 'passed' : 'escalated';

  return {
    html: current,
    log: {
      pass: opts.pass.name,
      rails: opts.pass.rails.map((r) => r.name),
      status,
      loops,
      residualViolations: [...railViolations, ...gov.slop, ...gov.fidelity],
    },
    governance: {
      pass: opts.pass.name,
      loops,
      railsClear,
      slopIntroduced: gov.slop.length,
      drift: gov.fidelity.length,
      inBounds,
      status,
    },
  };
}
