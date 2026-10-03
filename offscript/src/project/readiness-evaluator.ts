/**
 * P54 — Readiness Evaluator: checks a project against a policy's requirements and produces the
 * explicit ReadinessAssessment + AdmissionDecision.
 *
 * This is the composition point of the final Project-Platform stage
 * (… → Workflow Plan → Project Readiness Assessment → Generation):
 *   1. the policy declares WHAT must hold (evidence / assets / approvals / deliverables / workflow /
 *      decisions);
 *   2. the evaluator checks each against the actual state (Workflow Plan + Living Project Context +
 *      Creative Strategy), emitting a self-explaining Blocker per unmet requirement;
 *   3. `deriveReadinessState` maps the blockers to an explicit state, and `decideAdmission` decides
 *      admission (READY only).
 *
 * It EVALUATES ONLY — no generation, execution, scheduling, or agent/LLM call. Pure over its inputs
 * (no clock/rng/fs), so the same inputs replay the identical assessment. Generation never imports it.
 */
import type { Track } from '../paths.js';
import type { ProjectContext } from './project-context.js';
import type { AcquisitionPlan } from './acquisition-plan.js';
import type { WorkflowPlan } from './workflow.js';
import { validateWorkflow } from './workflow.js';
import { workflowFromAcquisition } from './workflow-planner.js';
import { currentFacts, decisionsByKind } from './history-reader.js';
import {
  deriveReadinessState,
  decideAdmission,
  type Blocker,
  type ProjectReadiness,
  type ReadinessAssessment,
} from './readiness.js';
import { ruleReadinessPolicy, type ReadinessPolicy } from './readiness-policy.js';

// ── Context readers (pure, read-only) ───────────────────────────────────────────

const factPresent = (ctx: ProjectContext | undefined, field: string): boolean => (ctx ? currentFacts(ctx)[field] != null : false);
const assetNames = (ctx: ProjectContext | undefined): string[] => (ctx ? [...ctx.knownAssets, ...ctx.generatedArtifacts.map((a) => a.name)] : []);
const assetMatch = (ctx: ProjectContext | undefined, pattern: string): boolean =>
  assetNames(ctx).some((n) => n.toLowerCase().includes(pattern.toLowerCase()));

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const approvalGranted = (ctx: ProjectContext | undefined, approval: string): boolean =>
  ctx ? decisionsByKind(ctx, 'approved').some((d) => slug(d.subject) === slug(approval)) : false;
/** A required decision that was rejected and never re-confirmed — an outstanding conflict. */
const rejectedUnresolved = (ctx: ProjectContext | undefined, subject: string): boolean =>
  ctx ? ctx.rejectedAssumptions.some((r) => r.subject === subject) && currentFacts(ctx)[subject] == null : false;

/** Workflow tasks whose id / inputs / outputs reference any of the given tokens (case-insensitive). */
function dependents(wf: WorkflowPlan, tokens: string[]): string[] {
  const t = tokens.map((x) => x.toLowerCase());
  return wf.tasks
    .filter((task) => {
      const hay = [task.id, ...task.inputs, ...task.outputs].join(' ').toLowerCase();
      return t.some((tok) => hay.includes(tok));
    })
    .map((task) => task.id);
}

const GENERATION_TASK: Record<Track, string> = { website: 'generate-website', collateral: 'prepare-collateral', deck: 'produce-presentation' };

