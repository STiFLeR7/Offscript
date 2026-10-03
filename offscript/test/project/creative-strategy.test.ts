/**
 * P51 — Creative Strategy assessment. Before any interview, the Creative Director determines HOW a
 * project should be acquired: its complexity, brand/creative maturity, evidence completeness, risk,
 * expected deliverables, stakeholders, approvals, and unknown critical decisions.
 */
import { describe, it, expect } from 'vitest';
import { CONFIDENCE, type Evidence } from '../../src/project/evidence.js';
import { inferFacts } from '../../src/project/inference.js';
import { analyzeGaps } from '../../src/project/gap-analysis.js';
import { getProjectType } from '../../src/project/project-registry.js';
import { assessStrategy } from '../../src/project/creative-strategy.js';

const NOW = '2026-01-01T00:00:00Z';
function ev(field: string, value: unknown, confidence: number, source = 'brand-kit'): Evidence {
  return { field, value, source, confidence, timestamp: NOW, origin: source };
}
function assess(projectId: string, evidence: Evidence[]) {
  const type = getProjectType(projectId);
  const facts = inferFacts(evidence);
  const gap = analyzeGaps(type.requiredArtifacts, facts);
  return assessStrategy({ projectType: type, facts, gap });
}

describe('P51 creative strategy', () => {
  it('a bare website (no evidence) is standard/greenfield/low-risk with zero completeness', () => {
    const s = assess('website', []);
    expect(s.projectComplexity).toBe('standard');
    expect(s.creativeMaturity).toBe('greenfield');
    expect(s.brandMaturity).toBe('unknown');
    expect(s.riskLevel).toBe('low');
    expect(s.evidenceCompleteness).toBe(0);
    expect(s.requiredStakeholders).toContain('project owner');
    expect(s.requiredApprovals).toEqual([]); // a simple low-risk kickoff needs no formal approvals
    expect(s.unknownCriticalDecisions).toEqual(['one-liner', 'audience', 'must-include']);
  });

  it('project complexity scales with deliverables/required-artifact count', () => {
    expect(assess('social-campaign', []).projectComplexity).toBe('simple'); // 1 deliverable, 2 required
    expect(assess('website', []).projectComplexity).toBe('standard'); // 1 deliverable, 3 required
    expect(assess('full-brand-package', []).projectComplexity).toBe('complex'); // 3 deliverables
  });

  it('a regulated-industry audience raises the risk level to high (banking ≠ startup)', () => {
    const startup = assess('website', [ev('audience', 'Growth teams at startups', CONFIDENCE.HIGH)]);
    const banking = assess('website', [ev('audience', 'Retail banking customers', CONFIDENCE.HIGH)]);
    expect(startup.riskLevel).toBe('low');
    expect(banking.riskLevel).toBe('high');
    expect(banking.requiredApprovals.length).toBeGreaterThan(0); // high risk demands sign-off
    expect(banking.requiredStakeholders).toContain('compliance officer');
  });

  it('brand maturity reflects the brand identity signals present', () => {
    expect(assess('website', []).brandMaturity).toBe('unknown');
    expect(assess('website', [ev('brand', 'Acme', CONFIDENCE.HIGH)]).brandMaturity).toBe('nascent');
    const established = assess('website', [ev('brand', 'Acme', CONFIDENCE.HIGH), ev('tone', 'Confident', CONFIDENCE.HIGH)]);
    expect(established.brandMaturity).toBe('established');
  });

  it('evidence completeness is the fraction of REQUIRED fields already known', () => {
    const s = assess('website', [ev('audience', 'Devs', CONFIDENCE.HIGH)]); // 1 of 3 required
    expect(s.evidenceCompleteness).toBeCloseTo(1 / 3, 5);
    expect(s.expectedDeliverables).toEqual(['website']);
  });
});
