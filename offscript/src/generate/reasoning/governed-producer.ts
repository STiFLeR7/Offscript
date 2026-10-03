/**
 * Sprint W4 — the Governed Reasoning Runtime (shadow mode), behind the W3 ReasoningProducer seam.
 *
 * Implements GOVERNED-REASONING-RUNTIME-ARCHITECTURE.md applied to World B's per-section reasoning.
 * The lifecycle (runGovernedReasoning) is deterministic; the ONLY non-deterministic point is the
 * INJECTED reasoning unit (GRR I10). The runtime isolates that bounded judgment behind a seam and
 * immediately freezes its output into an evidence-bearing, recipe-replayable artifact:
 *
 *   validate request → acquire governance snapshot → invoke injected reasoning unit → receive raw
 *   reasoning → validate → freeze → attach evidence → return GovernedReasoning
 *
 * Provider independence (GRR I6): the reasoning unit is injected, never instantiated internally,
 * never tied to Claude/Gemini/GPT — no provider branches. The unit returns only category CONTENT
 * (the six WHY fields); the runtime owns the snapshot, identity, evidence, and freeze (GRR §2.2).
 *
 * Shadow mode: this runtime is real and proven by the harness (verify-reasoning.ts) + tests, but it
 * is NOT wired into the default generate pipeline — the only reasoning unit available is a test
 * double, so production keeps the inert W3 default and the website stays byte-identical. When the
 * governed producer IS used, only the clean SectionReasoning rides PlanItem.reasoning (W2 transport);
 * the evidence lives on the GovernedReasoning artifact, never inside the item.
 */
import type { SectionReasoning } from '../types.js';
import { REASONING_FIELDS, hasReasoning, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import type { ReasoningContext, ReasoningProducer, ReasoningResult } from './types.js';
import { reasoningDigest, type GovernanceSnapshot } from './governance-snapshot.js';

/** The runtime version stamped into every artifact's evidence (the reasoning recipe version). */
export const REASONING_RUNTIME_VERSION = '0.1.0';

const SHA = /^sha256:[0-9a-f]{64}$/;

// ── the injected reasoning unit (provider-agnostic bounded judgment) ─────────────
/** What the bounded reasoner receives — the section context + the governance grounding text. */
export interface ReasoningRequest {
  readonly context: ReasoningContext;
  readonly governanceGrounding: string;
}
/** The reasoner's raw output: the WHY content only (the six fields), or absent when it declines. */
export interface RawReasoning {
  readonly reasoning?: SectionReasoning;
}
/**
 * One bounded reasoning step — the SOLE non-deterministic surface. Injected, provider-agnostic;
 * mirrors ModelDeriver / Author / Execution. It returns CONTENT only — never identities, citations,
 * evidence, or the envelope (the runtime owns those).
 */
export interface ReasoningUnit {
  readonly name: string;
  reason(request: ReasoningRequest): RawReasoning | Promise<RawReasoning>;
}

// ── evidence + the governed artifact ─────────────────────────────────────────────
/** The evidence chain every governed reasoning artifact carries (GRR §4). Nothing inferred/hidden. */
export interface ReasoningEvidence {
  /** the reasoning unit's NAME — provider-agnostic, never a provider type. */
  readonly reasoner: string;
  /** content hash of the governance grounding the reasoner read (GovernanceSnapshot.id). */
  readonly governanceSnapshotId: string;
  /** content hash binding the brief grounding the reasoning answers to. */
  readonly briefIdentity: string;
  /** the runtime version (REASONING_RUNTIME_VERSION). */
  readonly reasoningVersion: string;
  /** deterministic id of this reasoning event — recomputable from the artifact (recipe replay). */
  readonly traceId: string;
}
/** The observable reasoning artifact: the frozen WHY + its frozen evidence chain (the recipe). */
export interface GovernedReasoning {
  readonly reasoning: SectionReasoning;
  readonly evidence: ReasoningEvidence;
}

/** Dependencies of the governed runtime — both INJECTED, neither built internally (I6 / G2). */
export interface GovernedReasoningDeps {
  /** the bounded reasoning unit (provider-agnostic). */
  readonly reasoningUnit: ReasoningUnit;
  /** acquire the governance grounding snapshot for a context (G2; injected, never materialized here). */
  acquireSnapshot(context: ReasoningContext): GovernanceSnapshot | Promise<GovernanceSnapshot>;
}

// ── deterministic identity helpers ───────────────────────────────────────────────
/** Bind the brief grounding the reasoning answers to (track + one-liner) → a content hash. */
function briefIdentityOf(context: ReasoningContext): string {
  return reasoningDigest(`track:${context.track}\noneLiner:${context.oneLiner}`);
}

/**
 * Deterministically compute a reasoning event's trace id from its inputs + content. Recomputable
 * from a persisted artifact with NO reasoner call — this IS the recipe-replay guarantee (GRR §7:
 * "replay = bounds, not bytes"). Pure: no clock, no randomness, canonical field order.
 */
export function computeTraceId(parts: {
  reasoner: string;
  governanceSnapshotId: string;
  briefIdentity: string;
  reasoningVersion: string;
  sectionId: string;
  reasoning: SectionReasoning;
}): string {
  const content = REASONING_FIELDS.map((f) => `${f}=${parts.reasoning[f] ?? ''}`).join('\n');
  return reasoningDigest(
    [
      `reasoner:${parts.reasoner}`,
      `governanceSnapshotId:${parts.governanceSnapshotId}`,
      `briefIdentity:${parts.briefIdentity}`,
      `reasoningVersion:${parts.reasoningVersion}`,
      `section:${parts.sectionId}`,
      content,
    ].join('\n'),
  );
}

// ── validation (fail-loud, never repair/infer) ───────────────────────────────────
function validateDeps(deps: GovernedReasoningDeps): void {
  if (!deps || typeof deps !== 'object') {
    throw new Error('governed reasoning: deps are required.');
  }
  const unit = deps.reasoningUnit;
  if (!unit || typeof unit !== 'object' || typeof unit.name !== 'string' || unit.name.trim() === '' || typeof unit.reason !== 'function') {
    throw new Error('governed reasoning: deps.reasoningUnit must be an injected unit with a non-empty name + reason().');
  }
  if (typeof deps.acquireSnapshot !== 'function') {
    throw new Error('governed reasoning: deps.acquireSnapshot must be an injected function (governance snapshot source).');
  }
}

function validateContext(context: ReasoningContext): void {
  if (!context || typeof context !== 'object' || !context.item || typeof context.item !== 'object' || !context.item.anchor) {
    throw new Error('governed reasoning: a ReasoningContext carrying a plan item is required.');
  }
}

function validateSnapshot(snapshot: GovernanceSnapshot | undefined | null): GovernanceSnapshot {
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.grounding !== 'string' || snapshot.grounding.trim() === '' || !SHA.test(snapshot.id ?? '')) {
    throw new Error('governed reasoning: acquired governance snapshot is missing or invalid (no grounding / bad id).');
  }
  // Integrity: the id must be the content hash of the grounding (no tampered/forged snapshot).
  if (snapshot.id !== reasoningDigest(snapshot.grounding)) {
    throw new Error('governed reasoning: governance snapshot id does not match its grounding (tampered snapshot).');
  }
  return snapshot;
}

