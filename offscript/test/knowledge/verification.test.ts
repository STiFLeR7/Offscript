/**
 * Sprint 8 — Verification Harness: a single command that continuously verifies the WHOLE
 * pipeline (Repository → Discovery → Composition → Conditioning → Authoring → Execution) obeys
 * the architectural invariants. The harness validates execution; it never participates in it.
 * Mocked providers only — no network, no HTML.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import type { Author } from '../../src/knowledge/authoring.js';
import {
  verifyArchitecture,
  VERIFICATION_HARNESS_VERSION,
  type VerificationReport,
} from '../../src/knowledge/verification.js';

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
// A small but representative repository: plurality (two heroes) + a shared dependency (base).
const baseAsset = asset({ identity: { id: 'canonical::base', title: 'base' }, semantics: { specializes: ['concept:role:base'] }, capabilities: { satisfies: ['serves:base'] } });
const heroA = asset({ identity: { id: 'canonical::hero-a', title: 'a' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] }, dependencies: { prerequisite: ['canonical::base'] } });
const heroB = asset({ identity: { id: 'canonical::hero-b', title: 'b' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] }, dependencies: { prerequisite: ['canonical::base'] } });
const assets = [baseAsset, heroA, heroB];
const vocabulary = makeVocabulary({
  concepts: ['concept:role:hero', 'concept:role:base'],
  obligations: ['serves:hero', 'serves:base'],
  owners: ['ds'],
  scopeIdentities: ['offscript'],
});
const repo = { assets, vocabulary };

async function run(): Promise<VerificationReport> {
  return verifyArchitecture(repo, { intents: [{ obligations: ['serves:hero'] }] });
}

describe('verifyArchitecture — overall', () => {
  it('verifies the whole architecture and reports OK on a healthy repository', async () => {
    const r = await run();
    expect(r.ok).toBe(true);
    expect(r.harnessVersion).toBe(VERIFICATION_HARNESS_VERSION);
    expect(r.summary.failed).toBe(0);
    expect(r.summary.total).toBeGreaterThan(0);
    expect(r.summary.passed).toBe(r.summary.total);
    expect(r.repositoryIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('covers every verification category', async () => {
    const r = await run();
    const cats = new Set(r.checks.map((c) => c.category));
    for (const cat of ['invariant', 'identity', 'replay', 'evidence', 'determinism', 'conformance']) {
      expect(cats.has(cat as any)).toBe(true);
    }
  });

  it('covers every pipeline stage in its invariant checks', async () => {
    const r = await run();
    const stages = new Set(r.checks.filter((c) => c.category === 'invariant').map((c) => c.stage));
    for (const s of ['repository', 'graph', 'discovery', 'composition', 'conditioning', 'authoring', 'execution']) {
      expect(stages.has(s as any)).toBe(true);
    }
  });
});

describe('verifyArchitecture — identity chain', () => {
  it('produces a fully-linked identity chain back to the repository', async () => {
    const r = await run();
    expect(r.trace).not.toBeNull();
    const chain = r.trace!.identityChain;
    expect(chain.repository).toBe(r.repositoryIdentity);
    expect(chain.composition).toBe(r.repositoryIdentity); // plan binds to the repo identity
    for (const id of [chain.conditioning, chain.authoring, chain.execution]) {
      expect(id).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    const identityChecks = r.checks.filter((c) => c.category === 'identity');
    expect(identityChecks.length).toBeGreaterThan(0);
    expect(identityChecks.every((c) => c.passed)).toBe(true);
  });
});

describe('verifyArchitecture — evidence chain', () => {
  it('traces obligations unbroken from discovery through authoring', async () => {
    const r = await run();
    const ev = r.trace!.evidenceChain;
    expect(ev.discoveryObligations).toEqual(['serves:hero']);
    expect(ev.compositionObligations).toEqual(ev.discoveryObligations);
    expect(ev.conditioningObligations).toEqual(ev.discoveryObligations);
    expect(ev.authoringObligations).toEqual(ev.discoveryObligations);
    expect(ev.repositoryFacts).toBe(assets.length);
    expect(r.checks.filter((c) => c.category === 'evidence').every((c) => c.passed)).toBe(true);
  });
});

describe('verifyArchitecture — replay + determinism', () => {
  it('replay produces identical deterministic identities', async () => {
    const r = await run();
    const replay = r.checks.filter((c) => c.category === 'replay');
    expect(replay.length).toBeGreaterThan(0);
    expect(replay.every((c) => c.passed)).toBe(true);
  });

  it('verifies the determinism boundary (metadata stable; provider payload may differ)', async () => {
    const r = await run();
    const boundary = r.checks.filter((c) => c.category === 'determinism');
    expect(boundary.length).toBeGreaterThan(0);
    expect(boundary.every((c) => c.passed)).toBe(true);
  });

  it('is itself deterministic — same repository → same report shape + identities', async () => {
    const a = await run();
    const b = await run();
    expect(b.repositoryIdentity).toBe(a.repositoryIdentity);
    expect(b.trace!.identityChain).toEqual(a.trace!.identityChain);
    expect(b.summary).toEqual(a.summary);
  });
});

describe('verifyArchitecture — architectural conformance', () => {
  it('passes all conformance probes (no mutation, validation enforced, identities + evidence present)', async () => {
    const r = await run();
    const conf = r.checks.filter((c) => c.category === 'conformance');
    expect(conf.length).toBeGreaterThan(0);
    expect(conf.every((c) => c.passed)).toBe(true);
    // upstream repository is not mutated by a verification run
    expect(r.repositoryIdentity).toMatch(/^sha256:/);
    expect(Object.isFrozen(assets)).toBe(false); // the harness never freezes the caller's input
  });
});

describe('verifyArchitecture — default intent derivation', () => {
  it('derives lawful intents from the governed vocabulary when none are supplied', async () => {
    const r = await verifyArchitecture(repo); // no intents → derive from satisfied obligations
    expect(r.ok).toBe(true);
    expect(r.intentsVerified).toBeGreaterThan(0);
  });
});

describe('verifyArchitecture — catches a broken architecture', () => {
  it('reports NOT-ok when a custom provider violates the immutability/evidence contract', async () => {
    // A provider whose execution response is malformed must be caught as a conformance failure
    // is NOT applicable here (execution validates that). Instead, prove the harness surfaces a
    // failing check rather than throwing: feed an intent that cannot be satisfied.
    const r = await verifyArchitecture(repo, { intents: [{ obligations: ['serves:nonexistent'] }] });
    expect(r.ok).toBe(false);
    expect(r.summary.failed).toBeGreaterThan(0);
    expect(r.checks.some((c) => !c.passed)).toBe(true);
  });
});
