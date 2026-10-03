/**
 * P51 — Creative Strategy assessment.
 *
 * Before any interview, the Creative Director determines HOW a project should be acquired. This
 * layer reads the project definition + the inferred facts + the gap report and produces a
 * `CreativeStrategy`: the shape of the engagement (complexity, brand/creative maturity, evidence
 * completeness, risk), the deliverables/stakeholders/approvals it implies, and the unknown critical
 * decisions still open. The planning policy (planning-policy.ts) consumes this to build the plan.
 *
 * Pure + deterministic (no clock/rng/fs). It is a rule-based assessor today; a future AI planner
 * swaps in behind the same PlanningPolicy seam and may recompute or ignore this.
 */
import type { Track } from '../paths.js';
import type { ProjectType } from './project-registry.js';
import { knownValues, type InferredFact } from './inference.js';
import type { GapReport } from './gap-analysis.js';

export type ProjectComplexity = 'simple' | 'standard' | 'complex';
export type BrandMaturity = 'unknown' | 'nascent' | 'established';
export type CreativeMaturity = 'greenfield' | 'guided' | 'established';
export type RiskLevel = 'low' | 'elevated' | 'high';

export interface CreativeStrategy {
  readonly projectComplexity: ProjectComplexity;
  readonly creativeMaturity: CreativeMaturity;
  readonly brandMaturity: BrandMaturity;
  /** Fraction (0..1) of REQUIRED fields already known. */
  readonly evidenceCompleteness: number;
  readonly riskLevel: RiskLevel;
  readonly expectedDeliverables: Track[];
  readonly requiredStakeholders: string[];
  readonly requiredApprovals: string[];
  /** Required fields still unresolved (or, in high-risk, must-be-re-decided) — the critical opens. */
  readonly unknownCriticalDecisions: string[];
}

export interface StrategyInput {
  readonly projectType: ProjectType;
  readonly facts: readonly InferredFact[];
  readonly gap: GapReport;
  readonly threshold?: number;
}

/** Regulated / high-stakes domains that push a project to high risk (banking ≠ startup). */
const REGULATED_LEXICON =
  /\b(bank|banking|financ|fintech|insur|health|medical|clinical|pharma|govern|public[- ]sector|defen[cs]e|security|compliance|payment|trading|wealth|credit|lending|enterprise)\b/i;

export function assessStrategy(input: StrategyInput): CreativeStrategy {
  const { projectType, facts, gap } = input;
  const known = knownValues(facts, input.threshold);
  const knownFields = new Set(Object.keys(known));
  const required = projectType.requiredArtifacts;

  const requiredKnown = required.filter((f) => knownFields.has(f)).length;
  const evidenceCompleteness = required.length === 0 ? 1 : requiredKnown / required.length;

  const projectComplexity: ProjectComplexity =
    projectType.deliverables.length >= 2 ? 'complex' : required.length <= 2 ? 'simple' : 'standard';

  const brandMaturity: BrandMaturity = !knownFields.has('brand')
    ? 'unknown'
    : knownFields.has('tone')
      ? 'established'
      : 'nascent';

  const creativeMaturity: CreativeMaturity =
    knownFields.has('one-liner') && (knownFields.has('tone') || knownFields.has('must-include'))
      ? 'established'
      : knownFields.has('one-liner') || knownFields.has('must-include')
        ? 'guided'
        : 'greenfield';

  // Risk from the content signals we actually have (audience / brand / one-liner / tone text).
  const signalText = ['audience', 'brand', 'one-liner', 'tone']
    .map((f) => known[f])
    .filter((v): v is string => typeof v === 'string')
    .join(' • ');
  const riskLevel: RiskLevel = REGULATED_LEXICON.test(signalText)
    ? 'high'
    : projectComplexity === 'complex' || brandMaturity === 'established'
      ? 'elevated'
      : 'low';

  const requiredStakeholders = ['project owner'];
  if (projectComplexity === 'complex') requiredStakeholders.push('brand lead', 'delivery lead');
  if (riskLevel === 'high') requiredStakeholders.push('compliance officer');

  const requiredApprovals: string[] = [];
  if (brandMaturity === 'established') requiredApprovals.push('brand sign-off');
  if (projectComplexity === 'complex') requiredApprovals.push('executive sign-off');
  if (riskLevel === 'high') requiredApprovals.push('legal/compliance sign-off');

  // Critical opens = required gaps, plus (high-risk) the never-infer fields that must be re-decided.
  const criticalNeverInfer = riskLevel === 'high' ? ['one-liner', 'brand'].filter((f) => required.includes(f)) : [];
  const unknownCriticalDecisions = [...new Set([...gap.questions, ...criticalNeverInfer])];

  return {
    projectComplexity,
    creativeMaturity,
    brandMaturity,
    evidenceCompleteness,
    riskLevel,
    expectedDeliverables: [...projectType.deliverables],
    requiredStakeholders,
    requiredApprovals,
    unknownCriticalDecisions,
  };
}
