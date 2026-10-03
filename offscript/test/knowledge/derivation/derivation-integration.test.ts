/**
 * Sprint X — Governed Model Derivation against the REAL materialized repository + the Example Brand
 * APA brief. Proves the seven Models derive, conform to their constitutional schemas, replay, and
 * bind to the real repository identity WITHOUT mutating it — and that NO frozen engine consumes
 * the derivation layer (Phase A boundary: derived + verified, never routed downstream).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../../src/knowledge/source/index.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../../src/knowledge/graph.js';
import { discover } from '../../../src/knowledge/discovery.js';
import { compose, repositoryIdentity, type CompositionRepository } from '../../../src/knowledge/composition.js';
import { condition } from '../../../src/knowledge/conditioning.js';
import { canonicalText } from '../../../src/knowledge/digest.js';
import { deriveModels, type DerivationRepository } from '../../../src/knowledge/derivation/deriver.js';
import { defaultScriptedDeriver } from '../../../src/knowledge/derivation/scripted-deriver.js';
import { verifyDerivation } from '../../../src/knowledge/derivation/verify-derivation.js';
import { verifyArchitecture } from '../../../src/knowledge/verification.js';
import { MODEL_KINDS, MODEL_SCHEMA, type RawBrief } from '../../../src/knowledge/derivation/models.js';

const REAL_REPO = fileURLToPath(new URL('../../../repository', import.meta.url));

// A faithful, deterministic Example Brand APA Raw Brief (the concrete example for the proof).
const APA_BRIEF: RawBrief = {
  brand: 'Example Brand',
  oneLiner:
    'Autonomous digital workers remove the manual glue between the systems operations teams already run — without replacing the software.',
  audience: 'Operations and finance leaders at scaling mid-market companies',
  goals: [
    'Frame the hidden cost of manual operational work',
    'Show how an autonomous worker plugs into the existing stack',
    'Prove outcomes with measured first-quarter results',
  ],
  mustInclude: [
    'The four execution layers: Intelligence, Reasoning, Action, Safety',
    'How a digital worker deploys (~4 weeks)',
    'Outcomes: 80% of routine work automated, 30–50% faster, hundreds of hours recovered',
    'APA vs RPA comparison',
    'Integrations with the existing stack',
  ],
  tone: 'Precise, diagnostic, executive — confident without hype',
  successCriteria: ['A reader books a demo'],
  body:
    'Example Brand APA: autonomous process automation built on four layers — Intelligence (understands unstructured input), ' +
    'Reasoning (decides or asks), Action (executes across systems), and Safety (stays in human control). Deploys in ~4 weeks, ' +
    'outcome-based pricing, proven by a live sales-research agent and measured first-quarter results.',
  track: 'website',
};

const loaded = loadRepository(REAL_REPO);
const composeRepo: CompositionRepository = {
  assets: loaded.assets,
  dependencyGraph: buildDependencyGraph(loaded.assets),
  semanticGraph: buildSemanticGraph(loaded.assets),
};
const repoId = repositoryIdentity(composeRepo);
const repo: DerivationRepository = { repositoryIdentity: repoId, assetCount: loaded.assets.length };

function fingerprint(): string {
  return canonicalText(
    loaded.assets.map((a) => ({ id: a.identity.id, satisfies: a.capabilities.satisfies, specializes: a.semantics.specializes })),
  );
}

/** A single satisfiable obligation from the real repository (for a lawful discovery/compose). */
function firstObligation(): string[] {
  const satisfied = new Set<string>();
  for (const a of loaded.assets) for (const s of a.capabilities.satisfies) satisfied.add(s);
  const tok = [...loaded.vocabulary.obligations].filter((t) => satisfied.has(t)).sort()[0];
  if (!tok) throw new Error('no satisfiable obligation in the real repository');
  return [tok];
}

