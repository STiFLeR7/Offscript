/**
 * W3-S1 — Intent Brief Artifact + Persistence.
 *
 * The keystone runtime representation of intent/feel, persisted as a replayable
 * artifact. PERSISTENCE ONLY — DATA round-trip + write + replay-load + context
 * carry. NO readiness floor (W3-S2), NO signals/Failures (W3-S3), NO consumption
 * by planner/author (W3-S4), NO vagueness Critical Warning (W3-S5). Governed by
 * W3-S1-EXECUTION-PACKAGE.md + W3-CONTRACT-RECONCILIATION.md.
 *
 * The two proofs this stage exists to make:
 *   - persist → replay reads the SAME value back, with no LLM and no re-derivation;
 *   - missing (→ undefined) and malformed (→ throw) are distinguishable runtime
 *     states (mirrors src/generate/brief.ts loadBriefIfPresent discipline).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  type IntentBrief,
  parseIntentBrief,
  serializeIntentBrief,
  writeIntentBrief,
  loadIntentBriefIfPresent,
} from '../../src/generate/intent-brief.js';
import { intentBriefPath, projectDir, projectReferencesDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';

// A fully-populated intent brief (the frozen 6-category model + an opaque stamp).
const FULL: IntentBrief = {
  oneThing: 'A wary buyer leaves believing migration is low-risk.',
  what: 'A product landing page whose single job is to de-risk the switch.',
  why: 'The reader arrives mid-evaluation, burned by a past migration; the change sought is one demo booking.',
  how: 'Calm, exact, unhurried — proof over adjectives.',
  constraints: 'Honor the reference defaults; respect the medium laws of a single-page site.',
  antiPatterns: 'No hype, no fake urgency, no unsubstantiated superlatives.',
  briefStamp: 'abc123def4567890',
};

const tmpDirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-intent-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop()!;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});

describe('W3-S1 IntentBrief — round-trip (deterministic)', () => {
  it('round-trips a full intent brief with a stamp', () => {
    expect(parseIntentBrief(serializeIntentBrief(FULL))).toEqual(FULL);
  });

  it('round-trips without a stamp (frontmatter omitted entirely)', () => {
    const noStamp: IntentBrief = { ...FULL, briefStamp: undefined };
    const serialized = serializeIntentBrief(noStamp);
    expect(serialized).not.toContain('---');
    expect(parseIntentBrief(serialized)).toEqual(noStamp);
  });

  it('serializes deterministically (identical input → identical bytes)', () => {
    expect(serializeIntentBrief(FULL)).toBe(serializeIntentBrief(FULL));
  });

  it('does NOT validate categories — a missing category parses to an empty string (readiness is W3-S2)', () => {
    const onlyOneThing = serializeIntentBrief({
      oneThing: 'Just the one thing.',
      what: '',
      why: '',
      how: '',
      constraints: '',
      antiPatterns: '',
    });
    const parsed = parseIntentBrief(onlyOneThing);
    expect(parsed.oneThing).toBe('Just the one thing.');
    expect(parsed.why).toBe('');
    expect(parsed.antiPatterns).toBe('');
  });
});

describe('W3-S1 IntentBrief — persistence + replay', () => {
  it('writeIntentBrief persists and loadIntentBriefIfPresent replays the SAME value (no re-derivation)', () => {
    const path = join(freshDir(), 'intent-brief.md');
    writeIntentBrief(path, FULL);
    expect(loadIntentBriefIfPresent(path)).toEqual(FULL);
  });

  it('writeIntentBrief is idempotent — an identical re-write does not touch the file', () => {
    const path = join(freshDir(), 'intent-brief.md');
    writeIntentBrief(path, FULL);
    const mtime1 = statSync(path).mtimeMs;
    writeIntentBrief(path, FULL);
    const mtime2 = statSync(path).mtimeMs;
    expect(mtime2).toBe(mtime1);
  });

  it('creates the parent directory when absent', () => {
    const path = join(freshDir(), 'nested', 'deeper', 'intent-brief.md');
    writeIntentBrief(path, FULL);
    expect(loadIntentBriefIfPresent(path)).toEqual(FULL);
  });
});

describe('W3-S1 IntentBrief — missing vs malformed (distinguishable states)', () => {
  it('an ABSENT artifact loads as undefined (legitimate skeleton state)', () => {
    const path = join(freshDir(), 'does-not-exist.md');
    expect(loadIntentBriefIfPresent(path)).toBeUndefined();
  });

  it('a MALFORMED artifact (broken frontmatter YAML) throws — not silently demoted', () => {
    const path = join(freshDir(), 'intent-brief.md');
    writeFileSync(path, '---\nbriefStamp: [unclosed\n---\n\n## The One Thing\nx\n', 'utf8');
    expect(() => loadIntentBriefIfPresent(path)).toThrow();
  });

  it('a MALFORMED artifact (no recognized category headings) throws', () => {
    const path = join(freshDir(), 'intent-brief.md');
    writeFileSync(path, 'this file has no intent-brief headings at all\n', 'utf8');
    expect(() => loadIntentBriefIfPresent(path)).toThrow();
  });
});

describe('W3-S1 IntentBrief — persistence location (frozen contract)', () => {
  it('intentBriefPath resolves under the per-track project workspace, never resources', () => {
    const p = intentBriefPath('acme', 'website');
    expect(p).toContain(join('projects', 'acme', 'website', 'intent-brief.md'));
    expect(p).not.toContain('resources');
  });

  it('intentBriefPath is per-track (website and collateral never collide)', () => {
    expect(intentBriefPath('acme', 'website')).not.toBe(intentBriefPath('acme', 'collateral'));
  });
});

// ── Context carry (replay through buildContext) ───────────────────────────────
// Uses the throwaway-fixture-client pattern from test/context.test.ts: scaffold a
// client brand so buildContext resolves, then assert the intent artifact is read
// back onto DesignContext WITHOUT re-derivation. NO consumer reads it here (that
// is W3-S4) — this only proves the additive load + carry.
const FIXTURE_CLIENT = '__intent_ctx_test__';

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

function scaffoldClientBrand(client: string): void {
  const refsDir = projectReferencesDir(client);
  mkdirSync(refsDir, { recursive: true });
  writeFileSync(
    join(refsDir, 'colors_and_type.css'),
    ':root {\n  --cr-brand-blue: #2563eb;\n  --cr-bg: #ffffff;\n  --cr-fg: #1a1a2e;\n}',
    'utf8',
  );
}

describe('W3-S1 IntentBrief — buildContext carry', () => {
  it('attaches ctx.intentBrief by replaying the persisted artifact (no re-derivation)', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const path = intentBriefPath(FIXTURE_CLIENT, 'website');
    mkdirSync(dirname(path), { recursive: true });
    writeIntentBrief(path, FULL);

    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.intentBrief).toEqual(FULL);
  });

  it('leaves ctx.intentBrief undefined when no artifact is present (additive, no behavior change)', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.intentBrief).toBeUndefined();
  });
});
