/**
 * Sprint 10AD — the Environment Selection contract (Sprint 10AC's own design), a deterministic
 * scripted stub, and the future real executor's unwired toolkit (prompt builder + strict parser).
 * Answers a single semantic question — "which of these already-eligible environments best fits
 * this belief?" — never the deterministic "which environments are eligible at all" question
 * (`environment-selection-eligibility.ts`, Sprint 10AB, unmodified, imported only for its type).
 *
 * This module performs NO semantic selection. `createScriptedEnvironmentSelectionExecutor`
 * requires the caller to supply the entire `EnvironmentSelectionOutcome` up front and returns it
 * verbatim for every request — it never inspects `belief`/`feature`/`camera`/`eligibleCandidates`
 * to decide anything, exactly mirroring `createScriptedRevisionExecutor`'s own "caller supplies the
 * answer" discipline (`visual-proof-revision.ts`, Sprint 10Q). A real executor — an LLM or another
 * reasoning mechanism, structurally parallel to `createRealJudgmentExecutor`
 * (`visual-proof-judgment-executor.ts`, Sprint 10K) — is NOT implemented here; no `dispatch`
 * function is declared as a concrete import or invoked anywhere in this module. `buildEnvironment
 * SelectionPrompt`/`parseEnvironmentSelectionResponse` are pure, independently testable functions a
 * future sprint composes with a real dispatch — that composition step itself is deferred.
 *
 * Deliberately excluded from the request contract, per Sprint 10AC's own design (§3, §10):
 * `lastEnvironment` / recent-log history (already fully resolved upstream by the deterministic
 * eligibility filter — passing it here would let the selector re-litigate HANDOFF-v2.md's own
 * unresolved "vary from recent log" contradiction, Sprint 10AA §8/§9), `ratio` (every candidate in
 * `eligibleCandidates` is already ratio-legal by construction — restating it conveys no new
 * decision-relevant information), `material`/`color`/`composition`/`benchmark` (confirmed, repeatedly,
 * zero documented relationship to environment selection).
 *
 * `feature` is included as an OPTIONAL field, resolving Sprint 10AC §18's own open question: it has
 * no documented selection rule (unlike belief), but costs nothing as inert prompt context and Sprint
 * 10AC §14's own prompt design already included it on that basis.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Camera } from './camera-selection.js';
import { isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';

/**
 * The request contract. `eligibleCandidates` is Sprint 10AB's `getEligibleEnvironments()` output,
 * passed through unchanged — this module never recomputes or second-guesses eligibility.
 */
export interface EnvironmentSelectionRequest {
  readonly belief: string;
  readonly feature?: string;
  readonly camera?: Camera;
  readonly eligibleCandidates: readonly EnvironmentSlug[];
}

/**
 * The selected/unavailable idiom (mirroring `VisualProofValidationOutcome`/`RevisionOutcome`'s own
 * judged/unavailable shape) — never a `revised` variant (this is an initial pick, not a revision of
 * a prior one). No `passed`/`score`/`confidence`/`weights`/ranking field — no source methodology
 * supports any of them for this decision (Sprint 10AC §8).
 */
export type EnvironmentSelectionOutcome =
  | { readonly outcome: 'selected'; readonly environment: EnvironmentSlug; readonly evidence: string }
  | { readonly outcome: 'unavailable'; readonly reason: string };

/** The extension point a future real executor (LLM or another reasoning mechanism) would implement. */
export type EnvironmentSelectionExecutor = (
  request: EnvironmentSelectionRequest,
) => Promise<EnvironmentSelectionOutcome>;

/**
 * The injectable dispatch boundary a future real executor would use — declared now so the next
 * sprint has an interface to compose against, never invoked anywhere in this module (Sprint 10AC's
 * own "Sprint 1" scope: contract + prompt builder + strict parser + scripted stub, no real dispatch).
 * Independently declared, never imported from `visual-proof-judgment-executor.ts`'s own
 * `JudgmentDispatch` — the same "sibling reimplementation, never a shared type" precedent that
 * module's own header already establishes for itself relative to `authoring-seam.ts`.
 */