describe('Governed Model Derivation — real repository + Example Brand APA', () => {
  it('loads a non-empty real repository with a content-hash identity', () => {
    expect(loaded.assets.length).toBeGreaterThan(0);
    expect(repoId).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('derives the seven Models, each conforming to its constitutional schema', async () => {
    const set = await deriveModels(APA_BRIEF, repo, defaultScriptedDeriver());
    expect(Object.keys(set.models).sort()).toEqual([...MODEL_KINDS].sort());
    for (const k of MODEL_KINDS) {
      const authored = MODEL_SCHEMA[k].categories.map((c) => c.key).sort();
      expect(Object.keys(set.models[k].result).sort()).toEqual(authored);
      expect(set.models[k].evidence.repositoryIdentity).toBe(repoId);
      expect(set.models[k].evidence.briefIdentity).toBe(set.inputs.briefIdentity);
    }
  });

  it('replays identically against the real repository', async () => {
    const a = await deriveModels(APA_BRIEF, repo, defaultScriptedDeriver());
    const b = await deriveModels(APA_BRIEF, repo, defaultScriptedDeriver());
    expect(b.derivationIdentity).toBe(a.derivationIdentity);
  });

  it('does not mutate the repository', async () => {
    const before = fingerprint();
    await deriveModels(APA_BRIEF, repo, defaultScriptedDeriver());
    expect(fingerprint()).toBe(before);
  });

  it('passes the derivation Verification Harness', async () => {
    const r = await verifyDerivation(repo, APA_BRIEF, { deriver: defaultScriptedDeriver() });
    expect(r.ok).toBe(true);
    expect(r.modelsVerified).toBe(7);
    expect(r.repositoryIdentity).toBe(repoId);
  });

  it('the full harness verifies the pipeline AND attaches a passing derivation sub-report', async () => {
    const report = await verifyArchitecture(loaded, { deriver: defaultScriptedDeriver(), brief: APA_BRIEF });
    expect(report.ok).toBe(true); // the real pipeline still passes
    expect(report.derivation?.ok).toBe(true); // derivation verified alongside it
  });
});

describe('Phase boundary — only Conditioning (carrier) + Authoring (consumer) touch the derivation layer', () => {
  // Phase B: Conditioning carries (read-only). Phase C: Authoring consumes (interpretation).
  // Every OTHER engine must stay derivation-free — Discovery/Composition/Execution/Builder/model
  // neither consume nor interpret Models in this phase.
  const CLEAN_ENGINES = ['discovery', 'composition', 'execution', 'builder', 'model'];
  for (const eng of CLEAN_ENGINES) {
    it(`${eng}.ts does not import the derivation layer`, () => {
      const src = readFileSync(fileURLToPath(new URL(`../../../src/knowledge/${eng}.ts`, import.meta.url)), 'utf8');
      expect(src.includes('derivation/')).toBe(false);
      expect(src.includes("'./derivation")).toBe(false);
    });
  }

  it('conditioning.ts carries the Models (imports the derivation types)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../../src/knowledge/conditioning.ts', import.meta.url)), 'utf8');
    expect(src.includes('./derivation/models.js')).toBe(true); // the carrier wiring (Phase B)
  });

  it('authoring.ts consumes the Models (imports the derivation types)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../../src/knowledge/authoring.ts', import.meta.url)), 'utf8');
    expect(src.includes('./derivation/models.js')).toBe(true); // the consumer wiring (Phase C)
    // The runtime-stays-interpretation-free guarantee is proven behaviourally by the
    // authoring-interpretation tests (request.models === ctx.models, identities unchanged).
  });
});

describe('Phase B — Example Brand APA carried through Conditioning into the Authoring Context', () => {
  it('the Authoring Context contains an identical, immutable ModelSet', async () => {
    const set = await deriveModels(APA_BRIEF, repo, defaultScriptedDeriver());
    const dPlan = compose(discover({ obligations: firstObligation() }, { assets: loaded.assets, vocabulary: loaded.vocabulary }), composeRepo);
    const ctx = condition(dPlan, composeRepo, { requestId: 'phase-b-apa' }, set);
    expect(ctx.models).toEqual(set);
    expect(ctx.models!.derivationIdentity).toBe(set.derivationIdentity);
    expect(Object.isFrozen(ctx.models)).toBe(true);
    // default-off remains byte-identical
    const plain = condition(dPlan, composeRepo, { requestId: 'phase-b-apa' });
    expect('models' in plain).toBe(false);
    expect(plain.conditioningIdentity).not.toBe(ctx.conditioningIdentity);
  });
});
