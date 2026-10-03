/**
 * P54 — Readiness model: state derivation from blockers (explicit states, never a boolean), the
 * admission decision, and deterministic serialization (replay).
 */
import { describe, it, expect } from 'vitest';
import {
  deriveReadinessState,
  decideAdmission,
  serializeReadiness,
  deserializeReadiness,
  type Blocker,
  type ReadinessAssessment,
} from '../../src/project/readiness.js';

const B = (over: Partial<Blocker> = {}): Blocker => ({
  id: `${over.category ?? 'evidence'}:x`,
  reason: 'r',
  category: 'evidence',
  severity: 'major',
  owner: 'creative-director',
  resolution: 'fix it',
  dependentTasks: [],
  ...over,
});

describe('P54 readiness state derivation (explicit states, not booleans)', () => {
  it('no blockers → READY', () => {
    expect(deriveReadinessState([])).toBe('READY');
  });
  it('any critical blocker → BLOCKED (dominates everything)', () => {
    expect(deriveReadinessState([B({ severity: 'critical', category: 'dependency' }), B({ category: 'approval' })])).toBe('BLOCKED');
  });
  it('only minor blockers → PARTIALLY_READY', () => {
    expect(deriveReadinessState([B({ severity: 'minor' })])).toBe('PARTIALLY_READY');
  });
  it('a major approval blocker (no info) → WAITING_FOR_APPROVAL', () => {
    expect(deriveReadinessState([B({ category: 'approval' })])).toBe('WAITING_FOR_APPROVAL');
  });
  it('a major information blocker (no approval) → WAITING_FOR_INFORMATION', () => {
    expect(deriveReadinessState([B({ category: 'asset' })])).toBe('WAITING_FOR_INFORMATION');
  });
  it('both approval AND information majors → NOT_READY', () => {
    expect(deriveReadinessState([B({ category: 'approval' }), B({ category: 'evidence' })])).toBe('NOT_READY');
  });
});

describe('P54 admission decision', () => {
  it('READY admits; every other state does not', () => {
    expect(decideAdmission('READY', []).admitted).toBe(true);
    for (const s of ['BLOCKED', 'WAITING_FOR_APPROVAL', 'WAITING_FOR_INFORMATION', 'PARTIALLY_READY', 'NOT_READY'] as const) {
      expect(decideAdmission(s, [B()]).admitted).toBe(false);
    }
  });
  it('a non-admitting decision explains itself', () => {
    const d = decideAdmission('WAITING_FOR_APPROVAL', [B({ category: 'approval', reason: 'needs legal sign-off' })]);
    expect(d.reason).toMatch(/approval|legal/i);
  });
});

describe('P54 serialization (replay)', () => {
  const assessment: ReadinessAssessment = {
    schemaVersion: 1,
    projectType: 'website',
    deliverables: ['website'],
    version: 2,
    policyId: 'rule-based',
    state: 'WAITING_FOR_APPROVAL',
    admission: { admitted: false, state: 'WAITING_FOR_APPROVAL', reason: 'awaiting 1 approval' },
    blockers: [B({ category: 'approval', id: 'approval:legal' })],
    satisfied: ['evidence:brand', 'asset:logo'],
    summary: 'WAITING_FOR_APPROVAL — 1 blocker',
  };

  it('round-trips deterministically', () => {
    const s = serializeReadiness(assessment);
    expect(serializeReadiness(assessment)).toBe(s);
    expect(deserializeReadiness(s)).toEqual(assessment);
  });
  it('carries schemaVersion 1 and rejects an unknown one', () => {
    expect(JSON.parse(serializeReadiness(assessment)).schemaVersion).toBe(1);
    expect(() => deserializeReadiness(JSON.stringify({ schemaVersion: 7 }))).toThrow(/schemaVersion/);
  });
});
