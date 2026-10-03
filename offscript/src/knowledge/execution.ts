/**
 * Sprint 7 — Execution Runtime.
 *
 * The operational boundary around provider invocation. It consumes ONLY an immutable Authoring
 * Result + an Author implementation and produces an immutable Execution Result. It owns
 * EXECUTION (lifecycle, timeout, cancellation, retry, telemetry); authoring owns authoring;
 * providers own generation. The runtime depends only on the abstract `Author` seam — there is no
 * Claude / Gemini / GPT logic here, and no provider is implemented.
 *
 * The determinism boundary is explicit: the EXECUTION METADATA (identity, status, attempt
 * outcomes, policy) is deterministic — it never folds in wall-clock timing or the provider's
 * payload — while the PROVIDER OUTPUT (the artifact payload) is intentionally non-deterministic.
 * `provider.deterministic = false` records that boundary in every result.
 *
 * Fail-loud: an invalid authoring result, a timeout, a cancellation, a provider failure, an
 * invalid response, or a malformed payload throw an ExecutionError (carrying the partial
 * telemetry). The runtime never silently retries forever — retries are bounded by maxAttempts.
 */
import { digest } from './digest.js';
import type { AuthoringResult } from './authoring.js';
import type { AuthoringRequest, AuthoringResponse, Author } from './authoring.js';

export const EXECUTION_RUNTIME_VERSION = '0.1.0';

/** A single streamed unit of provider output (opaque value). */
export interface StreamChunk {
  readonly seq: number;
  readonly value: unknown;
}

/** The streaming abstraction sink — where provider chunks are delivered. */
export interface StreamSink {
  push(chunk: StreamChunk): void;
}

/**
 * An optional streaming extension of the abstract Author. Providers that can stream implement
 * `authorStream`; the runtime duck-types this and routes chunks to the supplied sink. The Author
 * interface itself (Sprint 6) is unchanged.
 */
export interface StreamingAuthor extends Author {
  authorStream(request: AuthoringRequest, sink: StreamSink): AuthoringResponse | Promise<AuthoringResponse>;
}

/** A telemetry event surfaced through the optional hook. */
export type ExecutionEvent =
  | { readonly kind: 'attempt-start'; readonly attempt: number; readonly at: number }
  | { readonly kind: 'attempt-success'; readonly attempt: number; readonly at: number }
  | { readonly kind: 'attempt-failure'; readonly attempt: number; readonly at: number; readonly code: ExecutionErrorCode }
  | { readonly kind: 'chunk'; readonly seq: number };

/** Execution policy — operational controls only (never model params / prompts / HTML). */
export interface ExecutionPolicy {
  /** Per-attempt deadline in milliseconds. Omitted → no timeout. */
  readonly timeoutMs?: number;
  /** Maximum attempts (retries included). Default 1 (no retry). */
  readonly maxAttempts?: number;
  /** External cancellation. */
  readonly signal?: AbortSignal;
  /** Streaming abstraction — provider chunks are forwarded here. */
  readonly streamSink?: StreamSink;
  /** Telemetry hook. */
  readonly onEvent?: (event: ExecutionEvent) => void;
  /** Clock injection for telemetry timing (default Date.now). */
  readonly now?: () => number;
}

/** Provider metadata — records the determinism boundary explicitly. */
export interface ProviderMetadata {
  readonly name: string;
  /** Provider output is intentionally non-deterministic. */
  readonly deterministic: false;
}

export type ExecutionStatus = 'succeeded';

export interface AttemptOutcome {
  readonly attempt: number;
  readonly outcome: 'success' | 'failure';
  readonly code?: ExecutionErrorCode;
}

/** Execution telemetry — timing is recorded but is NOT part of the execution identity. */
export interface ExecutionTelemetry {
  readonly attempts: number;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly chunkCount: number;
  readonly attemptOutcomes: readonly AttemptOutcome[];
}

