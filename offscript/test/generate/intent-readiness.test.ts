/**
 * W3-S2 — Intent Readiness Floor.
 *
 * A PURE, deterministic verdict over a replayed IntentBrief: the five floor
 * categories are present & non-empty, and no authority-class form literal appears.
 * DATA only — no AuthoritySignal, no ledger, no headline, no consumption, no control
 * flow (those are W3-S3/S4/S5). Governed by W3-S2-CONTRACT-RECONCILIATION.md +
 * W3-S2-EXECUTION-PACKAGE.md.
 *
 * Contract anchors tested here:
 *   U-CAT-STRUCT  — floor gates {oneThing, why, how, constraints, antiPatterns}; WHAT ungated.
 *   U-NONEMPTY    — empty ⇔ trim-length 0; no placeholder/generic detection.
 *   U-FORM-NARROW — authority form set = color literals + number+length-unit ONLY.
 *   U-VERDICT-SHAPE — returns a structured verdict (data); never throws on valid/undefined input.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IntentBrief } from '../../src/generate/intent-brief.js';
import {
  type ReadinessVerdict,
  evaluateReadiness,
  loadFormTerms,
} from '../../src/generate/intent-readiness.js';
import { formTermsPath } from '../../src/paths.js';

// The frozen authority-class length units (U-FORM-NARROW) — passed in-memory so the
// pure evaluator never touches disk.
const UNITS = ['px', 'pt', 'rem', 'em', 'vh', 'vw', 'vmin', 'vmax', 'mm', 'cm'] as const;

/** A complete, form-clean intent brief; override individual fields per test. */
function mk(overrides: Partial<IntentBrief> = {}): IntentBrief {
  return {
    oneThing: 'A wary buyer leaves believing migration is low-risk.',
    what: 'A landing page that de-risks the switch.',
    why: 'The reader arrives mid-evaluation; the change sought is one demo booking.',
    how: 'Calm, exact, unhurried.',
    constraints: 'Honor the reference defaults and single-page medium laws.',
    antiPatterns: 'No hype, no fake urgency.',
    ...overrides,
  };
}

describe('W3-S2 evaluateReadiness — ready path', () => {
  it('a complete, form-clean brief is ready', () => {
    const v = evaluateReadiness(mk(), UNITS);
    expect(v).toEqual<ReadinessVerdict>({
      ready: true,
      missingArtifact: false,
      missingCategories: [],
      formOversteps: [],
    });
  });
});

describe('W3-S2 evaluateReadiness — emptiness floor (U-CAT-STRUCT / U-NONEMPTY)', () => {
  it('empty canonical field (oneThing) → not-ready, names oneThing', () => {
    const v = evaluateReadiness(mk({ oneThing: '' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.missingCategories).toContain('oneThing');
  });

  it('empty other floor field (why) → not-ready, names why', () => {
    const v = evaluateReadiness(mk({ why: '' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.missingCategories).toContain('why');
  });

  it('empty WHAT alone → ready (WHAT is supporting, not emptiness-gated)', () => {
    const v = evaluateReadiness(mk({ what: '' }), UNITS);
    expect(v.ready).toBe(true);
    expect(v.missingCategories).not.toContain('what');
  });

  it('empty oneThing + filled WHAT → not-ready (canonical slot governs)', () => {
    const v = evaluateReadiness(mk({ oneThing: '', what: 'A pricing page.' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.missingCategories).toContain('oneThing');
  });

  it('whitespace-only category is treated as empty', () => {
    const v = evaluateReadiness(mk({ how: '   \n\t ' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.missingCategories).toContain('how');
  });
});

describe('W3-S2 evaluateReadiness — form-literal overstep (U-FORM-NARROW: flagged)', () => {
  it('a hex color literal in any category → not-ready, reports the token', () => {
    const v = evaluateReadiness(mk({ how: 'Calm, with #2563eb accents.' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.formOversteps).toContain('#2563eb');
  });

  it('a number bound to a length unit → not-ready, reports the token', () => {
    const v = evaluateReadiness(mk({ constraints: 'Keep the gutter at 16px.' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.formOversteps).toContain('16px');
  });

  it('rgb()/hsl() functional color notation is flagged', () => {
    const v = evaluateReadiness(mk({ how: 'Use rgb(0,0,0) ink.' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.formOversteps.length).toBeGreaterThan(0);
  });

  it('form literals in WHAT are scanned even though WHAT is emptiness-ungated', () => {
    const v = evaluateReadiness(mk({ what: 'A page on a 12 column grid sized 1200px.' }), UNITS);
    expect(v.ready).toBe(false);
    expect(v.formOversteps).toContain('1200px');
  });
});

describe('W3-S2 evaluateReadiness — NON-flags (U-FORM-NARROW: false-positive guards)', () => {
  it('a percentage is not a form overstep', () => {
    const v = evaluateReadiness(mk({ why: 'The goal: convert 20% more wary buyers.' }), UNITS);
    expect(v.ready).toBe(true);
    expect(v.formOversteps).toEqual([]);
  });

  it('a bare count is not a form overstep', () => {
    const v = evaluateReadiness(mk({ why: 'There are 2 audiences and the one action is a demo.' }), UNITS);
    expect(v.ready).toBe(true);
  });

  it('a named color / visual adjective is not a form overstep', () => {
    const v = evaluateReadiness(mk({ how: 'A bold, blue, confident register.' }), UNITS);
    expect(v.ready).toBe(true);
  });

  it('"#1" (a single hex digit) is not a color literal', () => {
    const v = evaluateReadiness(mk({ oneThing: 'Become the #1 trusted choice.' }), UNITS);
    expect(v.ready).toBe(true);
    expect(v.formOversteps).toEqual([]);
  });
});

describe('W3-S2 evaluateReadiness — absent artifact + purity (U-VERDICT-SHAPE)', () => {
  it('undefined intent → not-ready with missingArtifact (D-U1 verdict)', () => {
    const v = evaluateReadiness(undefined, UNITS);
    expect(v).toEqual<ReadinessVerdict>({
      ready: false,
      missingArtifact: true,
      missingCategories: [],
      formOversteps: [],
    });
  });

  it('is pure & deterministic — never throws, identical input → identical verdict', () => {
    expect(() => evaluateReadiness(mk(), UNITS)).not.toThrow();
    expect(() => evaluateReadiness(undefined, UNITS)).not.toThrow();
    expect(evaluateReadiness(mk(), UNITS)).toEqual(evaluateReadiness(mk(), UNITS));
  });
});

describe('W3-S2 loadFormTerms — governance lexicon (fail-loud)', () => {
  it('loads the cross-track length-unit list from governance', () => {
    const units = loadFormTerms(formTermsPath());
    expect(units).toContain('px');
    expect(units).toContain('vmax');
    // Deliberately-excluded, false-positive-prone tokens must NOT be present.
    expect(units).not.toContain('in');
    expect(units).not.toContain('%');
  });

  it('throws (fail-loud) when the governance file is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-formterms-'));
    try {
      expect(() => loadFormTerms(join(dir, 'nope.md'))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the real governance lexicon makes a px overstep fire end-to-end', () => {
    const units = loadFormTerms(formTermsPath());
    const v = evaluateReadiness(mk({ constraints: 'Pad by 24px.' }), units);
    expect(v.formOversteps).toContain('24px');
  });
});
