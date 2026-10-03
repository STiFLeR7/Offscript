/**
 * Sprint 10L — pre-render Visual Proof orchestration. Proves the SOURCE-REQUIRED ordering
 * (decision/sketch -> Visual Proof -> pass? -> render) at the orchestration level, without
 * modifying producer.ts. Every test here uses a deterministic, caller-supplied executor
 * (createScriptedStubExecutor, Sprint 10J) — this file tests ORCHESTRATION SEMANTICS (does the
 * producer get called, does the request carry the right context, does a failure/unavailable
 * outcome physically prevent a render), never whether any judgment is "correct." The real judgment
 * executor was already independently proven in Sprint 10K; the real end-to-end proof combining it
 * with this orchestrator lives in `offscript/scripts/_sprint10l-real-judge-run.ts`, not here.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { engineRoot } from '../src/references.js';
import { componentsForFeature } from '../src/feature-mapping.js';
import { selectCamera } from '../src/camera-selection.js';
import { getCompositionCameraBias } from '../src/composition-camera-bias.js';
import { produceCreativeArtifact, type CreativeIntentInput } from '../src/producer.js';
import { createScriptedStubExecutor, type VisualProofValidationAnswers } from '../src/visual-proof-validation.js';
import { orchestrateCreativeGeneration, judgedFrom } from '../src/visual-proof-orchestrator.js';

/** Test-local convenience: wraps the Sprint 10J scripted stub (Promise<Answer>) as the wider
 * Promise<Outcome> shape the orchestrator's executor slot requires, via the orchestrator module's
 * own exported adapter — never a second, competing scripted-answer mechanism. */
function scriptedJudgment(answers: VisualProofValidationAnswers) {
  return judgedFrom(createScriptedStubExecutor(answers));
}

const CLIENT = '__orchestrator-unit-test__';

const INTENT: CreativeIntentInput = {
  id: 'orchestration-test-intent',
  digest: 'sha256:' + 'c'.repeat(64),
  belief: 'exceptions surface themselves before a human has to go looking',
  feature: 'ai-intelligence',
  ratio: '4:3',
  camera: 'component',
  mustInclude: ['the triage queue as the hero element'],
  contentProvenance: 'human',
};

const ALL_YES = { q1: true, q2: true, q3: true, q4: true, q5: true, q6: true };
const ONE_NO = { ...ALL_YES, q4: false };

afterEach(() => {
  rmSync(join(engineRoot, 'projects', CLIENT), { recursive: true, force: true });
});

/** A counting wrapper around the REAL produceCreativeArtifact — proves the call boundary by
 * actually invoking the real function (never a fake renderer), while making "was it called"
 * and "how many times" directly, reliably observable without fighting ESM module-spy mechanics. */
function countingRealProduce() {
  let calls = 0;
  const args: unknown[][] = [];
  const fn = ((...a: Parameters<typeof produceCreativeArtifact>) => {
    calls++;
    args.push(a);
    return produceCreativeArtifact(...a);
  }) as typeof produceCreativeArtifact;
  return { fn, count: () => calls, callArgs: () => args };
}

// ── 1/2/3 — render ordering: the core proof ─────────────────────────────────────────────────
describe('orchestrateCreativeGeneration — render ordering (Phase 5: the real function call boundary)', () => {
  it('a PASSED judgment reaches the producer — produce is called exactly once', async () => {
    const spy = countingRealProduce();
    const executor = scriptedJudgment(ALL_YES);
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor,
      produceOptions: { client: CLIENT },
      produce: spy.fn,
    });
    expect(spy.count()).toBe(1);
    expect(result.status).toBe('RENDERED');
  });

  it('a FAILED judgment stops before the producer — produce is never called', async () => {
    const spy = countingRealProduce();
    const executor = scriptedJudgment(ONE_NO);
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor,
      produceOptions: { client: CLIENT },
      produce: spy.fn,
    });
    expect(spy.count()).toBe(0);
    expect(result.status).toBe('NOT_RENDERED');
    if (result.status === 'NOT_RENDERED') expect(result.reason).toBe('failed');
  });

  it('an UNAVAILABLE judgment stops before the producer — produce is never called', async () => {
    const spy = countingRealProduce();
    const executor = async () => ({ outcome: 'unavailable' as const, reason: 'malformed_response: test fixture' });
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor,
      produceOptions: { client: CLIENT },
      produce: spy.fn,
    });
    expect(spy.count()).toBe(0);
    expect(result.status).toBe('NOT_RENDERED');
    if (result.status === 'NOT_RENDERED') expect(result.reason).toBe('unavailable');
  });
});