/** The immutable Execution Result — the runtime's output. */
export interface ExecutionResult {
  readonly executionIdentity: string;
  readonly authoringIdentity: string;
  readonly provider: ProviderMetadata;
  readonly status: ExecutionStatus;
  /** The artifact produced by the provider — OPAQUE; the runtime never interprets it. */
  readonly payload: unknown;
  readonly telemetry: ExecutionTelemetry;
  readonly metadata: {
    readonly runtimeVersion: string;
    readonly provider: string;
    readonly maxAttempts: number;
    readonly timeoutMs: number | null;
  };
}

export type ExecutionErrorCode =
  | 'INVALID_AUTHORING_RESULT'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'PROVIDER_FAILURE'
  | 'INVALID_RESPONSE'
  | 'MALFORMED_PAYLOAD';

/** Fail-loud execution error; carries the partial telemetry gathered up to the failure. */
export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode;
  telemetry?: ExecutionTelemetry;
  constructor(code: ExecutionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ExecutionError';
    this.code = code;
  }
}

const SHA = /^sha256:[0-9a-f]{64}$/;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

function isStreamingAuthor(author: Author): author is StreamingAuthor {
  return typeof (author as Partial<StreamingAuthor>).authorStream === 'function';
}

/** A code is retryable iff retrying could plausibly change the outcome (transient, not deterministic). */
function isRetryable(code: ExecutionErrorCode): boolean {
  return code === 'PROVIDER_FAILURE' || code === 'TIMEOUT';
}

function classify(error: unknown): ExecutionErrorCode {
  return error instanceof ExecutionError ? error.code : 'PROVIDER_FAILURE';
}

function asExecutionError(error: unknown): ExecutionError {
  if (error instanceof ExecutionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ExecutionError('PROVIDER_FAILURE', `execution: provider failed — ${message}`, { cause: error });
}

function validateAuthoringResult(result: AuthoringResult): void {
  const ok =
    !!result &&
    typeof result === 'object' &&
    Object.isFrozen(result) &&
    typeof result.authoringIdentity === 'string' &&
    SHA.test(result.authoringIdentity) &&
    typeof result.conditioningIdentity === 'string' &&
    SHA.test(result.conditioningIdentity) &&
    !!result.context &&
    Array.isArray(result.determinations);
  if (!ok) {
    throw new ExecutionError('INVALID_AUTHORING_RESULT', 'execution: authoring result is invalid or not immutable.');
  }
}

/** Validate the provider response shape — fail loud (deterministically) on a malformed return. */
function validateResponse(response: unknown): asserts response is AuthoringResponse {
  if (!response || typeof response !== 'object' || !Array.isArray((response as AuthoringResponse).determinations)) {
    throw new ExecutionError('INVALID_RESPONSE', 'execution: provider returned an invalid response.');
  }
  if (!('payload' in (response as object)) || (response as AuthoringResponse).payload === undefined) {
    throw new ExecutionError('MALFORMED_PAYLOAD', 'execution: provider returned a malformed (absent) payload.');
  }
}

/** Race the provider work against the deadline + cancellation controls. */
function raceControls<T>(work: Promise<T>, timeoutMs: number | undefined, signal: AbortSignal | undefined): Promise<T> {
  if (timeoutMs == null && !signal) return work;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => finishReject(new ExecutionError('CANCELLED', 'execution: cancelled by signal.'));
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finishResolve = (v: T) => { if (!settled) { settled = true; cleanup(); resolve(v); } };
    const finishReject = (e: unknown) => { if (!settled) { settled = true; cleanup(); reject(e); } };
    if (signal?.aborted) { finishReject(new ExecutionError('CANCELLED', 'execution: cancelled before start.')); return; }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    if (timeoutMs != null) {
      timer = setTimeout(() => finishReject(new ExecutionError('TIMEOUT', `execution: provider exceeded ${timeoutMs}ms.`)), timeoutMs);
    }
    work.then(finishResolve, finishReject);
  });
}