/** Validate the unit's raw result → the reasoning to freeze, or undefined when it declined. */
function validateUnitResult(raw: RawReasoning | undefined | null): SectionReasoning | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('governed reasoning: the reasoning unit must return a RawReasoning object or undefined.');
  }
  const reasoning = (raw as RawReasoning).reasoning;
  if (reasoning === undefined) return undefined;
  if (typeof reasoning !== 'object' || reasoning === null || Array.isArray(reasoning)) {
    throw new Error('governed reasoning: result.reasoning must be a SectionReasoning object or undefined.');
  }
  const problems = validateReasoning(reasoning as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`governed reasoning: malformed reasoning — ${problems.join('; ')}.`);
  }
  if (!hasReasoning(reasoning as SectionReasoning)) return undefined; // empty channel = declined
  return reasoning as SectionReasoning;
}

/**
 * Validate an evidence chain — fail-loud on a missing trace, a non-content-hash id, or any empty
 * field. Defensive: the runtime builds evidence itself, so this guards the invariant (and is the
 * public check the verifier + tests exercise). Never repairs.
 */
export function validateEvidence(evidence: ReasoningEvidence): void {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('governed reasoning: evidence is required.');
  }
  if (typeof evidence.reasoner !== 'string' || evidence.reasoner.trim() === '') {
    throw new Error('governed reasoning: invalid evidence — reasoner is missing.');
  }
  if (!SHA.test(evidence.governanceSnapshotId ?? '')) {
    throw new Error('governed reasoning: invalid evidence — governanceSnapshotId is not a content hash.');
  }
  if (!SHA.test(evidence.briefIdentity ?? '')) {
    throw new Error('governed reasoning: invalid evidence — briefIdentity is not a content hash.');
  }
  if (typeof evidence.reasoningVersion !== 'string' || evidence.reasoningVersion.trim() === '') {
    throw new Error('governed reasoning: invalid evidence — reasoningVersion is missing.');
  }
  if (!SHA.test(evidence.traceId ?? '')) {
    throw new Error('governed reasoning: invalid evidence — trace id is missing or not a content hash.');
  }
}

