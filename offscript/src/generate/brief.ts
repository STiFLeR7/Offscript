/**
 * Brief schema — the design system's official external input contract.
 *
 * A Offscript brief lives at projects/<client>/references/brief.md as a
 * markdown file with a YAML frontmatter block fenced by `---` lines.
 * This module splits the fences, parses the block with the `yaml` package
 * (already a project dependency), validates required fields, and returns
 * a typed Brief for use by the 4-stage generate pipeline.
 *
 * This is the STABLE, VERSIONED seam an external content-engine → brief adapter
 * targets (see docs/BRIEF-CONTRACT.md). The brief carries INTENT ONLY. Governance
 * — claims, approval gates, publishing safety — is NOT the design system's concern
 * and never appears here as load-bearing data; an adapter enforces it upstream and
 * may record it opaquely via `provenance` (audit-only, never interpreted).
 *
 * Expand only as real briefs arrive — YAGNI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { projectReferencesDir } from '../paths.js';
import type { Track } from '../paths.js';

export interface Brief {
  /** Always 1 for this schema generation. */
  schemaVersion: 1;
  /** The deliverable track: website | collateral | deck. */
  track: Track;
  /** Single sentence the deliverable must land. */
  oneLiner: string;
  /** Primary audience description. */
  audience: string;
  /** Ordered list of goals. */
  goals: string[];
  /** Named sections/pages/slides the plan must contain. */
  mustInclude: string[];
  /** Tone / voice descriptor. */
  tone: string;
  /** Measurable success criteria. */
  successCriteria: string[];
  /**
   * Display brand / product name for the deliverable (e.g. "Helix", "Example Brand").
   * Drives the client-neutral author contract's header + voice. Optional — falls
   * back to the titleized client id when absent.
   */
  brand?: string;
  /** Parent URL for sub-page projects — Rule 0 kicks in when set. */
  parentUrl?: string;
  /** Optional path (relative to references/) to a long-form source doc that grounds
   *  per-page content deterministically (WS4). Absent → no source grounding.
   *  This is the sanctioned channel for an adapter to pass a governed packet's body
   *  as verbatim grounding copy — see docs/BRIEF-CONTRACT.md. */
  sourceDoc?: string;
  /**
   * Opaque, non-load-bearing provenance stamp from whatever produced this brief
   * (e.g. an external content-engine → brief adapter). Carried VERBATIM into the
   * per-run manifest.json for audit — the engine NEVER interprets it and NO field
   * of it affects generation. This is the boundary-safe audit slot: it lets an
   * adapter record which governed packet (id / approval status / source hash /
   * upstream version, and future context such as domain/region) a run was built
   * from, WITHOUT the design system knowing anything about claims, gates, or
   * approvals. All values are coerced to strings. Absent → nothing recorded
   * (manifest stays byte-identical to a no-provenance run).
   */
  provenance?: Record<string, string>;
  /** Free-form brief body (everything after the closing --- fence). */
  body: string;
}

const VALID_TRACKS: ReadonlySet<string> = new Set(['website', 'collateral', 'deck']);

/**
 * The brief-contract versions this engine understands (major integers). Additive,
 * backward-compatible optional fields do NOT bump this; removing/retyping a field
 * or changing the required set does. Keep older supported majors listed during a
 * deprecation window so an adapter can migrate without a hard cutover.
 * See docs/BRIEF-CONTRACT.md.
 */
export const SUPPORTED_BRIEF_VERSIONS: ReadonlySet<number> = new Set([1]);

/** Every frontmatter key the engine recognizes — used only for drift diagnostics. */
const KNOWN_BRIEF_KEYS: ReadonlySet<string> = new Set([
  'schemaVersion',
  'track',
  'one-liner',
  'brand',
  'audience',
  'goals',
  'must-include',
  'tone',
  'success-criteria',
  'parent_url',
  'source-doc',
  'provenance',
]);

/**
 * Parse a raw brief.md string (frontmatter + body) into a validated Brief.
 * Pure function — no filesystem I/O — so it can be called from tests with
 * in-memory strings or fixture file content alike.
 *
 * Throws a descriptive Error listing all missing/invalid fields.
 */
