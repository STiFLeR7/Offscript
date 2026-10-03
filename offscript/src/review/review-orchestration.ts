/**
 * R7 — Review Regeneration Orchestration: pure composition of the existing R1–R6 pipeline into one
 * deterministic flow (`ReviewSession → ReviewAnalysis → ReviewPlan → ReviewScope →
 * RegenerationPlan → ReadinessDecision → ReviewPipelineResult`). No new planning, no new
 * evaluation, no execution, no regeneration — every stage reuses the existing R2–R6 entry point
 * verbatim, called exactly once, in order.
 *
 * Ownership (`docs/review/R7-REVIEW-ORCHESTRATION.md` §3 for the full grounding):
 *   1. **Current execution chain (already fully linear before this sprint):**
 *      `analyzeReviewSession` (R2) → `planReviewSession` (R3) → `resolveReviewScope` (R4, needs
 *      `ProjectModel`) → `resolveRegenerationPlan` (R5, needs `ProjectModel`) →
 *      `evaluateRegenerationReadiness` (R6, needs optional `WorkspaceState`). This module adds no
 *      new edge to that chain — it only executes the existing one, in the existing order.
 *   2. **Ownership boundaries:** R1 owns the input `ReviewSession` (never created or mutated here —
 *      supplying one is the caller's job, exactly like every one of R2–R6's own inputs); R2–R6 each
 *      own their own pure derivation, imported here as FUNCTIONS + TYPES only, never reimplemented.
 *      This module owns exactly one thing: the ORDER and WIRING of those calls, plus bundling their
 *      results by reference — no business rule, no new kind of decision.
 *   3. **No stage duplicates work** — verified structurally, not merely asserted: this module's only
 *      non-infrastructure imports are the five R2–R6 entry-point functions and their result/input
 *      types. It reuses R3's session/analysis cross-check and R4's plan/model cross-check by simply
 *      calling through to them — it does NOT re-validate `client`/`track` agreement itself (that
 *      would be exactly the duplicated algorithm STOP/RULES forbid); a mismatch surfaces as R3/R4's
 *      own existing thrown error, unchanged, regression-tested directly (§5).
 *
 * **A deliberate simplification, named rather than hidden:** unlike R3–R6, this module does NOT
 * expose a per-sub-stage `*Policy` injection surface (e.g. a way to override R4's
 * `ScopeResolutionPolicy` through the orchestrator). The brief is explicit that this sprint
 * introduces "NO new planning… NO new evaluation" — every one of R2–R6's own policy seams already
 * exists and is reachable by calling that module directly; duplicating nine optional pass-through
 * fields here would be speculative plumbing this sprint was never asked to build (YAGNI). The one
 * injection seam this module DOES expose (`ReviewOrchestratorFns`) is the same
 * default-parameter-testability pattern every module in this program already uses — it swaps WHICH
 * function runs a stage, never HOW that stage decides anything.
 */
import { analyzeReviewSession, type ReviewAnalysis } from './review-analysis.js';
import { planReviewSession, type ReviewPlan } from './review-planning.js';
import { resolveReviewScope, type ReviewScope } from './review-scope.js';
import { resolveRegenerationPlan, type RegenerationPlan } from './regeneration-planning.js';
import { evaluateRegenerationReadiness, type ReadinessDecision } from './regeneration-readiness.js';
import type { ReviewSession } from './review-session.js';
import type { ProjectModel } from '../fullstack/project-model.js';
import type { WorkspaceState } from '../fullstack/workspace-state.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_ORCHESTRATION_VERSION_TAG = 'r7-review-orchestration@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_ORCHESTRATION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export type ReviewPipelineStageName = 'ANALYSIS' | 'PLANNING' | 'SCOPE' | 'REGENERATION_PLANNING' | 'READINESS';

export interface ReviewExecutionContext {
  readonly session: ReviewSession;
  readonly model: ProjectModel;
  readonly workspaceState?: WorkspaceState;
}

export interface ReviewPipelineResult {
  readonly session: ReviewSession;
  readonly analysis: ReviewAnalysis;
  readonly plan: ReviewPlan;
  readonly scope: ReviewScope;
  readonly regenerationPlan: RegenerationPlan;
  readonly readiness: ReadinessDecision;
  readonly stagesExecuted: readonly ReviewPipelineStageName[];
  readonly digest: string;
}

/** A plain, declarative description of the stage sequence — not itself executable. Exists so
 *  `ReviewPipelineResult.stagesExecuted` is genuinely SOURCED from a real value, not hardcoded, and
 *  so "no stage skipped" (VALIDATION) is checkable against a concrete, inspectable list. */
export interface ReviewPipeline {
  readonly stages: readonly ReviewPipelineStageName[];
}

export function createReviewPipeline(): ReviewPipeline {
  return { stages: Object.freeze(['ANALYSIS', 'PLANNING', 'SCOPE', 'REGENERATION_PLANNING', 'READINESS']) };
}

/** Injectable seam swapping WHICH function runs each stage (testability, matching every sibling
 *  module's default-parameter pattern) — never a business-rule policy. Defaults to the real R2–R6
 *  entry points. */
export interface ReviewOrchestratorFns {
  readonly analyze: typeof analyzeReviewSession;
  readonly plan: typeof planReviewSession;
  readonly resolveScope: typeof resolveReviewScope;
  readonly planRegeneration: typeof resolveRegenerationPlan;
  readonly evaluateReadiness: typeof evaluateRegenerationReadiness;
}

const DEFAULT_STAGE_FNS: ReviewOrchestratorFns = {
  analyze: analyzeReviewSession,
  plan: planReviewSession,
  resolveScope: resolveReviewScope,
  planRegeneration: resolveRegenerationPlan,
  evaluateReadiness: evaluateRegenerationReadiness,
};

export interface ReviewOrchestrator {
  run(context: ReviewExecutionContext): ReviewPipelineResult;
}

export function createReviewOrchestrator(
  pipeline: ReviewPipeline = createReviewPipeline(),
  fns: ReviewOrchestratorFns = DEFAULT_STAGE_FNS,
): ReviewOrchestrator {
  return {
    run(context) {
      // Each call site below is the ENTIRE cross-stage wiring — every argument is either the
      // context's own input or the immediately-preceding stage's own output, exactly once, in
      // order. No stage's own cross-reference validation (R3's session/analysis check, R4's
      // plan/model check) is re-implemented — a mismatch throws from inside that stage, unchanged.
      const analysis = fns.analyze(context.session);
      const plan = fns.plan(context.session, analysis);
      const scope = fns.resolveScope(plan, context.model);
      const regenerationPlan = fns.planRegeneration(scope, context.model);
      const readiness = fns.evaluateReadiness(regenerationPlan, context.workspaceState);

      const core = {
        session: context.session,
        analysis,
        plan,
        scope,
        regenerationPlan,
        readiness,
        stagesExecuted: Object.freeze([...pipeline.stages]),
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R2–R6's own `analyze`/`plan`/`resolve`/`evaluate`
 *  convenience idiom. */
export function orchestrateReview(
  context: ReviewExecutionContext,
  orchestrator: ReviewOrchestrator = createReviewOrchestrator(),
): ReviewPipelineResult {
  return orchestrator.run(context);
}