export type EnvironmentSelectionDispatch = (promptText: string) => Promise<string>;

/**
 * The central rule (Sprint 10AC §8): a selected slug must be BOTH a real governed EnvironmentSlug
 * AND a member of THIS request's own eligible-candidate set — global validity alone is
 * insufficient. Never silently substitutes a different candidate; every rejection is `unavailable`
 * with a specific, machine-readable reason.
 */
export function validateSelectedEnvironment(
  selected: string,
  eligibleCandidates: readonly EnvironmentSlug[],
  evidence: string,
): EnvironmentSelectionOutcome {
  if (!isEnvironmentSlug(selected)) {
    return { outcome: 'unavailable', reason: `invalid_environment: "${selected}" is not a recognized EnvironmentSlug` };
  }
  if (!eligibleCandidates.includes(selected)) {
    return { outcome: 'unavailable', reason: `invalid_environment: "${selected}" is not in the eligible candidate set` };
  }
  return { outcome: 'selected', environment: selected, evidence };
}

/**
 * Returns an `EnvironmentSelectionExecutor` that always resolves with the given, caller-supplied
 * outcome — regardless of the request it is called with. This is the SCRIPTED STUB: it proves the
 * `EnvironmentSelectionRequest -> executor -> EnvironmentSelectionOutcome` contract end to end for
 * tests and plumbing experiments, and performs no reasoning or validation over request content
 * whatsoever — not even the eligibility check `validateSelectedEnvironment` implements. A caller
 * that pre-configures an ineligible outcome gets that ineligible outcome back verbatim; enforcing
 * eligibility is a real executor's job, never this stub's.
 */
export function createScriptedEnvironmentSelectionExecutor(
  outcome: EnvironmentSelectionOutcome,
): EnvironmentSelectionExecutor {
  return async () => outcome;
}

/**
 * `ASSETS.md`'s own `### The library` section (design/website/brand-pack/ASSETS.md, lines 259-269),
 * transcribed verbatim as a small static table rather than doc-parsed at runtime — the same
 * "compute/transcribe, don't table-parse" precedent `environment-selection-eligibility.ts`'s own
 * ratio-legality table already established (Sprint 10AB §4). Preserved exactly as source-authored
 * usage prose (e.g. dawn-haze's own "Hero.", lake-mirror's own "not a hero") — never converted into
 * a numeric weight, score, or ranking value of any kind (Sprint 10AC §8/Phase 8).
 */
const ENVIRONMENT_GUIDANCE: Readonly<Record<EnvironmentSlug, string>> = {
  'ridges-distant':
    'calm, atmospheric. Receding hazy ridges under a deep cloud bank. The largest quiet sky in the ' +
    'library and the most versatile across ratios — the safest reach when a section needs atmosphere ' +
    'without a strong subject, and a strong hero.',
  'dawn-haze':
    'atmospheric, cinematic. Backlit morning haze, flare left, silhouetted treeline right, still ' +
    'water. The most cinematic member; its natural negative space on the light side is where ' +
    'typography belongs. Hero.',
  'massif-banded':
    'atmospheric, dense. Grey massif, dark conifer band, turquoise lake. Strong horizontal depth ' +
    'layers; the only member that holds its subject convincingly at every approved ratio.',
  'valley-deep':
    'dense, atmospheric. Enclosed green valley flanked by forest, glacier peak beyond. The deepest ' +
    'recession in the library; saturated and dense at the edges, so it wants room.',
  'cliffside-muted':
    'calm, editorial. Muted, near-monochrome cliff and forest under a white sky. The most restrained ' +
    'member — it recedes furthest behind copy, so reach for it when the typography must lead.',
  'lake-mirror':
    'bright, calm. Symmetrical mirror lake under cumulus. Bright and quiet, but deliberately centred ' +
    '— a closing surface, not a hero, because an obviously centred subject is what hero composition ' +
    'avoids.',
  'massif-clear':
    'dense, technical. Jagged limestone massif over transparent shallows. The most detailed member ' +
    '— busy enough to compete with copy, so prefer it as a subject rather than behind text. Nearly ' +
    '4:3 at source.',
};

