/**
 * Sprint 10Z — the runtime side of the Recent Environment Usage capability. Answers exactly one
 * question: what EnvironmentSlug did Output/_LOG.md's tail most recently carry, if any — the
 * narrow, deterministic half of HANDOFF-v2.md's Step 8 Environment Selection rule ("avoid the
 * tail's most recent env=", line 787). It performs NO selection: it never chooses an environment,
 * never scores candidates, never combines belief/camera/feature/ratio into a decision.
 *
 * Reuses, never duplicates, the real, already-tested Output/_LOG.md reader/parser from
 * creative-intent-exporter (log/reader.ts, log/parser.ts) — added as a second file: sibling
 * dependency, the same established pattern creative-artifact-contract already uses (Sprint 10Y
 * §5 traced this reuse boundary in full; this module applies its conclusion).
 *
 * Scope, per line 878's own "recent lines" (unqualified — the avoid list) vs. "approved=yes
 * lines" (the wins/precedent set) contrast: the recency check is NOT approval-filtered. That is
 * a deliberate, source-grounded default (Sprint 10Y §9/§18; resolved by this sprint, §Phase 2 of
 * its own report), distinct from Benchmark Retrieval's own, separate, approval-filtered
 * capability-keyed precedent system (§B-8) — not implemented here and not needed here.
 *
 * A malformed or unrecognized `env=` value on the literal most-recent env=-bearing line is never
 * silently substituted with an older, valid one — doing so would misrepresent what was actually
 * most recently attempted. Lines carrying no env= token at all are skipped over while scanning
 * backward (they simply don't participate in environment tracking, e.g. pre-v5 lines).
 */
import { readLogLines } from 'creative-intent-exporter/src/log/reader.js';
import { parseLogLine } from 'creative-intent-exporter/src/log/parser.js';
import { isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';

export interface RecentEnvironmentUsage {
  lastEnvironment: EnvironmentSlug | undefined;
}

/**
 * Reads `logPath` (a real Output/_LOG.md file) and returns the most recent governed
 * EnvironmentSlug found in its tail, scanning backward from the newest line. Fails closed
 * (throws) when `logPath` does not exist, exactly matching the reused reader's own precedent —
 * never caught and silently treated as empty. An empty or header-only log, or a log whose most
 * recent env=-bearing line carries an unrecognized value, resolves to `{ lastEnvironment:
 * undefined }` — never a guess, never an invented EnvironmentSlug.
 */
export function getRecentEnvironmentUsage(logPath: string): RecentEnvironmentUsage {
  const lines = readLogLines(logPath);
  for (let i = lines.length - 1; i >= 0; i--) {
    const record = parseLogLine(lines[i]);
    if (!record.raw.has('env')) continue;
    const value = record.raw.get('env')!;
    return { lastEnvironment: isEnvironmentSlug(value) ? value : undefined };
  }
  return { lastEnvironment: undefined };
}
