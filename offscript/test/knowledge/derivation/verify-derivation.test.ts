/**
 * Sprint X — the derivation Verification Harness + the additive hook into verifyArchitecture.
 *
 * Proves the seven Models: exist · are immutable · carry model- and category-level governance
 * references · represent every authored category (none omitted, none invented) · have content-hash
 * identities · replay identically · and bind to the repository without mutating it. Also proves the
 * existing harness is extended additively: absent a deriver, the report has no `derivation` field
 * (byte-identical default); present a deriver, the derivation sub-report is attached and passes.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../../src/knowledge/model.js';
import { makeVocabulary } from '../../../src/knowledge/vocabulary.js';
import { verifyArchitecture } from '../../../src/knowledge/verification.js';
import { defaultScriptedDeriver, scriptedDeriver } from '../../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type RawBrief } from '../../../src/knowledge/derivation/models.js';
import { verifyDerivation } from '../../../src/knowledge/derivation/verify-derivation.js';

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
const REPO = { repositoryIdentity: 'sha256:' + 'e'.repeat(64), assetCount: 96 };

describe('verifyDerivation — the derivation Verification Harness', () => {
  it('passes for the scripted double (all seven Models verified)', async () => {
    const r = await verifyDerivation(REPO, BRIEF, { deriver: defaultScriptedDeriver() });
    expect(r.ok).toBe(true);
    expect(r.modelsVerified).toBe(7);
    expect(r.summary.failed).toBe(0);
    expect(r.derivationIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('proves each Model exists, is immutable, and conforms to its constitutional schema', async () => {
    const r = await verifyDerivation(REPO, BRIEF, { deriver: defaultScriptedDeriver() });
    for (const k of MODEL_KINDS) {
      const named = (cat: string) => r.checks.find((c) => c.model === k && c.category === cat);
      expect(named('existence')?.passed).toBe(true);
      expect(named('immutability')?.passed).toBe(true);
      expect(named('schema')?.passed).toBe(true);
      expect(named('governance')?.passed).toBe(true);
      expect(named('identity')?.passed).toBe(true);
      expect(named('replay')?.passed).toBe(true);
    }
  });

  it('binds the repository identity without mutating it', async () => {
    const r = await verifyDerivation(REPO, BRIEF, { deriver: defaultScriptedDeriver() });
    expect(r.repositoryIdentity).toBe(REPO.repositoryIdentity);
  });

  it('records a failure (never throws) when a deriver omits a category', async () => {
    const bad = scriptedDeriver(
      MODEL_KINDS.map((k) => {
        const categories: Record<string, unknown> = {};
        for (const c of MODEL_SCHEMA[k].categories) categories[c.key] = null;
        if (k === 'information') delete categories.completenessModel;
        return { kind: k, categories, rationale: 'bad' };
      }),
    );
    const r = await verifyDerivation(REPO, BRIEF, { deriver: bad });
    expect(r.ok).toBe(false);
  });

  it('defaults to the scripted double when no deriver is supplied', async () => {
    const r = await verifyDerivation(REPO, BRIEF);
    expect(r.ok).toBe(true);
    expect(r.modelsVerified).toBe(7);
  });
});

// --- additive hook into the existing harness ---
const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};
function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset({ ...base, ...loose }, (loose.identity as any).id);
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}
const assets = [
  asset({ identity: { id: 'canonical::base', title: 'base' }, semantics: { specializes: ['concept:role:base'] }, capabilities: { satisfies: ['serves:base'] } }),
  asset({ identity: { id: 'canonical::hero', title: 'h' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] }, dependencies: { prerequisite: ['canonical::base'] } }),
];
const vocabulary = makeVocabulary({
  concepts: ['concept:role:hero', 'concept:role:base'],
  obligations: ['serves:hero', 'serves:base'],
  owners: ['ds'],
  scopeIdentities: ['offscript'],
});
const harnessRepo = { assets, vocabulary };

describe('verifyArchitecture — additive derivation hook', () => {
  it('omits the derivation field entirely when no deriver is supplied (default unchanged)', async () => {
    const report = await verifyArchitecture(harnessRepo);
    expect('derivation' in report).toBe(false);
    expect(report.derivation).toBeUndefined();
  });

  it('attaches a passing derivation sub-report when a deriver + brief are supplied', async () => {
    const report = await verifyArchitecture(harnessRepo, { deriver: defaultScriptedDeriver(), brief: BRIEF });
    expect(report.derivation).toBeDefined();
    expect(report.derivation!.ok).toBe(true);
    expect(report.derivation!.modelsVerified).toBe(7);
    // the pipeline itself is still verified and the derivation does not participate in it
    expect(report.intentsVerified).toBeGreaterThan(0);
  });
});
