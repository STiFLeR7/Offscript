/**
 * CreativeIntentBuilder — turns one already-parsed _LOG.md line into a
 * Creative Intent payload (no digest, no envelope: the exporter composes
 * those separately, per CG7 §2's envelope/payload split).
 *
 * This module REUSES the decisions Repo B's Creative Intelligence Layer
 * already made (belief/feature/camera/ratio/must-include/content-provenance
 * are read verbatim off the log line) — it never re-derives, re-infers, or
 * re-reasons about any of them. Enum CORRECTNESS is the Validator's job
 * (schema-driven, single source of truth); this module only checks
 * PRESENCE — an absent required field means the source creative predates
 * the contract (pre-v5) or is otherwise incomplete, and is reported as
 * ineligible, never defaulted or guessed.
 */
import type { ParsedLogLine } from '../log/parser.js';
import { unquote, parseArray } from '../log/parser.js';
import type { CreativeIntentPayload } from './types.js';

export type BuildResult =
  | { ok: true; payload: CreativeIntentPayload }
  | { ok: false; reason: string };

const REQUIRED_RAW_FIELDS = [
  'camera',
  'ratio',
  'must-include',
  'content-provenance',
  'feature',
  'belief',
] as const;

export function buildCreativeIntentPayload(record: ParsedLogLine): BuildResult {
  if (record.raw.get('approved') !== 'yes') {
    return {
      ok: false,
      reason: `"${record.slug}" is not approved=yes — never export a rejected creative or a draft.`,
    };
  }

  const missing = REQUIRED_RAW_FIELDS.filter((f) => !record.raw.has(f));
  if (missing.length > 0) {
    return {
      ok: false,
      reason:
        `"${record.slug}" is missing required field(s) [${missing.join(', ')}] — ` +
        `this creative predates the Creative Intent contract (pre-v5) and is never retrofitted.`,
    };
  }

  const payload: CreativeIntentPayload = {
    id: record.slug,
    belief: unquote(record.raw.get('belief')!),
    feature: record.raw.get('feature')!,
    ratio: record.raw.get('ratio')!,
    camera: record.raw.get('camera')!,
    mustInclude: parseArray(record.raw.get('must-include')!),
    contentProvenance: record.raw.get('content-provenance')!,
  };

  const section = record.raw.get('section');
  if (section !== undefined) payload.section = section;

  return { ok: true, payload };
}
