/**
 * Sprint 10AG — the Role Assignment contract, scripted stub, prompt builder, strict parser, and
 * real executor, in one file — mirroring `environment-selection.ts`'s own consolidated shape
 * (Sprint 10AD/10AE). Answers a single semantic question — "given this belief/feature/mustInclude
 * and this creative's authoritative component list, which of hero / support / signal / subordinate
 * context does each component earn?" — never Visual Proof Q5's own binary pass/fail judgment
 * (`VisualProofValidationExecutor`, unchanged) and never a remediation of a failed judgment
 * (`VisualProofRevisionExecutor`, unchanged): this is upstream candidate-state derivation, the same
 * category as Environment Selection, not a sibling of either judgment or revision.
 *
 * Source (`HANDOFF-v3-composition-laws.md` PART II §C1/§A1): `roles= hero:<the dominant product
 * object/state> · support:<what reinforces it> · signal:<the live detail>`, plus an implicit fourth
 * category named only in Q5's own wording, `subordinate context` — "1 HERO · 2 SUPPORT · 3 SIGNAL —
 * assign every element a role before composing. If an element can't be named hero, support, signal
 * or subordinate context, it doesn't belong." Populating this vocabulary for a specific composition
 * is explicitly belief-semantic judgment (`VISUAL-PROOF-VALIDATION.md`'s own "Decision Record — v3
 * additions" section), never a deterministic function of component names alone — confirmed this
 * sprint by tracing the three real `example-brand-apa` creatives (see
 * VISUAL-PROOF-Q5-ROLE-RESOLUTION-REPORT.md §3/§6): only one of three had an unambiguous single hero
 * candidate (mustInclude directly named it); the other two had multiple equally-plausible candidates
 * with no deterministic tiebreaker the source states.
 *
 * This module performs NO semantic assignment on its own. `createScriptedRoleAssignmentExecutor`
 * requires the caller to supply the entire `RoleAssignmentOutcome` up front and returns it verbatim
 * for every request — it never inspects `belief`/`feature`/`mustInclude`/`components` to decide
 * anything, exactly mirroring `createScriptedEnvironmentSelectionExecutor`'s own "caller supplies the
 * answer" discipline.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The request contract. `components` is Feature Mapping's own authoritative list for this
 * creative's feature — this module never invents, trims, or reorders it; every role assignment is
 * validated against exactly this list. */
export interface RoleAssignmentRequest {
  readonly belief: string;
  readonly feature: string;
  readonly mustInclude: readonly string[];
  readonly components: readonly string[];
}

/**
 * A complete role partition of `components`: every component appears in EXACTLY ONE of the five
 * buckets below — `hero` (exactly one component, "the dominant product object/state"), `support`
 * ("what reinforces it"), `signal` ("the live detail"), `subordinateContext` (present, legitimate,
 * but not hero/support/signal — the implicit fourth category Q5's own wording names), and
 * `unassigned` (components that genuinely cannot be honestly named under any of the first four —
 * the source's own "decoration — cut it" case, a real semantic finding, never a mechanism failure).
 * `validateRoleAssignment` enforces the partition; nothing in this module computes `unassigned` by
 * subtraction — the assigning mechanism (scripted caller or real judge) states it explicitly, so a
 * missing component is caught as an error, never silently inferred.
 */
export interface RoleAssignment {
  readonly hero: string;
  readonly support: readonly string[];
  readonly signal: readonly string[];
  readonly subordinateContext: readonly string[];
  readonly unassigned: readonly string[];
}

/** The assigned/unavailable idiom (mirroring `EnvironmentSelectionOutcome`'s selected/unavailable
 * shape) — `'assigned'` is a genuine, validated, complete role partition (which may legitimately
 * carry a non-empty `unassigned`); `'unavailable'` is reserved for a MECHANISM failure (dispatch
 * error, timeout, malformed response, an invented component, an incomplete partition) — never used
 * to represent "this composition has decoration," which is a real, honest `'assigned'` result. */
export type RoleAssignmentOutcome =
  | { readonly outcome: 'assigned'; readonly roles: RoleAssignment; readonly evidence: string }
  | { readonly outcome: 'unavailable'; readonly reason: string };

/** The extension point a future real executor implements. */
export type RoleAssignmentExecutor = (request: RoleAssignmentRequest) => Promise<RoleAssignmentOutcome>;