// ── 4 — q1-q6 preserved ──────────────────────────────────────────────────────────────────────
describe('orchestrateCreativeGeneration — q1-q6 preserved in the result', () => {
  it('a passed result carries the full, individually-visible six-answer object', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    expect(result.status).toBe('RENDERED');
    if (result.status === 'RENDERED') {
      expect(result.answer.q1).toBe(true);
      expect(result.answer.q2).toBe(true);
      expect(result.answer.q3).toBe(true);
      expect(result.answer.q4).toBe(true);
      expect(result.answer.q5).toBe(true);
      expect(result.answer.q6).toBe(true);
      expect(result.answer.passed).toBe(true);
    }
  });

  it('a failed result carries the full six-answer object, including which ones failed', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment({ ...ALL_YES, q3: false, q5: false }),
      produceOptions: { client: CLIENT },
    });
    expect(result.status).toBe('NOT_RENDERED');
    if (result.status === 'NOT_RENDERED' && result.reason === 'failed') {
      expect(result.answer.q3).toBe(false);
      expect(result.answer.q5).toBe(false);
      expect(result.answer.q1).toBe(true);
      expect(result.answer.passed).toBe(false);
    }
  });
});

// ── 5 — producer output unchanged when passed ───────────────────────────────────────────────
describe('orchestrateCreativeGeneration — producer output is passed through unmodified', () => {
  it('the returned artifact/html are byte-identical to what the real producer actually returned', async () => {
    const spy = countingRealProduce();
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
      produce: spy.fn,
    });
    expect(result.status).toBe('RENDERED');
    if (result.status === 'RENDERED') {
      const [directIntent, directOpts] = spy.callArgs()[0];
      const direct = produceCreativeArtifact(directIntent as CreativeIntentInput, directOpts as { client: string });
      expect(result.artifact.artifactDigest).toBe(direct.artifact.artifactDigest);
      expect(result.html).toBe(direct.html);
    }
  });

  it('the artifact approval status remains "pending" — never auto-approved by orchestration (Phase 10 boundary)', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    expect(result.status).toBe('RENDERED');
    if (result.status === 'RENDERED') {
      expect(result.artifact.approval.status).toBe('pending');
    }
  });
});

// ── 6/7/8 — Feature Mapping / Camera / components remain part of the request ───────────────
describe('orchestrateCreativeGeneration — request assembly preserves Feature Mapping, Camera Selection, and components', () => {
  it('the request carries exactly the components Feature Mapping (unmodified) produces for this feature', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    const expectedComponents = componentsForFeature(INTENT.feature);
    expect(result.request.components).toEqual(expectedComponents);
  });

  it('the request carries the camera candidate Camera Selection (unmodified) resolves', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    const expectedSelection = selectCamera(INTENT);
    expect(result.request.camera).toBe(expectedSelection.selected);
    expect(result.cameraSelection).toEqual(expectedSelection);
  });

  it('the request never carries a fabricated Decision Record field — only belief/feature/mustInclude/camera/components', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    expect(Object.keys(result.request).sort()).toEqual(['belief', 'camera', 'components', 'feature', 'mustInclude']);
  });

  it('Composition Camera Bias (unmodified) is derived and carried in the result, even though it is not part of the VPV request itself', async () => {
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    const selection = selectCamera(INTENT);
    const expectedBias = getCompositionCameraBias(selection.selected ?? INTENT.camera);
    expect(result.compositionBias).toEqual(expectedBias);
  });

  it('the request omits components entirely when Feature Mapping returns none for an unrecognized feature (never fabricated)', async () => {
    const unrecognized: CreativeIntentInput = { ...INTENT, feature: 'not-a-real-feature' };
    const result = await orchestrateCreativeGeneration(unrecognized, {
      executor: scriptedJudgment(ALL_YES),
      produceOptions: { client: CLIENT },
    });
    expect(result.request.components).toBeUndefined();
  });
});

