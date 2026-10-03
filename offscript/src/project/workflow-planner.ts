/**
 * P53 — Workflow Planner: turns a policy's task drafts into an explicit, validated Workflow Plan.
 *
 * The planner is the deterministic composition point of the P53 lifecycle stage
 * (… → Living Project Context → Creative Workflow Plan → Generation):
 *   1. the policy (rule-based by default) discovers task drafts from project type + strategy + context;
 *   2. a capability gate (optional) drops tasks whose owner is unavailable — and their dependents;
 *   3. the planner stamps completion/status from the Living Project Context (P52) — the reduction step;
 *   4. the graph mechanics (workflow.ts) order the tasks and compute the analysis.
 *
 * It NEVER executes a task, invokes an agent/LLM, or writes anything. It is pure over its inputs, so
 * the same inputs replay the identical plan. Generation is strictly downstream and never imports this.
 */
import type { Track } from '../paths.js';
import type { CreativeStrategy } from './creative-strategy.js';
import type { ProjectContext } from './project-context.js';
import type { AcquisitionPlan } from './acquisition-plan.js';
import { assembleWorkflow, type WorkflowPlan, type WorkflowTask, type TaskStatus } from './workflow.js';
import { ruleWorkflowPolicy, type WorkflowPlanningPolicy, type WorkflowTaskDraft } from './workflow-policy.js';

export interface WorkflowPlanInput {
  readonly projectType: string;
  readonly deliverables: Track[];
  readonly strategy: CreativeStrategy;
  /** The Living Project Context — the source of completion (what prior work satisfied). */
  readonly context?: ProjectContext;
  /** Available logical capabilities; when set, tasks owned by an unavailable capability are dropped. */
  readonly capabilities?: string[];
  readonly policy?: WorkflowPlanningPolicy;
  /** Plan version; defaults to the context version (0 without context). */
  readonly version?: number;
}

/**
 * Drop drafts whose owner is unavailable, then transitively drop any draft that depends on a dropped
 * one (a survivor must have an available owner AND all its task-deps survive). Deps on non-task ids
 * (external inputs) never block survival. Memoized fixpoint, cycle-guarded.
 */
function applyCapabilityGate(drafts: WorkflowTaskDraft[], capabilities?: string[]): WorkflowTaskDraft[] {
  if (!capabilities) return drafts;
  const avail = new Set(capabilities);
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const survives = new Map<string, boolean>();
  const ok = (id: string, seen: Set<string>): boolean => {
    if (survives.has(id)) return survives.get(id)!;
    const d = byId.get(id);
    if (!d) return true; // dependency on an external (non-task) input
    if (seen.has(id)) return true; // cycle guard — do not let a cycle force a drop
    seen.add(id);
    const r = avail.has(d.owner) && d.dependsOn.every((dep) => ok(dep, seen));
    seen.delete(id);
    survives.set(id, r);
    return r;
  };
  return drafts.filter((d) => ok(d.id, new Set()));
}

/** Stamp completion (from context) → status (complete | ready | blocked), then strip the predicate. */
function stamp(drafts: WorkflowTaskDraft[], context?: ProjectContext): WorkflowTask[] {
  const complete = new Set(drafts.filter((d) => d.completeWhen?.(context)).map((d) => d.id));
  const status = (d: WorkflowTaskDraft): TaskStatus =>
    complete.has(d.id) ? 'complete' : d.dependsOn.every((dep) => complete.has(dep) || !hasTask(drafts, dep)) ? 'ready' : 'blocked';
  return drafts.map((d) => ({
    id: d.id,
    title: d.title,
    objective: d.objective,
    inputs: d.inputs,
    outputs: d.outputs,
    dependsOn: d.dependsOn,
    priority: d.priority,
    owner: d.owner,
    status: status(d),
  }));
}

function hasTask(drafts: WorkflowTaskDraft[], id: string): boolean {
  return drafts.some((d) => d.id === id);
}

/** Produce the explicit, validated-shape Workflow Plan for a project. Deterministic + replayable. */
export function planWorkflow(input: WorkflowPlanInput): WorkflowPlan {
  const policy = input.policy ?? ruleWorkflowPolicy();
  const drafts = applyCapabilityGate(
    policy.discoverTasks({
      projectType: input.projectType,
      deliverables: input.deliverables,
      strategy: input.strategy,
      context: input.context,
      capabilities: input.capabilities,
    }),
    input.capabilities,
  );
  const tasks = stamp(drafts, input.context);
  const version = input.version ?? input.context?.version ?? 0;
  return assembleWorkflow({ projectType: input.projectType, deliverables: input.deliverables, version }, tasks);
}

/**
 * Adapter — build the Workflow Plan directly from a Creative Director Acquisition Plan (P51), which
 * already carries projectType, deliverables, and the Creative Strategy. The Living Project Context is
 * threaded in for completion/reduction. This is how "every project produces a Workflow Plan".
 */
export function workflowFromAcquisition(
  acq: AcquisitionPlan,
  opts: { context?: ProjectContext; capabilities?: string[]; policy?: WorkflowPlanningPolicy } = {},
): WorkflowPlan {
  return planWorkflow({
    projectType: acq.projectType,
    deliverables: [...acq.deliverables],
    strategy: acq.strategy,
    context: opts.context,
    capabilities: opts.capabilities,
    policy: opts.policy,
  });
}
