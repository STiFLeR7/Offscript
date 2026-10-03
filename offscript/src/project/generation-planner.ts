/**
 * P55 — Generation Planner: derives the immutable Generation Plan from a READY project.
 *
 * This is the boundary composer (… → Readiness → Generation Planning → Generation Plan → Generation).
 * It reuses Project-Platform outputs by REFERENCE (brief / workflow / context / readiness are pointers,
 * not copies) and freezes a derived, self-verifying contract. It EVALUATES + DERIVES only — no
 * generation, execution, scheduling, or agent/LLM call. Pure over its inputs, so the same READY project
 * replays the identical plan (identical planId). A non-admitted project cannot produce a contract.
 *
 * Ownership (design review): the Canonical Brief owns INTENT (referenced, never copied); the Project
 * Context owns the living LOG (referenced + a small frozen brand projection); the Generation Plan owns
 * the derived EXECUTION decisions — scope, constraints, validations, assumptions — nothing else holds.
 */
import type { Track } from '../paths.js';
import type { ProjectContext } from './project-context.js';
import type { CreativeStrategy } from './creative-strategy.js';
import type { ReadinessAssessment, ProjectReadiness } from './readiness.js';
import { evaluateReadiness } from './readiness-evaluator.js';
import type { ReadinessPolicy } from './readiness-policy.js';
import { currentFacts, decisionsByKind } from './history-reader.js';
import {
  planIdOf,
  buildManifest,
  assembleGenerationPlan,
  deepFreeze,
  type GenerationPlan,
  type GenerationPlanBody,
  type GenerationConstraint,
  type ExecutionAssumption,
  type BrandContext,
} from './generation-plan.js';

/** The CR-validations each deliverable track must pass (the "what validations are required" answer). */
export const VALIDATIONS_BY_TRACK: Readonly<Record<Track, string[]>> = {
  website: ['cr-validate', 'pixel-precision', 'surface-rhythm', 'wcag-contrast'],
  collateral: ['cr-validate', 'a4-bounds', 'text-overlap', 'print-page-count'],
  deck: ['cr-validate', 'slide-bounds', 'text-overlap', 'min-body-size'],
};

/** The generation capability that owns each deliverable track. */
const CAPABILITY_BY_TRACK: Readonly<Record<Track, string>> = {
  website: 'website-author',
  collateral: 'collateral-author',
  deck: 'deck-author',
};

