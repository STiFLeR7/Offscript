/**
 * P50 — Inference engine: combine attributable evidence into candidate facts.
 *
 * Per field: group evidence by value, aggregate each distinct value's confidence (corroborating
 * sources reinforce it, capped at 1), and pick the strongest as the winning value. A field is
 * CONFLICTING when a second distinct value is also independently credible (both ≥ threshold) —
 * unless the winner is AUTHORITATIVE (a CERTAIN interview/exact source), in which case it overrides
 * discovered context rather than conflicting with it. Pure + deterministic (field-sorted, stable
 * tie-break), so the reasoning replays.
 */
import { CONFIDENCE, type Evidence } from './evidence.js';

/** Confidence at or above which a single, unconflicted fact suppresses its interview question. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

/** Per-additional corroborating source, this much confidence is added (capped at 1). */
const CORROBORATION_BUMP = 0.1;

export interface AlternativeValue {
  readonly value: unknown;
  readonly confidence: number;
  readonly sources: string[];
}

/** A field's inferred candidate fact — the winning value plus its audit trail. */
export interface InferredFact {
  readonly field: string;
  readonly value: unknown;
  /** Aggregated confidence of the WINNING value. */
  readonly confidence: number;
  /** Two distinct credible values disagree (and no authoritative source settles it). */
  readonly conflicting: boolean;
  /** The winning value comes from a CERTAIN (human/exact) source — it overrides context. */
  readonly authoritative: boolean;
  /** Provider ids backing the winning value (sorted, deduped). */
  readonly sources: string[];
  /** Other distinct values that were also ≥ threshold (the losers in a conflict). */
  readonly alternatives: AlternativeValue[];
  /** All evidence considered for this field. */
  readonly evidence: Evidence[];
}

export interface InferenceOptions {
  readonly threshold?: number;
}

function valueKey(v: unknown): string {
  return JSON.stringify(v);
}
function uniqueSorted(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

export function inferFacts(evidence: readonly Evidence[], opts: InferenceOptions = {}): InferredFact[] {
  const threshold = opts.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const byField = new Map<string, Evidence[]>();
  for (const e of evidence) {
    const list = byField.get(e.field) ?? [];
    list.push(e);
    byField.set(e.field, list);
  }

  const facts: InferredFact[] = [];
  for (const field of [...byField.keys()].sort()) {
    const evs = byField.get(field)!;

    // Group by distinct value, aggregate each value's confidence.
    const byValue = new Map<string, { value: unknown; evs: Evidence[] }>();
    for (const e of evs) {
      const k = valueKey(e.value);
      const g = byValue.get(k) ?? { value: e.value, evs: [] };
      g.evs.push(e);
      byValue.set(k, g);
    }
    const candidates = [...byValue.entries()].map(([key, g]) => {
      const maxRaw = Math.max(...g.evs.map((e) => e.confidence));
      const agg = Math.min(1, maxRaw + CORROBORATION_BUMP * (g.evs.length - 1));
      return { key, value: g.value, agg, maxRaw, sources: uniqueSorted(g.evs.map((e) => e.source)) };
    });
    // Winner: highest aggregated confidence; deterministic tie-break by value key.
    candidates.sort((a, b) => b.agg - a.agg || a.key.localeCompare(b.key));
    const winner = candidates[0];

    const authoritative = winner.maxRaw >= CONFIDENCE.CERTAIN;
    const credibleRivals = candidates.slice(1).filter((c) => c.agg >= threshold);
    const conflicting = !authoritative && credibleRivals.length > 0;

    facts.push({
      field,
      value: winner.value,
      confidence: winner.agg,
      conflicting,
      authoritative,
      sources: winner.sources,
      alternatives: credibleRivals.map((c) => ({ value: c.value, confidence: c.agg, sources: c.sources })),
      evidence: evs,
    });
  }
  return facts;
}

/** Known (non-conflicting, ≥ threshold) facts, keyed by canonical field → winning value. */
export function knownValues(facts: readonly InferredFact[], threshold = DEFAULT_CONFIDENCE_THRESHOLD): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of facts) if (!f.conflicting && f.confidence >= threshold) out[f.field] = f.value;
  return out;
}