/** The injectable dispatch boundary. Independently declared, never imported from
 * `visual-proof-judgment-executor.ts`'s `JudgmentDispatch` or `environment-selection.ts`'s
 * `EnvironmentSelectionDispatch` — the same "sibling reimplementation, never a shared type"
 * precedent every judgment-shaped module in this package already follows. */
export type RoleAssignmentDispatch = (promptText: string) => Promise<string>;

interface RoleAssignmentCandidate {
  readonly hero: string;
  readonly support: readonly string[];
  readonly signal: readonly string[];
  readonly subordinateContext: readonly string[];
  readonly unassigned: readonly string[];
}

/**
 * The central rule: every component in `components` must appear in EXACTLY ONE of the five buckets
 * (hero counts as its own singleton bucket) — no invented component, no duplicate across buckets, no
 * component left out entirely. `hero` must additionally be a non-empty string. Never silently
 * computes or repairs a partition; every violation is `unavailable` with a specific, machine-readable
 * reason.
 */
export function validateRoleAssignment(
  candidate: RoleAssignmentCandidate,
  components: readonly string[],
  evidence: string,
): RoleAssignmentOutcome {
  const componentSet = new Set(components);
  if (typeof candidate.hero !== 'string' || candidate.hero.trim() === '') {
    return { outcome: 'unavailable', reason: 'invalid_role: hero must be a non-empty string' };
  }
  if (!componentSet.has(candidate.hero)) {
    return { outcome: 'unavailable', reason: `invalid_role: hero "${candidate.hero}" is not in the component list` };
  }

  const seen = new Set<string>([candidate.hero]);
  const buckets: readonly (readonly [string, readonly string[]])[] = [
    ['support', candidate.support],
    ['signal', candidate.signal],
    ['subordinateContext', candidate.subordinateContext],
    ['unassigned', candidate.unassigned],
  ];
  for (const [bucketName, values] of buckets) {
    for (const value of values) {
      if (!componentSet.has(value)) {
        return {
          outcome: 'unavailable',
          reason: `invalid_role: ${bucketName} entry "${value}" is not in the component list`,
        };
      }
      if (seen.has(value)) {
        return {
          outcome: 'unavailable',
          reason: `invalid_role: "${value}" appears in more than one role bucket`,
        };
      }
      seen.add(value);
    }
  }

  if (seen.size !== componentSet.size) {
    const missing = components.filter((c) => !seen.has(c));
    return {
      outcome: 'unavailable',
      reason: `incomplete_role_assignment: component(s) not accounted for in any bucket: ${missing.join(', ')}`,
    };
  }

  return {
    outcome: 'assigned',
    roles: {
      hero: candidate.hero,
      support: Object.freeze([...candidate.support]),
      signal: Object.freeze([...candidate.signal]),
      subordinateContext: Object.freeze([...candidate.subordinateContext]),
      unassigned: Object.freeze([...candidate.unassigned]),
    },
    evidence,
  };
}

/**
 * Returns a `RoleAssignmentExecutor` that always resolves with the given, caller-supplied outcome —
 * regardless of the request it is called with. This is the SCRIPTED STUB: it proves the
 * `RoleAssignmentRequest -> executor -> RoleAssignmentOutcome` contract end to end for tests and
 * plumbing experiments, and performs no reasoning or validation over request content whatsoever —
 * not even the coverage check `validateRoleAssignment` implements. A caller that pre-configures an
 * incomplete/invalid outcome gets that outcome back verbatim; enforcing validity is a real
 * executor's job, never this stub's.
 */
export function createScriptedRoleAssignmentExecutor(outcome: RoleAssignmentOutcome): RoleAssignmentExecutor {
  return async () => outcome;
}

/**
 * Builds the curated prompt for a real executor. Includes only belief/feature/mustInclude/
 * components (never camera, never environment/material — no documented relationship to role
 * assignment exists in the source) and the source's own role-meaning quotes. Explicitly instructs:
 * assign EVERY component to exactly one bucket, hero must be exactly one component, never invent a
 * component name, an honest `unassigned` entry is a legitimate answer (not a failure), structured
 * JSON only.
 */
