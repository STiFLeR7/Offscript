/**
 * P47 — cross-page novelty persistence: the per-deliverable section-usage store.
 *
 * The website fragment picker (`pickFragment`, catalog.ts) already ranks a cross-page rotation
 * key ("least-recently-used across prior pages") — but its `recent` memory was never fed: every
 * generation started from `new Map()`, so similar briefs landed on the same winners run after run
 * (FINDINGS-SECTION-VARIETY-COLLAPSE.md §4, Candidate Remedy #1). This module is that missing
 * memory: a slug→cumulative-use-count history persisted across `generate.ts` invocations, read as
 * an EXPLICIT selection input and written back after each generation.
 *
 * Canonical identity = the fragment SLUG (= the selected `fragmentId`, the band that actually
 * ships and exactly the key `pickFragment` reads via `recent.get(f.slug)`).
 *
 * Discipline: pure functions only — no hidden mutable state, no global cache, no randomness, no
 * decay. `recordSectionUsage` returns a NEW map and never mutates its input; serialization is
 * deterministic (sorted keys) so the store is stable, diffable, and replay-reproducible. Absent
 * store ⇒ empty history ⇒ the first generation is byte-identical to the pre-P47 baseline; the
 * variety shift appears only once real history has accumulated. A corrupt store fails loud rather
 * than silently discarding a client's accumulated memory.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** slug → cumulative number of prior generations that shipped that section. */
export type SectionUsageHistory = ReadonlyMap<string, number>;

/** The starting state for a new client / new deliverable. */
export const EMPTY_SECTION_USAGE: SectionUsageHistory = new Map();

/**
 * Read the persisted history. Absent file ⇒ empty (new client / new deliverable — migration-safe,
 * and byte-identical to the pre-P47 `new Map()` default). A present-but-corrupt store throws: a
 * client's accumulated novelty memory is never silently discarded.
 */
export function readSectionUsage(filePath: string): SectionUsageHistory {
  if (!existsSync(filePath)) return EMPTY_SECTION_USAGE;
  const raw = readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `section-usage: ${filePath} is not valid JSON (${(err as Error).message}). ` +
        `Delete it to reset this deliverable's cross-page section history.`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`section-usage: ${filePath} must be a JSON object of "<slug>": <count>.`);
  }
  const out = new Map<string, number>();
  for (const [slug, count] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(
        `section-usage: ${filePath} entry "${slug}" = ${String(count)} is not a non-negative integer.`,
      );
    }
    out.set(slug, count);
  }
  return out;
}

/**
 * Deterministic serialization — keys sorted so the same history always yields identical bytes
 * (stable diffs, replay-reproducible). Trailing newline for POSIX-clean files.
 */
export function serializeSectionUsage(history: ReadonlyMap<string, number>): string {
  const sorted = [...history.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(Object.fromEntries(sorted), null, 2) + '\n';
}

/** Persist the history to disk (deterministic bytes). */
export function writeSectionUsage(filePath: string, history: ReadonlyMap<string, number>): void {
  writeFileSync(filePath, serializeSectionUsage(history), 'utf8');
}

/**
 * Pure update: return a NEW history with each slug's count incremented by one occurrence in
 * `slugs`. The `prior` map is never mutated (no hidden mutable state). Repeated slugs increment
 * cumulatively.
 */
export function recordSectionUsage(
  prior: ReadonlyMap<string, number>,
  slugs: Iterable<string>,
): SectionUsageHistory {
  const next = new Map(prior);
  for (const slug of slugs) next.set(slug, (next.get(slug) ?? 0) + 1);
  return next;
}
