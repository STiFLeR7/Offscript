/**
 * Sprint W3 — the reasoning producer lifecycle.
 *
 * `produceReasoning` is the seam's single entry point and the SOLE caller of a ReasoningProducer.
 * It runs the deterministic lifecycle that mirrors deriveModels (knowledge/derivation/deriver.ts):
 *
 *   validate (producer + context) → invoke producer ONCE → validate (result) → freeze → return
 *
 * The lifecycle itself is deterministic; the only non-deterministic element is the producer's own
 * reasoning, which W3 never exercises (the default producer is inert). It NEVER repairs, infers,
 * synthesizes, or fills — a malformed result fails loud. It returns a deep-frozen SectionReasoning
 * (the immutable WHY) or `undefined` when the producer produced nothing.
 *
 * Boundary: this module produces reasoning; it does NOT attach it to the item, persist it, or
 * surface it. The orchestrator (scripts/generate.ts) attaches a non-undefined result to
 * `PlanItem.reasoning`; W1 serialization + W2 transport carry it from there.
 */
import type { SectionReasoning } from '../types.js';
import { hasReasoning, validateReasoning, freezeReasoning } from '../section-reasoning.js';
import type { ReasoningContext, ReasoningProducer, ReasoningResult } from './types.js';

/** Name a value's runtime shape for a clear fail-loud message. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateProducer(producer: ReasoningProducer): void {
  if (
    !producer ||
    typeof producer !== 'object' ||
    typeof producer.name !== 'string' ||
    producer.name.trim() === '' ||
    typeof producer.produce !== 'function'
  ) {
    throw new Error('reasoning producer: a ReasoningProducer with a non-empty name + produce() is required.');
  }
}

function validateContext(context: ReasoningContext): void {
  if (
    !context ||
    typeof context !== 'object' ||
    !context.item ||
    typeof context.item !== 'object' ||
    !context.item.anchor
  ) {
    throw new Error('reasoning producer: a ReasoningContext carrying a plan item is required.');
  }
}

/**
 * Validate the producer's result and return the reasoning to freeze, or `undefined` when the
 * producer produced nothing. Fail-loud: rejects anything that is not `undefined` or a sound
 * SectionReasoning — arrays, numbers, functions, unknown keys, empty / non-string fields. Never
 * repairs. An empty channel ({} or all-undefined) is "produced nothing" → undefined.
 */
function validateResult(result: ReasoningResult | undefined | null): SectionReasoning | undefined {
  if (result === undefined || result === null) return undefined;
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`reasoning producer: result must be a ReasoningResult object or undefined, got ${describe(result)}.`);
  }
  const reasoning = (result as ReasoningResult).reasoning;
  if (reasoning === undefined) return undefined;
  if (typeof reasoning !== 'object' || reasoning === null || Array.isArray(reasoning)) {
    throw new Error(`reasoning producer: result.reasoning must be a SectionReasoning object or undefined, got ${describe(reasoning)}.`);
  }
  const problems = validateReasoning(reasoning as SectionReasoning);
  if (problems.length > 0) {
    throw new Error(`reasoning producer: malformed reasoning — ${problems.join('; ')}.`);
  }
  // An empty channel carries no WHY — treat it as "produced nothing" (mirrors hasReasoning in W1).
  if (!hasReasoning(reasoning as SectionReasoning)) return undefined;
  return reasoning as SectionReasoning;
}

/**
 * Run the reasoning producer lifecycle for one section. Returns a deep-frozen SectionReasoning
 * (the immutable WHY) when the producer emits one, or `undefined` when it produces nothing (the
 * inert default). The producer is invoked EXACTLY ONCE. Throws (fail-loud) on an invalid producer,
 * an invalid context, or a malformed result — never repairs, never infers.
 */
export async function produceReasoning(
  producer: ReasoningProducer,
  context: ReasoningContext,
): Promise<SectionReasoning | undefined> {
  validateProducer(producer);
  validateContext(context);
  const result = await producer.produce(context);
  const reasoning = validateResult(result);
  return reasoning === undefined ? undefined : freezeReasoning(reasoning);
}