export function buildRoleAssignmentPrompt(request: RoleAssignmentRequest): string {
  const mustIncludeLine =
    request.mustInclude.length > 0 ? request.mustInclude.join(' | ') : '(none given)';
  const componentsText = request.components.map((c) => `- ${c}`).join('\n');

  return [
    'You are answering the Role Assignment question for one proposed creative concept. This is a',
    'semantic per-element role classification over an already-decided, closed list of components —',
    'nothing else. Do not design the creative. Do not choose camera or environment. Do not judge',
    'whether the creative passes any gate.',
    '',
    '## The proposed creative',
    '',
    `- belief: ${request.belief}`,
    `- feature: ${request.feature}`,
    `- mustInclude: ${mustIncludeLine}`,
    '',
    '## The components — assign EVERY one of these to exactly one role, and ONLY these',
    '',
    'This is the authoritative, already-decided component list for this creative. Do not add, drop,',
    'rename, or reorder any component.',
    '',
    componentsText,
    '',
    '## The four roles — quoted from source',
    '',
    '- hero: "the dominant product object/state" — exactly ONE component, the single element the',
    '  belief is most directly about.',
    '- support: "what reinforces it" — components that back up or structurally support the hero.',
    '- signal: "the live detail" — components that show live, dynamic, or momentary state.',
    '- subordinate context: present and legitimate, but not hero/support/signal — a real,',
    '  non-decorative element that plays a secondary role.',
    '- unassigned: a component that genuinely cannot be honestly named under any of the above —',
    '  decoration. Reporting an honest unassigned component is a correct, useful answer, not a failure',
    '  — do not force a role onto something that does not earn one.',
    '',
    '## Rules',
    '',
    '- Every component listed above MUST appear in EXACTLY ONE of: hero, support, signal,',
    '  subordinateContext, unassigned. Do not leave any component out. Do not put the same',
    '  component in more than one bucket.',
    '- hero MUST be exactly one component from the list above — never invent a component name,',
    '  never leave hero empty.',
    '- Never invent a component that is not in the list above, in any bucket.',
    '- If no honest assignment can be made at all (e.g. the belief/feature give no basis to judge',
    '  any component), respond instead with exactly:',
    '  {"status": "unavailable", "reason": "<why>"}',
    '- Otherwise, respond with EXACTLY this JSON shape and nothing else — no prose before or after,',
    '  no markdown code fence:',
    '  {"status": "assigned", "hero": "<one component>", "support": ["<component>", "..."],',
    '   "signal": ["<component>", "..."], "subordinateContext": ["<component>", "..."],',
    '   "unassigned": ["<component>", "..."], "evidence": "<one short auditable line>"}',
    '  (support/signal/subordinateContext/unassigned may be empty arrays, but must be present.)',
    '- Do not include any field beyond status/hero/support/signal/subordinateContext/unassigned/',
    '  evidence/reason.',
    '',
  ].join('\n');
}

const ALLOWED_RESPONSE_KEYS = new Set([
  'status',
  'hero',
  'support',
  'signal',
  'subordinateContext',
  'unassigned',
  'evidence',
  'reason',
]);

function asStringArray(value: unknown, field: string): readonly string[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    return { error: `invalid_role: ${field} must be an array of strings` };
  }
  return value as string[];
}

/**
 * Strictly parses and validates a real executor's raw response string. Never best-effort: malformed
 * JSON, a non-object, an unrecognized status, a missing/invalid field, or any response key outside
 * the allowed set all become `unavailable` with a specific, machine-readable reason. A `"assigned"`
 * response is always routed through `validateRoleAssignment` — the model's own bucket contents are
 * never trusted as a valid partition on their own.
 */
