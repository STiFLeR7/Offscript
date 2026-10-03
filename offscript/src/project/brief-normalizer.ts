/**
 * P49 — Brief Normalizer: the single convergence point for every brief source.
 *
 * Every source (manual interview, Content-Core adapter, or any future source) builds a common
 * `NormalizedBriefInput` and serializes it HERE, into the exact `brief.md` shape the UNCHANGED
 * pipeline parser (`src/generate/brief.ts` → `parseBrief`) reads. Convergence is therefore a
 * property of THIS module, not of trusting two producers to agree: equal input ⇒ byte-identical
 * brief.md, by construction.
 *
 * The Canonical Brief contract is owned upstream by `src/generate/brief.ts` — this module never
 * redefines it; it only emits it. Deterministic (fixed key order, absent optionals omitted, no
 * clock/rng) so briefs are diffable and replayable.
 */
import { stringify as stringifyYaml } from 'yaml';
import type { Track } from '../paths.js';
import { parseBrief } from '../generate/brief.js';

/** The common intermediate every brief source produces. Optional fields omitted from output. */
export interface NormalizedBriefInput {
  readonly track: Track;
  readonly oneLiner: string;
  readonly brand?: string;
  readonly audience?: string;
  readonly goals?: readonly string[];
  readonly mustInclude?: readonly string[];
  readonly tone?: string;
  readonly successCriteria?: readonly string[];
  readonly parentUrl?: string;
  /** Filename (relative to references/) of a long-form grounding source doc. */
  readonly sourceDoc?: string;
  /** Opaque provenance stamp (audit-only; the engine never interprets it). */
  readonly provenance?: Record<string, string>;
  /** Free-form brief body. */
  readonly body?: string;
}

const VALID_TRACKS: ReadonlySet<string> = new Set(['website', 'collateral', 'deck']);

/** Serialize a NormalizedBriefInput into canonical `brief.md` text. Round-trips through parseBrief. */
export function normalizeBrief(input: NormalizedBriefInput): string {
  if (!input.track || !VALID_TRACKS.has(input.track)) {
    throw new Error(`brief normalizer: track must be one of website|collateral|deck (got "${String(input.track)}").`);
  }
  if (!input.oneLiner || !input.oneLiner.trim()) {
    throw new Error('brief normalizer: "one-liner" is required and must be non-empty.');
  }

  // Frontmatter built in a FIXED key order (matches the engine's recognized keys). Absent
  // optionals are omitted entirely — never emitted as empty keys — so a minimal brief stays clean
  // and two equivalent inputs serialize identically regardless of caller key order.
  const fm: Record<string, unknown> = { schemaVersion: 1, track: input.track };
  if (present(input.brand)) fm['brand'] = input.brand;
  fm['one-liner'] = input.oneLiner;
  if (present(input.audience)) fm['audience'] = input.audience;
  if (nonEmpty(input.goals)) fm['goals'] = [...input.goals!];
  if (nonEmpty(input.mustInclude)) fm['must-include'] = [...input.mustInclude!];
  if (present(input.tone)) fm['tone'] = input.tone;
  if (nonEmpty(input.successCriteria)) fm['success-criteria'] = [...input.successCriteria!];
  if (present(input.parentUrl)) fm['parent_url'] = input.parentUrl;
  if (present(input.sourceDoc)) fm['source-doc'] = input.sourceDoc;
  const prov = normalizeProvenance(input.provenance);
  if (prov) fm['provenance'] = prov;

  const yaml = stringifyYaml(fm, { lineWidth: 0 }).trimEnd();
  const body = (input.body ?? '').trim();
  const md = body.length > 0 ? `---\n${yaml}\n---\n\n${body}\n` : `---\n${yaml}\n---\n`;

  // Round-trip invariant: what we emit must parse cleanly under the UNCHANGED contract.
  parseBrief(md);
  return md;
}

function present(v: string | undefined): v is string {
  return v != null && v.trim().length > 0;
}
function nonEmpty(v: readonly string[] | undefined): boolean {
  return Array.isArray(v) && v.length > 0;
}
/** Sort provenance keys so equal maps serialize identically regardless of insertion order. */
function normalizeProvenance(p: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!p) return undefined;
  const keys = Object.keys(p).filter((k) => p[k] != null && String(p[k]).length > 0).sort();
  if (keys.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(p[k]);
  return out;
}
