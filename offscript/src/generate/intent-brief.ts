/**
 * Intent Brief artifact + persistence (schema: W3-S1).
 *
 * The Intent Brief is Offscript's persisted, replayable representation of *intent and
 * feel* — the Creative Director's output for one deliverable: the one thing,
 * what/why/how, register/constraints, anti-patterns. It lives in the project
 * workspace (`projects/<client>/<track>/intent-brief.md`), beside score.json /
 * manifest.json — NEVER in `resources/` (shared governance) and NEVER in session
 * memory (source-of-truth doctrine).
 *
 * W3-S1 SCOPE — strictly artifact + persistence + replay. This module:
 *   - defines the artifact shape (the frozen six-category model + an opaque stamp),
 *   - serializes/parses it deterministically (human-readable markdown),
 *   - writes it idempotently (mirrors src/generate/governance-version.ts writeManifest),
 *   - loads it back, distinguishing ABSENT (→ undefined) from MALFORMED (→ throw),
 *     exactly as src/generate/brief.ts loadBriefIfPresent does.
 *
 * It deliberately does NOT: validate categories or check for form-terms (the
 * readiness floor — W3-S2); emit any AuthoritySignal / Failure (W3-S3); get read by
 * the planner or author (consumption — W3-S4); or judge vagueness (W3-S5). It is
 * pure DATA movement. The brief-identity `briefStamp` is carried opaquely so a later
 * stage can compare it; W3-S1 neither computes nor compares it.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * The Intent Brief artifact (frozen six-category model — see
 * W3-CONTRACT-RECONCILIATION.md D-CAT). Intent only, never form. Each category is a
 * free-form string; W3-S1 does NOT validate them (an empty category is legitimate
 * data here — completeness is the W3-S2 floor's concern).
 */
export interface IntentBrief {
  /** The single reader-outcome the piece exists to create (carries the WHAT/objective). */
  oneThing: string;
  /** The deliverable and its single objective (the job, never the form). */
  what: string;
  /** The reader, their starting state, the change sought, the one action. */
  why: string;
  /** Register, mood, pace, emotional pitch (taste — abstract; never a value/structure). */
  how: string;
  /** Brand truths and medium laws that bound the piece (referenced, not re-derived). */
  constraints: string;
  /** What this piece must avoid. */
  antiPatterns: string;
  /**
   * Opaque brief-identity stamp (for later stale-detection — W3-S3). Carried
   * verbatim through (de)serialization; W3-S1 never computes or compares it.
   * Absent → no frontmatter is emitted.
   */
  briefStamp?: string;
}

/** Ordered (key → markdown heading) map — the canonical serialization order. */
const CATEGORIES: ReadonlyArray<readonly [keyof IntentBrief, string]> = [
  ['oneThing', 'The One Thing'],
  ['what', 'WHAT'],
  ['why', 'WHY'],
  ['how', 'HOW'],
  ['constraints', 'Constraints'],
  ['antiPatterns', 'Anti-patterns'],
];

const HEADING_TO_KEY: ReadonlyMap<string, keyof IntentBrief> = new Map(
  CATEGORIES.map(([key, label]) => [label, key]),
);

/**
 * Serialize an IntentBrief to deterministic, human-readable markdown:
 *   - an optional `---\nbriefStamp: …\n---` frontmatter block (only when stamped),
 *   - one `## <Heading>` section per category, in the canonical order.
 * Pure; no timestamp; identical input → identical bytes (so the writer is idempotent).
 */
export function serializeIntentBrief(ib: IntentBrief): string {
  const sections = CATEGORIES.map(([key, label]) => `## ${label}\n${(ib[key] as string) ?? ''}`);
  const body = sections.join('\n\n');
  const frontmatter = ib.briefStamp ? `---\nbriefStamp: ${ib.briefStamp}\n---\n\n` : '';
  return frontmatter + body + '\n';
}

/**
 * Parse markdown produced by serializeIntentBrief back into an IntentBrief.
 *
 * MALFORMED → throws (never silently demoted), in two cases:
 *   - a present `---…---` frontmatter block whose YAML is unparseable, or
 *   - no recognized category heading present at all (not an intent-brief.md).
 * A recognized-but-absent category parses to '' (W3-S1 does not validate).
 */
export function parseIntentBrief(raw: string): IntentBrief {
  const text = raw.replace(/^﻿/, '').trimStart();

  let body = text;
  let briefStamp: string | undefined;

  // Optional frontmatter — only when the file actually starts with a fence.
  if (text.startsWith('---')) {
    const fenceRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = fenceRe.exec(text);
    if (match) {
      const [, fmBlock, rest] = match;
      let fm: Record<string, unknown>;
      try {
        fm = (parseYaml(fmBlock) as Record<string, unknown>) ?? {};
      } catch (err) {
        throw new Error(
          `intent-brief.md: YAML parse error in frontmatter — ${(err as Error).message}`,
        );
      }
      if (fm['briefStamp'] != null) briefStamp = String(fm['briefStamp']);
      body = rest;
    }
  }

  // Group body lines under their most-recent `## ` heading.
  const found = new Map<string, string>();
  let curLabel: string | null = null;
  let buf: string[] = [];
  const flush = (): void => {
    if (curLabel !== null) found.set(curLabel, buf.join('\n').trim());
  };
  for (const line of body.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      curLabel = h[1].trim();
      buf = [];
    } else if (curLabel !== null) {
      buf.push(line);
    }
  }
  flush();

  const recognized = CATEGORIES.filter(([, label]) => found.has(label));
  if (recognized.length === 0) {
    throw new Error(
      'intent-brief.md: no recognized intent category headings found ' +
        '(expected at least one of: The One Thing, WHAT, WHY, HOW, Constraints, Anti-patterns).',
    );
  }

  const out: IntentBrief = {
    oneThing: '',
    what: '',
    why: '',
    how: '',
    constraints: '',
    antiPatterns: '',
  };
  for (const [label, value] of found) {
    const key = HEADING_TO_KEY.get(label);
    if (key && key !== 'briefStamp') (out[key] as string) = value;
  }
  if (briefStamp !== undefined) out.briefStamp = briefStamp;
  return out;
}

/**
 * Persist an IntentBrief to `filePath` as stable markdown. Mirrors writeManifest:
 * creates the parent dir, and is IDEMPOTENT — an identical existing file is left
 * untouched (no mtime bump). Pure I/O; emits no signal.
 *
 * Callers compose the path via `intentBriefPath(client, track)` (src/paths.ts) so
 * the write-path matches the buildContext read-path exactly.
 */
export function writeIntentBrief(filePath: string, ib: IntentBrief): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = serializeIntentBrief(ib);
  if (existsSync(filePath) && readFileSync(filePath, 'utf8') === content) return;
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Lenient loader for the replay path:
 *   - file ABSENT     → returns undefined (a legitimate skeleton state)
 *   - file PRESENT    → parse/validation errors PROPAGATE (loud)
 * The same distinction src/generate/brief.ts draws for briefs. No LLM, no
 * re-derivation — a pure read-back, which is what makes the artifact replayable.
 */
export function loadIntentBriefIfPresent(filePath: string): IntentBrief | undefined {
  if (!existsSync(filePath)) return undefined;
  return parseIntentBrief(readFileSync(filePath, 'utf8'));
}
