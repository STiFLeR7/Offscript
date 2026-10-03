import type { Actuator, ActuationRequest, ActuationResult } from '../actuator.js';

/** What to do once the ordered script has been exhausted. */
type Exhausted = 'last' | 'passthrough';

/**
 * A deterministic {@link Actuator} double for tests and the in-session live loop's dry-runs.
 * It replays fixed/known hardened HTML per `harden()` call instead of calling an LLM:
 *   - a single string  → always returned;
 *   - an array         → returned in call order, then `onExhausted` decides ('last' replays
 *                         the final entry, 'passthrough' returns the request HTML unchanged);
 *   - a function        → full control, given the request and the 0-based call index.
 */
export function scriptedActuator(
  script: string | string[] | ((req: ActuationRequest, call: number) => string),
  onExhausted: Exhausted = 'last',
): Actuator {
  let call = 0;
  return {
    async harden(req: ActuationRequest): Promise<ActuationResult> {
      const index = call++;
      if (typeof script === 'function') return { html: script(req, index) };
      if (typeof script === 'string') return { html: script };
      if (index < script.length) return { html: script[index] };
      return { html: onExhausted === 'last' ? script[script.length - 1] : req.html };
    },
  };
}
