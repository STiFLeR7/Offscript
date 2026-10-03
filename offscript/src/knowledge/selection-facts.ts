/**
 * Sprint 2.1 — Stage 1 repository enrichment: the selection-fact band-mapper.
 *
 * Pure, deterministic transform from an authored COMPOSITION row's selection cells onto
 * the FROZEN four-band model (ES-1R §4 — no new band, no new region):
 *
 *   serves   → capabilities.satisfies, prefixed `serves:`    (obligations namespace)
 *   surface  → capabilities.satisfies, prefixed `surface:`   (obligations namespace)
 *   limits   → validation.expects, one `key:value` token per authored {limit}
 *
 * The prefixes keep serves and surface independently queryable within the single
 * obligations namespace `capabilities.satisfies` validates against. This module never
 * invents a fact: an empty cell yields no token (absence is meaning), and a non-empty
 * value that normalizes to nothing is a malformed authored value and fails loud.
 *
 * Knowledge-layer + self-contained: it owns the band mapping only; the COMPOSITION.md
 * reader (composition-md.ts) supplies the RawSelection shape via structural typing.
 */

export const SERVES_PREFIX = 'serves:';
export const SURFACE_PREFIX = 'surface:';

/** The authored selection cells of one COMPOSITION row (serialization-independent shape). */
export interface RawSelection {
  readonly serves: readonly string[];
  readonly surface: readonly string[];
  readonly limits: {
    readonly maxPerPage?: number;
    readonly minBands?: number;
    readonly avoidAdjacent?: string;
    readonly avoidAdjacentSurface?: string;
  };
}

/** Band-ready token lists, sorted + deduped (canonical). */
export interface SelectionFacts {
  /** capabilities.satisfies tokens (serves:* and surface:*). */
  readonly satisfies: string[];
  /** validation.expects tokens (limit annotations). */
  readonly expects: string[];
}

/** Deterministic, OS-stable token: NFC, lowercase, non-alnum → '-', trimmed. */
function token(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tag(prefix: string, raw: string, kind: string): string {
  const t = token(raw);
  if (t === '') {
    throw new Error(`selection-facts: ${kind} value "${raw}" normalizes to nothing (malformed authored value).`);
  }
  return prefix + t;
}

function sortedUnique(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

/**
 * Map an authored row's selection cells onto band tokens. Pure + fail-loud; never invents.
 */
export function toSelectionFacts(raw: RawSelection): SelectionFacts {
  const satisfies: string[] = [];
  for (const s of raw.serves) satisfies.push(tag(SERVES_PREFIX, s, 'serves'));
  for (const s of raw.surface) satisfies.push(tag(SURFACE_PREFIX, s, 'surface'));

  const expects: string[] = [];
  const { maxPerPage, minBands, avoidAdjacent, avoidAdjacentSurface } = raw.limits;
  if (maxPerPage !== undefined) expects.push(`maxPerPage:${maxPerPage}`);
  if (minBands !== undefined) expects.push(`minBands:${minBands}`);
  if (avoidAdjacent !== undefined) expects.push(`avoidAdjacent:${token(avoidAdjacent)}`);
  if (avoidAdjacentSurface !== undefined) expects.push(`avoidAdjacentSurface:${token(avoidAdjacentSurface)}`);

  return { satisfies: sortedUnique(satisfies), expects: sortedUnique(expects) };
}

/**
 * Join a variant slug to its authored selection facts, fail-loud when no row exists —
 * the "no authored source ⇒ fail loud, never guess" guard.
 */
export function resolveVariantFacts(
  slug: string,
  map: ReadonlyMap<string, RawSelection>,
): SelectionFacts {
  const raw = map.get(slug);
  if (raw === undefined) {
    throw new Error(`selection-facts: variant "${slug}" has no authored COMPOSITION row — refusing to guess.`);
  }
  return toSelectionFacts(raw);
}

/**
 * Required-metadata gate: a materialized variant must carry at least one serves: and one
 * surface: fact. Fail-loud at authoring time (the Builder model stays generic — families
 * legitimately carry none, so this domain rule lives here, not in the Builder).
 */
export function assertCompleteVariantFacts(slug: string, facts: SelectionFacts): void {
  const hasServes = facts.satisfies.some((t) => t.startsWith(SERVES_PREFIX));
  const hasSurface = facts.satisfies.some((t) => t.startsWith(SURFACE_PREFIX));
  if (!hasServes) throw new Error(`selection-facts: variant "${slug}" has no authored serves fact.`);
  if (!hasSurface) throw new Error(`selection-facts: variant "${slug}" has no authored surface fact.`);
}