export function parseRoleAssignmentResponse(
  raw: string,
  components: readonly string[],
): RoleAssignmentOutcome {
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
      return { outcome: 'unavailable', reason: `invented_field: "${key}" is not a recognized response field` };
    }
  }

  if (obj.status === 'unavailable') {
    const reason = typeof obj.reason === 'string' && obj.reason.trim() !== '' ? obj.reason.trim() : 'no reason given';
    return { outcome: 'unavailable', reason };
  }
  if (obj.status !== 'assigned') {
    return { outcome: 'unavailable', reason: 'invalid_status: status must be "assigned" or "unavailable"' };
  }
  if (typeof obj.hero !== 'string' || obj.hero.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: hero' };
  }
  if (typeof obj.evidence !== 'string' || obj.evidence.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: evidence' };
  }

  const support = asStringArray(obj.support, 'support');
  if ('error' in support) return { outcome: 'unavailable', reason: support.error };
  const signal = asStringArray(obj.signal, 'signal');
  if ('error' in signal) return { outcome: 'unavailable', reason: signal.error };
  const subordinateContext = asStringArray(obj.subordinateContext, 'subordinateContext');
  if ('error' in subordinateContext) return { outcome: 'unavailable', reason: subordinateContext.error };
  const unassigned = asStringArray(obj.unassigned, 'unassigned');
  if ('error' in unassigned) return { outcome: 'unavailable', reason: unassigned.error };

  return validateRoleAssignment(
    { hero: obj.hero, support, signal, subordinateContext, unassigned },
    components,
    obj.evidence.trim(),
  );
}

/**
 * Sprint 10AG — the real Role Assignment executor. Structurally a sibling to
 * `createRealEnvironmentSelectionExecutor`: curated prompt -> injected `dispatch` -> strict parsing
 * -> assigned/unavailable. Own executor, own prompt builder, own strict parser — never imports
 * `VisualProofValidationExecutor`/`VisualProofRevisionExecutor`, never introduces a second generic
 * model/provider abstraction.
 */
export const ROLE_ASSIGNMENT_LLM_EXECUTOR = 'role-assignment-llm-v1';

export interface RealRoleAssignmentExecutorOptions {
  readonly dispatch: RoleAssignmentDispatch;
  /** When given, a curated request file and an audit-trail trace file are written here per call. */
  readonly dispatchDir?: string;
  /** Milliseconds to wait for dispatch before treating it as unavailable (reason: 'timeout'). */
  readonly timeoutMs?: number;
}

function correlationIdFor(request: RoleAssignmentRequest): string {
  return createHash('sha256')
    .update(`${request.belief}|${request.components.join(',')}`)
    .digest('hex')
    .slice(0, 12);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__role_assignment_timeout__')), ms);
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
  outcome: RoleAssignmentOutcome,
  startedAt: string,
  endedAt: string,
): void {
  fs.mkdirSync(dispatchDir, { recursive: true });
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.role-request.md`), prompt, 'utf8');
  const trace =
    outcome.outcome === 'assigned'
      ? {
          executor: ROLE_ASSIGNMENT_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'assigned',
          hero: outcome.roles.hero,
          support: outcome.roles.support,
          signal: outcome.roles.signal,
          subordinateContext: outcome.roles.subordinateContext,
          unassigned: outcome.roles.unassigned,
          evidence: outcome.evidence,
        }
      : {
          executor: ROLE_ASSIGNMENT_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'unavailable',
          reason: outcome.reason,
        };
  fs.writeFileSync(
    path.join(dispatchDir, `${correlationId}.role-trace.json`),
    JSON.stringify(trace, null, 2),
    'utf8',
  );
}

/**
 * Builds a real `RoleAssignmentExecutor`. When `request.components` is empty, resolves
 * `unavailable` (reason: `no_components`) WITHOUT ever building a prompt or calling `dispatch` —
 * asking a model to assign roles over nothing is a precondition failure, not a genuine judgment
 * question, mirroring `createRealEnvironmentSelectionExecutor`'s own `no_eligible_candidates`
 * short-circuit. Otherwise: builds the curated prompt, dispatches it via the injected `dispatch`
 * (bounded by `timeoutMs`), and strictly parses the response. A dispatch exception or timeout
 * becomes `unavailable` — never a fabricated assignment.
 */
export function createRealRoleAssignmentExecutor(
  opts: RealRoleAssignmentExecutorOptions,
): RoleAssignmentExecutor {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return async (request) => {
    if (request.components.length === 0) {
      return { outcome: 'unavailable', reason: 'no_components' };
    }
    const prompt = buildRoleAssignmentPrompt(request);
    const startedAt = new Date().toISOString();
    let outcome: RoleAssignmentOutcome;
    try {
      const raw = await withTimeout(opts.dispatch(prompt), timeoutMs);
      outcome = parseRoleAssignmentResponse(raw, request.components);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === '__role_assignment_timeout__';
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
