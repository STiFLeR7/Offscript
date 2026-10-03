/**
 * Sprint 10Z — Recent Environment Usage. getRecentEnvironmentUsage() must reuse the existing,
 * real, already-tested Output/_LOG.md reader/parser from creative-intent-exporter (log/reader.ts,
 * log/parser.ts) — never a second, duplicated log-line tokenizer — and answer exactly one
 * question: what EnvironmentSlug did the log's tail most recently carry, if any.
 *
 * Scope, per HANDOFF-v2.md's own evidence (Sprint 10Y): "avoid the tail's most recent env="
 * (line 787) is singular and, per line 878's own "recent lines" vs. "approved=yes lines" wording
 * contrast, is NOT approval-filtered — unlike the separate, still out-of-scope Benchmark Retrieval
 * mechanism (§B-8), which explicitly IS approval-filtered and capability-keyed. This module
 * implements only the former.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseLogLine } from 'creative-intent-exporter/src/log/parser.js';
import {
  getRecentEnvironmentUsage,
  type RecentEnvironmentUsage,
} from '../src/recent-environment-usage.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = fileURLToPath(new URL('../src/recent-environment-usage.ts', import.meta.url));
const REAL_FIXTURE_PATH = join(
  here,
  '..',
  '..',
  'creative-intent-exporter',
  'test',
  'fixtures',
  'sample-log.md',
);

function withTempLog(content: string, fn: (logPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'recent-env-usage-test-'));
  const logPath = join(dir, '_LOG.md');
  writeFileSync(logPath, content, 'utf8');
  try {
    fn(logPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('getRecentEnvironmentUsage — one env=', () => {
  it('returns the single env= value present', () => {
    const log = `2026-08-12 · one-line · camera=macro · env=dawn-haze · approved=yes · feature=automation · belief="x"\n`;
    withTempLog(log, (logPath) => {
      const result = getRecentEnvironmentUsage(logPath);
      expect(result).toEqual<RecentEnvironmentUsage>({ lastEnvironment: 'dawn-haze' });
    });
  });
});

describe('getRecentEnvironmentUsage — multiple env=', () => {
  it('returns the LAST (most recent, by file order) env= value, not the first', () => {
    const log = [
      `2026-08-10 · first · env=dawn-haze · approved=yes · feature=automation · belief="a"`,
      `2026-08-11 · second · env=lake-mirror · approved=yes · feature=automation · belief="b"`,
      `2026-08-12 · third · env=massif-clear · approved=yes · feature=automation · belief="c"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: 'massif-clear' });
    });
  });
});

describe('getRecentEnvironmentUsage — no env=', () => {
  it('returns undefined when no line carries an env= token', () => {
    const log = [
      `2026-08-12 · pre-v5-style · archetype=x · approved=yes · feature=automation · belief="no env field on this line"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: undefined });
    });
  });

  it('skips backward past env=-less lines to find the nearest line that does carry env=', () => {
    const log = [
      `2026-08-10 · has-env · env=ridges-distant · approved=yes · feature=automation · belief="a"`,
      `2026-08-11 · no-env-here · archetype=x · approved=yes · feature=automation · belief="b"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: 'ridges-distant' });
    });
  });
});

describe('getRecentEnvironmentUsage — invalid env=', () => {
  it('returns undefined when the most recent env= is not a governed EnvironmentSlug', () => {
    const log = [
      `2026-08-12 · typo-env · env=dawn-hazee · approved=yes · feature=automation · belief="a"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: undefined });
    });
  });

  it('does NOT silently fall back to an older, valid env= when the most recent one is invalid', () => {
    const log = [
      `2026-08-10 · older-valid · env=valley-deep · approved=yes · feature=automation · belief="a"`,
      `2026-08-12 · newer-invalid · env=not-a-real-environment · approved=yes · feature=automation · belief="b"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      // the literal most-recent env= is malformed; this must NOT resolve to 'valley-deep'
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: undefined });
    });
  });
});

describe('getRecentEnvironmentUsage — missing log (FAIL CLOSED)', () => {
  it('throws when the log file does not exist, matching the reused reader\'s own precedent', () => {
    withTempLog('placeholder', (logPath) => {
      const missingPath = join(dirname(logPath), 'does-not-exist_LOG.md');
      expect(() => getRecentEnvironmentUsage(missingPath)).toThrow();
    });
  });
});

describe('getRecentEnvironmentUsage — malformed log (EMPTY CONTEXT)', () => {
  it('returns undefined for a file with no genuine dated log-line content', () => {
    const log = [
      '# Output log — header prose only',
      '',
      'Format: header prose that must never be mistaken for a log line.',
      '',
      '**v4 (2026-08-04+):** more header prose, no dated rows below it.',
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: undefined });
    });
  });

  it('the reused parseLogLine genuinely fails closed on a structurally broken record (verifies the precedent this module relies on, not this module\'s own file-reading path)', () => {
    expect(() => parseLogLine('not-a-log-line-at-all')).toThrow();
  });
});

describe('getRecentEnvironmentUsage — approved=no still counts as "most recent" (Phase 2 decision A)', () => {
  it('an approved=no line with the newest env= wins over an older approved=yes line', () => {
    const log = [
      `2026-08-10 · older-approved · env=cliffside-muted · approved=yes · feature=automation · belief="a"`,
      `2026-08-12 · newer-unapproved · env=massif-banded · approved=no · feature=automation · belief="b"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      // per HANDOFF-v2.md line 878's own "recent lines" (unqualified, the avoid list) vs.
      // "approved=yes lines" (the wins/precedent set) contrast — the avoid list is NOT
      // approval-filtered, unlike Benchmark Retrieval's own separate approved-only rule.
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: 'massif-banded' });
    });
  });

  it('an approved=no line with no env= is skipped over the same way an approved=yes line would be', () => {
    const log = [
      `2026-08-10 · older-with-env · env=lake-mirror · approved=yes · feature=automation · belief="a"`,
      `2026-08-12 · newer-no-env · archetype=x · approved=no · feature=automation · belief="b"`,
      '',
    ].join('\n');
    withTempLog(log, (logPath) => {
      expect(getRecentEnvironmentUsage(logPath)).toEqual({ lastEnvironment: 'lake-mirror' });
    });
  });
});

describe('getRecentEnvironmentUsage — deterministic repeated reads', () => {
  it('returns an equal result across repeated calls against the same file', () => {
    const log = `2026-08-12 · x · env=dawn-haze · approved=yes · feature=automation · belief="x"\n`;
    withTempLog(log, (logPath) => {
      const first = getRecentEnvironmentUsage(logPath);
      const second = getRecentEnvironmentUsage(logPath);
      expect(first).toEqual(second);
    });
  });
});

describe('getRecentEnvironmentUsage — no mutation', () => {
  it('never writes back to the log file', () => {
    const log = `2026-08-12 · x · env=dawn-haze · approved=yes · feature=automation · belief="x"\n`;
    withTempLog(log, (logPath) => {
      const before = readFileSync(logPath, 'utf8');
      getRecentEnvironmentUsage(logPath);
      const after = readFileSync(logPath, 'utf8');
      expect(after).toBe(before);
    });
  });
});

describe('getRecentEnvironmentUsage — EnvironmentSlug validation', () => {
  it('never returns a value outside the seven governed EnvironmentSlug values', () => {
    const GOVERNED = new Set([
      'cliffside-muted',
      'dawn-haze',
      'lake-mirror',
      'massif-banded',
      'massif-clear',
      'ridges-distant',
      'valley-deep',
    ]);
    const log = `2026-08-12 · x · env=totally-invented-value · approved=yes · feature=automation · belief="x"\n`;
    withTempLog(log, (logPath) => {
      const result = getRecentEnvironmentUsage(logPath);
      if (result.lastEnvironment !== undefined) {
        expect(GOVERNED.has(result.lastEnvironment)).toBe(true);
      } else {
        expect(result.lastEnvironment).toBeUndefined();
      }
    });
  });
});

describe('getRecentEnvironmentUsage — real fixture from creative-intent-exporter', () => {
  it('resolves the real sample-log.md fixture to its actual most recent env= value', () => {
    // sample-log.md's last real line is v5-approved-two, env=massif-clear — traced by hand
    // against the real, unmodified fixture, not a copy.
    const result = getRecentEnvironmentUsage(REAL_FIXTURE_PATH);
    expect(result).toEqual({ lastEnvironment: 'massif-clear' });
  });
});

describe('recent-environment-usage.ts — reuses the existing parser, does not duplicate it', () => {
  it('imports from creative-intent-exporter rather than reimplementing log parsing', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).toMatch(/from ['"]creative-intent-exporter\//);
  });

  it('does not redeclare a log-line date-prefix pattern or a quote/bracket-aware splitter', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/\\d\{4\}-\\d\{2\}-\\d\{2\}/);
    expect(src).not.toMatch(/splitTopLevel/);
    expect(src).not.toMatch(/inQuotes/);
  });
});

describe('recent-environment-usage.ts — portability', () => {
  it('contains no absolute Windows drive-letter path literal', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/["'`][A-Za-z]:[\\/]/);
  });

  it('contains no reference to the external Creative Generation engine or backups path', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/Offscript-creatives-generation/i);
    expect(src).not.toMatch(/Backups-Stacks/i);
  });
});

describe('recent-environment-usage.ts — no selection, no Benchmark Retrieval', () => {
  it('does not implement environment selection or capability-keyed benchmark retrieval', () => {
    // "Benchmark Retrieval" may appear in prose explaining the scope boundary (Sprint 10Y's own
    // documentation convention) — what must be absent is an actual retrieval implementation:
    // feature-keyed matching, or a selection/retrieval function.
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/selectEnvironment/);
    expect(src).not.toMatch(/feature\s*=\s*['"`]/); // no feature=<row> capability-key matching
    expect(src).not.toMatch(/function\s+\w*[Bb]enchmark\w*/);
    expect(src).not.toMatch(/retrieveBenchmark|benchmarkRetrieval/i);
  });
});
