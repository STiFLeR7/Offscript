/**
 * Sprint 10R — the real Visual Proof revision executor. Structurally a sibling to
 * `visual-proof-judgment-executor.ts`'s `createRealJudgmentExecutor`: curated request -> injectable
 * `dispatch` -> real reasoning mechanism -> strict structured response -> validated
 * `RevisionOutcome`. Reuses that file's `JudgmentDispatch` boundary type (a plain
 * `(promptText: string) => Promise<string>` function) rather than inventing a second provider
 * abstraction — this module never imports `authoring-seam.ts`, never imports `offscript/src/`, and
 * never creates a shared cross-domain package; the reuse is a single type import between two sibling
 * files inside `creative-generation`.
 *
 * This module is NOT asked "did this pass?" (that is `VisualProofValidationExecutor`'s job,
 * unchanged). It is asked: given a candidate and its failed six-question judgment, what is the
 * smallest legitimate revision — expressed only through `camera`/`components`, the only two fields
 * this package's producers currently populate — that could address the failure? No revision-target
 * enum exists here (see `visual-proof-revision.ts`'s own header for why); the model reasons freely
 * over the prior request + full prior answer and proposes a camera and/or component change, which
 * this module then validates deterministically against the SAME authoritative vocabularies the rest
 * of the package already uses: `selectCamera` for camera membership (no camera value is duplicated
 * as a literal here — `CAMERAS` is not exported from `camera-selection.ts`, and this module is
 * forbidden from touching that file, so it reuses the existing exported function instead of
 * re-declaring the vocabulary) and `componentsForFeature` for component membership.
 *
 * A mechanism failure (dispatch exception, timeout, malformed response, an invented field, an
 * invalid camera, an unsupported component, or the model's own honest "no revision exists") ALWAYS
 * becomes `{ outcome: 'unavailable', reason }` — never a fabricated `revised` candidate. The parser
 * is a strict allow-list: any JSON key outside `status`/`camera`/`components`/`evidence`/`reason`
 * rejects the response outright, which is what catches an invented `role`/`environment`/`material`/
 * `surfaces` field generically, without needing to enumerate the Decision Record's other 18 fields
 * one by one.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RevisionRequest, RevisionOutcome, VisualProofRevisionExecutor } from './visual-proof-revision.js';
import type { VisualProofValidationRequest } from './visual-proof-validation.js';
import { loadVisualProofValidationMethodology } from './visual-proof-validation.js';
import { selectCamera, type Camera } from './camera-selection.js';
import { componentsForFeature } from './feature-mapping.js';
import { isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';
import { validateRoleAssignment, type RoleAssignment } from './role-assignment.js';
import type { JudgmentDispatch } from './visual-proof-judgment-executor.js';

export type { JudgmentDispatch };

/** Distinct from `VISUAL_PROOF_VALIDATION_LLM_VALIDATOR` — a revision executor and a judgment
 * executor are different mechanisms answering different questions; their identities never collide. */
export const VISUAL_PROOF_REVISION_LLM_EXECUTOR = 'visual-proof-revision-llm-v1';

export interface RealRevisionExecutorOptions {
  readonly dispatch: JudgmentDispatch;
  /** When given, a curated request file and an audit-trail trace file are written here per call. */
  readonly dispatchDir?: string;
  /** Milliseconds to wait for dispatch before treating it as unavailable (reason: 'timeout'). */
  readonly timeoutMs?: number;
}

const ALLOWED_RESPONSE_KEYS = new Set(['status', 'camera', 'components', 'environment', 'roles', 'evidence', 'reason']);

function correlationIdFor(request: RevisionRequest): string {
  return createHash('sha256')
    .update(`${request.priorRequest.belief}|${request.priorRequest.feature}|${request.attempt}`)
    .digest('hex')
    .slice(0, 12);
}

/** Extracts the "## The six questions" section's body from the loaded methodology document — the
 * question wording is never duplicated as a string literal in this source file. Independently
 * implemented (not imported) from `visual-proof-judgment-executor.ts`'s own private helper of the
 * same shape, to avoid widening that file's exports for a single reused regex. */
