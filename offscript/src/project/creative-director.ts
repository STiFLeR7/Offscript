/**
 * P49 — Creative Director orchestration layer.
 *
 * The Creative Director inspects the selected project, discovers required capabilities, determines
 * what information is missing, selects the appropriate brief source, and produces the Canonical
 * Brief — via interactive interview (Source A) or the Content-Core adapter (Source B). It
 * ORCHESTRATES information gathering; it never generates a deliverable and never touches the
 * pipeline past the Canonical Brief. It avoids asking for anything already available.
 *
 * It mirrors Offscript's established seam shape (a default assembled from the source registry, plus an
 * in-session interviewer that fills the `answers` the plan asks for). The `plan → acquire` split
 * lets the in-session layer read the questions, collect answers, then acquire deterministically.
 */
import type { Track } from '../paths.js';
import { getProjectType, type ProjectType } from './project-registry.js';
import {
  registerBriefSource,
  selectBriefSource,
  listBriefSources,
  _resetBriefSources,
  type BriefSource,
  type BriefAcquisitionContext,
  type CanonicalBriefResult,
} from './brief-source.js';
import { manualBriefSource } from './brief-source-manual.js';
import { contentCoreBriefSource, type PacketAdapterRunner } from './brief-source-content-core.js';
import {
  creativeIntentBriefSource,
  type CreativeIntentAdapterRunner,
} from './brief-source-creative-intent.js';
import {
  discoverContext,
  registerDiscoveryProvider,
  _resetDiscoveryProviders,
  type DiscoveryProvider,
  type DiscoveryContext,
} from './discovery.js';
import { defaultDiscoveryProviders } from './discovery-providers.js';
import { answersToEvidence, FIELD_TO_ANSWER_KEY } from './evidence.js';
import { inferFacts, knownValues, DEFAULT_CONFIDENCE_THRESHOLD } from './inference.js';
import { analyzeGaps } from './gap-analysis.js';
import { assessStrategy } from './creative-strategy.js';
import { rulePlanningPolicy, type PlanningPolicy } from './planning-policy.js';
import type { AcquisitionPlan } from './acquisition-plan.js';

// The one plan contract is owned by acquisition-plan.ts (the strategic Acquisition Plan). Re-export
// for callers that imported it from here in P50.
export type { AcquisitionPlan } from './acquisition-plan.js';

/** What the caller gives the Creative Director to acquire a brief. */
export interface AcquireRequest {
  readonly client: string;
  readonly projectType: string;
  /** Deliverable track to target; defaults to the project type's first deliverable. */
  readonly track?: Track;
  readonly packetPath?: string;
  /** Creative Intent artifact path (Program CG / L1-L2) — see brief-source-creative-intent.ts. */
  readonly creativeIntentPath?: string;
  readonly answers?: Record<string, unknown>;
  readonly now?: string;
}

export interface CreativeDirector {
  /** Inspect + discover + decide which source and which questions — no production. */
  plan(req: AcquireRequest): AcquisitionPlan;
  /** Produce the Canonical Brief through the selected source (no file write). */
  acquire(req: AcquireRequest): Promise<CanonicalBriefResult>;
}

/**
 * The default source set: Manual interview is the bundled input channel. Explicitly injected external converters may
 * supply additional sources; removed adapter packages are never invoked implicitly.
 */
export function defaultBriefSources(
  opts: { runner?: PacketAdapterRunner; ciRunner?: CreativeIntentAdapterRunner } = {},
): BriefSource[] {
  return [
    ...(opts.runner ? [contentCoreBriefSource({ runner: opts.runner })] : []),
    ...(opts.ciRunner ? [creativeIntentBriefSource({ runner: opts.ciRunner })] : []),
    manualBriefSource(),
  ];
}

/**
 * Build a Creative Director over a source set + a discovery provider set. Both are installed into
 * their shared registries so selection/extensibility go through one path. Sources default to
 * Content-Core + manual; providers default to the shipped context-discovery set.
 *
 * The Creative Director is now EVIDENCE-DRIVEN: it discovers context, infers candidate facts, does
 * gap analysis, and only the unresolved required fields become the (dynamic) interview. It never
 * asks for information that evidence already answered. The Canonical Brief contract is untouched —
 * discovered facts and interview answers converge through the SAME normalizer, so equivalent
 * information yields a byte-identical brief.
 */
