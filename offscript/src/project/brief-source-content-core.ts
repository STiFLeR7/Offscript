/** Optional externally injected brief conversion; no adapter package is bundled. */
import { parseBrief } from '../generate/brief.js';
import { normalizeBrief } from './brief-normalizer.js';
import {
  briefToNormalized,
  type BriefSource,
  type BriefAcquisitionContext,
  type CanonicalBriefResult,
} from './brief-source.js';

export const CONTENT_CORE_SOURCE_ID = 'content-core';

/** The injectable adapter seam. Returns the adapter's raw brief.md + optional grounding doc. */
export interface PacketAdapterRunner {
  run(opts: { packetPath: string; client: string; now: string }): Promise<{
    briefMd: string;
    sourceDoc?: { name: string; text: string };
  }>;
}

/** The Content-Core source. `detect` fires when a packet path is present. */
export function contentCoreBriefSource(opts: { runner?: PacketAdapterRunner } = {}): BriefSource {
  const runner = opts.runner ?? unconfiguredExternalRunner();
  return {
    id: CONTENT_CORE_SOURCE_ID,
    label: 'Content-Core adapter',
    detect: (ctx: BriefAcquisitionContext) => !!ctx.packetPath,
    async produce(ctx: BriefAcquisitionContext): Promise<CanonicalBriefResult> {
      if (!ctx.packetPath) throw new Error('content-core source: ctx.packetPath is required.');
      const now = ctx.now ?? new Date().toISOString();
      const out = await runner.run({ packetPath: ctx.packetPath, client: ctx.client, now });
      // Re-normalize the adapter's brief through offscript's own contract → convergence guarantee.
      const parsed = parseBrief(out.briefMd);
      const briefText = normalizeBrief(briefToNormalized(parsed));
      return { client: ctx.client, sourceId: CONTENT_CORE_SOURCE_ID, briefText, sourceDoc: out.sourceDoc };
    },
  };
}

/** An unconfigured external converter fails explicitly, without invoking a removed package. */
export function unconfiguredExternalRunner(): PacketAdapterRunner {
  return {
    async run() {
      throw new Error('External brief conversion is not bundled. Supply normalized interview answers or an explicitly injected converter.');
    },
  };
}
