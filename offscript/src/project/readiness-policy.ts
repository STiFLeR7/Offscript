/**
 * P54 — Readiness Policy: the seam that declares WHAT a project must satisfy to be admitted.
 *
 * Mirrors P51's PlanningPolicy / P53's WorkflowPlanningPolicy. `ruleReadinessPolicy` ships a
 * deterministic rule-based requirement set; a future AI evaluator implements the SAME
 * `ReadinessPolicy` interface (derive different minimums per project type / risk) and drops in without
 * touching the evaluator (P54 report §3/§7). The policy declares requirements; the evaluator
 * (readiness-evaluator.ts) checks them against the actual project state. The policy never reads fs.
 */
import { isCurrentTextIdentityApproved } from '../identity/identity-approval.js';
import type { Track } from '../paths.js';
import type { ProjectReadiness } from './readiness.js';

/** The minimum bar a project must clear to be admitted, as declared by a policy. */
export interface ReadinessRequirements {
  /** Canonical fields that must be confirmed facts. */
  readonly minEvidence: string[];
  /** Asset name patterns that must be present (matched case-insensitively as substrings). */
  readonly minAssets: string[];
  /** Approvals that must be granted (an 'approved' decision). */
  readonly minApprovals: string[];
  /** Deliverables that must have a generation task in the workflow. */
  readonly requiredDeliverables: Track[];
  /** Workflow task ids that must be complete (prerequisites; NOT the generation tasks themselves). */
  readonly requiredWorkflowTasks: string[];
  /** Subjects that, if rejected-and-unresolved, are a critical conflict. */
  readonly requiredDecisions: string[];
  /** Optional enrichment — missing ⇒ a minor blocker (PARTIALLY_READY), never a gate. */
  readonly niceToHaveEvidence: string[];
}

export interface ReadinessPolicy {
  readonly id: string;
  requirements(input: ProjectReadiness): ReadinessRequirements;
}

/** The prerequisite (non-generation) foundation tasks that must be complete before generation. */
const FOUNDATION_TASKS = ['review-brand-kit', 'confirm-audience', 'validate-assets'];

export function ruleReadinessPolicy(): ReadinessPolicy {
  return {
    id: 'rule-based',
    requirements(input: ProjectReadiness): ReadinessRequirements {
      const foundationInWorkflow = FOUNDATION_TASKS.filter((id) => input.workflow.tasks.some((t) => t.id === id));
      return {
        // The two foundation reviews (brand + audience) must rest on confirmed facts.
        minEvidence: ['brand', 'audience'],
        // The brand kit's core asset must exist.
        minAssets: ['logo'].filter(asset => asset !== 'logo' || !isCurrentTextIdentityApproved(input.context, input.installedIdentity)),
        // Whatever the Creative Strategy says must be signed off.
        minApprovals: [...input.strategy.requiredApprovals],
        requiredDeliverables: [...input.deliverables],
        requiredWorkflowTasks: foundationInWorkflow,
        requiredDecisions: ['brand', 'audience'],
        niceToHaveEvidence: ['tone'],
      };
    },
  };
}
