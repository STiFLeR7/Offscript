/**
 * G1-S3 — Persisted Project Readiness: ProjectReadiness (the evaluator INPUT — the thing generation
 * needs but G1-S2 showed the CLI could not reconstruct) becomes a durable, deterministic project
 * artifact. This proves the lifecycle: evaluate → persist ONCE → reload byte-identical → the Generation
 * Planner accepts the reloaded readiness unchanged (identical contract). Version + admission evidence are
 * preserved; serialization is deterministic; replay is byte-identical.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import type { Track } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { recordProjectSession, loadProjectContext } from '../../src/project/context-store.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import { evaluateReadiness, evaluateReadinessFor, projectReadinessFor } from '../../src/project/readiness-evaluator.js';
import { planGenerationFor } from '../../src/project/generation-planner.js';
import {
  serializeProjectReadiness,
  deserializeProjectReadiness,
  writeProjectReadiness,
  readProjectReadiness,
  projectReadinessPath,
} from '../../src/project/readiness-store.js';

// ── A self-contained READY ProjectReadiness for client 'acme' (no fs, no CD) ──────
function readinessFor(deliverables: Track[], over: Partial<CreativeStrategy> = {}): ProjectReadiness {
  const strat: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [],
    ...over,
  };
  const id: ProjectIdentity = { client: 'acme', projectType: 'website', deliverables };
  const decisions: SessionInput['decisions'] = [
    { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
    { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
  ];
  const base = emptyContext(id);
  const context: ProjectContext = applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context }), strategy: strat, context };
}

describe('G1-S3 persisted project readiness — serialization (pure)', () => {
  it('round-trips byte-identical: deserialize(serialize(r)) deep-equals r, and re-serializing is identical (replay)', () => {
    const r = readinessFor(['website', 'collateral']);
    const text = serializeProjectReadiness(r);
    const reloaded = deserializeProjectReadiness(text);
    expect(reloaded).toEqual(r);
    expect(serializeProjectReadiness(reloaded)).toBe(text); // byte-identical replay
  });

  it('serialization is deterministic: the same readiness always produces the identical string', () => {
    const a = serializeProjectReadiness(readinessFor(['website']));
    const b = serializeProjectReadiness(readinessFor(['website']));
    expect(a).toBe(b);
  });

  it('preserves the context + workflow version through a round-trip', () => {
    const r = readinessFor(['website']);
    const reloaded = deserializeProjectReadiness(serializeProjectReadiness(r));
    expect(reloaded.workflow.version).toBe(r.workflow.version);
    expect(reloaded.context?.version).toBe(r.context?.version);
  });

  it('preserves admission evidence: re-evaluating the reloaded readiness yields the identical assessment', () => {
    const r = readinessFor(['website']);
    const reloaded = deserializeProjectReadiness(serializeProjectReadiness(r));
    expect(evaluateReadiness(reloaded)).toEqual(evaluateReadiness(r));
    expect(evaluateReadiness(reloaded).admission.admitted).toBe(true);
  });

  it('the Generation Planner accepts the persisted readiness unchanged: identical contract', () => {
    const r = readinessFor(['website', 'collateral']);
    const reloaded = deserializeProjectReadiness(serializeProjectReadiness(r));
    const fromReloaded = planGenerationFor('acme', reloaded);
    const fromOriginal = planGenerationFor('acme', r);
    expect(fromReloaded).toEqual(fromOriginal);
    expect(fromReloaded.planId).toBe(fromOriginal.planId); // content-hash identity unchanged
  });

  it('a readiness WITHOUT a context round-trips (optional field omitted, deep-equal)', () => {
    const full = readinessFor(['website']);
    const { context: _c, ...noContext } = full;
    const r = noContext as ProjectReadiness;
    const reloaded = deserializeProjectReadiness(serializeProjectReadiness(r));
    expect(reloaded).toEqual(r);
    expect('context' in reloaded).toBe(false);
  });

  it('rejects an unsupported schemaVersion (fail-loud)', () => {
    expect(() => deserializeProjectReadiness(JSON.stringify({ schemaVersion: 2, readiness: {} }))).toThrow(/schemaVersion/);
  });
});

describe('G1-S3 persisted project readiness — lifecycle (persist → reload)', () => {
  const CLIENT = '__g1s3_store__';
  const T = '2026-01-01T00:00:00Z';
  afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

  it('absent readiness artifact reads back as null', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    expect(readProjectReadiness(CLIENT)).toBeNull();
  });

  it('Acquire → evaluate → persist → reload → byte-identical → planner accepts the reloaded readiness', () => {
    // Acquire (P49/P51): init, record a READY living context, plan the acquisition.
    initProject({ client: CLIENT, projectType: 'website' });
    recordProjectSession(CLIENT, { goal: 'prep', decisions: [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
    ] }, T);
    const ctx = loadProjectContext(CLIENT);
    const acq = createCreativeDirector().plan({ client: CLIENT, projectType: 'website', answers: { audience: 'Devs' } });

    // Evaluate → assemble the ProjectReadiness exactly as evaluateReadinessFor does.
    const readiness = projectReadinessFor(acq, { context: ctx });
    expect(evaluateReadiness(readiness).admission.admitted).toBe(true); // READY

    // Persist ONCE, reload.
    writeProjectReadiness(CLIENT, readiness);
    expect(existsSync(projectReadinessPath(CLIENT))).toBe(true);
    const reloaded = readProjectReadiness(CLIENT)!;

    expect(reloaded).toEqual(readiness); // byte-identical reload
    // The Generation Planner accepts the persisted readiness unchanged — identical contract.
    expect(planGenerationFor(CLIENT, reloaded)).toEqual(planGenerationFor(CLIENT, readiness));
  });

  it('projectReadinessFor assembles the same readiness evaluateReadinessFor evaluates (behaviour-preserving extraction)', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    recordProjectSession(CLIENT, { goal: 'prep', decisions: [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
    ] }, T);
    const ctx = loadProjectContext(CLIENT);
    const acq = createCreativeDirector().plan({ client: CLIENT, projectType: 'website', answers: { audience: 'Devs' } });
    // evaluating the assembled readiness == the one-call surface (evaluateReadinessFor builds it internally)
    expect(evaluateReadiness(projectReadinessFor(acq, { context: ctx }))).toEqual(evaluateReadinessFor(acq, { context: ctx }));
  });
});
