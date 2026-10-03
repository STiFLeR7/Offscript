/**
 * Sprint 10K — the real Visual Proof Validation judgment executor. Structurally parallel to
 * `offscript/src/generate/authoring-seam.ts`'s `Author`/`createSubagentAuthor` pattern (curated
 * request → injectable dispatch → real external judge → structured, validated response) — an
 * independent, sibling reimplementation, never an import of that file or a shared package. See
 * the Judgment Execution Seam Design Report (Sprint 10G) for the full architectural comparison.
 *
 * `VisualProofValidationExecutor` (visual-proof-validation.ts, Sprint 10J) returns
 * `Promise<VisualProofValidationAnswer>` — a clean type with no way to honestly represent
 * "the mechanism failed to produce a judgment." A real executor needs exactly that, so this module
 * defines its own, wider `VisualProofJudgmentExecutor` type returning
 * `Promise<VisualProofValidationOutcome>` (judged | unavailable) — the type Sprint 10J's own
 * `VisualProofValidationOutcome`/`answerFromOutcome` were built to receive. The scripted stub
 * (`createScriptedStubExecutor`) is unaffected — it still satisfies the narrower
 * `VisualProofValidationExecutor` type unchanged.
 *
 * This module performs semantic judgment ONLY via an injected `dispatch` function — it contains no
 * embedded model call, no hardcoded vendor, and no API key handling. `dispatch` is a plain
 * `(promptText: string) => Promise<string>` boundary, exactly as replaceable as
 * `AuthorDispatch` is for the authoring seam. `createRealJudgmentExecutor`'s own logic — prompt
 * construction, strict response parsing/coercion, timeout handling, and the judged/unavailable
 * distinction — is the only "real" logic here; who or what fulfills `dispatch` is entirely the
 * caller's concern (see `offscript/scripts/_sprint10k-real-judge.ts` for the file-based
 * request/response fulfillment this repository's real subagent path uses today).
 *
 * A mechanism failure (dispatch exception, timeout, malformed response, missing/invalid answer
 * fields, or the judge honestly declining via the `insufficient_context` escape hatch) ALWAYS
 * becomes `{ outcome: 'unavailable', reason }` — never a semantic "no". `passed` is always
 * recomputed from the six parsed booleans in this module's own code; a model-supplied `passed`
 * field, if present in the raw response, is read from nowhere and has no effect.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  VisualProofValidationRequest,
  VisualProofValidationAnswer,
  VisualProofValidationOutcome,
} from './visual-proof-validation.js';
import { loadVisualProofValidationMethodology } from './visual-proof-validation.js';

/**
 * The validator label for this real executor's own results — deliberately distinct from both
 * `VISUAL_PROOF_VALIDATION_VERSION` (the methodology this executor implements, not this executor's
 * own identity) and `VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR` (a different, non-semantic
 * executor). Methodology identity and executor identity are never the same string.
 */
export const VISUAL_PROOF_VALIDATION_LLM_VALIDATOR = 'visual-proof-validation-llm-v1';

/**
 * The injectable dispatch boundary: given a curated prompt string, return the judge's raw response
 * string. Mirrors `AuthorDispatch`'s role for the authoring seam — this module never decides how
 * `dispatch` is fulfilled (an in-session subagent, a file-based request/response protocol, a direct
 * API call, a human reviewer typing an answer). Independently defined; not imported from
 * `authoring-seam.ts`.
 */
export type JudgmentDispatch = (promptText: string) => Promise<string>;

/** The wider executor type a real judgment mechanism satisfies — see the module header for why
 * this is distinct from `VisualProofValidationExecutor`. */
export type VisualProofJudgmentExecutor = (
  request: VisualProofValidationRequest,
) => Promise<VisualProofValidationOutcome>;

export interface RealJudgmentExecutorOptions {
  readonly dispatch: JudgmentDispatch;
  /** When given, a curated request file and an audit-trail trace file are written here per call — mirrors authoring-seam.ts's own "the request file IS the observability artifact" convention, independently implemented. */
  readonly dispatchDir?: string;
  /** Milliseconds to wait for dispatch before treating it as unavailable (reason: 'timeout'). Default 120_000 (2 minutes) — a plausible LLM-call ceiling; injectable for tests. */
  readonly timeoutMs?: number;
}

const REQUIRED_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

function correlationIdFor(request: VisualProofValidationRequest): string {
  return createHash('sha256').update(`${request.belief}|${request.feature}`).digest('hex').slice(0, 12);
}

/** Extracts the "## The six questions" section's body from the loaded methodology document — the
 * question wording is never duplicated as a string literal in this source file. */
