/**
 * P50 — Evidence model: the common, attributable schema every discovery source emits.
 *
 * A single observed fact about ONE canonical-brief field, tagged with where it came from and how
 * much to trust it. No free-form assumptions — every value carries its source, confidence, origin,
 * and (optionally) the artifact backing it. This is the shared contract that lets the inference
 * engine merge heterogeneous sources uniformly; a new provider only has to speak Evidence.
 *
 * Confidence is a 0..1 scalar (named bands are readability conventions, not an enum — a provider
 * may pick any value). The interview is itself an evidence source: the highest-authority one.
 */

/** Canonical-brief artifact keys evidence can target (the kebab vocabulary the registry speaks). */
export const CANONICAL_FIELDS = [
  'one-liner',
  'audience',
  'brand',
  'tone',
  'goals',
  'must-include',
  'success-criteria',
  'source-doc',
] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** Confidence bands — conventions used by the shipped providers. `CERTAIN` marks an authoritative
 *  (human / exact) source that overrides discovered context rather than conflicting with it. */
export const CONFIDENCE = { LOW: 0.3, MEDIUM: 0.6, HIGH: 0.9, CERTAIN: 1 } as const;

/** One attributable observation about a canonical-brief field. */
export interface Evidence {
  /** Canonical artifact key (a CanonicalField; kept as string for provider extensibility). */
  readonly field: string;
  /** The observed value — a string, or a string[] for list fields. */
  readonly value: unknown;
  /** Provider id that produced it (e.g. 'existing-brief', 'brand-kit', 'interview'). */
  readonly source: string;
  /** 0..1 trust scalar. */
  readonly confidence: number;
  /** ISO-8601 observation timestamp (injected — deterministic, no clock in pure code). */
  readonly timestamp: string;
  /** Where it physically came from (a file path, 'manifest', 'interview'). */
  readonly origin: string;
  /** The named artifact backing the evidence, when there is one. */
  readonly supportingArtifact?: string;
}

/** kebab canonical field → the camelCase answer key the brief-normalizer path consumes. */
export const FIELD_TO_ANSWER_KEY: Readonly<Record<string, string>> = {
  'one-liner': 'oneLiner',
  audience: 'audience',
  brand: 'brand',
  tone: 'tone',
  goals: 'goals',
  'must-include': 'mustInclude',
  'success-criteria': 'successCriteria',
  'source-doc': 'sourceDoc',
};

/** True for a non-empty string or a non-empty array (an "" / [] value carries no information). */
export function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

/**
 * Map gathered interview answers → CERTAIN interview evidence, so discovered context and the
 * interview flow through ONE inference path. Reads either the camelCase or kebab key per field.
 */
export function answersToEvidence(answers: Record<string, unknown> | undefined, now: string): Evidence[] {
  if (!answers) return [];
  const out: Evidence[] = [];
  for (const [field, answerKey] of Object.entries(FIELD_TO_ANSWER_KEY)) {
    const v = answers[answerKey] ?? answers[field];
    if (hasValue(v)) {
      out.push({ field, value: v, source: 'interview', confidence: CONFIDENCE.CERTAIN, timestamp: now, origin: 'interview' });
    }
  }
  return out;
}