export function createCreativeDirector(
  opts: {
    sources?: BriefSource[];
    runner?: PacketAdapterRunner;
    ciRunner?: CreativeIntentAdapterRunner;
    providers?: DiscoveryProvider[];
    confidenceThreshold?: number;
    /** The strategic planner (rule-based default; a future AI planner drops in here). */
    policy?: PlanningPolicy;
  } = {},
): CreativeDirector {
  const sources = opts.sources ?? defaultBriefSources({ runner: opts.runner, ciRunner: opts.ciRunner });
  const providers = opts.providers ?? defaultDiscoveryProviders();
  const threshold = opts.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const policy = opts.policy ?? rulePlanningPolicy({ threshold });

  // Install into the registries (idempotently) so selection/extensibility go through one path each.
  _resetBriefSources();
  for (const s of sources) registerBriefSource(s);
  _resetDiscoveryProviders();
  for (const p of providers) registerDiscoveryProvider(p);

  function resolveTrack(type: ProjectType, req: AcquireRequest): Track {
    if (req.track) {
      if (!type.deliverables.includes(req.track)) {
        throw new Error(`project type "${type.id}" does not deliver track "${req.track}" (has: ${type.deliverables.join(', ')}).`);
      }
      return req.track;
    }
    return type.deliverables[0];
  }

  function contextFor(req: AcquireRequest): {
    type: ProjectType;
    ctx: BriefAcquisitionContext;
    dctx: DiscoveryContext;
  } {
    const type = getProjectType(req.projectType);
    const track = resolveTrack(type, req);
    const now = req.now ?? new Date().toISOString();
    return {
      type,
      ctx: {
        client: req.client,
        projectType: type,
        track,
        packetPath: req.packetPath,
        creativeIntentPath: req.creativeIntentPath,
        answers: req.answers,
        now: req.now,
      },
      dctx: { client: req.client, projectType: type, track, packetPath: req.packetPath, now },
    };
  }

  /** Discovered context (providers only) → known facts, keyed by canonical field → value. */
  function resolvedFromContext(dctx: DiscoveryContext): Record<string, unknown> {
    return knownValues(inferFacts(discoverContext(dctx, providers), { threshold }), threshold);
  }

  return {
    plan(req: AcquireRequest): AcquisitionPlan {
      const { type, ctx, dctx } = contextFor(req);
      const source = selectBriefSource(ctx);

      // A Content-Core packet or a Creative Intent artifact supplies the whole brief ⇒ no interview at all.
      if (req.packetPath || req.creativeIntentPath) {
        const gap = analyzeGaps(type.requiredArtifacts, [], { threshold });
        const strategy = assessStrategy({ projectType: type, facts: [], gap, threshold });
        return {
          projectType: type.id,
          track: ctx.track,
          deliverables: [...type.deliverables],
          sourceId: source.id,
          strategy: { ...strategy, evidenceCompleteness: 1, unknownCriticalDecisions: [] },
          questionPlan: { questions: [] },
          questions: [],
          ready: true,
          alreadyKnown: [...type.requiredArtifacts],
          critical: [],
          inferable: [],
          neverInfer: [],
          mustConfirm: [],
          evidence: [],
          facts: [],
        };
      }

      // Discovery → evidence → inference → gap analysis → CREATIVE STRATEGY → ACQUISITION PLAN.
      const evidence = [...discoverContext(dctx, providers), ...answersToEvidence(req.answers, dctx.now)];
      const facts = inferFacts(evidence, { threshold });
      const gap = analyzeGaps(type.requiredArtifacts, facts, { threshold });
      const acquisitionPlan = policy.plan({
        projectType: type,
        track: ctx.track,
        deliverables: [...type.deliverables],
        sourceId: source.id,
        facts,
        gap,
        evidence,
        threshold,
      });
      // Attach the discovery observability onto the plan (not part of the serialized replay artifact).
      return { ...acquisitionPlan, evidence, facts, gap };
    },
    async acquire(req: AcquireRequest): Promise<CanonicalBriefResult> {
      const { ctx, dctx } = contextFor(req);

      // Content-Core path is unchanged — the packet source produces directly.
      if (req.packetPath) return selectBriefSource(ctx).produce(ctx);

      // Evidence-driven backfill: discovered known facts fill fields the interview did not; explicit
      // answers always override. Both converge through the SAME normalizer ⇒ equivalent info yields
      // a byte-identical brief (no discovery ⇒ merged === answers ⇒ identical to the pre-P50 path).
      const backfill: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(resolvedFromContext(dctx))) {
        backfill[FIELD_TO_ANSWER_KEY[field] ?? field] = value;
      }
      const merged = { ...backfill, ...(req.answers ?? {}) };
      const ctx2: BriefAcquisitionContext = { ...ctx, answers: merged };
      return selectBriefSource(ctx2).produce(ctx2);
    },
  };
}

export { listBriefSources };