export function parseBrief(raw: string): Brief {
  // Split on the YAML frontmatter fences: --- ... ---
  // The opening --- must be at the very start (possibly after a BOM / whitespace).
  const fenceRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/m;
  const match = fenceRe.exec(raw.trimStart());
  if (!match) {
    throw new Error(
      'brief.md: no valid frontmatter fences found. ' +
        'File must start with a --- ... --- YAML block.',
    );
  }
  const [, frontmatterBlock, bodyRaw] = match;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fm: Record<string, any>;
  try {
    fm = (parseYaml(frontmatterBlock) as Record<string, unknown>) ?? {};
  } catch (err) {
    throw new Error(`brief.md: YAML parse error in frontmatter — ${(err as Error).message}`);
  }

  // Validate required fields — collect all errors in one throw.
  const missing: string[] = [];
  if (fm['schemaVersion'] == null) missing.push('schemaVersion');
  if (!fm['track']) missing.push('track');
  if (!fm['one-liner']) missing.push('one-liner');
  if (missing.length > 0) {
    throw new Error(`brief.md: missing required field(s): ${missing.join(', ')}`);
  }

  // Guard the schema version against the supported set — fail loudly rather than
  // silently coercing. A documented compatibility policy (vs. a bare `=== 1`) gives
  // a future content-engine version bump a defined outcome instead of an opaque
  // hard-fail. See docs/BRIEF-CONTRACT.md and SUPPORTED_BRIEF_VERSIONS.
  const versionNum = Number(fm['schemaVersion']);
  if (!Number.isInteger(versionNum) || !SUPPORTED_BRIEF_VERSIONS.has(versionNum)) {
    const supported = [...SUPPORTED_BRIEF_VERSIONS].sort((a, b) => a - b).join(', ');
    throw new Error(
      `brief.md: unsupported schemaVersion ${String(fm['schemaVersion'])}. ` +
        `This engine understands schemaVersion: ${supported}. ` +
        `Emit a supported version or upgrade the design system (see docs/BRIEF-CONTRACT.md).`,
    );
  }

  // Validate track value.
  const rawTrack = String(fm['track']);
  if (!VALID_TRACKS.has(rawTrack)) {
    throw new Error(
      `brief.md: unknown track value "${rawTrack}". ` +
        `Valid values: website | collateral | deck.`,
    );
  }

  // Coerce optional arrays — yaml.parse gives null for empty "key:" fields.
  function toStringArray(v: unknown): string[] {
    if (!v || v === null) return [];
    if (Array.isArray(v)) return v.map(String);
    return [String(v)];
  }

  // Coerce optional string — null/missing → undefined.
  function toOptionalString(v: unknown): string | undefined {
    if (v == null || v === '') return undefined;
    return String(v);
  }

  // Opaque provenance — coerce a frontmatter mapping to Record<string,string>,
  // verbatim. Non-mapping / empty → undefined (nothing recorded). The engine never
  // reads these values; they exist only to be stamped into manifest.json for audit.
  function toProvenance(v: unknown): Record<string, string> | undefined {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val != null) out[k] = String(val);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  // Drift diagnostic (non-fatal): surface unrecognized frontmatter keys so an
  // adapter typo (e.g. `must_include` vs `must-include`) is loud, not silently
  // dropped. Warn only — never reject; unknown keys remain forward-compatible.
  const unknownKeys = Object.keys(fm).filter((k) => !KNOWN_BRIEF_KEYS.has(k));
  if (unknownKeys.length > 0) {
    console.warn(
      `brief.md: ignoring unrecognized frontmatter field(s): ${unknownKeys.join(', ')}. ` +
        `Check for a typo or an unsupported extension (see docs/BRIEF-CONTRACT.md).`,
    );
  }

  return {
    schemaVersion: 1,
    track: rawTrack as Track,
    oneLiner: String(fm['one-liner']),
    audience: fm['audience'] ? String(fm['audience']) : '',
    goals: toStringArray(fm['goals']),
    mustInclude: toStringArray(fm['must-include']),
    tone: fm['tone'] ? String(fm['tone']) : '',
    successCriteria: toStringArray(fm['success-criteria']),
    brand: toOptionalString(fm['brand']),
    parentUrl: toOptionalString(fm['parent_url']),
    sourceDoc: toOptionalString(fm['source-doc']),
    provenance: toProvenance(fm['provenance']),
    body: bodyRaw.trim(),
  };
}

/**
 * Load and parse the brief for a given client from
 * projects/<client>/references/brief.md.
 *
 * Strict: throws if the file does not exist OR fails validation. Use this when
 * a brief is genuinely required. The generate pipeline instead uses
 * `loadBriefIfPresent` (absent → null → `stubBrief`; malformed → propagates), so
 * a missing brief is a legitimate skeleton state while a malformed one still errors.
 */
export function loadBrief(client: string): Brief {
  const briefPath = join(projectReferencesDir(client), 'brief.md');
  let raw: string;
  try {
    raw = readFileSync(briefPath, 'utf8');
  } catch {
    throw new Error(
      `brief.md: no brief found at ${briefPath}. ` +
        `Drop a brief.md into projects/${client}/references/ to get started.`,
    );
  }
  return parseBrief(raw);
}

/**
 * Lenient sibling of loadBrief for the generate pipeline:
 *   - brief.md ABSENT     → returns null (caller substitutes a stub)
 *   - brief.md PRESENT    → parse/validation errors PROPAGATE
 *
 * The distinction matters: a *missing* brief is a legitimate skeleton-run
 * state, but a *present but malformed* brief is a real error that must not be
 * silently demoted to a stub. Callers do `loadBriefIfPresent(c) ?? stubBrief(t)`.
 */
export function loadBriefIfPresent(client: string): Brief | null {
  const briefPath = join(projectReferencesDir(client), 'brief.md');
  if (!existsSync(briefPath)) return null;
  return parseBrief(readFileSync(briefPath, 'utf8'));
}

/** A minimal placeholder Brief for skeleton runs with no brief.md present. */
export function stubBrief(track: Track): Brief {
  return {
    schemaVersion: 1,
    track,
    oneLiner: '(stub — no brief.md yet)',
    audience: '',
    goals: [],
    mustInclude: [],
    tone: '',
    successCriteria: [],
    body: '',
  };
}
