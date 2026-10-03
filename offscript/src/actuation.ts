import { parseHtml, serializeHtml } from './working-rep.js';
import { runGate } from './gate.js';
import type { Rail } from './gate.js';
import type { Actuator } from './actuator.js';
import type { Finding, OperatorContext } from './operator.js';

/**
 * A judgment pass: a name, an instruction for the actuator, and the rails that gate it.
 * `playbookAnchors` is an optional list of section ids (e.g., '§4.1', '§6.1') into
 * `offscript/references/SECTION_INTELLIGENCE.md` that the actuator instruction-composer
 * (`src/instruction.ts`) will resolve to verbatim playbook excerpts. Existing passes
 * with no anchors continue to ship the instruction text inline; new passes opt in.
 * See docs/superpowers/plans/2026-05-28-offscript-actuator-instruction-composition.md.
 *
 * `kind` (M2 — Track B seam) discriminates between:
 *  - 'judgment'  → the historical pass shape: dispatch a subagent, edit the
 *                  HTML in place, gate-loop until the rail clears.
 *  - 'advisory'  → for Tier-2 escalations: dispatch a subagent that produces
 *                  a PROPOSAL (not an edit) — written to
 *                  `output/<brand>/tier-2-proposals.json` and applied only on
 *                  human approval via `npm run harden:review`.
 * Defaults to 'judgment' for backward compatibility with WP1.G passes.
 */
export interface PassSpec {
  name: string;
  instruction: string;
  rails: Rail[];
  playbookAnchors?: string[];
  kind?: 'judgment' | 'advisory';
}

/** One entry in the durable decision log (vision §5). */
export interface DecisionLogEntry {
  pass: string;
  rails: string[];
  status: 'passed' | 'escalated';
  /** number of actuator invocations it took (0 = already in bounds, 1 = converged first try) */
  loops: number;
  /** violations still present when escalated (empty when passed) */
  residualViolations: Finding[];
}

export interface ActuationOutcome {
  html: string;
  log: DecisionLogEntry;
}

/**
 * The gate-loop (vision §3–§6): invoke the actuator → re-parse → run the rail gate;
 * loop until the gate is clear (`passed`) or `maxLoops` is exhausted (`escalated` → a
 * frozen/human region). "Deterministic bounds, LLM fill": the rails decide pass/fail,
 * the actuator fills. Already-in-bounds input converges with zero actuations.
 */
export async function actuatePass(
  html: string,
  ctx: OperatorContext,
  pass: PassSpec,
  actuator: Actuator,
  maxLoops = 3,
): Promise<ActuationOutcome> {
  if (maxLoops <= 0) throw new RangeError(`actuatePass: maxLoops must be >= 1, got ${maxLoops}`);
  let current = html;
  let violations: Finding[] = runGate(parseHtml(current), ctx, pass.rails);
  let loops = 0;

  while (violations.length > 0 && loops < maxLoops) {
    const result = await actuator.harden({
      pass: pass.name,
      instruction: pass.instruction,
      html: current,
      tokens: ctx.tokens,
      priorViolations: violations,
    });
    const tree = parseHtml(result.html);
    current = serializeHtml(tree);
    loops += 1;
    violations = runGate(tree, ctx, pass.rails);
  }

  const status: DecisionLogEntry['status'] = violations.length === 0 ? 'passed' : 'escalated';
  return {
    html: current,
    log: {
      pass: pass.name,
      rails: pass.rails.map((r) => r.name),
      status,
      loops,
      residualViolations: violations,
    },
  };
}