/** Constraints that apply to every Offscript deliverable, regardless of project. */
const BASE_CONSTRAINTS: readonly GenerationConstraint[] = [
  { id: 'output-single-file', kind: 'output', description: 'single self-contained HTML file; no framework, build step, or runtime dependency', source: 'offscript-deliverable-contract' },
  { id: 'palette-tokens', kind: 'palette', description: 'all colours resolve to brand tokens; off-palette fails validation', source: 'governance' },
  { id: 'motion-discipline', kind: 'motion', description: 'CSS-first motion; any JS animation is GSAP-only', source: 'governance' },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export interface GenerationPlanInput {
  readonly client: string;
  readonly readiness: ProjectReadiness;
  readonly assessment: ReadinessAssessment;
  /** The prior plan this one replaces, if this is a re-plan (a change produces a NEW plan). */
  readonly supersedes?: string;
}

function brandProjection(ctx: ProjectContext | undefined): BrandContext {
  if (!ctx) return {};
  const f = currentFacts(ctx);
  const out: BrandContext = {};
  if (typeof f.brand === 'string') (out as { brand?: string }).brand = f.brand;
  if (typeof f.tone === 'string') (out as { tone?: string }).tone = f.tone;
  if (typeof f.audience === 'string') (out as { audience?: string }).audience = f.audience;
  return out;
}

function deriveConstraints(strategy: CreativeStrategy, excluded: Track[]): GenerationConstraint[] {
  const c: GenerationConstraint[] = [...BASE_CONSTRAINTS];
  if (strategy.riskLevel === 'high')
    c.push({ id: 'regulated-governance', kind: 'governance', description: 'regulated-domain governance applies to every decision', source: 'strategy:risk' });
  for (const approval of strategy.requiredApprovals)
    c.push({ id: `approval-${slug(approval)}`, kind: 'approval', description: `${approval} is required before publish`, source: 'strategy:approval' });
  if (strategy.projectComplexity === 'complex')
    c.push({ id: 'cross-deliverable-consistency', kind: 'coordination', description: 'brand consistency is enforced across all deliverables', source: 'strategy:complexity' });
  if (excluded.includes('deck'))
    c.push({ id: 'deck-blocked', kind: 'deliverable', description: 'deck authoring governance is design-team-gated; deck generation is out of scope', source: 'offscript-scope' });
  return c;
}

function deriveAssumptions(
  assessment: ReadinessAssessment,
  brand: BrandContext,
  requiredAssets: string[],
  ctx: ProjectContext | undefined,
): ExecutionAssumption[] {
  const a: ExecutionAssumption[] = [
    { id: 'readiness-admitted', assumption: 'the project passed the readiness gate', basis: `readiness:${assessment.state} v${assessment.version}` },
  ];
  if (brand.brand) a.push({ id: 'brand-confirmed', assumption: 'the brand identity is confirmed', basis: 'context.confirmedFacts.brand' });
  if (brand.audience) a.push({ id: 'audience-confirmed', assumption: 'the primary audience is confirmed', basis: 'context.confirmedFacts.audience' });
  if (requiredAssets.length) a.push({ id: 'assets-validated', assumption: 'required assets are validated and available', basis: 'readiness:asset' });
  a.push({ id: 'single-file-output', assumption: 'each deliverable is one self-contained HTML file', basis: 'offscript-deliverable-contract' });
  if (ctx) for (const d of decisionsByKind(ctx, 'approved')) a.push({ id: `approval-granted-${slug(d.subject)}`, assumption: `${d.subject} is granted`, basis: 'context:approved' });
  return a;
}

/** Produce the immutable Generation Plan for a READY project. Throws if the project was not admitted. */
export function planGeneration(input: GenerationPlanInput): GenerationPlan {
  const { client, readiness, assessment } = input;
  if (!assessment.admission.admitted) {
    throw new Error(
      `cannot plan generation: project "${client}" is not READY (state ${assessment.state}). ` +
        `Resolve its readiness blockers first — generation is admitted only from a READY project.`,
    );
  }
  const { projectType, deliverables, strategy, context, workflow } = readiness;

  const excluded = deliverables.filter((d) => d === 'deck');
  const included = deliverables.filter((d) => d !== 'deck');
  const capabilities = included.map((t) => CAPABILITY_BY_TRACK[t]);
  const brandContext = brandProjection(context);
  const requiredAssets = assessment.satisfied.filter((s) => s.startsWith('asset:')).map((s) => s.slice('asset:'.length));
  const requiredValidations = included.map((track) => ({ track, validations: [...VALIDATIONS_BY_TRACK[track]] }));

  const body: GenerationPlanBody = {
    createdVersion: context?.version ?? 0,
    ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
    identity: { client, projectType, deliverables: [...deliverables] },
    objective: `Generate ${included.length ? included.join(' + ') : 'no'} deliverable(s) for ${client}.`,
    scope: { included, excluded, capabilities },
    brandContext,
    references: {
      canonicalBrief: { kind: 'canonical-brief', ref: `projects/${client}/references/brief.md` },
      workflow: { kind: 'workflow-plan', ref: `${client}/workflow`, version: workflow.version },
      projectContext: { kind: 'project-context', ref: `projects/${client}/context.json`, version: context?.version ?? 0 },
      readiness: { kind: 'readiness-assessment', ref: `${client}/readiness`, version: assessment.version, state: assessment.state },
    },
    requiredAssets,
    requiredValidations,
    constraints: deriveConstraints(strategy, excluded),
    assumptions: deriveAssumptions(assessment, brandContext, requiredAssets, context),
  };

  const planId = planIdOf(body);
  return deepFreeze(assembleGenerationPlan(body, planId, buildManifest(planId, body)));
}

/**
 * One-call surface — evaluate readiness and, if admitted, produce the Generation Plan. This is how a
 * READY project crosses the boundary into an execution contract in a single step.
 */
export function planGenerationFor(
  client: string,
  readiness: ProjectReadiness,
  opts: { policy?: ReadinessPolicy; supersedes?: string } = {},
): GenerationPlan {
  const assessment = evaluateReadiness(readiness, opts.policy ? { policy: opts.policy } : {});
  return planGeneration({ client, readiness, assessment, supersedes: opts.supersedes });
}
