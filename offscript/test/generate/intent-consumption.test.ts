/**
 * W3-S4 — Intent Consumption · unit + acceptance (planner-side, deterministic).
 *
 * Covers the pure consumer (intent-consumption.ts) and the remaining acceptance criteria
 * from W3-S4-EXECUTION-PACKAGE.md that complement the differential proof in
 * intent-consumption-diff.test.ts:
 *   AC-2 absent intent == no-cue intent (baseline), AC-3 determinism, AC-5 no-cue no-op,
 *   AC-6 fail-loud governance.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { projectDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import type { DesignContext } from '../../src/generate/types.js';
import type { IntentBrief } from '../../src/generate/intent-brief.js';
import {
  type CompositionPreferenceRule,
  intentCompositionMapPath,
  loadIntentCompositionMap,
  compositionPreferenceFor,
  reorderCandidatesByPreference,
} from '../../src/generate/intent-consumption.js';
import { makeBriefFixture } from './_brief-fixture.js';

// ── Pure consumer ───────────────────────────────────────────────────────────

describe('W3-S4 loadIntentCompositionMap — governance lexicon (fail-loud)', () => {
  it('AC-6: loads cue→composition rules from the real governance file', () => {
    const rules = loadIntentCompositionMap(intentCompositionMapPath());
    expect(rules.length).toBeGreaterThan(0);
    const calm = rules.find((r) => r.cue === 'calm');
    expect(calm?.names).toContain('STATEMENT-LED');
  });

  it('AC-6: throws (fail-loud) when the governance file is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-intentmap-'));
    try {
      expect(() => loadIntentCompositionMap(join(dir, 'nope.md'))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('W3-S4 compositionPreferenceFor — HOW → preferred names (pure)', () => {
  const rules: CompositionPreferenceRule[] = [
    { cue: 'calm', names: ['STATEMENT-LED'] },
    { cue: 'bold', names: ['ICON-FEATURE GRID'] },
  ];

  it('a matching cue yields its preferred name', () => {
    expect(compositionPreferenceFor('A calm, unhurried register.', rules)).toEqual([
      'STATEMENT-LED',
    ]);
  });

  it('multiple cues yield names in rule order, de-duplicated', () => {
    expect(compositionPreferenceFor('bold and calm at once', rules)).toEqual([
      'STATEMENT-LED',
      'ICON-FEATURE GRID',
    ]);
  });

  it('no governed cue yields [] (no-op)', () => {
    expect(compositionPreferenceFor('serene and pleasant', rules)).toEqual([]);
  });

  it('absent / empty how yields []', () => {
    expect(compositionPreferenceFor(undefined, rules)).toEqual([]);
    expect(compositionPreferenceFor('   ', rules)).toEqual([]);
  });

  it('matches whole words only (calmness does not trip calm)', () => {
    expect(compositionPreferenceFor('calmness everywhere', rules)).toEqual([]);
  });
});

describe('W3-S4 reorderCandidatesByPreference — stable, identity on empty (pure)', () => {
  const cands = [
    'NUMBERED EDITORIAL LIST — a',
    'ICON-FEATURE GRID — b',
    'STATEMENT-LED — c',
  ];

  it('empty preference is identity (same order)', () => {
    expect(reorderCandidatesByPreference(cands, [])).toEqual(cands);
  });

  it('a preferred name moves to the front; the rest keep original order', () => {
    expect(reorderCandidatesByPreference(cands, ['STATEMENT-LED'])).toEqual([
      'STATEMENT-LED — c',
      'NUMBERED EDITORIAL LIST — a',
      'ICON-FEATURE GRID — b',
    ]);
  });

  it('a preferred name absent from candidates is ignored (identity)', () => {
    expect(reorderCandidatesByPreference(cands, ['PULL-QUOTE'])).toEqual(cands);
  });

  it('multiple preferred names lead in preference order', () => {
    expect(
      reorderCandidatesByPreference(cands, ['ICON-FEATURE GRID', 'STATEMENT-LED']),
    ).toEqual([
      'ICON-FEATURE GRID — b',
      'STATEMENT-LED — c',
      'NUMBERED EDITORIAL LIST — a',
    ]);
  });
});

// ── Acceptance criteria over planner output ─────────────────────────────────

const FIXTURE_CLIENT = '__intent_consume_ac_test__';
const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

function withHow(base: DesignContext, how: string | undefined): DesignContext {
  if (how === undefined) return { ...base, intentBrief: undefined };
  const intentBrief: IntentBrief = {
    oneThing: '',
    what: '',
    why: '',
    how,
    constraints: '',
    antiPatterns: '',
  };
  return { ...base, intentBrief };
}

function collateralBase(): DesignContext {
  scaffoldClient();
  writeBrief(['Overview', 'Approach', 'Method', 'Wrap up'], 'collateral');
  return buildContext(FIXTURE_CLIENT, 'collateral');
}

const comps = (ctx: DesignContext): Array<string | undefined> =>
  plan(ctx).items.map((i) => i.composition);

describe('W3-S4 acceptance — planner output only', () => {
  it('AC-2 + AC-5: absent intent and a no-cue HOW yield identical compositions (baseline)', () => {
    const base = collateralBase();
    const absent = comps(withHow(base, undefined));
    const noCue = comps(withHow(base, 'serene, pleasant, agreeable'));
    expect(noCue).toEqual(absent);
  });

  it('AC-3: identical (brief + intent) inputs produce identical compositions', () => {
    const base = collateralBase();
    const a = comps(withHow(base, 'calm, unhurried'));
    const b = comps(withHow(base, 'calm, unhurried'));
    expect(a).toEqual(b);
  });
});
