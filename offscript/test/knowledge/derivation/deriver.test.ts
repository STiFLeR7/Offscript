/**
 * Sprint X — deriveModels orchestrator + injected ModelDeriver seam.
 *
 * The layer validates inputs, invokes the injected deriver (the sole reasoning point), then
 * deterministically assembles + validates + freezes the seven Models. The deriver is abstract;
 * tests supply doubles. The layer NEVER calls a provider.
 */
import { describe, it, expect } from 'vitest';
import {
  MODEL_KINDS,
  MODEL_SCHEMA,
  briefIdentity,
  DerivationError,
  type ModelKind,
  type ModelDraft,
  type RawBrief,
} from '../../../src/knowledge/derivation/models.js';
import {
  deriveModels,
  type ModelDeriver,
  type DerivationRequest,
  type DerivationRepository,
} from '../../../src/knowledge/derivation/deriver.js';

const SHA = /^sha256:[0-9a-f]{64}$/;

const BRIEF: RawBrief = {
  brand: 'Example Brand',
  oneLiner: 'Autonomous digital workers remove the manual glue between systems.',
  audience: 'Operations and finance leaders',
  goals: ['Frame the hidden cost', 'Show integration', 'Prove outcomes'],
  mustInclude: ['Hidden tax', 'How a worker deploys', 'First-quarter outcomes'],
  tone: 'Precise, diagnostic, executive',
  successCriteria: ['A reader books a demo'],
  body: 'A one-pager on the cost of manual work and how autonomous workers remove it.',
};

const REPO: DerivationRepository = {
  repositoryIdentity: 'sha256:' + 'c'.repeat(64),
  assetCount: 96,
};

function draftFor(kind: ModelKind, mark = (k: string) => `content:${k}`): ModelDraft {
  const categories: Record<string, unknown> = {};
  for (const c of MODEL_SCHEMA[kind].categories) categories[c.key] = mark(c.key);
  return { kind, categories, rationale: `derived ${kind}` };
}

/** A complete, well-behaved test deriver (sync). */
const fullDeriver: ModelDeriver = {
  name: 'test::full',
  derive: (_req: DerivationRequest) => MODEL_KINDS.map((k) => draftFor(k)),
};

describe('deriveModels — the derivation lifecycle', () => {
  it('derives the seven Models through the injected deriver', async () => {
    const set = await deriveModels(BRIEF, REPO, fullDeriver);
    expect(Object.keys(set.models).sort()).toEqual([...MODEL_KINDS].sort());
    expect(set.derivationIdentity).toMatch(SHA);
    expect(set.metadata.deriver).toBe('test::full');
    expect(set.metadata.modelCount).toBe(7);
  });

  it('carries traceable inputs (brief identity + repository identity)', async () => {
    const set = await deriveModels(BRIEF, REPO, fullDeriver);
    expect(set.inputs.briefIdentity).toBe(briefIdentity(BRIEF));
    expect(set.inputs.repositoryIdentity).toBe(REPO.repositoryIdentity);
    expect(set.inputs.assetCount).toBe(96);
    // governance documents default to the seven constitutions
    expect(set.inputs.governanceDocuments).toContain('COMPONENT_SYSTEM.md');
    expect(new Set(set.inputs.governanceDocuments).size).toBe(7);
    for (const k of MODEL_KINDS) expect(set.models[k].evidence.repositoryIdentity).toBe(REPO.repositoryIdentity);
  });

  it('replays identically (same brief + repo + deriver ⇒ same identity)', async () => {
    const a = await deriveModels(BRIEF, REPO, fullDeriver);
    const b = await deriveModels(BRIEF, REPO, fullDeriver);
    expect(b.derivationIdentity).toBe(a.derivationIdentity);
    for (const k of MODEL_KINDS) expect(b.models[k].identity).toBe(a.models[k].identity);
  });

  it('supports an async deriver', async () => {
    const asyncDeriver: ModelDeriver = {
      name: 'test::async',
      derive: async () => MODEL_KINDS.map((k) => draftFor(k)),
    };
    const set = await deriveModels(BRIEF, REPO, asyncDeriver);
    expect(set.metadata.deriver).toBe('test::async');
  });

  it('rejects a deriver that omits an authored category (fail-loud)', async () => {
    const bad: ModelDeriver = {
      name: 'test::omit',
      derive: () =>
        MODEL_KINDS.map((k) => {
          const d = draftFor(k);
          if (k === 'spatial') delete (d.categories as Record<string, unknown>).density;
          return d;
        }),
    };
    await expect(deriveModels(BRIEF, REPO, bad)).rejects.toMatchObject({ code: 'MISSING_CATEGORY' });
  });

  it('rejects a deriver that invents a category (fail-loud)', async () => {
    const bad: ModelDeriver = {
      name: 'test::invent',
      derive: () =>
        MODEL_KINDS.map((k) => {
          const d = draftFor(k);
          if (k === 'visual') (d.categories as Record<string, unknown>).fakeAxis = 'x';
          return d;
        }),
    };
    await expect(deriveModels(BRIEF, REPO, bad)).rejects.toMatchObject({ code: 'UNKNOWN_CATEGORY' });
  });

  it('rejects a deriver that drops a whole Model (fail-loud)', async () => {
    const bad: ModelDeriver = {
      name: 'test::dropmodel',
      derive: () => MODEL_KINDS.filter((k) => k !== 'mechanism').map((k) => draftFor(k)),
    };
    await expect(deriveModels(BRIEF, REPO, bad)).rejects.toMatchObject({ code: 'MISSING_MODEL' });
  });

  it('rejects an invalid repository identity (fail-loud)', async () => {
    const badRepo = { repositoryIdentity: 'not-a-hash', assetCount: 1 };
    await expect(deriveModels(BRIEF, badRepo, fullDeriver)).rejects.toBeInstanceOf(DerivationError);
  });

  it('rejects an empty brief (fail-loud)', async () => {
    const empty = { ...BRIEF, brand: '', oneLiner: '' };
    await expect(deriveModels(empty, REPO, fullDeriver)).rejects.toMatchObject({ code: 'INVALID_BRIEF' });
  });
});
