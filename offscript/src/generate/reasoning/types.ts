/**
 * Sprint W3 — Reasoning Producer Seam: the producer boundary's types.
 *
 * Today the planner produces a `PlanItem`. Tomorrow's planner will produce a `PlanItem` PLUS a
 * `SectionReasoning` (the WHY — see ../section-reasoning.ts + SectionReasoning in ../types.ts).
 * This module declares ONLY the boundary across which that reasoning will one day be produced:
 *
 *   ReasoningProducer.produce(ReasoningContext) → ReasoningResult
 *
 * It is the abstract seam — a deterministic scripted DOUBLE (inert by default) and an in-session
 * subagent seam implement it (scripted-producer.ts); the deterministic lifecycle wraps it
 * (producer.ts). Nothing here reasons, infers, or generates. Per WORLD-B-EVOLUTION-ARCHITECTURE.md
 * §7–§8: the producer is introduced behind the existing seam pattern, inert by default, so the
 * current path stays byte-identical until a real producer is deliberately wired in (W4).
 */
import type { PlanItem, SectionReasoning } from '../types.js';
import type { Track } from '../../paths.js';

/**
 * What a producer reasons from to produce ONE section's reasoning — minimal + immutable.
 * Carries the section itself plus the brief grounding a real producer would ground on; mirrors
 * the authoring seam's curated AuthoringRequest (item + oneLiner), not the whole DesignContext.
 * W3 uses only `item` (to identify the section); `track`/`oneLiner` are the grounding W4 will read.
 */
export interface ReasoningContext {
  /** The planned section this reasoning is for — its archetype, intent, anchor, etc. */
  readonly item: PlanItem;
  /** The deliverable track (website | collateral). */
  readonly track: Track;
  /** brief.oneLiner — the one-sentence product/deliverable description (brief grounding). */
  readonly oneLiner: string;
}

/**
 * A producer's output for one section: a reasoning channel, or nothing.
 * `reasoning` absent / undefined ⇒ the producer declined to reason about this section (the inert
 * default). A present value is validated + frozen by the lifecycle before it reaches the item.
 */
export interface ReasoningResult {
  readonly reasoning?: SectionReasoning;
}

/**
 * The reasoning producer seam — the boundary tomorrow's reasoned planner will implement.
 * Mirrors ModelDeriver (knowledge/derivation/deriver.ts) and Director/Critic: a named producer
 * with a single `produce` method that may be sync (the scripted double) or async (the subagent
 * seam). The lifecycle (produceReasoning) is the SOLE caller; it validates, invokes once,
 * validates, freezes, and returns. The producer NEVER persists, mutates the item, or reads
 * downstream output.
 */
export interface ReasoningProducer {
  readonly name: string;
  produce(context: ReasoningContext): ReasoningResult | Promise<ReasoningResult>;
}