/**
 * Execute an Author implementation against an immutable Authoring Result under operational policy.
 * Throws ExecutionError (carrying partial telemetry) on timeout, cancellation, provider failure,
 * invalid response, or malformed payload.
 */
export async function execute(
  authoring: AuthoringResult,
  author: Author,
  policy: ExecutionPolicy = {},
): Promise<ExecutionResult> {
  validateAuthoringResult(authoring);

  const now = policy.now ?? Date.now;
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 1);
  const timeoutMs = policy.timeoutMs;
  const request: AuthoringRequest = { context: authoring.context };

  const startedAt = now();
  const attemptOutcomes: AttemptOutcome[] = [];
  let chunkCount = 0;
  const sink: StreamSink | undefined = policy.streamSink
    ? {
        push: (chunk) => {
          chunkCount++;
          policy.onEvent?.({ kind: 'chunk', seq: chunk.seq });
          policy.streamSink!.push(chunk);
        },
      }
    : undefined;

  const buildTelemetry = (): ExecutionTelemetry => {
    const endedAt = now();
    return {
      attempts: attemptOutcomes.length,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      chunkCount,
      attemptOutcomes,
    };
  };

  const fail = (error: ExecutionError): never => {
    error.telemetry = deepFreeze(buildTelemetry());
    throw error;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    policy.onEvent?.({ kind: 'attempt-start', attempt, at: now() });
    try {
      const invoke = (): Promise<AuthoringResponse> =>
        sink && isStreamingAuthor(author)
          ? Promise.resolve(author.authorStream(request, sink))
          : Promise.resolve(author.author(request));
      const response = await raceControls(invoke(), timeoutMs, signalOf(policy));
      validateResponse(response); // INVALID_RESPONSE / MALFORMED_PAYLOAD (deterministic — not retried)

      attemptOutcomes.push({ attempt, outcome: 'success' });
      policy.onEvent?.({ kind: 'attempt-success', attempt, at: now() });
      return assemble(authoring, author, response.payload, maxAttempts, timeoutMs ?? null, buildTelemetry());
    } catch (error) {
      const code = classify(error);
      attemptOutcomes.push({ attempt, outcome: 'failure', code });
      policy.onEvent?.({ kind: 'attempt-failure', attempt, at: now(), code });
      if (!isRetryable(code) || attempt >= maxAttempts) fail(asExecutionError(error));
      // retryable + attempts remain → loop
    }
  }
  // Unreachable: the loop either returns on success or fails on the last attempt.
  return fail(new ExecutionError('PROVIDER_FAILURE', 'execution: exhausted all attempts.'));
}

function signalOf(policy: ExecutionPolicy): AbortSignal | undefined {
  return policy.signal;
}

function assemble(
  authoring: AuthoringResult,
  author: Author,
  payload: unknown,
  maxAttempts: number,
  timeoutMs: number | null,
  telemetry: ExecutionTelemetry,
): ExecutionResult {
  const provider: ProviderMetadata = { name: author.name, deterministic: false };
  const status: ExecutionStatus = 'succeeded';

  // Execution identity = deterministic metadata ONLY. The provider payload and all wall-clock
  // timing are EXCLUDED — same inputs + same provider behavior → same identity.
  const executionIdentity = digest({
    executionRuntimeVersion: EXECUTION_RUNTIME_VERSION,
    authoringIdentity: authoring.authoringIdentity,
    provider: provider.name,
    policy: { maxAttempts, timeoutMs },
    status,
    attemptOutcomes: telemetry.attemptOutcomes.map((o) => ({ attempt: o.attempt, outcome: o.outcome, code: o.code ?? null })),
  });

  const result: ExecutionResult = {
    executionIdentity,
    authoringIdentity: authoring.authoringIdentity,
    provider,
    status,
    payload,
    telemetry,
    metadata: {
      runtimeVersion: EXECUTION_RUNTIME_VERSION,
      provider: provider.name,
      maxAttempts,
      timeoutMs,
    },
  };
  return deepFreeze(result);
}
