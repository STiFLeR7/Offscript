/**
 * Sprint 10F — Visual Proof Validation methodology + contract port (q1-q4, sync executor).
 * Sprint 10I — HANDOFF-v3 methodology extension: the native/mirrored METHODOLOGY DOCUMENT was
 *   extended to six questions; this runtime contract was deliberately left unchanged that sprint.
 * Sprint 10J — THIS sprint: contract evolution. Extends the answer to q1-q6, makes the executor
 *   async (every real judgment mechanism — an LLM call, a filesystem-mediated subagent dispatch, a
 *   human review — is asynchronous; see the Judgment Execution Seam Design Report §6), adds two
 *   optional request-context fields (`camera`, `components` — closing the Q3/Q4 context gap that
 *   report's §17/Decision K identified), and introduces the judged/unavailable executor-outcome
 *   distinction (§10 of that report: a mechanism failure must never be mistaken for a semantic
 *   "no").
 *
 * This module performs NO semantic judgment. `createScriptedStubExecutor` requires the caller to
 * supply all six answers explicitly — it never inspects `belief`, `feature`, `mustInclude`,
 * `camera`, or `components` content to decide anything. A real judgment executor (LLM subagent,
 * human review, or another mechanism — undecided, see the methodology document's "Non-goals")
 * would satisfy the same `VisualProofValidationExecutor` type but is NOT implemented here.
 *
 * Answered against the Decision Record (here: the request contract's own belief/feature/
 * mustInclude/camera/components fields), never rendered pixels — this module exposes no API
 * accepting rendered HTML/image content, and never will for this gate (see the methodology
 * document's "Pre-render boundary").
 */
import type { CreativeArtifactValidation } from 'creative-artifact-contract/src/artifact/types.js';
import type { Camera } from './camera-selection.js';
import type { EnvironmentSlug } from './environment-library.js';
import type { RoleAssignment } from './role-assignment.js';
import { loadCreativeReference } from './references.js';

/**
 * Identifies the Visual Proof Validation methodology version this contract implements. Bumped
 * from 'visual-proof-validation-v1' (Sprint 10F, four questions) to 'visual-proof-validation-v2'
 * this sprint because the contract's actual scope materially changed (four questions -> six,
 * matching the now-authoritative HANDOFF-v3-extended native methodology) — the same
 * "bump when the contract's real scope changes" discipline every other methodologyVersion constant
 * in this package already follows (FEATURE_MAPPING_VERSION, CAMERA_SELECTION_VERSION,
 * COMPOSITION_CAMERA_BIAS_VERSION). This is NOT a compound/delimited version string (the smuggling
 * pattern Sprint 10B's own precedent forbids) — it is the existing, already-generic single-string
 * mechanism used exactly as designed.
 */
export const VISUAL_PROOF_VALIDATION_VERSION = 'visual-proof-validation-v2';

/**
 * The validator label for the scripted stub's own results — deliberately distinct from
 * VISUAL_PROOF_VALIDATION_VERSION so a stub result can never be mistaken for a real judgment.
 * Executor identity, never methodology identity.
 */
export const VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR = 'visual-proof-validation-scripted-stub';

/**
 * The pre-render inputs the six questions need. `belief`/`feature`/`mustInclude` are Q1-Q4's
 * original minimal contract (Sprint 10F), all already present on `CreativeIntent` today. `camera`
 * (optional) is the candidate camera being validated — needed to answer Q4 concretely (the
 * Judgment Execution Seam Design Report's own finding: Q4 is under-specified without knowing what
 * is being cropped from). It reuses `camera-selection.ts`'s existing `Camera` type — no new enum.
 * `components` (optional) is Feature Mapping's own authoritative `componentsForFeature(feature)`
 * output — needed to answer Q3 concretely, a richer, more authoritative source than free-text
 * `mustInclude` alone. All three remain optional: the contract structurally supports all six
 * questions without them, and the full Decision Record (which would make richer context mandatory)
 * remains unimplemented.
 *
 * `environment` (Sprint 10AE, optional) is the selected governed environment identity — a bare
 * `EnvironmentSlug`, never a richer `EnvironmentContext` object (mood/framing/focus). Now that
 * Sprint 10AB/10AD/10AE give this field a real, honest producer (the deterministic eligibility
 * filter + the real semantic selector), it can be populated truthfully. Q6 is answered from this
 * identity together with `components` alone (Sprint 10AF corrected an earlier, self-imposed
 * requirement for a `material` field Q6's own source wording never named — see
 * `buildJudgmentPrompt`'s own honesty-rule text).
 *
 * `roles` (Sprint 10AG, optional) is the already-decided Role Assignment (hero/support/signal/
 * subordinateContext/unassigned) for this candidate's own `components` — produced upstream by a
 * real or scripted `RoleAssignmentExecutor` (`role-assignment.ts`), never invented by this contract
 * or by a Visual Proof judge. Q5 asks whether every element is nameable under this vocabulary; when
 * `roles` is present, the judge evaluates the GIVEN assignment (never derives its own); when absent,
 * Q5 honestly declines rather than freelancing from belief/feature/components alone — the same
 * "each Decision Record field has exactly one legitimate producer" discipline `environment` already
 * established for Q6.
 */