/**
 * Builds the curated prompt for a future real executor. Includes only belief/feature/camera (never
 * ratio, never lastEnvironment/recent-log content, never material/color/composition) and the
 * eligible candidates' own source-authored guidance prose — never a numeric score/weight. Explicitly
 * instructs: choose exactly one, only from the eligible list, never invent, do not reconsider
 * eligibility, do not use recent history, structured JSON only.
 */
export function buildEnvironmentSelectionPrompt(request: EnvironmentSelectionRequest): string {
  const featureLine = request.feature ? `- feature: ${request.feature}` : '- feature: (not provided)';
  const cameraLine = request.camera
    ? `- camera candidate: ${request.camera} (visibility guidance only — never a hard constraint on which environment may be chosen)`
    : '- camera candidate: (not provided)';
  const candidatesText = request.eligibleCandidates
    .map((slug) => `- ${slug}: ${ENVIRONMENT_GUIDANCE[slug]}`)
    .join('\n');

  return [
    'You are answering the Environment Selection question for one proposed creative concept. This is',
    'a semantic belief-fit pick among an already-decided, closed list of eligible environments —',
    'nothing else. Do not design the creative. Do not choose website sections. Do not judge material,',
    'composition, or anything about the recent output log.',
    '',
    '## The proposed creative',
    '',
    `- belief: ${request.belief}`,
    featureLine,
    cameraLine,
    '',
    '## Eligible environments — choose exactly ONE from this list, and ONLY this list',
    '',
    'Vocabulary membership, ratio legality, and recent-use exclusion have ALL already been decided',
    'upstream, before this prompt was built — none of that reasoning is yours to redo.',
    'Do not use or reference recent log/history information of any kind: no information about the',
    'recent output log was given to you, and none should be assumed.',
    '',
    candidatesText,
    '',
    '## The question',
    '',
    'Which one of the eligible environments listed above best fits the belief\'s narrative — how it',
    'supports what the viewer should believe? Judge fit only; do not score, weigh, or rank.',
    '',
    '## Rules',
    '',
    '- Choose exactly ONE candidate from the eligible list above.',
    '- Never invent an environment value outside the eligible list — a globally valid EnvironmentSlug',
    '  that is not in the eligible list above is still not a legal answer.',
    '- Do not reconsider or re-derive eligibility.',
    '- Do not modify or reorder the candidate list.',
    '- If no honest selection can be made, respond instead with exactly:',
    '  {"status": "unavailable", "reason": "<why>"}',
    '- Otherwise, respond with EXACTLY this JSON shape and nothing else — no prose before or after,',
    '  no markdown code fence:',
    '  {"status": "selected", "environment": "<one of the eligible values above>", "evidence": "<one short auditable line>"}',
    '- Do not include any field beyond status/environment/evidence/reason.',
    '',
  ].join('\n');
}

const ALLOWED_RESPONSE_KEYS = new Set(['status', 'environment', 'evidence', 'reason']);

/**
 * Strictly parses and validates a future real executor's raw response string. Never best-effort:
 * malformed JSON, a non-object, an unrecognized status, a missing/empty required field, or any
 * response key outside the allowed set all become `unavailable` with a specific, machine-readable
 * reason — mirroring the Revision Executor's own strict allow-list discipline
 * (`visual-proof-revision-executor.ts`'s `ALLOWED_RESPONSE_KEYS`), the stricter of this package's
 * two established parsing styles, deliberately chosen here to catch an invented `score`/
 * `confidence`/`weights` field outright. A `"selected"` response's `environment` value is always
 * routed through `validateSelectedEnvironment` — global vocabulary validity is never treated as
 * sufficient on its own.
 */