// ── 9/10 — no artifact exists on the real filesystem after a non-render ────────────────────
describe('orchestrateCreativeGeneration — no artifact exists on disk after a non-render (real filesystem proof)', () => {
  const expectedDir = join(engineRoot, 'projects', CLIENT, 'creative-assets', INTENT.id);

  it('no creative-assets directory exists after a failed validation (the orchestrator never writes to disk)', async () => {
    expect(existsSync(expectedDir)).toBe(false);
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ONE_NO),
      produceOptions: { client: CLIENT },
    });
    expect(result.status).toBe('NOT_RENDERED');
    expect(existsSync(expectedDir)).toBe(false);
  });

  it('no creative-assets directory exists after an unavailable validation (the orchestrator never writes to disk)', async () => {
    expect(existsSync(expectedDir)).toBe(false);
    const executor = async () => ({ outcome: 'unavailable' as const, reason: 'timeout' });
    const result = await orchestrateCreativeGeneration(INTENT, {
      executor,
      produceOptions: { client: CLIENT },
    });
    expect(result.status).toBe('NOT_RENDERED');
    expect(existsSync(expectedDir)).toBe(false);
  });
});

// ── No retry — the executor is invoked exactly once, regardless of outcome ─────────────────
describe('orchestrateCreativeGeneration — no retry/rethink (Phase 9)', () => {
  it('the executor is invoked exactly once even on failure', async () => {
    let calls = 0;
    const executor = async () => {
      calls++;
      return { outcome: 'judged' as const, answer: { ...ONE_NO, passed: false, evidence: 'x' } };
    };
    await orchestrateCreativeGeneration(INTENT, { executor, produceOptions: { client: CLIENT } });
    expect(calls).toBe(1);
  });

  it('the executor is invoked exactly once even when unavailable', async () => {
    let calls = 0;
    const executor = async () => {
      calls++;
      return { outcome: 'unavailable' as const, reason: 'timeout' };
    };
    await orchestrateCreativeGeneration(INTENT, { executor, produceOptions: { client: CLIENT } });
    expect(calls).toBe(1);
  });

  it('the orchestrator never mutates the input intent (no automatic camera/component/belief revision)', async () => {
    const before = JSON.stringify(INTENT);
    await orchestrateCreativeGeneration(INTENT, {
      executor: scriptedJudgment(ONE_NO),
      produceOptions: { client: CLIENT },
    });
    expect(JSON.stringify(INTENT)).toBe(before);
  });
});

// ── Unavailable reason preserved verbatim ───────────────────────────────────────────────────
describe('orchestrateCreativeGeneration — unavailable reason is preserved verbatim', () => {
  it('the exact machine-readable reason string reaches the result', async () => {
    const executor = async () => ({ outcome: 'unavailable' as const, reason: 'dispatch_error: network reset' });
    const result = await orchestrateCreativeGeneration(INTENT, { executor, produceOptions: { client: CLIENT } });
    expect(result.status).toBe('NOT_RENDERED');
    if (result.status === 'NOT_RENDERED' && result.reason === 'unavailable') {
      expect(result.unavailableReason).toBe('dispatch_error: network reset');
    }
  });
});