function extractSixQuestionsSection(doc: string): string {
  const match = doc.match(/## The six questions\n([\s\S]*?)\n## /);
  return match ? match[1].trim() : doc;
}

/**
 * Builds the curated judgment prompt for one request. Includes only belief/feature/mustInclude/
 * camera/components (never a rendered visual, never website state, never PlanItem) and the six
 * questions' real wording, loaded fresh from the native methodology document. Explicitly frames
 * this as a pre-render concept gate, not a design/authoring/approval task.
 */
export function buildJudgmentPrompt(request: VisualProofValidationRequest): string {
  const questionsText = extractSixQuestionsSection(loadVisualProofValidationMethodology());
  const cameraLine = request.camera
    ? `- camera candidate: ${request.camera}`
    : '- camera candidate: (not provided)';
  const componentsLine =
    request.components && request.components.length > 0
      ? `- authoritative component list: ${request.components.join(' | ')}`
      : '- authoritative component list: (not provided)';
  const environmentLine = request.environment
    ? `- environment: ${request.environment}`
    : '- environment: (not provided)';
  const roleAssignmentLines = request.roles
    ? [
        `- role assignment: hero=${request.roles.hero}`,
        `  support=${request.roles.support.length > 0 ? request.roles.support.join(' | ') : '(none)'}`,
        `  signal=${request.roles.signal.length > 0 ? request.roles.signal.join(' | ') : '(none)'}`,
        `  subordinate context=${request.roles.subordinateContext.length > 0 ? request.roles.subordinateContext.join(' | ') : '(none)'}`,
        `  unassigned (no role)=${request.roles.unassigned.length > 0 ? request.roles.unassigned.join(' | ') : '(none)'}`,
      ]
    : ['- role assignment (hero/support/signal/subordinate context): (not provided)'];

  return [
    'You are answering the Visual Proof Validation pre-render gate for one proposed creative',
    'concept. This is a PRE-RENDER CONCEPT GATE — nothing has been rendered. Do not design the',
    'creative. Do not rewrite the creative. Do not select website sections. Do not choose website',
    'assets. Do not approve the artifact. Do not modify the input. Do not score the Quality Bar.',
    'Do not evaluate pixels or perform post-render review. Answer only the six questions below,',
    'using only the information given.',
    '',
    '## The proposed creative',
    '',
    `- belief: ${request.belief}`,
    `- feature: ${request.feature}`,
    `- mustInclude: ${request.mustInclude.length > 0 ? request.mustInclude.join(' | ') : '(none given)'}`,
    cameraLine,
    componentsLine,
    ...roleAssignmentLines,
    environmentLine,
    '',
    '## The six questions',
    '',
    questionsText,
    '',
    '## Honesty rule — do not invent what is not given',
    '',
    'Evaluate ONLY what is actually present above. You must NEVER invent: role assignments',
    '(hero/support/signal/subordinate), environment, material, surfaces, composition decisions,',
    'hidden information, or any other unstated visual fact.',
    '',
    'Q5 asks whether every element is nameable hero/support/signal/subordinate context. When a role',
    'assignment is given above, it is the already-decided governed assignment for this composition —',
    'evaluate whether it honestly covers every component, do not invent a different assignment of',
    'your own, and do not re-derive one yourself even if you think a different assignment would fit',
    'better. If the given assignment leaves any component in "unassigned (no role)", Q5 is false —',
    'that is the source\'s own remedy ("cut it"), not a reason to decline.',
    'If no role assignment was given above (see "role assignment" line), you cannot honestly',
    'determine role-nameability without inventing one — do not guess — decline Q5 via',
    'insufficient_context (below), with a reason naming Q5 and what is missing.',
    '',
    'Q6 asks whether the composition would still read as a product creative on a flat grey',
    'background — the environment-photo-removal test. "environment" above, when given, is the',
    'selected governed environment identity only — never its framing, mood, or visual weight.',
    'Judge Q6 from what remains once the environment photo is imagined removed: does the',
    'authoritative component list above show real interface structure (data, workflow, live',
    'state), or would only "a card with an icon and some text" be left? Answer this from',
    'environment (when given) and the component list alone.',
    'If you cannot honestly determine from what is given whether real interface structure would',
    'survive the removal, do not guess, and do NOT substitute a different question (e.g. do not',
    'answer Q6 by judging whether the components look functional or realistic in isolation,',
    'unrelated to the environment-removal test) — decline Q6 via insufficient_context (below),',
    'with a reason naming Q6 and what is missing.',
    '',
    '## Rules',
    '',
    '- Use ONLY the information given above. Never invent a camera candidate, a component list, a',
    '  role assignment, or environment/material context that was not provided — if a question',
    '  genuinely cannot be answered honestly without inventing missing context, respond instead',
    '  with exactly:',
    '  {"insufficient_context": true, "reason": "<which question(s), e.g. Q5/Q6, and why>"}',
    '- Otherwise, respond with EXACTLY this JSON shape and nothing else — no prose before or after,',
    '  no markdown code fence:',
    '  {"q1": true|false, "q2": true|false, "q3": true|false, "q4": true|false, "q5": true|false,',
    '   "q6": true|false, "evidence": "<one short auditable line per question>"}',
    '- Do not include a "passed" field — it is derived from your six answers, never taken from you.',
    '- Do not reveal private or hidden chain-of-thought reasoning; "evidence" must be concise and',
    '  auditable only.',
    '',
  ].join('\n');
}

/**
 * Strictly parses and coerces a judge's raw response string into a `VisualProofValidationOutcome`.
 * Never "best-effort" — malformed JSON, a non-object, a missing/non-boolean q1-q6, or missing
 * evidence all become `unavailable` with a specific, machine-readable reason. The judge's own
 * `insufficient_context` escape hatch is recognized explicitly and also becomes `unavailable`,
 * never a semantic "no". Any unexpected EXTRA fields on an otherwise-valid response are tolerated
 * (ignored) — strictness applies to the required shape, not to harmless additional noise.
 */
export function parseJudgmentResponse(raw: string): VisualProofValidationOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { outcome: 'unavailable', reason: 'malformed_response: response is not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { outcome: 'unavailable', reason: 'malformed_response: response is not a JSON object' };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.insufficient_context === true) {
    const reason = typeof obj.reason === 'string' && obj.reason.trim() !== '' ? obj.reason.trim() : 'no reason given';
    return { outcome: 'unavailable', reason: `insufficient_context: ${reason}` };
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) return { outcome: 'unavailable', reason: `missing_answer: ${key}` };
    if (typeof obj[key] !== 'boolean') {
      return { outcome: 'unavailable', reason: `invalid_answer: ${key} is not a boolean` };
    }
  }
  if (typeof obj.evidence !== 'string' || obj.evidence.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: evidence' };
  }

  const q1 = obj.q1 as boolean;
  const q2 = obj.q2 as boolean;
  const q3 = obj.q3 as boolean;
  const q4 = obj.q4 as boolean;
  const q5 = obj.q5 as boolean;
  const q6 = obj.q6 as boolean;
  // passed is ALWAYS recomputed here — obj.passed, if present, is never read.
  const passed = q1 && q2 && q3 && q4 && q5 && q6;
  const answer: VisualProofValidationAnswer = Object.freeze({
    q1,
    q2,
    q3,
    q4,
    q5,
    q6,
    passed,
    evidence: obj.evidence.trim(),
  });
  return { outcome: 'judged', answer };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__vpv_judgment_timeout__')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function writeAuditTrail(
  dispatchDir: string,
  correlationId: string,
  prompt: string,
  outcome: VisualProofValidationOutcome,
  startedAt: string,
  endedAt: string,
): void {
  fs.mkdirSync(dispatchDir, { recursive: true });
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.judgment-request.md`), prompt, 'utf8');
  const trace =
    outcome.outcome === 'judged'
      ? {
          validator: VISUAL_PROOF_VALIDATION_LLM_VALIDATOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'judged',
          q1: outcome.answer.q1,
          q2: outcome.answer.q2,
          q3: outcome.answer.q3,
          q4: outcome.answer.q4,
          q5: outcome.answer.q5,
          q6: outcome.answer.q6,
          passed: outcome.answer.passed,
          evidence: outcome.answer.evidence,
        }
      : {
          validator: VISUAL_PROOF_VALIDATION_LLM_VALIDATOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'unavailable',
          reason: outcome.reason,
        };
  fs.writeFileSync(
    path.join(dispatchDir, `${correlationId}.judgment-trace.json`),
    JSON.stringify(trace, null, 2),
    'utf8',
  );
}

/**
 * Builds a real `VisualProofJudgmentExecutor`: constructs the curated prompt, dispatches it via
 * the injected `dispatch`, awaits (bounded by `timeoutMs`), and strictly parses the response. A
 * dispatch exception or timeout becomes `unavailable` — never `failed`. When `dispatchDir` is
 * given, writes a per-call request file and audit-trail trace file (never hidden reasoning beyond
 * the same `evidence` string the caller already receives).
 */
export function createRealJudgmentExecutor(opts: RealJudgmentExecutorOptions): VisualProofJudgmentExecutor {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return async (request) => {
    const prompt = buildJudgmentPrompt(request);
    const startedAt = new Date().toISOString();
    let outcome: VisualProofValidationOutcome;
    try {
      const raw = await withTimeout(opts.dispatch(prompt), timeoutMs);
      outcome = parseJudgmentResponse(raw);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === '__vpv_judgment_timeout__';
      outcome = isTimeout
        ? { outcome: 'unavailable', reason: 'timeout' }
        : { outcome: 'unavailable', reason: `dispatch_error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const endedAt = new Date().toISOString();
    if (opts.dispatchDir) {
      writeAuditTrail(opts.dispatchDir, correlationIdFor(request), prompt, outcome, startedAt, endedAt);
    }
    return outcome;
  };
}
