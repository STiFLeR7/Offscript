/**
 * P49 — Manual (interactive interview) brief source.
 *
 * Workflow A: Interactive Interview → Brief Normalization → Canonical Brief. The Creative Director
 * decides WHICH questions to ask (the missing required artifacts); the in-session interviewer
 * collects the answers. This source is the deterministic tail: given the gathered answers, it
 * normalizes them into the Canonical Brief through the shared normalizer — the same one the
 * Content-Core source uses, so equivalent information yields a byte-identical brief.
 */
import type { BriefSource, BriefAcquisitionContext, CanonicalBriefResult } from './brief-source.js';
import { answersToNormalized } from './brief-source.js';
import { normalizeBrief } from './brief-normalizer.js';

export const MANUAL_SOURCE_ID = 'manual';

/** The manual interview source. Detects as the fallback when no Content-Core packet is supplied. */
export function manualBriefSource(): BriefSource {
  return {
    id: MANUAL_SOURCE_ID,
    label: 'Interactive interview',
    // Fallback source: handles anything that is not a packet run or a Creative Intent run.
    detect: (ctx: BriefAcquisitionContext) => !ctx.packetPath && !ctx.creativeIntentPath,
    async produce(ctx: BriefAcquisitionContext): Promise<CanonicalBriefResult> {
      const input = answersToNormalized(ctx.track, ctx.answers ?? {});
      return { client: ctx.client, sourceId: MANUAL_SOURCE_ID, briefText: normalizeBrief(input) };
    },
  };
}
