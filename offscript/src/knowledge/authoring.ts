/**
 * Sprint 6 — Authoring Runtime.
 *
 * The architectural boundary where deterministic execution ends and CONTROLLED
 * determination begins. It consumes ONLY the immutable Authoring Context and produces an
 * immutable Authoring Result. It is responsible only for authoring orchestration — it never
 * reads the Repository / Discovery / Composition / governance / HTML / filesystem, never
 * implements a provider, constructs a prompt, generates HTML, or renders.
 *
 * The runtime itself is deterministic. The ONLY non-deterministic element is the Author's
 * controlled determination — its resolution of the plurality Conditioning preserved — which
 * is recorded, validated, and made replayable + explainable inside the result.
 *
 * Provider independence: the runtime depends only on the abstract `Author` interface. Claude
 * / Gemini / GPT / local implementations may be added later without changing runtime behavior.
 *
 * Fail-loud: an invalid context, missing plurality, inconsistent determination, or evidence
 * mismatch throws an AuthoringError. The result is deep-frozen (mutable outputs fail loud).
 */
import { digest } from './digest.js';
import type { AuthoringContext } from './conditioning.js';
import type { ResolvedObligation } from './discovery.js';
import { checkModelSetIntegrity, type DerivedModelSet } from './derivation/models.js';

export const AUTHORING_RUNTIME_VERSION = '0.1.0';

/**
 * What the Author receives — the immutable context, plus (Phase C) the seven Governance Models
 * exposed EXPLICITLY when carried. The runtime guarantees availability + traceability; the Author
 * implementation is the only component permitted to realize the Models. `models` is present iff a
 * validated ModelSet was carried through Conditioning (absent ⇒ pre-Phase-C behaviour, unchanged).
 */
export interface AuthoringRequest {
  readonly context: AuthoringContext;
  /** The carried, validated seven-Model set (Phase C) — for the Author to realize, not the runtime. */
  readonly models?: DerivedModelSet;
}

/** The Author's controlled determination: one selection per preserved plurality + an opaque payload. */
export interface AuthorDetermination {
  readonly key: string;
  readonly selected: string;
}
export interface AuthoringResponse {
  readonly determinations: readonly AuthorDetermination[];
  /** The authored artifact — OPAQUE; the runtime never interprets it. */
  readonly payload: unknown;
}

/** The abstract authoring provider seam. Real providers implement this; tests mock it. */
export interface Author {
  readonly name: string;
  author(request: AuthoringRequest): AuthoringResponse | Promise<AuthoringResponse>;
}

/** A recorded determination, fully traceable to repository facts. */
export interface ResolvedDetermination {
  readonly key: string;
  /** The originating plurality — the lawful candidate set offered. */
  readonly from: readonly string[];
  /** The selected candidate (∈ from). */
  readonly selected: string;
}

/** Authoring evidence — every determination remains traceable to repository facts. */
export interface AuthoringEvidence {
  readonly repositoryIdentity: string;
  readonly assetCount: number;
  readonly candidateCount: number;
  readonly obligations: readonly ResolvedObligation[];
}

/** The immutable Authoring Result — the runtime's output. */
export interface AuthoringResult {
  readonly authoringIdentity: string;
  readonly conditioningIdentity: string;
  readonly repositoryIdentity: string;
  /** The conditioned context, carried verbatim. */
  readonly context: AuthoringContext;
  readonly determinations: readonly ResolvedDetermination[];
  readonly evidence: AuthoringEvidence;
  /** The opaque authored artifact (uninterpreted). */
  readonly payload: unknown;
  readonly metadata: {
    readonly runtimeVersion: string;
    readonly author: string;
    readonly determinationCount: number;
  };
}

