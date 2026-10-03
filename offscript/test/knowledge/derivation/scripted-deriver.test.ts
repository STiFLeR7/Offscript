/**
 * Sprint X — the scripted ModelDeriver double + the unwired subagent seam.
 *
 * The scripted double exists ONLY for CI and verification: it produces deterministic, INERT
 * drafts that satisfy the constitutional schema and nothing more — no reasoning, no heuristics,
 * no interpretation, no brief-derived content. Real derivation belongs to the in-session subagent
 * seam, which is NOT wired by default.
 */
import { describe, it, expect } from 'vitest';
import { MODEL_KINDS, MODEL_SCHEMA, type RawBrief } from '../../../src/knowledge/derivation/models.js';
import { deriveModels, type DerivationRepository, type DerivationRequest } from '../../../src/knowledge/derivation/deriver.js';
import {
  defaultScriptedDeriver,
  createSubagentDeriver,
  scriptedDeriver,
} from '../../../src/knowledge/derivation/scripted-deriver.js';

const BRIEF: RawBrief = {
  brand: 'Example Brand',
  oneLiner: 'Autonomous digital workers remove the manual glue between systems.',
  audience: 'Operations leaders',
  goals: ['a'],
  mustInclude: ['b'],
  tone: 'precise',
  successCriteria: ['demo'],
  body: 'x',
};
const REPO: DerivationRepository = { repositoryIdentity: 'sha256:' + 'd'.repeat(64), assetCount: 96 };

describe('defaultScriptedDeriver — deterministic, inert double', () => {
  it('produces the seven conforming Models', async () => {
    const set = await deriveModels(BRIEF, REPO, defaultScriptedDeriver());
    expect(Object.keys(set.models).sort()).toEqual([...MODEL_KINDS].sort());
    for (const k of MODEL_KINDS) {
      expect(Object.keys(set.models[k].result).sort()).toEqual(
        MODEL_SCHEMA[k].categories.map((c) => c.key).sort(),
      );
    }
  });

  it('is INERT — every category content is null (no fabricated design intelligence)', async () => {
    const set = await deriveModels(BRIEF, REPO, defaultScriptedDeriver());
    for (const k of MODEL_KINDS) {
      for (const c of MODEL_SCHEMA[k].categories) {
        expect(set.models[k].result[c.key].content).toBeNull();
      }
    }
  });

  it('is deterministic and stable across runs', async () => {
    const a = await deriveModels(BRIEF, REPO, defaultScriptedDeriver());
    const b = await deriveModels(BRIEF, REPO, defaultScriptedDeriver());
    expect(b.derivationIdentity).toBe(a.derivationIdentity);
  });

  it('its content does NOT vary with the brief (no reasoning)', async () => {
    const set1 = await deriveModels(BRIEF, REPO, defaultScriptedDeriver());
    const set2 = await deriveModels({ ...BRIEF, oneLiner: 'totally different one-liner about pizza' }, REPO, defaultScriptedDeriver());
    // Per-category content is identical (null) regardless of brief — only inputs/identity differ.
    for (const k of MODEL_KINDS) {
      for (const c of MODEL_SCHEMA[k].categories) {
        expect(set1.models[k].result[c.key].content).toBe(set2.models[k].result[c.key].content);
      }
    }
  });

  it('names itself as a scripted double', () => {
    expect(defaultScriptedDeriver().name).toMatch(/scripted/);
  });
});

describe('createSubagentDeriver — the in-session seam (NOT wired by default)', () => {
  it('is distinct from the default scripted double', () => {
    expect(defaultScriptedDeriver().name).not.toBe(createSubagentDeriver({ dispatch: async () => [] }).name);
  });

  it('routes derivation through the injected dispatch', async () => {
    let seen: DerivationRequest | null = null;
    const deriver = createSubagentDeriver({
      dispatch: async (req) => {
        seen = req;
        return MODEL_KINDS.map((k) => ({
          kind: k,
          rationale: 'subagent',
          categories: Object.fromEntries(MODEL_SCHEMA[k].categories.map((c) => [c.key, `real:${c.key}`])),
        }));
      },
    });
    const set = await deriveModels(BRIEF, REPO, deriver);
    expect(seen).not.toBeNull();
    expect(seen!.brief.brand).toBe('Example Brand');
    expect(set.models.mechanism.result.requiredMechanisms.content).toBe('real:requiredMechanisms');
  });
});

describe('scriptedDeriver(fixture) — test helper', () => {
  it('returns the supplied drafts verbatim', async () => {
    const drafts = MODEL_KINDS.map((k) => ({
      kind: k,
      rationale: 'fixture',
      categories: Object.fromEntries(MODEL_SCHEMA[k].categories.map((c) => [c.key, 1])),
    }));
    const set = await deriveModels(BRIEF, REPO, scriptedDeriver(drafts));
    expect(set.models.progression.result.progressionUnits.content).toBe(1);
  });
});
