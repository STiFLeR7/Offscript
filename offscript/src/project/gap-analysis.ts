/**
 * P50 — Gap analysis: bucket each REQUIRED field against the inferred facts and derive the dynamic
 * interview. A field is Known (has a trusted, unconflicted fact), Unknown (no evidence),
 * Conflicting (credible sources disagree), or Low-confidence (evidence too weak). Only the
 * non-Known required fields become questions — in required order — so a fully-evidenced project
 * asks nothing. The interview is generated FROM the gaps; there is no fixed question flow.
 */
import { DEFAULT_CONFIDENCE_THRESHOLD, type InferredFact } from './inference.js';

export type GapKind = 'known' | 'unknown' | 'conflicting' | 'low-confidence';

export interface FieldGap {
  readonly field: string;
  readonly kind: GapKind;
  /** The fact behind a conflicting / low-confidence gap (absent for unknown). */
  readonly fact?: InferredFact;
}

export interface GapReport {
  readonly required: string[];
  readonly known: string[];
  readonly unknown: string[];
  readonly conflicting: string[];
  readonly lowConfidence: string[];
  /** Required fields that are NOT known — the dynamic interview, in required order. */
  readonly questions: string[];
  readonly gaps: FieldGap[];
}

export interface GapOptions {
  readonly threshold?: number;
}

export function analyzeGaps(required: readonly string[], facts: readonly InferredFact[], opts: GapOptions = {}): GapReport {
  const threshold = opts.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const factByField = new Map(facts.map((f) => [f.field, f]));

  const known: string[] = [];
  const unknown: string[] = [];
  const conflicting: string[] = [];
  const lowConfidence: string[] = [];
  const gaps: FieldGap[] = [];
  const questions: string[] = [];

  for (const field of required) {
    const fact = factByField.get(field);
    let kind: GapKind;
    if (!fact) kind = 'unknown';
    else if (fact.conflicting) kind = 'conflicting';
    else if (fact.confidence >= threshold) kind = 'known';
    else kind = 'low-confidence';

    if (kind === 'known') known.push(field);
    else if (kind === 'unknown') unknown.push(field);
    else if (kind === 'conflicting') conflicting.push(field);
    else lowConfidence.push(field);

    if (kind !== 'known') {
      gaps.push({ field, kind, fact });
      questions.push(field);
    }
  }

  return { required: [...required], known, unknown, conflicting, lowConfidence, questions, gaps };
}
