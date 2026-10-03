import { describe, it, expect } from 'vitest';
import {
  AUTHORITY_LEVELS,
  outcomeToAuthority,
  signalFromFinding,
  validateSignal,
  type AuthorityLevel,
  type AuthoritySignal,
} from '../src/authority.js';
import type { Finding } from '../src/operator.js';

// W1-S1 — Signal Authority Taxonomy + Producer Contract.
// Governed by docs/internals/W1-S1-EXECUTION-PACKAGE.md and
// docs/internals/OFFSCRIPT-V3-AUTHORITY-SIGNAL-OWNERSHIP-CONTRACT.md.
// Additive: this exercises only the new module; nothing in the scoring/freeze
// path is imported or modified.

describe('authority taxonomy', () => {
  it('exposes exactly four distinguishable authority levels in severity order', () => {
    expect(AUTHORITY_LEVELS).toEqual([
      'information',
      'warning',
      'critical-warning',
      'failure',
    ]);
    expect(new Set(AUTHORITY_LEVELS).size).toBe(4);
  });
});

describe('Finding.outcome → authority mapping (read-only, total)', () => {
  it('maps each Finding.outcome to its frozen authority level', () => {
    expect(outcomeToAuthority('auto-remediated')).toBe('information');
    expect(outcomeToAuthority('warning')).toBe('warning');
    expect(outcomeToAuthority('escalated')).toBe('failure');
  });

  it('is total over every Finding.outcome value (each maps to a real level)', () => {
    const outcomes: Finding['outcome'][] = ['auto-remediated', 'warning', 'escalated'];
    for (const o of outcomes) {
      expect(AUTHORITY_LEVELS).toContain(outcomeToAuthority(o));
    }
  });
});

describe('signalFromFinding — additive bridge over Finding (never mutates it)', () => {
  it('builds an objective signal carrying the mapped level + attribution', () => {
    const finding: Finding = {
      id: 'layout-alignment:misaligned:section:4',
      description: 'section 4 is off the 8pt grid',
      outcome: 'escalated',
    };
    const before = JSON.stringify(finding);

    const signal = signalFromFinding(finding, {
      producer: 'layout-alignment',
      where: 'section:4',
    });

    expect(signal.level).toBe('failure');
    expect(signal.nature).toBe('objective');
    expect(signal.producer).toBe('layout-alignment');
    expect(signal.where).toBe('section:4');
    expect(signal.what).toBe('section 4 is off the 8pt grid');
    expect(signal.why.length).toBeGreaterThan(0);

    // read-only: the source Finding is untouched (Finding.outcome semantics preserved)
    expect(JSON.stringify(finding)).toBe(before);

    // the bridged signal is itself well-formed
    expect(validateSignal(signal).valid).toBe(true);
  });
});

describe('validateSignal — attribution + doctrine firewall', () => {
  const base: AuthoritySignal = {
    producer: 'layout-alignment',
    level: 'warning',
    where: 'section:4',
    what: 'off the 8pt grid',
    why: 'deterministic soft QA note',
    nature: 'objective',
  };

  it('accepts a fully attributed signal', () => {
    expect(validateSignal(base).valid).toBe(true);
  });

  it('rejects an anonymous signal (missing producer)', () => {
    const r = validateSignal({ ...base, producer: '' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('rejects a signal missing where', () => {
    expect(validateSignal({ ...base, where: '' }).valid).toBe(false);
  });

  it('rejects a signal missing what', () => {
    expect(validateSignal({ ...base, what: '' }).valid).toBe(false);
  });

  it('rejects a signal missing why', () => {
    expect(validateSignal({ ...base, why: '' }).valid).toBe(false);
  });

  it('rejects a subjective signal labelled Failure (subjective never reaches Failure)', () => {
    const r = validateSignal({ ...base, nature: 'subjective', level: 'failure' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('rejects an objective signal labelled Critical Warning (Critical Warning is subjective-only)', () => {
    const r = validateSignal({ ...base, nature: 'objective', level: 'critical-warning' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('accepts a subjective Critical Warning (the subjective ceiling)', () => {
    expect(
      validateSignal({ ...base, nature: 'subjective', level: 'critical-warning' }).valid,
    ).toBe(true);
  });
});

describe('authority is a label, never control flow (LOUD-MARK compatible)', () => {
  it('outcomeToAuthority returns a value for escalated and never throws/terminates', () => {
    expect(() => outcomeToAuthority('escalated')).not.toThrow();
    expect(outcomeToAuthority('escalated')).toBe('failure');
  });

  it('a Failure signal is inert data — a sequence containing it is processed in full (no short-circuit)', () => {
    const failure: AuthoritySignal = {
      producer: 'source-fidelity',
      level: 'failure',
      where: 'unit:hero',
      what: 'declared must-include unit reached no consumer',
      why: 'objective guarantee violation (no-authoring-from-void)',
      nature: 'objective',
    };
    const warning: AuthoritySignal = { ...failure, level: 'warning', where: 'unit:cta' };

    const results = [failure, warning].map(validateSignal);

    // the Failure did not halt collection; both signals were evaluated
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.valid)).toBe(true);
  });
});
