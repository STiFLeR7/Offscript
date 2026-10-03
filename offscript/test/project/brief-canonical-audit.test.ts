/**
 * G5-S1 — Canonical Brief Audit: a READ-ONLY validator that reports the canonical brief-authored evidence
 * facts a brief is missing — the facts migration CANNOT supply (`--asset`/`--approve` only cover asset +
 * approval blockers). Those facts are `brand` + `audience` (required → major `evidence:*`) and `tone`
 * (optional → minor `optional:tone`). A brief missing any of them is permanently NOT_MIGRATABLE until the
 * brief is repaired — exactly the four blocked projects G4-S1 identified (all missing `tone`).
 *
 * The audit reuses `parseBrief` + `hasValue` — the SAME predicate `buildBriefSession` uses to decide
 * whether a field becomes a confirmed fact — so "missing" here is byte-identical to what produces the
 * readiness blocker. It reads nothing, evaluates no readiness, and never rewrites a brief.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import type { AcquisitionPlan } from '../../src/project/acquisition-plan.js';
import { reconstructLegacyReadiness, MIGRATION_TIMESTAMP } from '../../src/project/project-migration.js';
import { auditCanonicalBrief } from '../../src/project/brief-canonical-audit.js';

const frontmatter = (fields: Record<string, string>) =>
  `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\nmust-include:\n  - "hero: x"\n---\n# ${fields.brand ?? 'X'}\nbody\n`;

const COMPLETE = frontmatter({ schemaVersion: '1', track: 'website', brand: 'Acme', 'one-liner': 'Acme ships fast.', audience: 'Ops leaders', tone: 'Confident' });
const NO_TONE = frontmatter({ schemaVersion: '1', track: 'website', brand: 'Acme', 'one-liner': 'Acme ships fast.', audience: 'Ops leaders' });
const NO_BRAND = frontmatter({ schemaVersion: '1', track: 'website', 'one-liner': 'Something ships fast.', audience: 'Ops leaders', tone: 'Confident' });

function acqFor(deliverables: Track[]): AcquisitionPlan {
  const strategy: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [],
  };
  return {
    projectType: 'collateral', track: deliverables[0], deliverables, sourceId: 'manual', strategy,
    questionPlan: { questions: [] }, questions: [], ready: true, alreadyKnown: [], critical: [], inferable: [], neverInfer: [], mustConfirm: [],
  };
}

describe('G5-S1 canonical brief audit', () => {
  it('DETECTS the optional:tone defect (missing tone → minor, non-supplyable)', () => {
    const audit = auditCanonicalBrief(NO_TONE);
    expect(audit.canonical).toBe(false);
    const tone = audit.defects.find((d) => d.field === 'tone');
    expect(tone).toBeDefined();
    expect(tone!.blockerId).toBe('optional:tone');
    expect(tone!.severity).toBe('minor');
    expect(tone!.repair).toMatch(/tone/i);
  });

  it('NO FALSE POSITIVES: a complete brief (brand+audience+tone) audits canonical', () => {
    const audit = auditCanonicalBrief(COMPLETE);
    expect(audit.canonical).toBe(true);
    expect(audit.defects).toEqual([]);
  });

  it('also detects missing REQUIRED evidence (brand → major evidence:brand)', () => {
    const audit = auditCanonicalBrief(NO_BRAND);
    const brand = audit.defects.find((d) => d.field === 'brand');
    expect(brand).toBeDefined();
    expect(brand!.blockerId).toBe('evidence:brand');
    expect(brand!.severity).toBe('major');
  });

  it('is deterministic — identical brief text → deep-equal audit', () => {
    expect(auditCanonicalBrief(NO_TONE)).toEqual(auditCanonicalBrief(NO_TONE));
  });

  it('READINESS RECOVERY: the tone repair flips migration prediction from not-admitted to admitted', () => {
    const acq = acqFor(['collateral']);
    const evidence = { assets: ['logo.svg'], approvals: [] };
    // Original (no tone) — the optional:tone blocker survives even with operator evidence → not admitted.
    const before = reconstructLegacyReadiness({ client: 'x', acquisition: acq, briefText: NO_TONE, evidence, now: MIGRATION_TIMESTAMP });
    expect(before.admitted).toBe(false);
    expect(before.assessment.blockers.some((b) => b.id === 'optional:tone')).toBe(true);
    // Repaired (tone added) — the blocker is gone → admitted (migratable).
    const after = reconstructLegacyReadiness({ client: 'x', acquisition: acq, briefText: COMPLETE, evidence, now: MIGRATION_TIMESTAMP });
    expect(after.admitted).toBe(true);
    expect(after.assessment.blockers.some((b) => b.id === 'optional:tone')).toBe(false);
  });
});