/** Fail-loud authoring error. */
export class AuthoringError extends Error {
  readonly code:
    | 'INVALID_AUTHORING_CONTEXT'
    | 'MISSING_PLURALITY'
    | 'INCONSISTENT_DETERMINATION'
    | 'EVIDENCE_MISMATCH'
    // Phase C — a carried ModelSet failed availability/traceability validation (never repaired).
    | 'INVALID_MODEL_SET';
  constructor(code: AuthoringError['code'], message: string) {
    super(message);
    this.name = 'AuthoringError';
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

function validateContext(context: AuthoringContext): void {
  const ok =
    !!context &&
    typeof context === 'object' &&
    Object.isFrozen(context) &&
    typeof context.conditioningIdentity === 'string' &&
    SHA.test(context.conditioningIdentity) &&
    typeof context.repositoryIdentity === 'string' &&
    SHA.test(context.repositoryIdentity) &&
    !!context.plan &&
    Array.isArray(context.unresolvedPlurality) &&
    Array.isArray(context.obligations);
  if (!ok) {
    throw new AuthoringError('INVALID_AUTHORING_CONTEXT', 'authoring: authoring context is invalid or not immutable.');
  }
}

/**
 * Assemble + validate an Authoring Result from a recorded response — PURE and deterministic.
 * Validates that exactly the preserved plurality is resolved, each selection is lawful, and
 * stamps the authoring identity. Reusable for replay (no Author invocation required).
 */
export function assembleAuthoringResult(
  context: AuthoringContext,
  response: AuthoringResponse,
  authorName: string,
): AuthoringResult {
  validateContext(context);

  const groups = new Map(context.unresolvedPlurality.map((g) => [g.key, g.members]));
  const seen = new Set<string>();
  const determinations: ResolvedDetermination[] = [];
  for (const det of response.determinations ?? []) {
    const members = groups.get(det.key);
    if (!members) {
      throw new AuthoringError(
        'INCONSISTENT_DETERMINATION',
        `authoring: determination for '${det.key}' resolves a plurality not preserved by conditioning.`,
      );
    }
    if (seen.has(det.key)) {
      throw new AuthoringError('INCONSISTENT_DETERMINATION', `authoring: duplicate determination for '${det.key}'.`);
    }
    if (!members.includes(det.selected)) {
      throw new AuthoringError(
        'EVIDENCE_MISMATCH',
        `authoring: '${det.selected}' is not in the lawful candidate set for '${det.key}' — untraceable selection.`,
      );
    }
    seen.add(det.key);
    determinations.push({ key: det.key, from: members, selected: det.selected });
  }
  for (const g of context.unresolvedPlurality) {
    if (!seen.has(g.key)) {
      throw new AuthoringError('MISSING_PLURALITY', `authoring: preserved plurality '${g.key}' was left unresolved.`);
    }
  }
  determinations.sort((a, b) => a.key.localeCompare(b.key));

  // Authoring identity: conditioning identity + resolved plurality + runtime version.
  // The opaque payload is deliberately EXCLUDED — identity captures decisions, not the artifact.
  const authoringIdentity = digest({
    runtimeVersion: AUTHORING_RUNTIME_VERSION,
    conditioningIdentity: context.conditioningIdentity,
    determinations: determinations.map((d) => ({ key: d.key, selected: d.selected })),
  });

  const evidence: AuthoringEvidence = {
    repositoryIdentity: context.repositoryIdentity,
    assetCount: context.evidence.assetCount,
    candidateCount: context.evidence.candidateCount,
    obligations: context.obligations,
  };

  const result: AuthoringResult = {
    authoringIdentity,
    conditioningIdentity: context.conditioningIdentity,
    repositoryIdentity: context.repositoryIdentity,
    context,
    determinations,
    evidence,
    payload: response.payload,
    metadata: {
      runtimeVersion: AUTHORING_RUNTIME_VERSION,
      author: authorName,
      determinationCount: determinations.length,
    },
  };
  return deepFreeze(result);
}

/**
 * The Authoring Runtime session: validate the immutable context, invoke the Author (the sole
 * controlled-determination point), then deterministically assemble + freeze the result.
 */
export async function runAuthoring(context: AuthoringContext, author: Author): Promise<AuthoringResult> {
  validateContext(context);
  // Phase C — when a ModelSet is carried, the runtime GUARANTEES availability + traceability before
  // exposing it to the Author, then forwards it verbatim. It performs ZERO interpretation: it never
  // flattens, merges, summarizes, projects, derives, or chooses among the Models. Absent ⇒ unchanged.
  if (context.models !== undefined) {
    const problems = checkModelSetIntegrity(context.models, { expectedRepositoryIdentity: context.repositoryIdentity });
    if (problems.length > 0) {
      throw new AuthoringError('INVALID_MODEL_SET', `authoring: carried model set failed validation — ${problems.join('; ')}.`);
    }
  }
  const response = await author.author({ context, models: context.models });
  return assembleAuthoringResult(context, response, author.name);
}
