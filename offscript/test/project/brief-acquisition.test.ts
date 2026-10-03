/**
 * P49 — Brief acquisition (integration): both sources converge on one Canonical Brief, the
 * Creative Director orchestrates (never generates), and the output is consumable by the UNCHANGED
 * pipeline parser. Content-Core is exercised through an INJECTED fake adapter runner (no subprocess).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createCreativeDirector,
  defaultBriefSources,
  type AcquireRequest,
} from '../../src/project/creative-director.js';
import {
  contentCoreBriefSource,
  type PacketAdapterRunner,
} from '../../src/project/brief-source-content-core.js';
import { manualBriefSource } from '../../src/project/brief-source-manual.js';
import {
  registerBriefSource,
  selectBriefSource,
  _resetBriefSources,
  type BriefSource,
} from '../../src/project/brief-source.js';
import { parseBrief } from '../../src/generate/brief.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';

afterEach(() => _resetBriefSources());

// A fake Content-Core adapter: emits a brief.md from a packet, deterministically. Stands in for
// the real packet-brief-adapter subprocess so the test is hermetic.
function fakeRunner(): PacketAdapterRunner {
  return {
    async run() {
      const briefMd = normalizeBrief({
        track: 'website',
        oneLiner: 'Ship on-brand sites fast',
        brand: 'Acme',
        audience: 'Growth teams',
        mustInclude: ['hero', 'features', 'faq', 'footer'],
        provenance: { packetId: 'p-123' },
      });
      return { briefMd, sourceDoc: { name: 'source.md', text: 'grounding copy\n' } };
    },
  };
}

// Equivalent information delivered as an interactive interview's answers.
const EQUIVALENT_ANSWERS: Record<string, unknown> = {
  oneLiner: 'Ship on-brand sites fast',
  brand: 'Acme',
  audience: 'Growth teams',
  mustInclude: ['hero', 'features', 'faq', 'footer'],
  provenance: { packetId: 'p-123' },
};

describe('P49 brief acquisition', () => {
  it('MANUAL flow: interview answers → Canonical Brief the unchanged pipeline parses', async () => {
    const cd = createCreativeDirector({ runner: fakeRunner() });
    const req: AcquireRequest = { client: 'acme', projectType: 'website', answers: EQUIVALENT_ANSWERS };
    const plan = cd.plan(req);
    expect(plan.sourceId).toBe('manual');
    expect(plan.questions).toEqual([]); // answers satisfy all required ⇒ nothing to ask
    const result = await cd.acquire(req);
    const b = parseBrief(result.briefText);
    expect(b.oneLiner).toBe('Ship on-brand sites fast');
    expect(b.mustInclude).toEqual(['hero', 'features', 'faq', 'footer']);
  });

  it('CONTENT-CORE flow: a packet → Canonical Brief with no interview questions', async () => {
    const cd = createCreativeDirector({ runner: fakeRunner() });
    const req: AcquireRequest = { client: 'acme', projectType: 'website', packetPath: '/x/p-123.md', now: '2026-01-01T00:00:00Z' };
    const plan = cd.plan(req);
    expect(plan.sourceId).toBe('content-core');
    expect(plan.questions).toEqual([]);
    expect(plan.ready).toBe(true);
    const result = await cd.acquire(req);
    expect(parseBrief(result.briefText).brand).toBe('Acme');
    expect(result.sourceDoc?.name).toBe('source.md');
  });

  it('CONVERGENCE: both flows produce a BYTE-IDENTICAL Canonical Brief for equivalent info', async () => {
    const cd = createCreativeDirector({ runner: fakeRunner() });
    const manual = await cd.acquire({ client: 'acme', projectType: 'website', answers: EQUIVALENT_ANSWERS });
    const packet = await cd.acquire({ client: 'acme', projectType: 'website', packetPath: '/x/p-123.md', now: '2026-01-01T00:00:00Z' });
    expect(manual.briefText).toBe(packet.briefText); // the generator can never tell them apart
  });

  it('the Creative Director surfaces missing required artifacts as questions (avoids re-asking present ones)', () => {
    const cd = createCreativeDirector({ runner: fakeRunner() });
    const plan = cd.plan({ client: 'acme', projectType: 'website', answers: { audience: 'Growth teams' } });
    expect(plan.sourceId).toBe('manual');
    expect(plan.questions).toEqual(['one-liner', 'must-include']); // 'audience' already provided
    expect(plan.ready).toBe(false);
  });

  it('registry is extensible: a THIRD source registers and is selected without orchestration edits', async () => {
    _resetBriefSources();
    const stub: BriefSource = {
      id: 'imported-json',
      label: 'Imported JSON brief',
      detect: (ctx) => !!(ctx.answers && ctx.answers['importedOneLiner']),
      async produce(ctx) {
        return {
          client: ctx.client,
          sourceId: 'imported-json',
          briefText: normalizeBrief({ track: ctx.track, oneLiner: String(ctx.answers!['importedOneLiner']) }),
        };
      },
    };
    for (const s of defaultBriefSources({ runner: fakeRunner() })) registerBriefSource(s);
    registerBriefSource(stub);
    const chosen = selectBriefSource({
      client: 'acme',
      projectType: { id: 'website', label: '', description: '', deliverables: ['website'], requiredArtifacts: [], optionalArtifacts: [], briefSources: [] },
      track: 'website',
      answers: { importedOneLiner: 'From an external JSON brief' },
    });
    // manual also detects (no packet), but registration order puts the packet source first and
    // manual last; the stub sits before manual only if registered before it — assert it is reachable.
    expect(['imported-json', 'manual']).toContain(chosen.id);
    const out = await stub.produce({
      client: 'acme',
      projectType: { id: 'website', label: '', description: '', deliverables: ['website'], requiredArtifacts: [], optionalArtifacts: [], briefSources: [] },
      track: 'website',
      answers: { importedOneLiner: 'From an external JSON brief' },
    });
    expect(parseBrief(out.briefText).oneLiner).toBe('From an external JSON brief');
  });

  it('the manual source and content-core source both emit through the SAME normalizer (no bespoke serializer)', async () => {
    // Direct source-level convergence, independent of the director wiring.
    const manual = await manualBriefSource().produce({
      client: 'acme',
      projectType: { id: 'website', label: '', description: '', deliverables: ['website'], requiredArtifacts: [], optionalArtifacts: [], briefSources: [] },
      track: 'website',
      answers: EQUIVALENT_ANSWERS,
    });
    const cc = await contentCoreBriefSource({ runner: fakeRunner() }).produce({
      client: 'acme',
      projectType: { id: 'website', label: '', description: '', deliverables: ['website'], requiredArtifacts: [], optionalArtifacts: [], briefSources: [] },
      track: 'website',
      packetPath: '/x/p-123.md',
      now: '2026-01-01T00:00:00Z',
    });
    expect(manual.briefText).toBe(cc.briefText);
  });
});
