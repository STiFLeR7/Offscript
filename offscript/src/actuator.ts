import type { Finding } from './operator.js';
import type { TokenModel } from './tokens.js';

/** What the actuator (Claude Code, in production) is asked to do for one hardening pass. */
export interface ActuationRequest {
  /** the pass name (e.g. 'contrast', 'responsive') */
  pass: string;
  /** the human-readable instruction + bounds for this pass (steering-doc text, later) */
  instruction: string;
  /** the current artifact HTML to harden */
  html: string;
  /** the brand-kit tokens the actuator must stay inside (optional) */
  tokens?: TokenModel;
  /** rail violations from the previous loop iteration to fix (empty on the first call) */
  priorViolations: Finding[];
}

/** What the actuator returns: the hardened HTML. */
export interface ActuationResult {
  html: string;
}

/**
 * The single seam to the LLM transform engine (vision §4.1).
 * Implementations: deterministic fakes (tests) and, later, a Claude-backed adapter.
 */
export interface Actuator {
  harden(request: ActuationRequest): Promise<ActuationResult>;
}
