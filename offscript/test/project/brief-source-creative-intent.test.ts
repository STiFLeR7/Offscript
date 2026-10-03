/**
 * L2 — Creative Intent brief source. Mirrors brief-acquisition.test.ts's
 * CONTENT-CORE flow tests exactly, but for the new creative-intent source.
 * Exercised through an INJECTED fake adapter runner — no real subprocess.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createCreativeDirector,
  type AcquireRequest,
} from '../../src/project/creative-director.js';
import {
  creativeIntentBriefSource,
  CREATIVE_INTENT_SOURCE_ID,
  type CreativeIntentAdapterRunner,
} from '../../src/project/brief-source-creative-intent.js';
import { manualBriefSource } from '../../src/project/brief-source-manual.js';
import {
  registerBriefSource,
  selectBriefSource,
  _resetBriefSources,
  type BriefAcquisitionContext,
} from '../../src/project/brief-source.js';
import { parseBrief } from '../../src/generate/brief.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';

afterEach(() => _resetBriefSources());

// A fake Creative Intent adapter: stands in for creative-intent-brief-adapter's
// real subprocess so the test is hermetic, exactly like brief-acquisition.test.ts's fakeRunner.
function fakeRunner(): CreativeIntentAdapterRunner {
  return {
    async run() {
      const briefMd = normalizeBrief({
        track: 'website',
        oneLiner: 'nothing falls through the cracks because every task always has a clear, visible owner',
        provenance: {
          sourceCreativeId: 'owned-task-handoff',
          sourceDigest: 'sha256:198a726db00df79dcf5589e6d10371777d091913363d17e7cfeb5de29ee6f8e4',
          sourceContractVersion: '1',
          contentProvenance: 'augmented',
        },
      });
      return { briefMd };
    },
  };
}

const baseCtx: Omit<BriefAcquisitionContext, 'creativeIntentPath' | 'packetPath' | 'answers'> = {
  client: 'acme',
  projectType: {
    id: 'website',
    label: '',
    description: '',
    deliverables: ['website'],
    requiredArtifacts: [],
    optionalArtifacts: [],
    briefSources: [],
  },
  track: 'website',
};

describe('L2 creative-intent brief source', () => {
  it('detect() fires only when creativeIntentPath is present', () => {
    const source = creativeIntentBriefSource({ runner: fakeRunner() });
    expect(source.id).toBe(CREATIVE_INTENT_SOURCE_ID);
    expect(source.detect({ ...baseCtx, creativeIntentPath: '/x/owned-task-handoff.creative-intent.json' })).toBe(true);
    expect(source.detect({ ...baseCtx })).toBe(false);
  });

  it('produces a Canonical Brief via the injected runner, re-normalized through the SAME normalizer', async () => {
    const source = creativeIntentBriefSource({ runner: fakeRunner() });
    const result = await source.produce({
      ...baseCtx,
      creativeIntentPath: '/x/owned-task-handoff.creative-intent.json',
      now: '2026-01-01T00:00:00Z',
    });
    expect(result.sourceId).toBe(CREATIVE_INTENT_SOURCE_ID);
    const b = parseBrief(result.briefText);
    expect(b.oneLiner).toBe(
      'nothing falls through the cracks because every task always has a clear, visible owner'
    );
    expect(b.provenance?.sourceCreativeId).toBe('owned-task-handoff');
  });

  it('manual source no longer claims a context that carries creativeIntentPath', () => {
    const manual = manualBriefSource();
    expect(manual.detect({ ...baseCtx, creativeIntentPath: '/x/foo.creative-intent.json' })).toBe(false);
    expect(manual.detect({ ...baseCtx })).toBe(true); // still the fallback otherwise
  });

  it('registry selection: a creativeIntentPath context resolves to the creative-intent source, never manual', () => {
    _resetBriefSources();
    registerBriefSource(creativeIntentBriefSource({ runner: fakeRunner() }));
    registerBriefSource(manualBriefSource());
    const chosen = selectBriefSource({ ...baseCtx, creativeIntentPath: '/x/foo.creative-intent.json' });
    expect(chosen.id).toBe(CREATIVE_INTENT_SOURCE_ID);
  });

  it('CREATIVE DIRECTOR flow: plan() with creativeIntentPath is ready with no interview questions', () => {
    const cd = createCreativeDirector({ ciRunner: fakeRunner() });
    const req: AcquireRequest = {
      client: 'acme',
      projectType: 'website',
      track: 'website',
      creativeIntentPath: '/x/owned-task-handoff.creative-intent.json',
      now: '2026-01-01T00:00:00Z',
    };
    const plan = cd.plan(req);
    expect(plan.sourceId).toBe(CREATIVE_INTENT_SOURCE_ID);
    expect(plan.questions).toEqual([]);
    expect(plan.ready).toBe(true);
  });

  it('CREATIVE DIRECTOR flow: acquire() with creativeIntentPath produces a Brief through the full orchestration', async () => {
    const cd = createCreativeDirector({ ciRunner: fakeRunner() });
    const req: AcquireRequest = {
      client: 'acme',
      projectType: 'website',
      track: 'website',
      creativeIntentPath: '/x/owned-task-handoff.creative-intent.json',
      now: '2026-01-01T00:00:00Z',
    };
    const result = await cd.acquire(req);
    expect(result.sourceId).toBe(CREATIVE_INTENT_SOURCE_ID);
    expect(parseBrief(result.briefText).oneLiner).toBe(
      'nothing falls through the cracks because every task always has a clear, visible owner'
    );
  });

  it('CONVERGENCE: creative-intent and manual flows emit through the SAME normalizer for equivalent info', async () => {
    const ci = await creativeIntentBriefSource({ runner: fakeRunner() }).produce({
      ...baseCtx,
      creativeIntentPath: '/x/owned-task-handoff.creative-intent.json',
      now: '2026-01-01T00:00:00Z',
    });
    const manual = await manualBriefSource().produce({
      ...baseCtx,
      answers: {
        oneLiner: 'nothing falls through the cracks because every task always has a clear, visible owner',
        provenance: {
          sourceCreativeId: 'owned-task-handoff',
          sourceDigest: 'sha256:198a726db00df79dcf5589e6d10371777d091913363d17e7cfeb5de29ee6f8e4',
          sourceContractVersion: '1',
          contentProvenance: 'augmented',
        },
      },
    });
    expect(ci.briefText).toBe(manual.briefText);
  });
});
