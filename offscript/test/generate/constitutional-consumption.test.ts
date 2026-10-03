/**
 * Program Y, Sprint Y4 — Constitutional Governance Consumption.
 *
 * The pre-pass Y3 approved: cross-track creative identity (design/shared's Inherited Creative
 * Constitution, ported into resources/design_principles/ in Y2) is a fixed REFERENCE, not a
 * per-brief-derived Governance Model — so this consumer takes plain optional strings (already loaded
 * by the caller), never a GovernedModel, and has no repositoryIdentity binding to check. It runs
 * independently of the seven-model orchestration (reasoning-orchestrator.ts is untouched) and is
 * gated purely on the presence of BOTH ported documents (all-or-nothing, not partial).
 */
import { describe, it, expect } from 'vitest';
import {
  applyConstitutionalGovernance,
  buildConstitutionalEvidence,
} from '../../src/generate/reasoning/constitutional-consumption.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

function planOf(ids: string[]): AuthoringPlan {
  return {
    track: 'website',
    items: ids.map((id) => ({ anchor: { id, anchor: id }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: id })) as PlanItem[],
    warnings: [],
  };
}

const REAL_SECTIONS = Array.from({ length: 5 }, (_, i) => `## §${i} — Heading\n\nbody`).join('\n\n');

describe('buildConstitutionalEvidence (pure)', () => {
  it('yields {} when both documents are absent', () => {
    expect(buildConstitutionalEvidence({})).toEqual({});
  });

  it('yields {} when only one of the two documents is present (all-or-nothing)', () => {
    expect(buildConstitutionalEvidence({ creativeDirection: REAL_SECTIONS })).toEqual({});
    expect(buildConstitutionalEvidence({ inheritedConstitution: REAL_SECTIONS })).toEqual({});
  });

  it('produces a fixed communicationObjective pointer clause when both are present', () => {
    const evidence = buildConstitutionalEvidence({
      creativeDirection: REAL_SECTIONS,
      inheritedConstitution: REAL_SECTIONS,
    });
    expect(evidence.communicationObjective).toContain('Cross-track creative identity');
    expect(evidence.communicationObjective).toContain('INHERITED_CREATIVE_CONSTITUTION.md');
  });

  it('fails loud on a malformed/truncated document rather than silently degrading', () => {
    expect(() =>
      buildConstitutionalEvidence({ creativeDirection: 'too short', inheritedConstitution: REAL_SECTIONS }),
    ).toThrow(/shape validation/i);
  });
});

describe('applyConstitutionalGovernance — absence is byte-identical', () => {
  it('does not touch plan.items when both documents are absent', () => {
    const plan = planOf(['hero', 'cta']);
    const before = JSON.stringify(plan);
    applyConstitutionalGovernance(plan, {});
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.items.every((i) => i.reasoning === undefined)).toBe(true);
  });
});

describe('applyConstitutionalGovernance — presence is additive-only', () => {
  it('writes ONLY communicationObjective; never role / orderingRationale / transition / selectionRationale / relationships', () => {
    const plan = planOf(['hero']);
    applyConstitutionalGovernance(plan, { creativeDirection: REAL_SECTIONS, inheritedConstitution: REAL_SECTIONS });
    const r = plan.items[0].reasoning!;
    expect(r.communicationObjective).toBeDefined();
    expect(r.role).toBeUndefined();
    expect(r.orderingRationale).toBeUndefined();
    expect(r.transition).toBeUndefined();
    expect(r.selectionRationale).toBeUndefined();
    expect(r.relationships).toBeUndefined();
  });

  it('never reorders and never changes the item count (selection/ordering untouched)', () => {
    const plan = planOf(['hero', 'mechanism', 'proof', 'cta']);
    const idsBefore = plan.items.map((i) => i.anchor.id);
    applyConstitutionalGovernance(plan, { creativeDirection: REAL_SECTIONS, inheritedConstitution: REAL_SECTIONS });
    expect(plan.items.map((i) => i.anchor.id)).toEqual(idsBefore);
  });

  it('APPENDS after, never overwrites, existing reasoning content in the same field', () => {
    const plan = planOf(['hero']);
    plan.items[0].reasoning = Object.freeze({ communicationObjective: 'existing clause' }) as PlanItem['reasoning'];
    applyConstitutionalGovernance(plan, { creativeDirection: REAL_SECTIONS, inheritedConstitution: REAL_SECTIONS });
    const v = plan.items[0].reasoning!.communicationObjective!;
    expect(v.startsWith('existing clause · ')).toBe(true);
    expect(v).toContain('Cross-track creative identity');
  });

  it('is the same evidence clause for every item on the page (page-scoped, uniform)', () => {
    const plan = planOf(['hero', 'cta']);
    applyConstitutionalGovernance(plan, { creativeDirection: REAL_SECTIONS, inheritedConstitution: REAL_SECTIONS });
    expect(plan.items[0].reasoning!.communicationObjective).toBe(plan.items[1].reasoning!.communicationObjective);
  });

  it('returned reasoning is frozen (immutable)', () => {
    const plan = planOf(['hero']);
    applyConstitutionalGovernance(plan, { creativeDirection: REAL_SECTIONS, inheritedConstitution: REAL_SECTIONS });
    expect(Object.isFrozen(plan.items[0].reasoning)).toBe(true);
  });
});
