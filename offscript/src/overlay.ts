/**
 * overlay/ — durable record of escalated (frozen) regions.
 *
 * WP1.E.1 (the WP1.5 escalation half). When `actuatePass` returns
 * `status: 'escalated'`, the residual violations name regions the
 * systematic core could not bring into bounds. Per the bounded-LLM spec
 * (vision §6, §8.2), those regions become **frozen bespoke** — stored,
 * but never replayed: "you owned X; upstream changed; re-decide".
 *
 * This module is the library half of that contract. It deliberately
 * leaves `actuatePass` untouched (it stays pure: html in, DecisionLogEntry
 * out). An orchestrator (a script or the live actuator runner) wires the
 * helpers together as:
 *
 *   const frozen = readOverlay(overlayDir);
 *   const { live } = filterFrozenFindings(findings, frozen);
 *   // … run actuatePass on rails that target only `live` …
 *   if (outcome.log.status === 'escalated') {
 *     const f = freezeFromDecisionLog(outcome.log, { decidedBy: 'actuator', snapshotHtml: outcome.html });
 *     writeOverlay(overlayDir, f);
 *   }
 *
 * A follow-up WP wires this into `npm run harden` / the live actuator;
 * this WP delivers the library + tests only.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { DecisionLogEntry } from './actuation.js';
import type { Finding } from './operator.js';

/** A frozen bespoke region — stored once, never replayed. */
export interface Frozen {
  /**
   * Stable id: `${pass}:<short-hash-of-sorted-findingIds>` — content-derived,
   * NOT time-derived. The same finding-set produces the same id across runs,
   * so re-hardening an unchanged kit is a filesystem no-op (the content-compare
   * in `writeOverlay` short-circuits the write).
   */
  id: string;
  /** Name of the pass that escalated. */
  pass: string;
  /** Ids of the findings that were unresolved when the pass escalated. */
  findingIds: string[];
  /** Optional snapshot of the working HTML at the moment of freeze. */
  snapshotHtml?: string;
  /** Optional human-readable note (why it was frozen, hand-off context). */
  reason?: string;
  /**
   * ISO timestamp the freeze decision was FIRST made. Not part of identity —
   * `writeOverlay` preserves the existing on-disk `decidedAt` when overwriting
   * an entry with the same id, so the first-decided moment is stable across
   * subsequent re-runs.
   */
  decidedAt: string;
  /** Who/what made the decision (e.g. 'actuator', 'reviewer:hill'). */
  decidedBy: string;
}

/**
 * Build a `Frozen` from an escalated DecisionLogEntry. Throws if the entry
 * is not `escalated` — passed entries have nothing to freeze.
 */
export function freezeFromDecisionLog(
  entry: DecisionLogEntry,
  opts: { decidedBy: string; snapshotHtml?: string; reason?: string; now?: () => string },
): Frozen {
  if (entry.status !== 'escalated') {
    throw new Error(
      `freezeFromDecisionLog: expected entry.status === 'escalated', got '${entry.status}' (pass '${entry.pass}')`,
    );
  }
  const decidedAt = (opts.now ?? (() => new Date().toISOString()))();
  const findingIds = entry.residualViolations.map((v) => v.id);
  const frozen: Frozen = {
    id: `${entry.pass}:${shortHashOfFindingIds(findingIds)}`,
    pass: entry.pass,
    findingIds,
    decidedAt,
    decidedBy: opts.decidedBy,
  };
  if (opts.snapshotHtml !== undefined) frozen.snapshotHtml = opts.snapshotHtml;
  if (opts.reason !== undefined) frozen.reason = opts.reason;
  return frozen;
}