export interface VisualProofValidationRequest {
  readonly belief: string;
  readonly feature: string;
  readonly mustInclude: readonly string[];
  readonly camera?: Camera;
  readonly components?: readonly string[];
  readonly environment?: EnvironmentSlug;
  readonly roles?: RoleAssignment;
}

/**
 * The six questions' answers, individually visible (never collapsed into `passed` alone), plus
 * the derived gate outcome and a diagnostic evidence string. `passed` is always the logical AND
 * of q1-q6 — enforced by every producer of this type in this module, never stored independently.
 * No score, no confidence, no weights, no numeric threshold — matching the native methodology's
 * own binary, unweighted gate.
 */
export interface VisualProofValidationAnswer {
  readonly q1: boolean;
  readonly q2: boolean;
  readonly q3: boolean;
  readonly q4: boolean;
  readonly q5: boolean;
  readonly q6: boolean;
  readonly passed: boolean;
  readonly evidence: string;
}

/** The six questions' answers, as supplied by a caller (a fixture, a future judgment executor). */
export interface VisualProofValidationAnswers {
  readonly q1: boolean;
  readonly q2: boolean;
  readonly q3: boolean;
  readonly q4: boolean;
  readonly q5: boolean;
  readonly q6: boolean;
}

/**
 * The extension point a future judgment executor (LLM subagent, human review, or another
 * mechanism) would implement. Async — every real judgment mechanism is asynchronous.
 * `createScriptedStubExecutor` below produces a function of this exact shape, proving the seam is
 * clean, without deciding what a real implementation is.
 */
export type VisualProofValidationExecutor = (
  request: VisualProofValidationRequest,
) => Promise<VisualProofValidationAnswer>;

/**
 * The judged/unavailable outcome distinction a real executor's internal caller would need: either
 * a genuine judgment completed ('judged'), or the mechanism failed to produce one at all — crash,
 * timeout, refusal, unparseable response ('unavailable'). This exists so a mechanism failure can
 * NEVER be mistaken for a semantic "no". `answerFromOutcome` below routes 'unavailable' through the
 * same `undefined` path an unrun validation already uses — `toArtifactValidation` is unmodified,
 * and 'unavailable' never becomes a new `CreativeArtifactValidation` status.
 */
export type VisualProofValidationOutcome =
  | { readonly outcome: 'judged'; readonly answer: VisualProofValidationAnswer }
  | { readonly outcome: 'unavailable'; readonly reason: string };

function deriveAnswer(feature: string, answers: VisualProofValidationAnswers): VisualProofValidationAnswer {
  const passed = answers.q1 && answers.q2 && answers.q3 && answers.q4 && answers.q5 && answers.q6;
  return Object.freeze({
    q1: answers.q1,
    q2: answers.q2,
    q3: answers.q3,
    q4: answers.q4,
    q5: answers.q5,
    q6: answers.q6,
    passed,
    evidence:
      `SCRIPTED STUB — no real judgment performed. Caller-supplied answers for feature ` +
      `"${feature}": q1=${answers.q1} q2=${answers.q2} q3=${answers.q3} q4=${answers.q4} ` +
      `q5=${answers.q5} q6=${answers.q6}.`,
  });
}

/**
 * Returns a `VisualProofValidationExecutor` that always resolves with the given, caller-supplied
 * six booleans — regardless of the request it is called with. This is the SCRIPTED STUB: it
 * exists only to prove the request/answer contract and pass/fail derivation work end to end for
 * tests and plumbing experiments. It performs no reasoning over request content whatsoever —
 * `belief`/`feature`/`mustInclude`/`camera`/`components` are all ignored for judgment purposes.
 */
export function createScriptedStubExecutor(
  answers: VisualProofValidationAnswers,
): VisualProofValidationExecutor {
  return async (request) => deriveAnswer(request.feature, answers);
}

/**
 * Extracts the answer from a (possibly absent) executor outcome, collapsing an 'unavailable'
 * outcome — or a never-run (`undefined`) one — to the same `undefined` value
 * `toArtifactValidation` already treats as "no judgment ran." This is how "unavailable" stays
 * distinct from "failed" without becoming a new `CreativeArtifactValidation` status: it never
 * reaches `toArtifactValidation` as an answer at all.
 */
export function answerFromOutcome(
  outcome: VisualProofValidationOutcome | undefined,
): VisualProofValidationAnswer | undefined {
  return outcome?.outcome === 'judged' ? outcome.answer : undefined;
}

/**
 * Maps a (possibly absent) Visual Proof Validation answer onto CreativeArtifact's existing
 * `validation` shape — no schema change. An absent answer (judgment never executed, or routed here
 * via `answerFromOutcome` from an 'unavailable' outcome) maps to 'unknown', distinct from
 * 'failed' — a missing or failed-to-run judgment must never masquerade as a failed one.
 */
export function toArtifactValidation(
  answer: VisualProofValidationAnswer | undefined,
  validator: string,
  validatedAt: string,
): CreativeArtifactValidation {
  if (!answer) return { status: 'unknown', validator, validatedAt };
  return { status: answer.passed ? 'passed' : 'failed', validator, validatedAt };
}

/**
 * Returns the raw Visual Proof Validation methodology document — the authoritative wording of the
 * six questions a future judgment executor must evaluate against. This module never duplicates
 * that prose; a caller (test, or a future executor) reads it from here.
 */
export function loadVisualProofValidationMethodology(): string {
  return loadCreativeReference('VISUAL-PROOF-VALIDATION.md');
}