export function parseEnvironmentSelectionResponse(
  raw: string,
  eligibleCandidates: readonly EnvironmentSlug[],
): EnvironmentSelectionOutcome {
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
  if (obj.status !== 'selected') {
    return { outcome: 'unavailable', reason: 'invalid_status: status must be "selected" or "unavailable"' };
  }
  if (typeof obj.environment !== 'string' || obj.environment.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: environment' };
  }
  if (typeof obj.evidence !== 'string' || obj.evidence.trim() === '') {
    return { outcome: 'unavailable', reason: 'missing_answer: evidence' };
  }

  return validateSelectedEnvironment(obj.environment, eligibleCandidates, obj.evidence.trim());
}

/**
 * Sprint 10AE — the real Environment Selection executor. Structurally a sibling to
 * `createRealJudgmentExecutor`/`createRealRevisionExecutor`: curated prompt -> injected `dispatch`
 * -> strict parsing -> selected/unavailable. Own executor, own prompt builder
 * (`buildEnvironmentSelectionPrompt`, above), own strict parser (`parseEnvironmentSelectionResponse`,
 * above) — never imports `VisualProofValidationExecutor`/`VisualProofRevisionExecutor`, never
 * introduces a second generic model/provider abstraction.
 */
export const ENVIRONMENT_SELECTION_LLM_EXECUTOR = 'environment-selection-llm-v1';

export interface RealEnvironmentSelectionExecutorOptions {
  readonly dispatch: EnvironmentSelectionDispatch;
  /** When given, a curated request file and an audit-trail trace file are written here per call. */
  readonly dispatchDir?: string;
  /** Milliseconds to wait for dispatch before treating it as unavailable (reason: 'timeout'). */
  readonly timeoutMs?: number;
}

function correlationIdFor(request: EnvironmentSelectionRequest): string {
  return createHash('sha256')
    .update(`${request.belief}|${request.eligibleCandidates.join(',')}`)
    .digest('hex')
    .slice(0, 12);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__environment_selection_timeout__')), ms);
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
  outcome: EnvironmentSelectionOutcome,
  startedAt: string,
  endedAt: string,
): void {
  fs.mkdirSync(dispatchDir, { recursive: true });
  fs.writeFileSync(path.join(dispatchDir, `${correlationId}.selection-request.md`), prompt, 'utf8');
  const trace =
    outcome.outcome === 'selected'
      ? {
          executor: ENVIRONMENT_SELECTION_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'selected',
          environment: outcome.environment,
          evidence: outcome.evidence,
        }
      : {
          executor: ENVIRONMENT_SELECTION_LLM_EXECUTOR,
          correlationId,
          startedAt,
          endedAt,
          outcome: 'unavailable',
          reason: outcome.reason,
        };
  fs.writeFileSync(
    path.join(dispatchDir, `${correlationId}.selection-trace.json`),
    JSON.stringify(trace, null, 2),
    'utf8',
  );
}

/**
 * Builds a real `EnvironmentSelectionExecutor`. When `request.eligibleCandidates` is empty, resolves
 * `unavailable` (reason: `no_eligible_candidates`) WITHOUT ever building a prompt or calling
 * `dispatch` — asking a model to choose from nothing is a precondition failure, not a genuine
 * judgment question (Sprint 10AC §9). Otherwise: builds the curated prompt, dispatches it via the
 * injected `dispatch` (bounded by `timeoutMs`), and strictly parses the response. A dispatch
 * exception or timeout becomes `unavailable` — never a fabricated selection.
 */
export function createRealEnvironmentSelectionExecutor(
  opts: RealEnvironmentSelectionExecutorOptions,
): EnvironmentSelectionExecutor {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return async (request) => {
    if (request.eligibleCandidates.length === 0) {
      return { outcome: 'unavailable', reason: 'no_eligible_candidates' };
    }
    const prompt = buildEnvironmentSelectionPrompt(request);
    const startedAt = new Date().toISOString();
    let outcome: EnvironmentSelectionOutcome;
    try {
      const raw = await withTimeout(opts.dispatch(prompt), timeoutMs);
      outcome = parseEnvironmentSelectionResponse(raw, request.eligibleCandidates);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === '__environment_selection_timeout__';
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
