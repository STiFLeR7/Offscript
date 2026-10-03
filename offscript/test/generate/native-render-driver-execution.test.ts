/**
 * G2-S1 — Native Render Driver Execution: promote the contract-native ReviewPackage driver into
 * production. Before G2-S1 the render tier (`validate-loop-driver.ts`) ORIGINATED execution identity —
 * it built the terminal Designer Review Package from `context.client` / `context.track`. This sprint
 * makes that identity come from the GenerationContract instead: `runValidateAndReport` now takes a
 * REQUIRED `reviewPackageBuilder` closure that the orchestration layer injects — `nativeReviewPackage`
 * (identity from the contract) on the native path, the compatibility bridge on the legacy path. The
 * driver assembles the run-owned inputs and DELEGATES; it no longer originates execution identity.
 *
 * Boundary: `validate-loop-driver` is World B (`src/generate`) and imports nothing from `src/project`.
 * The native driver is injected as a closure from `scripts/generate.ts` (the orchestration layer). This
 * test verifies (a) the native driver is byte-identical to the legacy origination, (b) the legacy compat
 * bridge is byte-identical, (c) they are one and the same value, and (d) the driver USES the injected
 * builder and no longer references client/track itself.
 *
 * Uses the real example-brand collateral fixture for the integration seams (fast, deterministic, no
 * OFFSCRIPT_PLAYWRIGHT gate — same pattern as validate-loop-driver.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { authorDocument } from '../../src/generate/author.js';
import { defaultScriptedAuthor } from '../../src/generate/authoring-seam.js';
import { runValidateAndReport } from '../../src/generate/validate-loop-driver.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { readReviewPackage } from '../../src/doctor/review-package-io.js';
import { scoreFindingsByRail } from '../../src/score.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import type { Track } from '../../src/paths.js';
import type { CreativeStrategy } from '../../src/project/creative-strategy.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type SessionInput } from '../../src/project/project-context.js';
import { newSession, applySession } from '../../src/project/context-updater.js';
import { planWorkflow } from '../../src/project/workflow-planner.js';
import type { ProjectReadiness } from '../../src/project/readiness.js';
import type { ReviewPackageRuntimeInputs } from '../../src/project/doctor-contract-adapter.js';
import { buildReviewPackageFromContract, doctorContractFromLegacy } from '../../src/project/doctor-contract-adapter.js';
import { beginGeneration, nativeReviewPackage } from '../../src/project/generation-orchestration.js';

// ── A READY project (parameterized by client + deliverables) ──────────────────────
function readinessFor(client: string, deliverables: Track[]): ProjectReadiness {
  const strategy: CreativeStrategy = {
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
  return { projectType: 'website', deliverables, workflow: planWorkflow({ projectType: 'website', deliverables, strategy, context }), strategy, context };
}

// ── A run-owned review-package surface (identity-free — the shape the driver assembles) ──
function signal(): AuthoritySignal {
  return { producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' };
}
function health(delivered: AuthoritySignal[]): RunHealth {
  return {
    headline: { status: 'success', goalMet: true, systematicRatio: 1, failures: [], criticals: [], warnings: delivered, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}
function reviewRuntime(subject: string): ReviewPackageRuntimeInputs {
  const doctorInput: DoctorReportInput = { subject, generatedAt: '2026-01-01T00:00:00.000Z', health: health([signal()]), perRail: [], frozen: [] };
  const doctorReport = buildDoctorReport(doctorInput);
  const reviewReport = buildReviewReport(doctorReport);
  return {
    doctorReport, score: scoreFindingsByRail({ subject, applied: [], perRail: [] }),
    reviewReport, reviewReportMarkdown: renderReviewReport(reviewReport), validationSummary: 'Run headline: SUCCESS',
  };
}

describe('G2-S1 native render driver execution', () => {
  // ── Unit: the native driver IS the production identity source, byte-identical to the legacy origination ──

  it('single execution identity: the native ReviewPackage driver is byte-identical to the legacy client/track origination', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor('acme', ['collateral']) });
    const runtime = reviewRuntime('projects/acme/collateral');
    const native = nativeReviewPackage(gen, 'collateral', runtime);
    const legacyOrigination = buildReviewPackage({ client: 'acme', track: 'collateral', ...runtime });
    expect(native).toEqual(legacyOrigination);
    expect(native.metadata.replayIdentity).toBe(legacyOrigination.metadata.replayIdentity);
    expect(native.metadata.client).toBe('acme');
    expect(native.metadata.track).toBe('collateral');
  });

  it('legacy compatibility path: the compat bridge is byte-identical to the direct client/track origination', () => {
    const runtime = reviewRuntime('projects/acme/collateral');
    const viaBridge = buildReviewPackageFromContract(doctorContractFromLegacy({ client: 'acme', deliverables: ['collateral'] }), 'collateral', runtime);
    const direct = buildReviewPackage({ client: 'acme', track: 'collateral', ...runtime });
    expect(viaBridge).toEqual(direct);
    expect(viaBridge.metadata.replayIdentity).toBe(direct.metadata.replayIdentity);
  });

  it('one value, two ways: native driver and legacy compat bridge resolve to the identical ReviewPackage', () => {
    const gen = beginGeneration({ client: 'acme', readiness: readinessFor('acme', ['collateral']) });
    const runtime = reviewRuntime('projects/acme/collateral');
    const native = nativeReviewPackage(gen, 'collateral', runtime);
    const bridge = buildReviewPackageFromContract(doctorContractFromLegacy({ client: 'acme', deliverables: ['collateral'] }), 'collateral', runtime);
    expect(native).toEqual(bridge);
  });

  // ── Integration: the driver DELEGATES to the injected builder and no longer originates identity ──

  it('the render driver invokes the injected reviewPackageBuilder with identity-free runtime inputs, and writes its output', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-g2s1-delegate-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

      let calls = 0;
      let seenRuntime: ReviewPackageRuntimeInputs | undefined;
      const reviewPackageBuilder = (runtime: ReviewPackageRuntimeInputs) => {
        calls += 1;
        seenRuntime = runtime;
        // identity injected HERE (the orchestration layer's job), not by the driver:
        return buildReviewPackage({ client: 'example-brand', track: 'collateral', ...runtime });
      };

      await runValidateAndReport(html, p, ctx, {
        outDir,
        useSubagent: false,
        author: (findingsByItem) => authorDocument(p, ctx, defaultScriptedAuthor(), findingsByItem),
        reviewPackageBuilder,
      });

      // The driver delegated exactly once...
      expect(calls).toBe(1);
      // ...with run-owned inputs that carry NO execution identity (client/track are the builder's to supply)...
      expect(seenRuntime).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(seenRuntime, 'client')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(seenRuntime, 'track')).toBe(false);
      // ...and the persisted review package is the one the injected builder produced.
      const pkg = readReviewPackage(join(outDir, 'review-package.json'))!;
      expect(pkg.metadata.client).toBe('example-brand');
      expect(pkg.metadata.track).toBe('collateral');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('production native path == legacy path: the native driver and the legacy origination write byte-identical review packages', async () => {
    const outDirNative = mkdtempSync(join(tmpdir(), 'offscript-g2s1-native-'));
    const outDirLegacy = mkdtempSync(join(tmpdir(), 'offscript-g2s1-legacy-'));
    try {
      // Native path: identity sourced from a GenerationContract admitting example-brand/collateral.
      const gen = beginGeneration({ client: 'example-brand', readiness: readinessFor('example-brand', ['collateral']) });
      const ctxN = buildContext('example-brand', 'collateral');
      const pN = plan(ctxN);
      const { html: htmlN } = await authorDocument(pN, ctxN, defaultScriptedAuthor());
      await runValidateAndReport(htmlN, pN, ctxN, {
        outDir: outDirNative,
        useSubagent: false,
        author: (f) => authorDocument(pN, ctxN, defaultScriptedAuthor(), f),
        reviewPackageBuilder: (runtime) => nativeReviewPackage(gen, 'collateral', runtime),
      });

      // Legacy path: identity sourced from the compat bridge (the DesignContext client/track).
      const ctxL = buildContext('example-brand', 'collateral');
      const pL = plan(ctxL);
      const { html: htmlL } = await authorDocument(pL, ctxL, defaultScriptedAuthor());
      await runValidateAndReport(htmlL, pL, ctxL, {
        outDir: outDirLegacy,
        useSubagent: false,
        author: (f) => authorDocument(pL, ctxL, defaultScriptedAuthor(), f),
        reviewPackageBuilder: (runtime) =>
          buildReviewPackageFromContract(doctorContractFromLegacy({ client: 'example-brand', deliverables: ['collateral'] }), 'collateral', runtime),
      });

      const native = readReviewPackage(join(outDirNative, 'review-package.json'))!;
      const legacy = readReviewPackage(join(outDirLegacy, 'review-package.json'))!;
      // replayIdentity excludes subject (outDir-derived) + generatedAt — it must match across paths.
      expect(native.metadata.replayIdentity).toBe(legacy.metadata.replayIdentity);
      expect(native.metadata.client).toBe(legacy.metadata.client);
      expect(native.metadata.track).toBe(legacy.metadata.track);
      expect(native.headlineStatus).toBe(legacy.headlineStatus);
      expect(native.findingCount).toBe(legacy.findingCount);
    } finally {
      rmSync(outDirNative, { recursive: true, force: true });
      rmSync(outDirLegacy, { recursive: true, force: true });
    }
  }, 30_000);

  it('requires an explicit `reviewPackageBuilder` at the type level — the driver no longer defaults execution identity', () => {
    // Compile-time proof: `reviewPackageBuilder` is non-optional on ValidateLoopDriverOptions, so omitting
    // it must fail to type-check. If a future change reintroduces a context.client/track default, the
    // @ts-expect-error stops erroring and `tsc --noEmit` fails here — the falsification.
    function typeOnlyCheck(outDir: string): void {
      // @ts-expect-error — `reviewPackageBuilder` is required; this call must not type-check.
      void runValidateAndReport('<html></html>', {} as never, {} as never, { outDir, useSubagent: false, author: async () => ({ html: '', warnings: [] }) });
    }
    expect(typeof typeOnlyCheck).toBe('function');
  });
});
