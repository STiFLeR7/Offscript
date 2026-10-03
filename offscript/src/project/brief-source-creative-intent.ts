/** Optional externally injected brief conversion; no adapter package is bundled. */
import { parseBrief } from '../generate/brief.js';
import { normalizeBrief } from './brief-normalizer.js';
import {
  briefToNormalized,
  type BriefSource,
  type BriefAcquisitionContext,
  type CanonicalBriefResult,
} from './brief-source.js';

export const CREATIVE_INTENT_SOURCE_ID = 'creative-intent';

/** The injectable adapter seam. Returns the adapter's raw brief.md. */
export interface CreativeIntentAdapterRunner {
  run(opts: { creativeIntentPath: string; client: string; track: string; now: string }): Promise<{
    briefMd: string;
  }>;
}

/** The Creative Intent source. `detect` fires when a Creative Intent path is present. */
export function creativeIntentBriefSource(opts: { runner?: CreativeIntentAdapterRunner } = {}): BriefSource {
  const runner = opts.runner ?? unconfiguredExternalRunner();
  return {
    id: CREATIVE_INTENT_SOURCE_ID,
    label: 'Creative Intent adapter',
    detect: (ctx: BriefAcquisitionContext) => !!ctx.creativeIntentPath,
    async produce(ctx: BriefAcquisitionContext): Promise<CanonicalBriefResult> {
      if (!ctx.creativeIntentPath) {
        throw new Error('creative-intent source: ctx.creativeIntentPath is required.');
      }
      const now = ctx.now ?? new Date().toISOString();
      const out = await runner.run({
        creativeIntentPath: ctx.creativeIntentPath,
        client: ctx.client,
        track: ctx.track,
        now,
      });
      // Re-normalize the adapter's brief through offscript's own contract → convergence guarantee.
      const parsed = parseBrief(out.briefMd);
      const briefText = normalizeBrief(briefToNormalized(parsed));
      return { client: ctx.client, sourceId: CREATIVE_INTENT_SOURCE_ID, briefText };
    },
  };
}

/** An unconfigured external converter fails explicitly, without invoking a removed package. */
export function unconfiguredExternalRunner(): CreativeIntentAdapterRunner {
  return {
    async run() {
      throw new Error('External brief conversion is not bundled. Supply normalized interview answers or an explicitly injected converter.');
    },
  };
}
