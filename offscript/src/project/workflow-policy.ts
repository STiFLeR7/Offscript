/**
 * P53 — Workflow Planning Policy: the seam that discovers WHICH creative tasks a project needs.
 *
 * This is the swap point for planning intelligence, mirroring P51's PlanningPolicy. `ruleWorkflowPolicy`
 * ships a deterministic rule-based task generator; a future AI planner implements the SAME
 * `WorkflowPlanningPolicy` interface and drops in without touching the planner (P53 report §7/§8).
 *
 * A policy proposes task DRAFTS — id, title, objective, inputs, outputs, deps, priority, owner, and an
 * optional `completeWhen(context)` predicate. The planner (workflow-planner.ts) owns the graph math and
 * stamps completion/status from the Living Project Context; the policy never touches the graph or fs.
 */
import type { Track } from '../paths.js';
import type { CreativeStrategy } from './creative-strategy.js';
import type { ProjectContext } from './project-context.js';
import { currentFacts } from './history-reader.js';

/** The logical capabilities that own workflow tasks (owner === a capability, not a runtime binding). */
export const WORKFLOW_CAPABILITIES = [
  'creative-director',
  'brand',
  'asset',
  'website-author',
  'collateral-author',
  'deck-author',
  'stakeholder',
] as const;

/** A proposed task before the planner stamps completion/status. `completeWhen` reads context only. */
export interface WorkflowTaskDraft {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly inputs: string[];
  readonly outputs: string[];
  readonly dependsOn: string[];
  readonly priority: number;
  readonly owner: string;
  /** True ⇒ the Living Project Context already satisfies this task (⇒ status 'complete'). */
  readonly completeWhen?: (ctx: ProjectContext | undefined) => boolean;
}

export interface WorkflowPolicyInput {
  readonly projectType: string;
  readonly deliverables: Track[];
  readonly strategy: CreativeStrategy;
  readonly context?: ProjectContext;
  readonly capabilities?: string[];
}

export interface WorkflowPlanningPolicy {
  readonly id: string;
  discoverTasks(input: WorkflowPolicyInput): WorkflowTaskDraft[];
}

// ── Context readers (pure, read-only) ───────────────────────────────────────────

const fact = (ctx: ProjectContext | undefined, field: string): unknown => (ctx ? currentFacts(ctx)[field] : undefined);
const assetNames = (ctx: ProjectContext | undefined): string[] =>
  ctx ? [...ctx.knownAssets, ...ctx.generatedArtifacts.map((a) => a.name)] : [];
const hasAnyAsset = (ctx: ProjectContext | undefined): boolean => assetNames(ctx).length > 0;
const hasLogo = (ctx: ProjectContext | undefined): boolean => assetNames(ctx).some((n) => /logo/i.test(n));
/** A deliverable is "done" if the context recorded an artifact/asset naming that track. */
const deliverableDone = (ctx: ProjectContext | undefined, track: string): boolean =>
  assetNames(ctx).some((n) => n.toLowerCase().includes(track));

/** 'legal/compliance sign-off' → 'legal-compliance-sign-off' (stable, id-safe). */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Generation task template per track (owner, output, and completion-from-context). */
const GENERATION: Record<Track, { id: string; title: string; owner: string; output: string }> = {
  website: { id: 'generate-website', title: 'Generate Website', owner: 'website-author', output: 'website' },
  collateral: { id: 'prepare-collateral', title: 'Prepare Collateral', owner: 'collateral-author', output: 'collateral' },
  deck: { id: 'produce-presentation', title: 'Produce Presentation', owner: 'deck-author', output: 'deck' },
};

