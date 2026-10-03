import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Actuator, ActuationRequest, ActuationResult } from '../actuator.js';

/**
 * The dispatch seam: given a fully composed ActuationRequest, return the edited
 * HTML. In tests/CI this is a deterministic function (no model). In the live
 * in-session run it is fulfilled by a Claude subagent editing index.html per the
 * request file — driven by the orchestrating session (see scripts/actuate.ts and
 * the manual procedure in the M3 Plan B doc).
 */
export type SubagentDispatch = (req: ActuationRequest) => Promise<string>;

/**
 * A real-actuator {@link Actuator} (spec §2). Writes a human-readable dispatch
 * request to `<dispatchDir>/<pass>.request.md`, then delegates the edit to the
 * injected `dispatch` and returns its HTML. The seam is unchanged from
 * actuator.ts — this fills the real implementation behind it; scriptedActuator
 * remains the CI double for the gate-loop logic.
 */
export function createSubagentActuator(opts: {
  dispatchDir: string;
  dispatch: SubagentDispatch;
  /** write the `<pass>.request.md` brief (default true). */
  writeRequestFile?: boolean;
}): Actuator {
  const writeRequestFile = opts.writeRequestFile ?? true;
  return {
    async harden(req: ActuationRequest): Promise<ActuationResult> {
      if (writeRequestFile) {
        fs.mkdirSync(opts.dispatchDir, { recursive: true });
        const reqPath = path.join(opts.dispatchDir, `${req.pass}.request.md`);
        fs.writeFileSync(reqPath, renderRequest(req), 'utf8');
      }
      const html = await opts.dispatch(req);
      return { html };
    },
  };
}

/** Render a dispatch request as a readable markdown brief for the subagent. */
function renderRequest(req: ActuationRequest): string {
  return [
    `# Offscript actuator dispatch — pass: ${req.pass}`,
    '',
    '## Instruction (bounds — do not loosen)',
    '',
    req.instruction,
    '',
    '## Violations to clear this pass',
    '',
    '```json',
    JSON.stringify(req.priorViolations, null, 2),
    '```',
    '',
    '## How to respond',
    '',
    'Edit the live index.html to clear the violations above WITHOUT introducing slop',
    '(off-token / over-ceiling colours) or structural drift (removed landmarks, sections,',
    'archetypes). Every replacement value must be a brand token var(). Better, not different.',
    '',
  ].join('\n');
}
