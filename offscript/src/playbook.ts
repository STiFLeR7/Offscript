import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from './paths.js';

/**
 * Parser for `resources/design_processes/SECTION_INTELLIGENCE.md`.
 *
 * The playbook is project-invariant marketing-page guidance. Rails / passes
 * reference it by anchor (`§N.M`); the actuator instruction composer
 * (`src/instruction.ts`) resolves anchor lists to verbatim excerpts that get
 * embedded in the subagent's instruction. Pure parser; never read by the
 * engine itself.
 *
 * Determinism: anchor list sorted before resolution; missing anchors throw
 * loudly so a planning bug fails at dispatch time, not silently.
 *
 * Spec: docs/superpowers/plans/2026-05-28-offscript-actuator-instruction-composition.md
 */

/** Map keyed by anchor id (e.g., '§4.1') -> the verbatim section block. */
export type Playbook = Map<string, string>;

const HEADING_RE = /^### (\d+\.\d+) (.+)$/;
const STOP_RE = /^(### \d+\.\d+ |## )/;

/**
 * Parse a SECTION_INTELLIGENCE.md-shaped markdown string into anchor → excerpt.
 * The excerpt is the verbatim block from the `### N.M` heading line up to (but
 * not including) the next `### N.M` or `## ` heading. Trailing whitespace on
 * the last line is preserved so byte-exactness with the source holds.
 */
export function parsePlaybook(md: string): Playbook {
  // CRLF-tolerant split: a Windows checkout (core.autocrlf=true) can deliver
  // \r\n, and the `$`-anchored HEADING_RE below will not match a line that
  // still carries a trailing \r. Normalising here keeps the loader robust
  // regardless of how the reference docs were checked out.
  const lines = md.split(/\r?\n/);
  const out: Playbook = new Map();
  let i = 0;
  while (i < lines.length) {
    const m = HEADING_RE.exec(lines[i]);
    if (!m) {
      i += 1;
      continue;
    }
    const id = `§${m[1]}`;
    const start = i;
    let j = i + 1;
    while (j < lines.length && !STOP_RE.test(lines[j])) j += 1;
    out.set(id, lines.slice(start, j).join('\n'));
    i = j;
  }
  return out;
}

/** Cache so a process reads the canonical file at most once. */
let cached: Playbook | undefined;

/** Default path: `resources/design_processes/website/SECTION_INTELLIGENCE.md`. */
function defaultPath(): string {
  return join(designProcessesDir('website'), 'SECTION_INTELLIGENCE.md');
}

/**
 * True when the canonical playbook file is on disk. It is absent under the
 * post-website-pivot author-from-governance layout, so the instruction composer
 * guards `loadPlaybook()` with this and degrades the playbook-excerpts section
 * rather than throwing ENOENT at module load (harden-path migration, #46).
 */
export function playbookAvailable(): boolean {
  return existsSync(defaultPath());
}

/** Load and parse the canonical playbook (cached). Tests can pass a path. */
export function loadPlaybook(path?: string): Playbook {
  if (path) return parsePlaybook(readFileSync(path, 'utf8'));
  if (!cached) cached = parsePlaybook(readFileSync(defaultPath(), 'utf8'));
  return cached;
}

/** Test-only: drop the cached default playbook. */
export function _resetPlaybookCache(): void {
  cached = undefined;
}

/**
 * Resolve an anchor list to a single string of verbatim excerpts.
 *
 * - Anchors are sorted (lexical on the §N.M key) before joining → deterministic.
 * - Duplicates collapse to one excerpt.
 * - Excerpts are separated by a single blank line (the trailing newline of each
 *   block already exists; we add no extra framing).
 * - Unknown anchor throws RangeError with the offending id — planning bugs fail
 *   loud at dispatch time.
 */
export function resolvePlaybookAnchors(anchors: string[], playbook?: Playbook): string {
  const book = playbook ?? loadPlaybook();
  const unique = Array.from(new Set(anchors)).sort();
  const parts: string[] = [];
  for (const id of unique) {
    const excerpt = book.get(id);
    if (excerpt === undefined) {
      throw new RangeError(
        `resolvePlaybookAnchors: unknown anchor "${id}". Known anchors: ${Array.from(book.keys()).join(', ')}`,
      );
    }
    parts.push(excerpt);
  }
  return parts.join('\n\n');
}