export function ruleWorkflowPolicy(): WorkflowPlanningPolicy {
  return {
    id: 'rule-based',
    discoverTasks(input: WorkflowPolicyInput): WorkflowTaskDraft[] {
      const { deliverables, strategy, context } = input;
      const tasks: WorkflowTaskDraft[] = [];

      // ── Foundation (always) ───────────────────────────────────────────────────
      const needLogo = !hasLogo(context);
      if (needLogo) {
        tasks.push({
          id: 'request-missing-logo',
          title: 'Request Missing Logo',
          objective: 'Obtain the brand logo asset required before assets can be validated.',
          inputs: [],
          outputs: ['logo'],
          dependsOn: [],
          priority: 0,
          owner: 'asset',
          completeWhen: () => false, // this task is dropped (not completed) once a logo is known
        });
      }
      tasks.push({
        id: 'review-brand-kit',
        title: 'Review Brand Kit',
        objective: 'Confirm brand tokens, voice, and usage are on-brand and complete.',
        inputs: ['brand-kit'],
        outputs: ['approved-brand'],
        dependsOn: [],
        priority: 1,
        owner: 'brand',
        completeWhen: (ctx) => fact(ctx, 'brand') != null,
      });
      tasks.push({
        id: 'confirm-audience',
        title: 'Confirm Audience',
        objective: 'Confirm the primary audience the deliverables must address.',
        inputs: ['audience'],
        outputs: ['approved-audience'],
        dependsOn: [],
        priority: 2,
        owner: 'creative-director',
        completeWhen: (ctx) => fact(ctx, 'audience') != null,
      });
      tasks.push({
        id: 'validate-assets',
        title: 'Validate Assets',
        objective: 'Validate that all required brand assets are present and production-ready.',
        inputs: ['brand-kit', 'assets'],
        outputs: ['validated-assets'],
        dependsOn: ['review-brand-kit', ...(needLogo ? ['request-missing-logo'] : [])],
        priority: 3,
        owner: 'asset',
        completeWhen: (ctx) => hasAnyAsset(ctx),
      });

      const foundation = ['review-brand-kit', 'confirm-audience', 'validate-assets'];
      const hasWebsite = deliverables.includes('website');

      // ── Per-deliverable generation (in deliverable order) ─────────────────────
      const genIds: string[] = [];
      deliverables.forEach((track, i) => {
        const g = GENERATION[track];
        if (!g) return;
        // Cross-deliverable: collateral/deck depend on the website when it is also a deliverable.
        const crossDeps = track !== 'website' && hasWebsite ? ['generate-website'] : [];
        tasks.push({
          id: g.id,
          title: g.title,
          objective: `Produce the ${track} deliverable, grounded in the approved brand and audience.`,
          inputs: ['canonical-brief', 'approved-brand', 'approved-audience', 'validated-assets'],
          outputs: [g.output],
          dependsOn: [...foundation, ...crossDeps],
          priority: 10 + i,
          owner: g.owner,
          completeWhen: (ctx) => deliverableDone(ctx, track) || (track === 'deck' && deliverableDone(ctx, 'presentation')),
        });
        genIds.push(g.id);
      });

      // Website-specific review (an example dependent task).
      if (hasWebsite) {
        tasks.push({
          id: 'review-hero-copy',
          title: 'Review Hero Copy',
          objective: 'Review and approve the generated hero headline and subcopy.',
          inputs: ['website'],
          outputs: ['approved-hero-copy'],
          dependsOn: ['generate-website'],
          priority: 15,
          owner: 'creative-director',
          completeWhen: (ctx) => deliverableDone(ctx, 'website'),
        });
      }

      // ── Strategy-driven expansion (stakeholder review + approvals) ────────────
      const gatesOn = genIds.length ? genIds : foundation;
      if (strategy.requiredStakeholders.length > 1) {
        tasks.push({
          id: 'stakeholder-review',
          title: 'Stakeholder Review',
          objective: `Review the deliverables with ${strategy.requiredStakeholders.join(', ')}.`,
          inputs: gatesOn.map((id) => `${id}:output`),
          outputs: ['stakeholder-review'],
          dependsOn: [...gatesOn],
          priority: 20,
          owner: 'stakeholder',
        });
      }
      const approvalGate = strategy.requiredStakeholders.length > 1 ? ['stakeholder-review'] : [...gatesOn];
      strategy.requiredApprovals.forEach((approval, i) => {
        tasks.push({
          id: `approval-${slug(approval)}`,
          title: `Approval — ${approval}`,
          objective: `Obtain ${approval} before release.`,
          inputs: ['stakeholder-review'],
          outputs: [`${slug(approval)}-approved`],
          dependsOn: [...approvalGate],
          priority: 21 + i,
          owner: 'stakeholder',
        });
      });

      return tasks;
    },
  };
}