/** Replace filesystem-unsafe chars in an id to derive a filename stem. */
function safeStem(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * First 12 hex chars of sha256(sortedFindingIds.join('\n')). Stable across
 * runs, immune to input ordering, and short enough to keep filenames tidy.
 * An empty finding-set hashes deterministically too (degenerate but valid).
 */
function shortHashOfFindingIds(findingIds: string[]): string {
  const sorted = [...findingIds].sort();
  const h = createHash('sha256');
  h.update(sorted.join('\n'));
  return h.digest('hex').slice(0, 12);
}

/** Stable JSON: sorted keys, 2-space pretty-print, terminating newline. */
function stableStringify(frozen: Frozen): string {
  return JSON.stringify(frozen, Object.keys(frozen).sort(), 2) + '\n';
}

/**
 * Write a Frozen to `<overlayDir>/<safe-id>.json`, plus a sibling
 * `<safe-id>.html` if `snapshotHtml` is present. Idempotent: if the
 * target file's content is already identical, the file is left untouched
 * (mtime is not bumped). Returns the absolute path to the JSON file.
 */
export function writeOverlay(overlayDir: string, frozen: Frozen): string {
  fs.mkdirSync(overlayDir, { recursive: true });
  const stem = safeStem(frozen.id);
  const jsonPath = path.join(overlayDir, `${stem}.json`);

  // Preserve the FIRST decidedAt across re-writes — identity is content-derived
  // (the hash of sorted findingIds), so an existing file with the same id is the
  // same logical entry. Its original decidedAt is the truthful first-decided
  // moment; the caller's freshly-stamped one is just "now" and would churn the
  // content. Read-merge on decidedAt only; everything else comes from the caller.
  let toWrite = frozen;
  if (fs.existsSync(jsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as unknown;
      if (isFrozen(existing) && existing.id === frozen.id) {
        toWrite = { ...frozen, decidedAt: existing.decidedAt };
      }
    } catch {
      // malformed existing file — fall through and overwrite with the new content
    }
  }
  writeIfChanged(jsonPath, stableStringify(toWrite));

  if (frozen.snapshotHtml !== undefined) {
    const htmlPath = path.join(overlayDir, `${stem}.html`);
    writeIfChanged(htmlPath, frozen.snapshotHtml);
  }
  return jsonPath;
}

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Read all `Frozen` entries from `overlayDir`, sorted ascending by
 * `decidedAt`. Returns `[]` if the dir doesn't exist. Non-JSON files and
 * malformed JSON are silently skipped (a `<id>.html` snapshot sitting
 * next to its JSON is expected and ignored here).
 */
export function readOverlay(overlayDir: string): Frozen[] {
  if (!fs.existsSync(overlayDir)) return [];
  const entries: Frozen[] = [];
  for (const name of fs.readdirSync(overlayDir)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(overlayDir, name);
    let raw: string;
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (isFrozen(parsed)) entries.push(parsed);
  }
  entries.sort((a, b) => (a.decidedAt < b.decidedAt ? -1 : a.decidedAt > b.decidedAt ? 1 : 0));
  return entries;
}

function isFrozen(v: unknown): v is Frozen {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.pass === 'string' &&
    Array.isArray(o.findingIds) &&
    o.findingIds.every((x) => typeof x === 'string') &&
    typeof o.decidedAt === 'string' &&
    typeof o.decidedBy === 'string'
  );
}

/**
 * Partition current findings against the stored frozen entries:
 *   - `live`     — findings not claimed by any frozen entry; pass these into the gate-loop.
 *   - `frozen`   — findings whose id matches at least one frozen entry's `findingIds`.
 *   - `orphaned` — frozen entries whose `findingIds` are all absent from `findings`; the
 *                  kit changed underfoot and the user must re-decide ("you owned X;
 *                  upstream changed").
 */
export function filterFrozenFindings(
  findings: Finding[],
  frozen: Frozen[],
): { live: Finding[]; frozen: Finding[]; orphaned: Frozen[] } {
  const claimed = new Set<string>();
  for (const f of frozen) for (const id of f.findingIds) claimed.add(id);

  const currentIds = new Set(findings.map((f) => f.id));

  const live: Finding[] = [];
  const frozenFindings: Finding[] = [];
  for (const f of findings) {
    if (claimed.has(f.id)) frozenFindings.push(f);
    else live.push(f);
  }

  const orphaned: Frozen[] = frozen.filter(
    (entry) => entry.findingIds.length > 0 && entry.findingIds.every((id) => !currentIds.has(id)),
  );

  return { live, frozen: frozenFindings, orphaned };
}