// ── the runtime ──────────────────────────────────────────────────────────────────
/**
 * Run the governed reasoning lifecycle for one section. Returns a frozen, evidence-bearing
 * GovernedReasoning artifact, or `undefined` when the injected unit declines. Deterministic apart
 * from the unit's own judgment; the unit is invoked EXACTLY ONCE. Fail-loud on invalid deps /
 * context / snapshot / reasoning / evidence — never repairs, never infers.
 */
export async function runGovernedReasoning(
  deps: GovernedReasoningDeps,
  context: ReasoningContext,
): Promise<GovernedReasoning | undefined> {
  // 1. validate request
  validateDeps(deps);
  validateContext(context);

  // 2. acquire governance snapshot
  const snapshot = validateSnapshot(await deps.acquireSnapshot(context));

  // 3. invoke the injected reasoning unit (the sole non-deterministic surface)
  const raw = await deps.reasoningUnit.reason({ context, governanceGrounding: snapshot.grounding });

  // 4–5. receive + validate raw reasoning
  const reasoning = validateUnitResult(raw);
  if (reasoning === undefined) return undefined; // declined → no artifact

  // 6. freeze
  const frozen = freezeReasoning(reasoning);
  if (!Object.isFrozen(frozen)) {
    throw new Error('governed reasoning: reasoning is mutable after freeze.');
  }

  // 7. attach evidence
  const reasoner = deps.reasoningUnit.name;
  const briefIdentity = briefIdentityOf(context);
  const evidence: ReasoningEvidence = Object.freeze({
    reasoner,
    governanceSnapshotId: snapshot.id,
    briefIdentity,
    reasoningVersion: REASONING_RUNTIME_VERSION,
    traceId: computeTraceId({
      reasoner,
      governanceSnapshotId: snapshot.id,
      briefIdentity,
      reasoningVersion: REASONING_RUNTIME_VERSION,
      sectionId: context.item.anchor.id,
      reasoning: frozen,
    }),
  });
  validateEvidence(evidence);

  // 8. return the immutable artifact (the recipe)
  return Object.freeze({ reasoning: frozen, evidence });
}

// ── the producer seam adapter ─────────────────────────────────────────────────────
/**
 * A ReasoningProducer (W3 seam) backed by the governed runtime. `produce` runs the full lifecycle
 * and returns ONLY the clean SectionReasoning through the seam — so produceReasoning attaches a
 * pristine reasoning to PlanItem.reasoning (W2 transport intact, evidence never leaking into the
 * item). The evidence-bearing artifact is available via runGovernedReasoning directly (the harness
 * + any future recipe-persistence consume it). The public seam is preserved; the GRR lives behind it.
 */
export function createGovernedReasoningProducer(deps: GovernedReasoningDeps): ReasoningProducer {
  validateDeps(deps); // construct-time fail-loud
  return {
    name: 'reasoning::governed',
    async produce(context: ReasoningContext): Promise<ReasoningResult> {
      const artifact = await runGovernedReasoning(deps, context);
      return { reasoning: artifact ? artifact.reasoning : undefined };
    },
  };
}

// ── injected reasoning-unit doubles (provider-agnostic; for CI / harness / tests) ──
/**
 * A deterministic scripted reasoning unit — the CI/test double. Returns a fixed RawReasoning (or
 * computes it from the request). It is INJECTED by the caller, never instantiated inside the
 * runtime. GUARDRAIL: a double, not evidence — real reasoning is the subagent unit (R6).
 */
export function scriptedReasoningUnit(
  verdict: RawReasoning | ((request: ReasoningRequest) => RawReasoning) = { reasoning: undefined },
  name = 'reasoning::unit-scripted',
): ReasoningUnit {
  return {
    name,
    reason: (request: ReasoningRequest): RawReasoning => (typeof verdict === 'function' ? verdict(request) : verdict),
  };
}

/** The dispatch a subagent reasoning unit delegates real bounded judgment to. */
export interface ReasoningUnitDispatch {
  dispatch(request: ReasoningRequest): Promise<RawReasoning>;
}

/**
 * The in-session reasoning-unit seam — provider-agnostic, NOT wired by default. Routes the request
 * to an injected dispatch (a bounded in-session reasoner). Mirrors createSubagentDeriver /
 * createSubagentAuthor: no provider branches, no Claude/Gemini/GPT coupling.
 */
export function createSubagentReasoningUnit(deps: ReasoningUnitDispatch, name = 'reasoning::unit-subagent'): ReasoningUnit {
  return {
    name,
    reason: (request) => deps.dispatch(request),
  };
}