/** Evaluate a project's readiness against a policy → explicit assessment + admission. */
export function evaluateReadiness(input: ProjectReadiness, opts: { policy?: ReadinessPolicy } = {}): ReadinessAssessment {
  const policy = opts.policy ?? ruleReadinessPolicy();
  const req = policy.requirements(input);
  const ctx = input.context;
  const wf = input.workflow;
  const blockers: Blocker[] = [];
  const satisfied: string[] = [];

  // Required evidence (confirmed facts).
  for (const field of req.minEvidence) {
    const id = `evidence:${field}`;
    if (factPresent(ctx, field)) satisfied.push(id);
    else
      blockers.push({
        id, category: 'evidence', severity: 'major', owner: 'creative-director',
        reason: `required evidence missing: ${field}`,
        resolution: `Provide "${field}" through context discovery or the interview.`,
        dependentTasks: dependents(wf, [field, `approved-${field}`]),
      });
  }

  // Required assets.
  for (const pattern of req.minAssets) {
    const id = `asset:${pattern}`;
    if (assetMatch(ctx, pattern)) satisfied.push(id);
    else
      blockers.push({
        id, category: 'asset', severity: 'major', owner: 'asset',
        reason: `required asset missing: ${pattern}`,
        resolution: `Add the ${pattern} asset (brand kit) to the project.`,
        dependentTasks: dependents(wf, [pattern, 'validated-assets']),
      });
  }

  // Required approvals (granted decisions).
  for (const approval of req.minApprovals) {
    const id = `approval:${slug(approval)}`;
    if (approvalGranted(ctx, approval)) satisfied.push(id);
    else
      blockers.push({
        id, category: 'approval', severity: 'major', owner: 'stakeholder',
        reason: `required approval not granted: ${approval}`,
        resolution: `Obtain ${approval} from the responsible stakeholder.`,
        dependentTasks: dependents(wf, [`approval-${slug(approval)}`]),
      });
  }

  // Required deliverables must have a generation task planned.
  for (const track of req.requiredDeliverables) {
    const gen = GENERATION_TASK[track];
    const id = `deliverable:${track}`;
    if (gen && wf.tasks.some((t) => t.id === gen)) satisfied.push(id);
    else
      blockers.push({
        id, category: 'deliverable', severity: 'major', owner: 'creative-director',
        reason: `no generation task planned for required deliverable: ${track}`,
        resolution: `Ensure the workflow plans the ${track} deliverable.`,
        dependentTasks: [],
      });
  }

  // Prerequisite workflow tasks must be complete.
  for (const taskId of req.requiredWorkflowTasks) {
    const task = wf.tasks.find((t) => t.id === taskId);
    if (!task) continue;
    const id = `workflow:${taskId}`;
    if (task.status === 'complete') satisfied.push(id);
    else
      blockers.push({
        id, category: 'workflow', severity: 'major', owner: task.owner,
        reason: `prerequisite task not complete: ${taskId} (${task.status})`,
        resolution: `Complete "${task.title}" before generation.`,
        dependentTasks: [taskId],
      });
  }

  // Outstanding conflicts — a required decision rejected and never re-confirmed (critical).
  for (const subject of req.requiredDecisions) {
    if (rejectedUnresolved(ctx, subject))
      blockers.push({
        id: `conflict:${subject}`, category: 'conflict', severity: 'critical', owner: 'creative-director',
        reason: `required decision "${subject}" was rejected and is unresolved`,
        resolution: `Re-decide "${subject}" and confirm the new value.`,
        dependentTasks: dependents(wf, [subject, `approved-${subject}`]),
      });
  }

  // Structural dependency block — an invalid workflow graph (critical).
  const v = validateWorkflow(wf);
  if (!v.valid)
    blockers.push({
      id: 'dependency:workflow', category: 'dependency', severity: 'critical', owner: 'creative-director',
      reason: `workflow has an unresolved dependency: ${v.errors[0]}`,
      resolution: 'Resolve the workflow dependency graph before admission.',
      dependentTasks: [],
    });

  // Optional enrichment — minor (PARTIALLY_READY), never a gate.
  for (const field of req.niceToHaveEvidence) {
    if (factPresent(ctx, field)) satisfied.push(`evidence:${field}`);
    else
      blockers.push({
        id: `optional:${field}`, category: 'evidence', severity: 'minor', owner: 'creative-director',
        reason: `optional enrichment missing: ${field}`,
        resolution: `Optionally provide "${field}" to enrich the deliverable.`,
        dependentTasks: dependents(wf, [field]),
      });
  }

  const state = deriveReadinessState(blockers);
  const admission = decideAdmission(state, blockers);
  const version = input.context?.version ?? wf.version ?? 0;
  return {
    schemaVersion: 1,
    projectType: input.projectType,
    deliverables: [...input.deliverables],
    version,
    policyId: policy.id,
    state,
    admission,
    blockers,
    satisfied,
    summary: `${state} — ${blockers.length} blocker(s), ${satisfied.length} satisfied`,
  };
}

/**
 * Assemble the ProjectReadiness a Creative Director Acquisition Plan (P51) implies: it carries
 * projectType, deliverables, and the Creative Strategy; the Workflow Plan is derived (P53) and the
 * Living Project Context (P52) is threaded in for completion/approval state. This is the evaluator INPUT
 * — the artifact G1-S3 persists so generation consumes it instead of reconstructing it. Pure; no eval.
 */
export function projectReadinessFor(acq: AcquisitionPlan, opts: { context?: ProjectContext } = {}): ProjectReadiness {
  const workflow = workflowFromAcquisition(acq, { context: opts.context });
  return {
    projectType: acq.projectType,
    deliverables: [...acq.deliverables],
    workflow,
    strategy: acq.strategy,
    ...(opts.context !== undefined ? { context: opts.context } : {}),
  };
}

/**
 * Adapter — assess readiness directly from a Creative Director Acquisition Plan (P51). The "one call per
 * project" readiness surface: assemble the ProjectReadiness (`projectReadinessFor`) and evaluate it.
 */
export function evaluateReadinessFor(
  acq: AcquisitionPlan,
  opts: { context?: ProjectContext; policy?: ReadinessPolicy } = {},
): ReadinessAssessment {
  return evaluateReadiness(projectReadinessFor(acq, { context: opts.context }), { policy: opts.policy });
}
