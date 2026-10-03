/**
 * Sprint X — the scripted ModelDeriver double + the in-session subagent seam.
 *
 * Mirrors the authoring seam exactly: a deterministic scripted double for CI/verification, plus a
 * `createSubagentDeriver` factory that routes real derivation through an injected dispatch — the
 * in-session LLM path, NOT wired by default.
 *
 * GUARDRAIL — the scripted double is a double, NOT evidence. It emits INERT drafts: every authored
 * category is present (so the schema is satisfied and the lifecycle/identity/replay machinery is
 * provable) with `null` content. It performs NO reasoning, NO heuristics, NO interpretation, and
 * does NOT read the brief — so it can never fabricate design intelligence. Real, on-brand
 * derivation comes only from the subagent seam.
 */
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft } from './models.js';
import type { ModelDeriver, DerivationRequest } from './deriver.js';

/** Build the seven INERT drafts: schema-complete, every category content = null. */
function inertDrafts(): ModelDraft[] {
  return MODEL_KINDS.map((kind) => {
    const categories: Record<string, unknown> = {};
    for (const c of MODEL_SCHEMA[kind].categories) categories[c.key] = null;
    return { kind, categories, rationale: 'scripted: inert placeholder (no reasoning)' };
  });
}

/**
 * The deterministic scripted double — for CI and verification ONLY. Schema-satisfying, inert,
 * brief-independent. There is no heuristic production implementation by design.
 */
export function defaultScriptedDeriver(): ModelDeriver {
  return {
    name: 'derivation::scripted',
    derive: () => inertDrafts(),
  };
}

/** A test helper: a deriver that returns the supplied drafts verbatim. */
export function scriptedDeriver(drafts: readonly ModelDraft[]): ModelDeriver {
  return {
    name: 'derivation::scripted-fixture',
    derive: () => drafts,
  };
}

/** The dispatch a subagent deriver delegates real reasoning to. */
export interface SubagentDispatch {
  dispatch(request: DerivationRequest): Promise<readonly ModelDraft[]>;
}

/**
 * The in-session LLM derivation seam. Routes the request to an injected dispatch that produces
 * real, brief-grounded drafts (validated against the constitutional schema by the lifecycle).
 * This is the on-brand derivation intelligence — but it is NOT wired by default; a caller must
 * construct it explicitly with a dispatch.
 */
export function createSubagentDeriver(deps: SubagentDispatch): ModelDeriver {
  return {
    name: 'derivation::subagent',
    derive: (request) => deps.dispatch(request),
  };
}
