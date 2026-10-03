/**
 * P51 — Planning Policy: the seam that turns strategy + gaps into an explicit Acquisition Plan.
 *
 * This is the swap point for planning intelligence. `rulePlanningPolicy` ships a deterministic
 * rule-based planner; a future AI planner implements the SAME `PlanningPolicy` interface and drops
 * in without touching the Creative Director (see P51 report §8). Multiple policies coexist by
 * injection — `createCreativeDirector({ policy })`.
 *
 * The rule policy: required gaps → questions; high-risk → confirmations for known/critical fields
 * (never silently inferred); complex projects → optional enrichment questions. Everything is anchored
 * to the canonical field priority/dependency tables so the interview is ordered and dependency-gated.
 */
import type { Track } from '../paths.js';
import type { ProjectType } from './project-registry.js';
import type { Evidence } from './evidence.js';
import { type InferredFact } from './inference.js';
import type { GapReport } from './gap-analysis.js';
import { assessStrategy } from './creative-strategy.js';
import {
  fieldPriority,
  fieldDependencies,
  questionPrompt,
  orderQuestions,
  type AcquisitionPlan,
  type PlannedQuestion,
  type QuestionReason,
} from './acquisition-plan.js';

export interface PlanningInput {
  readonly projectType: ProjectType;
  readonly track: Track;
  readonly deliverables: Track[];
  readonly sourceId: string;
  readonly facts: readonly InferredFact[];
  readonly gap: GapReport;
  readonly evidence?: readonly Evidence[];
  readonly threshold?: number;
}

export interface PlanningPolicy {
  readonly id: string;
  plan(input: PlanningInput): AcquisitionPlan;
}

const NEVER_INFER_WHEN_HIGH_RISK = ['one-liner', 'brand'];

export function rulePlanningPolicy(opts: { threshold?: number } = {}): PlanningPolicy {
  return {
    id: 'rule-based',
    plan(input: PlanningInput): AcquisitionPlan {
      const { projectType, gap, facts } = input;
      const strategy = assessStrategy({ projectType, facts, gap, threshold: opts.threshold });
      const required = projectType.requiredArtifacts;
      const optional = projectType.optionalArtifacts;

      const knownFields = new Set(gap.known);
      // A field is "known" for planning if it is a non-conflicting, confident fact — reuse the gap's
      // buckets for required fields, and the facts for optional fields.
      for (const f of facts) {
        if (!f.conflicting && f.confidence >= (opts.threshold ?? 0.7)) knownFields.add(f.field);
      }

      const highRisk = strategy.riskLevel === 'high';
      const neverInfer = highRisk ? NEVER_INFER_WHEN_HIGH_RISK.filter((f) => required.includes(f) || knownFields.has(f)) : [];

      const unknownSet = new Set(gap.unknown);
      const conflictingSet = new Set(gap.conflicting);
      const lowConfSet = new Set(gap.lowConfidence);

      // ── Required tier ───────────────────────────────────────────────────────
      const raw: Array<{ field: string; reason: QuestionReason; optional: boolean; critical: boolean }> = [];
      for (const field of required) {
        if (unknownSet.has(field)) raw.push({ field, reason: 'unknown', optional: false, critical: true });
        else if (conflictingSet.has(field)) raw.push({ field, reason: 'conflicting', optional: false, critical: true });
        else if (lowConfSet.has(field)) raw.push({ field, reason: 'low-confidence', optional: false, critical: true });
        else if (highRisk || neverInfer.includes(field)) raw.push({ field, reason: 'confirm', optional: false, critical: true });
        // else: known + low-risk ⇒ no question.
      }

      // ── Optional tier (only complex projects enrich with optional questions) ──
      if (strategy.projectComplexity === 'complex') {
        for (const field of optional) {
          if (!knownFields.has(field)) raw.push({ field, reason: 'unknown', optional: true, critical: false });
        }
      }

      // Dependencies: keep only deps on a field that is known or itself planned (never deadlock).
      const plannedFields = new Set(raw.map((r) => r.field));
      const questions: PlannedQuestion[] = raw.map((r) => ({
        field: r.field,
        prompt: questionPrompt(r.field, r.reason),
        priority: fieldPriority(r.field),
        optional: r.optional,
        dependsOn: fieldDependencies(r.field).filter((d) => knownFields.has(d) || plannedFields.has(d)),
        reason: r.reason,
        critical: r.critical,
      }));
      const ordered = orderQuestions(questions);

      const requiredQuestions = ordered.filter((q) => !q.optional);
      const byPriority = (a: string, b: string) => fieldPriority(a) - fieldPriority(b);

      const inferable = facts
        .filter((f) => !f.conflicting && f.confidence >= (opts.threshold ?? 0.7) && !f.authoritative && !neverInfer.includes(f.field))
        .map((f) => f.field)
        .sort(byPriority);
      const mustConfirm = [
        ...new Set([...ordered.filter((q) => q.reason === 'confirm').map((q) => q.field), ...neverInfer.filter((f) => knownFields.has(f))]),
      ].sort(byPriority);

      return {
        projectType: projectType.id,
        track: input.track,
        deliverables: [...input.deliverables],
        sourceId: input.sourceId,
        strategy,
        questionPlan: { questions: ordered },
        questions: requiredQuestions.map((q) => q.field),
        ready: requiredQuestions.length === 0,
        alreadyKnown: [...knownFields].sort(byPriority),
        critical: requiredQuestions.map((q) => q.field),
        inferable,
        neverInfer: [...neverInfer].sort(byPriority),
        mustConfirm,
      };
    },
  };
}
