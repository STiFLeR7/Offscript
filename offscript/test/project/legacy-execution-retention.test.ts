/**
 * G2-S4 — Legacy Execution Retention: this sprint evaluated whether the CLI's legacy execution branch
 * (`resolveGenerationEntry`'s `readiness === null` fallback) can be retired, and RETAINED it — a
 * documented non-removal.
 *
 * The blocker, proven by inventory (G2-S4 report §1–§4): `readiness.json` is written by exactly ONE
 * production path — `scripts/acquire-brief.ts` — and 0 of the 14 briefed projects in `projects/` have
 * one. Every project authored via the hand-dropped-brief workflow (the one `generate.ts`'s own
 * skip-clean message documents) reaches generation with `readiness === null` and MUST resolve to a
 * complete legacy entry. Retiring the branch would fail-close all of them.
 *
 * These are the RETENTION GUARDS. They lock the load-bearing invariant so a future retirement cannot
 * land silently: the legacy fallback is a COMPLETE, render-usable execution path (not a stub), it is
 * the ONLY entry available when readiness is absent, migrating a project to native is output-neutral
 * (identity byte-equal), and the fallback is replay-stable. RED-proof: momentarily making the null
 * branch throw (simulating the retirement) turns guards 1–2 red — see the G2-S4 report §5.
 */
import { describe, it, expect } from 'vitest';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import { resolveGenerationEntry } from '../../src/project/generation-orchestration.js';

function readinessFor(client: string, deliverables: Track[]): ProjectReadiness {
  const strat: CreativeStrategy = {
    projectComplexity: 'standard', creativeMaturity: 'guided', brandMaturity: 'nascent', evidenceCompleteness: 1,
    riskLevel: 'low', expectedDeliverables: deliverables, requiredStakeholders: ['project owner'], requiredApprovals: [], unknownCriticalDecisions: [],
  };
  const id: ProjectIdentity = { client, projectType: 'website', deliverables };
  const decisions: SessionInput['decisions'] = [
    { kind: 'confirmed', subject: 'brand', to: 'Acme' }, { kind: 'confirmed', subject: 'audience', to: 'Devs' },
    { kind: 'confirmed', subject: 'tone', to: 'Confident' }, { kind: 'asset', subject: 'logo.svg' },
  ];
  const base = emptyContext(id);
  const context: ProjectContext = applySession(base, newSession({ goal: 'p', decisions }, base, '2026-01-01T00:00:00Z'));
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy: strat, context }), strategy: strat, context };
}

describe('G2-S4 legacy execution retention (documented non-removal)', () => {
  it('absent readiness (the state of every current production project) → a COMPLETE, render-usable legacy entry', () => {
    // example-brand/collateral is the live baseline: it has a brief.md but no readiness.json, so it runs legacy.
    const entry = resolveGenerationEntry({ client: 'example-brand', track: 'collateral', readiness: null });
    expect(entry.mode).toBe('legacy');
    // Load-bearing: the fallback is a full execution path, not a stub — the render tier keys on this identity.
    expect(entry.identity).toEqual({ client: 'example-brand', track: 'collateral', subject: 'example-brand/collateral' });
    if (entry.mode === 'legacy') expect(entry.reason).toMatch(/readiness/);
  });

  it('legacy is the ONLY entry available for a hand-brief project — retiring it would fail-close the run', () => {
    // A hand-dropped-brief project has no ProjectReadiness to admit; native (beginGeneration) needs one.
    // null is the only input these 14/14 projects can supply — which is precisely why the branch is retained.
    const entry = resolveGenerationEntry({ client: 'example-brand', track: 'collateral', readiness: null });
    expect(entry.mode).not.toBe('native');
  });

  it('migration is output-neutral: once acquired, native identity byte-equals the legacy fallback identity', () => {
    // The eventual retirement path is sound (native == legacy identity ⇒ ReviewPackage/Doctor/Author unchanged);
    // it is simply not yet reachable because acquisition has not run for these projects.
    const native = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: readinessFor('acme', ['website']) });
    const legacy = resolveGenerationEntry({ client: 'acme', track: 'website', readiness: null });
    expect(native.identity).toEqual(legacy.identity);
  });

  it('the legacy fallback is deterministic (replay-stable)', () => {
    const a = resolveGenerationEntry({ client: 'acme', track: 'collateral', readiness: null });
    const b = resolveGenerationEntry({ client: 'acme', track: 'collateral', readiness: null });
    expect(a).toEqual(b);
  });
});