function sixQuestionsText(): string {
  const doc = loadVisualProofValidationMethodology();
  const match = doc.match(/## The six questions\n([\s\S]*?)\n## /);
  return match ? match[1].trim() : doc;
}

/**
 * Builds the curated revision prompt for one `RevisionRequest`. Frames the task as "what is the
 * smallest legitimate revision", never "did this pass" (already answered). States the fixed facts
 * (belief/feature/mustInclude — never proposable), the two currently-revisable fields and their
 * authoritative vocabularies (the five camera values; this feature's authoritative component list),
 * the full prior six-question judgment with evidence, and the attempt number (context only — no
 * retry policy is stated or implied).
 */
export function buildRevisionPrompt(request: RevisionRequest): string {
  const { priorRequest, priorAnswer, attempt } = request;
  const cameraLine = priorRequest.camera
    ? `- current camera: ${priorRequest.camera}`
    : '- current camera: (not set)';
  const componentsLine =
    priorRequest.components && priorRequest.components.length > 0
      ? `- current components: ${priorRequest.components.join(' | ')}`
      : '- current components: (not set)';
  const authoritativeComponents = componentsForFeature(priorRequest.feature);
  const authoritativeComponentsLine =
    authoritativeComponents.length > 0 ? authoritativeComponents.join(' | ') : '(none documented for this feature)';
  const qLine = (label: string, value: boolean) => `- ${label}: ${value ? 'PASSED' : 'FAILED'}`;

  // Sprint 10AE — environment is offered as a third revisable field ONLY when the request carries
  // its own eligible-candidate set (the same set the original selection used, never recomputed
  // here). Absent that set, environment is not offered at all — fail closed, never fall back to
  // the global seven-value vocabulary as if it were the eligible one.
  const hasEligibleEnvironments = request.eligibleCandidates !== undefined && request.eligibleCandidates.length > 0;
  const environmentLine = priorRequest.environment
    ? `- current environment: ${priorRequest.environment}`
    : '- current environment: (not set)';
  const environmentFieldLines = hasEligibleEnvironments
    ? [
        '- environment — exactly one of these eligible candidates for this creative (never any other',
        `  governed environment value, even a real one): ${request.eligibleCandidates!.join(' | ')}`,
      ]
    : [];

  // Sprint 10AG — roles is offered as a fourth revisable field ONLY when the prior request carries
  // components to partition (validated directly against `priorRequest.components` — no separate
  // eligibility set is needed, unlike environment). Absent components, roles is not offered at all.
  const hasComponentsForRoles = priorRequest.components !== undefined && priorRequest.components.length > 0;
  const currentRolesLine = priorRequest.roles
    ? `- current role assignment: hero=${priorRequest.roles.hero}`
    : '- current role assignment: (not set)';
  const rolesFieldLines = hasComponentsForRoles
    ? [
        '- roles — a COMPLETE partition of every component currently on this candidate',
        `  (${priorRequest.components!.join(' | ')}) into exactly one of:`,
        '  hero (the dominant product object/state, exactly one), support (what reinforces it),',
        '  signal (the live detail), subordinateContext (present but secondary), unassigned',
        '  (genuinely no role — decoration). Every one of those components must appear in exactly',
        '  one bucket.',
      ]
    : [];

  return [
    'You are answering the Visual Proof Validation REVISION step for one proposed creative concept',
    'that has already been judged by the six-question gate and did not fully pass. You are NOT being asked "did this pass?" — that judgment already happened, below. You are being asked: given this',
    'candidate and its failed question(s), what is the smallest legitimate revision to the candidate',
    'that could address those failures? This is still a PRE-RENDER CONCEPT GATE — nothing has been',
    'rendered. Do not render anything. Do not approve anything. belief, feature, and mustInclude are',
    'fixed facts about this concept, never revision targets — do not propose changing them.',
    '',
    `## Revision attempt ${attempt}`,
    '',
    '## The candidate as judged',
    '',
    `- belief: ${priorRequest.belief}`,
    `- feature: ${priorRequest.feature}`,
    `- mustInclude: ${priorRequest.mustInclude.length > 0 ? priorRequest.mustInclude.join(' | ') : '(none given)'}`,
    cameraLine,
    componentsLine,
    environmentLine,
    currentRolesLine,
    '',
    '## The prior judgment',
    '',
    qLine('Q1', priorAnswer.q1),
    qLine('Q2', priorAnswer.q2),
    qLine('Q3', priorAnswer.q3),
    qLine('Q4', priorAnswer.q4),
    qLine('Q5', priorAnswer.q5),
    qLine('Q6', priorAnswer.q6),
    `- prior evidence: ${priorAnswer.evidence}`,
    '',
    '## The six questions (for reference)',
    '',
    sixQuestionsText(),
    '',
    '## What you may change',
    '',
    'The following fields on this candidate are currently revisable (never more than these):',
    '',
    '- camera — exactly one of: establishing | product | workflow | component | macro',
    "- components — a subset (any size, any order) of this feature's authoritative component list:",
    `  ${authoritativeComponentsLine}`,
    ...environmentFieldLines,
    ...rolesFieldLines,
    '',
    '## Rules — read carefully',
    '',
    '1. You may propose a new camera, a new component list, a new environment, a new role',
    '   assignment, any combination, or none at all — limited to only the fields listed above.',
    '2. belief, feature, and mustInclude are fixed facts — never propose changing them, and do not',
    '   repeat them in your response; they are preserved automatically.',
    '3. Never invent material, surfaces, composition values (hierarchy, density, rhythm, breathing,',
    '   dominant/supporting), focal scale, or any other unstated visual fact. Those are not',
    '   currently revisable fields — never propose them, not even as a JSON field name in your',
    '   response.',
    '4. A proposed camera MUST be exactly one of the five values listed above — no other value will be',
    '   accepted.',
    '5. A proposed component MUST be exactly one of the authoritative components listed above for this',
    '   feature — never invent a new component name.',
    ...(hasEligibleEnvironments
      ? [
          '5a. A proposed environment MUST be exactly one of the eligible candidates listed above — never',
          '    a different governed environment value, even a real one, and never a value outside the',
          '    governed vocabulary at all. Do not reconsider or re-derive eligibility yourself; the list',
          '    above is already final.',
        ]
      : [
          '5a. Environment is NOT currently revisable for this candidate (no eligible candidate set was',
          '    supplied) — never propose an "environment" field.',
        ]),
    ...(hasComponentsForRoles
      ? [
          '5b. A proposed roles object MUST assign EVERY component currently on this candidate to',
          '    exactly one of hero/support/signal/subordinateContext/unassigned — hero must be exactly',
          '    one of those components, never invented. An honest, non-empty "unassigned" is a valid',
          '    proposal, not a failure.',
        ]
      : [
          '5b. Role assignment is NOT currently revisable for this candidate (no components are set) —',
          '    never propose a "roles" field.',
        ]),
    '6. If no honest, currently-representable revision addresses the failed question(s) — for example',
    '   the failure is about the underlying claim, the copy, or something outside these revisable',
    '   fields entirely — say so honestly. Do not force a change that would not actually address the',
    '   failure.',
    '7. Do not render anything. Do not approve anything. Do not modify the creative intent.',
    '',
    '## Response format — return ONLY this JSON and nothing else (no prose, no markdown fence)',
    '',
    'If a legitimate revision exists:',
    '  {"status": "revised", "camera": "<one of the five values, only if changing it>",',
    '   "components": ["<authoritative component>", "..."] (only if changing them),',
    ...(hasEligibleEnvironments
      ? ['   "environment": "<one of the eligible candidates listed above, only if changing it>",']
      : []),
    ...(hasComponentsForRoles
      ? [
          '   "roles": {"hero": "<component>", "support": ["<component>", "..."],',
          '    "signal": ["<component>", "..."], "subordinateContext": ["<component>", "..."],',
          '    "unassigned": ["<component>", "..."]} (only if changing it, must fully partition the',
          '    components listed above),',
        ]
      : []),
    '   "evidence": "<one short auditable line explaining why this revision addresses the failure>"}',
    '',
    'If no honest revision can be expressed with the fields above:',
    '  {"status": "unavailable", "reason": "<why no legitimate revision exists>"}',
    '',
    'Include ONLY the fields shown above. Do not include any other field name.',
    '',
  ].join('\n');
}

/**
 * Strictly parses and validates a revision model's raw response string into a `RevisionOutcome`.
 * Never best-effort: any key outside the allow-list, an invalid `status`, a missing `reason` on
 * `unavailable`, an empty `revised` (neither camera nor components proposed), a non-vocabulary
 * camera, or a non-authoritative component all become `unavailable` with a specific, machine-readable
 * reason. On a valid `revised` response, reconstructs a COMPLETE `VisualProofValidationRequest` by
 * spreading `priorRequest` and overriding only the field(s) the model actually proposed — the model
 * never needs to repeat unchanged fields, and belief/feature/mustInclude can never be altered because
 * they are not in the allow-list at all.
 */
export function parseRevisionResponse(raw: string, request: RevisionRequest): RevisionOutcome {
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

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_RESPONSE_KEYS.has(key)) {
      return { outcome: 'unavailable', reason: `invented_field: response includes unsupported field "${key}"` };
    }
  }

  if (obj.status !== 'revised' && obj.status !== 'unavailable') {
    return { outcome: 'unavailable', reason: 'invalid_status: "status" must be "revised" or "unavailable"' };
  }

  if (obj.status === 'unavailable') {
    const reason = typeof obj.reason === 'string' ? obj.reason.trim() : '';
    if (!reason) {
      return { outcome: 'unavailable', reason: 'missing_reason: unavailable response must include a non-empty "reason"' };
    }
    return { outcome: 'unavailable', reason };
  }

  // status === 'revised'
  const hasCamera = 'camera' in obj;
  const hasComponents = 'components' in obj;
  const hasEnvironment = 'environment' in obj;
  const hasRoles = 'roles' in obj;
  if (!hasCamera && !hasComponents && !hasEnvironment && !hasRoles) {
    return {
      outcome: 'unavailable',
      reason: 'empty_revision: revised status proposed no camera, component, environment, or role change',
    };
  }
  if (typeof obj.evidence !== 'string' || obj.evidence.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: evidence' };
  }

  let camera: Camera | undefined;
  if (hasCamera) {
    if (typeof obj.camera !== 'string') {
      return { outcome: 'unavailable', reason: 'invalid_camera: camera must be a string' };
    }
    const selection = selectCamera({ camera: obj.camera });
    if (!selection.declared) {
      return { outcome: 'unavailable', reason: `invalid_camera: "${obj.camera}" is not a recognized camera value` };
    }
    camera = selection.declared;
  }

  let components: readonly string[] | undefined;
  if (hasComponents) {
    if (!Array.isArray(obj.components) || obj.components.some((c) => typeof c !== 'string')) {
      return { outcome: 'unavailable', reason: 'invalid_components: components must be an array of strings' };
    }
    const authoritative = new Set(componentsForFeature(request.priorRequest.feature));
    for (const c of obj.components as string[]) {
      if (!authoritative.has(c)) {
        return {
          outcome: 'unavailable',
          reason: `unsupported_component: "${c}" is not in the authoritative component list for feature "${request.priorRequest.feature}"`,
        };
      }
    }
    components = Object.freeze([...(obj.components as string[])]);
  }

  // Sprint 10AE — a proposed environment MUST be BOTH a real governed EnvironmentSlug AND a member
  // of THIS request's own eligibleCandidates (never the global seven-value vocabulary alone, and
  // never re-derived — the eligibility filter is never re-run here, only the request's known,
  // already-computed set is consulted). Fails closed when eligibleCandidates is absent entirely.
  let environment: EnvironmentSlug | undefined;
  if (hasEnvironment) {
    if (typeof obj.environment !== 'string') {
      return { outcome: 'unavailable', reason: 'invalid_environment: environment must be a string' };
    }
    if (!isEnvironmentSlug(obj.environment)) {
      return {
        outcome: 'unavailable',
        reason: `invalid_environment: "${obj.environment}" is not a recognized EnvironmentSlug`,
      };
    }
    const eligible = request.eligibleCandidates ?? [];
    if (!eligible.includes(obj.environment)) {
      return {
        outcome: 'unavailable',
        reason: `invalid_environment: "${obj.environment}" is not in the eligible candidate set for this revision`,
      };
    }
    environment = obj.environment;
  }

  // Sprint 10AG — a proposed roles object MUST fully and validly partition the components
  // currently on THIS request's prior candidate (never a separately-computed eligibility set —
  // roles validation is always directly against `priorRequest.components`). Fails closed when
  // `priorRequest.components` is absent or empty entirely; reuses `validateRoleAssignment` rather
  // than re-implementing partition validation here.
  let roles: RoleAssignment | undefined;
  if (hasRoles) {
    const rolesObj = obj.roles;
    if (typeof rolesObj !== 'object' || rolesObj === null || Array.isArray(rolesObj)) {
      return { outcome: 'unavailable', reason: 'invalid_role: roles must be an object' };
    }
    const priorComponents = request.priorRequest.components ?? [];
    if (priorComponents.length === 0) {
      return { outcome: 'unavailable', reason: 'invalid_role: no components on this candidate to assign roles over' };
    }
    const r = rolesObj as Record<string, unknown>;
    const asArray = (value: unknown): readonly string[] | null =>
      value === undefined ? [] : Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;
    const support = asArray(r.support);
    const signal = asArray(r.signal);
    const subordinateContext = asArray(r.subordinateContext);
    const unassigned = asArray(r.unassigned);
    if (typeof r.hero !== 'string' || support === null || signal === null || subordinateContext === null || unassigned === null) {
      return { outcome: 'unavailable', reason: 'invalid_role: roles fields must be hero (string) and support/signal/subordinateContext/unassigned (string arrays)' };
    }
    const validated = validateRoleAssignment(
      { hero: r.hero, support, signal, subordinateContext, unassigned },
      priorComponents,
      obj.evidence.trim(),
    );
    if (validated.outcome === 'unavailable') return validated;
    roles = validated.roles;
  }

  const candidate: VisualProofValidationRequest = Object.freeze({
    ...request.priorRequest,
    ...(hasCamera ? { camera } : {}),
    ...(hasComponents ? { components } : {}),
    ...(hasEnvironment ? { environment } : {}),
    ...(hasRoles ? { roles } : {}),
  });

  return { outcome: 'revised', candidate, rationale: obj.evidence.trim() };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__vpv_revision_timeout__')), ms);
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
  request: RevisionRequest,
  outcome: RevisionOutcome,
  startedAt: string,
  endedAt: string,
): void {
  fs.mkdirSync(dispatchDir, { recursive: true });
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.revision-request.md`), prompt, 'utf8');
  const base = {
    executor: VISUAL_PROOF_REVISION_LLM_EXECUTOR,
    correlationId,
    attempt: request.attempt,
    startedAt,
    endedAt,
    priorQ1: request.priorAnswer.q1,
    priorQ2: request.priorAnswer.q2,
    priorQ3: request.priorAnswer.q3,
    priorQ4: request.priorAnswer.q4,
    priorQ5: request.priorAnswer.q5,
    priorQ6: request.priorAnswer.q6,
    priorEvidence: request.priorAnswer.evidence,
  };
  const trace =
    outcome.outcome === 'revised'
      ? {
          ...base,
          outcome: 'revised',
          revisedCamera: outcome.candidate.camera ?? null,
          revisedComponents: outcome.candidate.components ?? null,
          revisedEnvironment: outcome.candidate.environment ?? null,
          revisedRoles: outcome.candidate.roles ?? null,
          rationale: outcome.rationale,
        }
      : { ...base, outcome: 'unavailable', reason: outcome.reason };
  fs.writeFileSync(
    path.join(dispatchDir, `${correlationId}.revision-trace.json`),
    JSON.stringify(trace, null, 2),
    'utf8',
  );
}

/**
 * Builds a real `VisualProofRevisionExecutor`: constructs the curated prompt, dispatches it via the
 * injected `dispatch`, awaits (bounded by `timeoutMs`), and strictly parses the response. A dispatch
 * exception or timeout becomes `unavailable` — never a fabricated `revised` candidate. Performs
 * exactly ONE revision decision per invocation — no loop, no retry, no maximum attempt count.
 */
export function createRealRevisionExecutor(opts: RealRevisionExecutorOptions): VisualProofRevisionExecutor {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return async (request) => {
    const prompt = buildRevisionPrompt(request);
    const startedAt = new Date().toISOString();
    let outcome: RevisionOutcome;
    try {
      const raw = await withTimeout(opts.dispatch(prompt), timeoutMs);
      outcome = parseRevisionResponse(raw, request);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === '__vpv_revision_timeout__';
      outcome = isTimeout
        ? { outcome: 'unavailable', reason: 'timeout' }
        : { outcome: 'unavailable', reason: `dispatch_error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const endedAt = new Date().toISOString();
    if (opts.dispatchDir) {
      writeAuditTrail(opts.dispatchDir, correlationIdFor(request), prompt, request, outcome, startedAt, endedAt);
    }
    return outcome;
  };
}
