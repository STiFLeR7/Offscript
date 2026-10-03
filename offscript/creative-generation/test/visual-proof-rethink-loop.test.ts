/**
 * Sprint 10S — the bounded rethink/retry orchestration loop.
 *
 * Every test in this file uses DETERMINISTIC queued judgment/revision executors — a fake that
 * dequeues one pre-configured outcome per call, never real semantic reasoning. This proves the
 * loop's OWN mechanics: attempt sequencing, the render gate, the retry bound, the no-progress
 * detector, and CreativeIntent immutability. Real integration proof (a genuine judge + a genuine
 * revision reasoner driving the loop end to end) is exercised separately, outside this unit-test
 * file, by `offscript/scripts/_sprint10s-real-rethink-run.ts` and reported in
 * `.experiments/2026-08-12-creative-generation-renderer-readiness/RETHINK-LOOP-IMPLEMENTATION-REPORT.md`.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  runRethinkLoop,
  DEFAULT_MAX_REVISION_ATTEMPTS,
  CREATIVE_AUTHORING_GENERATOR_VERSION,
  type RethinkLoopEvent,
} from '../src/visual-proof-rethink-loop.js';
import type { CreativeAuthoringExecutor, CreativeAuthoringRequest } from '../src/creative-authoring.js';
import { judgedFrom } from '../src/visual-proof-orchestrator.js';
import { createScriptedStubExecutor } from '../src/visual-proof-validation.js';
import { createScriptedRevisionExecutor } from '../src/visual-proof-revision.js';
import type {
  VisualProofValidationRequest,
  VisualProofValidationOutcome,
  VisualProofValidationAnswer,
} from '../src/visual-proof-validation.js';
import type { VisualProofJudgmentExecutor } from '../src/visual-proof-judgment-executor.js';
import type { RevisionOutcome, RevisionRequest, VisualProofRevisionExecutor } from '../src/visual-proof-revision.js';
import type { CreativeIntentInput, ProduceOptions } from '../src/producer.js';
import type { CreativeArtifact } from 'creative-artifact-contract/src/artifact/types.js';

const INTENT: CreativeIntentInput = {
  id: 'test-intent-1',
  digest: 'digest-abc',
  belief: 'the anomaly gets flagged before a human ever has to go looking for it',
  feature: 'ai-intelligence',
  ratio: '4:3',
  camera: 'establishing',
  mustInclude: ['the insight card as the sole hero element'],
  contentProvenance: 'test-fixture',
};

const PRODUCE_OPTIONS: ProduceOptions = { client: 'test-client', createdAt: '2026-08-12T00:00:00.000Z' };

function answer(overrides: Partial<VisualProofValidationAnswer>): VisualProofValidationAnswer {
  return Object.freeze({
    q1: true,
    q2: true,
    q3: true,
    q4: true,
    q5: true,
    q6: true,
    passed: true,
    evidence: 'test evidence',
    ...overrides,
  });
}
const PASSED_ANSWER = answer({});
const FAILED_ANSWER = answer({ q4: false, passed: false, evidence: 'Q4: no — too much shown.' });

/** Test-only: dequeues one pre-configured judgment outcome per call; throws if exhausted (a test
 * bug, never a runtime possibility for the real loop). Also records every request it was called
 * with, for call-count and call-argument assertions. */
function queuedJudgment(outcomes: VisualProofValidationOutcome[]): {
  executor: VisualProofJudgmentExecutor;
  calls: VisualProofValidationRequest[];
} {
  const queue = [...outcomes];
  const calls: VisualProofValidationRequest[] = [];
  const executor: VisualProofJudgmentExecutor = async (request) => {
    calls.push(request);
    const next = queue.shift();
    if (!next) throw new Error('queuedJudgment exhausted — test misconfigured');
    return next;
  };
  return { executor, calls };
}

/** Test-only: dequeues one pre-configured revision outcome per call; throws if exhausted. Records
 * every RevisionRequest it was called with. */
function queuedRevision(outcomes: RevisionOutcome[]): {
  executor: VisualProofRevisionExecutor;
  calls: RevisionRequest[];
} {
  const queue = [...outcomes];
  const calls: RevisionRequest[] = [];
  const executor: VisualProofRevisionExecutor = async (request) => {
    calls.push(request);
    const next = queue.shift();
    if (!next) throw new Error('queuedRevision exhausted — test misconfigured');
    return next;
  };
  return { executor, calls };
}

const FAKE_ARTIFACT: CreativeArtifact = {
  contractVersion: 1,
  id: 'test-intent-1',
  intentDigest: 'digest-abc',
  artifactType: 'html',
  location: 'projects/test-client/creative-assets/test-intent-1/visual.html',
  artifactDigest: 'sha256-fake',
  createdAt: '2026-08-12T00:00:00.000Z',
  generation: { sourceSystem: 'creative-generation', generatorVersion: 'v1-deterministic-placeholder', methodologyVersion: 'feature-mapping-v1' },
  approval: { status: 'pending', source: 'creative-generation' },
};

function fakeProduce() {
  return vi.fn((_intent: CreativeIntentInput, _opts: ProduceOptions) => ({ artifact: FAKE_ARTIFACT, html: '<html>fake</html>' }));
}

// ── 1. first-pass success ─────────────────────────────────────────────────────────────────────
describe('runRethinkLoop — first-pass success', () => {
  it('a passing first judgment renders immediately, no revision call', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('PASSED');
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].attempt).toBe(0);
    expect(revision.calls).toHaveLength(0);
    expect(produce).toHaveBeenCalledTimes(1);
    if (result.status === 'PASSED') {
      expect(result.artifact).toEqual(FAKE_ARTIFACT);
      expect(result.html).toBe('<html>fake</html>');
    }
  });
});

// ── 2. fail → revise → pass ───────────────────────────────────────────────────────────────────
describe('runRethinkLoop — fail then revise then pass', () => {
  it('one revision cycle reaches PASSED and renders once', async () => {
    const revisedCandidate: VisualProofValidationRequest = { ...INTENT, camera: 'component', mustInclude: INTENT.mustInclude };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedCandidate, rationale: 'narrowed camera' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('PASSED');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].attempt).toBe(0);
    expect(result.attempts[1].attempt).toBe(1);
    expect(result.attempts[0].revision).toBeDefined();
    expect(produce).toHaveBeenCalledTimes(1);
  });
});

// ── 3. fail → revise → fail → pass ────────────────────────────────────────────────────────────
describe('runRethinkLoop — two revision cycles reaching PASSED', () => {
  it('a second revision cycle also reaches PASSED, within a maxAttempts of 2', async () => {
    const candidateB: VisualProofValidationRequest = { ...INTENT, camera: 'component' };
    const candidateC: VisualProofValidationRequest = { ...INTENT, camera: 'macro' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([
      { outcome: 'revised', candidate: candidateB, rationale: 'first revision' },
      { outcome: 'revised', candidate: candidateC, rationale: 'second revision' },
    ]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
      maxAttempts: 2,
    });
    expect(result.status).toBe('PASSED');
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.map((a) => a.attempt)).toEqual([0, 1, 2]);
  });
});

// ── 4. fail → revision unavailable ────────────────────────────────────────────────────────────
describe('runRethinkLoop — revision unavailable', () => {
  it('an unavailable revision terminates UNAVAILABLE_REVISION, no further judgment', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }]);
    const revision = queuedRevision([{ outcome: 'unavailable', reason: 'claim/copy problem, not camera or components' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('UNAVAILABLE_REVISION');
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].revision).toEqual({ outcome: 'unavailable', reason: 'claim/copy problem, not camera or components' });
    expect(judgment.calls).toHaveLength(1);
    expect(produce).not.toHaveBeenCalled();
  });
});

// ── 5. fail → no progress ─────────────────────────────────────────────────────────────────────
describe('runRethinkLoop — no progress', () => {
  it('a revised candidate structurally identical to the prior request terminates NO_PROGRESS', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }]);
    const initialLikeRequest: VisualProofValidationRequest = {
      belief: INTENT.belief,
      feature: INTENT.feature,
      mustInclude: [...INTENT.mustInclude],
      camera: 'establishing',
      components: ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'],
    };
    const revision = queuedRevision([{ outcome: 'revised', candidate: initialLikeRequest, rationale: 'no-op' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('NO_PROGRESS');
    expect(judgment.calls).toHaveLength(1);
    expect(produce).not.toHaveBeenCalled();
  });
});

// ── Sprint 10AE — environment as a sixth structural-equality field / initial environment wiring ─
describe('runRethinkLoop — environment dimension (Sprint 10AE)', () => {
  it('initialEnvironment flows into the very first judgment request', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: (async () => {
        throw new Error('should not be called — first attempt passes');
      }) as unknown as VisualProofRevisionExecutor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialEnvironment: 'dawn-haze',
    });
    expect(judgment.calls[0].environment).toBe('dawn-haze');
  });

  it('with no initialEnvironment, the first judgment request carries no environment field', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: (async () => {
        throw new Error('should not be called');
      }) as unknown as VisualProofRevisionExecutor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(judgment.calls[0].environment).toBeUndefined();
  });

  it('eligibleEnvironments flows through into every RevisionRequest built by the loop', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'macro' }, rationale: 'x' }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      eligibleEnvironments: ['dawn-haze', 'valley-deep'],
    });
    expect(revision.calls[0].eligibleCandidates).toEqual(['dawn-haze', 'valley-deep']);
  });

  it('an environment-only revision (identical belief/feature/mustInclude/camera/components) is NOT NO_PROGRESS', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revisedWithNewEnvironment: VisualProofValidationRequest = {
      belief: INTENT.belief,
      feature: INTENT.feature,
      mustInclude: [...INTENT.mustInclude],
      camera: 'establishing',
      components: ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'],
      environment: 'valley-deep',
    };
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedWithNewEnvironment, rationale: 'new environment' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialEnvironment: 'dawn-haze',
      eligibleEnvironments: ['dawn-haze', 'valley-deep'],
    });
    expect(result.status).not.toBe('NO_PROGRESS');
    expect(judgment.calls).toHaveLength(2);
    expect(judgment.calls[1].environment).toBe('valley-deep');
  });

  it('a revision proposing the SAME environment as the prior request (plus nothing else changed) still terminates NO_PROGRESS', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }]);
    const sameEnvironmentCandidate: VisualProofValidationRequest = {
      belief: INTENT.belief,
      feature: INTENT.feature,
      mustInclude: [...INTENT.mustInclude],
      camera: 'establishing',
      components: ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'],
      environment: 'dawn-haze',
    };
    const revision = queuedRevision([{ outcome: 'revised', candidate: sameEnvironmentCandidate, rationale: 'no-op' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialEnvironment: 'dawn-haze',
      eligibleEnvironments: ['dawn-haze', 'valley-deep'],
    });
    expect(result.status).toBe('NO_PROGRESS');
  });
});

describe('runRethinkLoop — roles dimension (Sprint 10AG)', () => {
  const AI_INTELLIGENCE_COMPONENTS = ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'];
  const INITIAL_ROLES = {
    hero: 'insight card',
    support: ['recommendation panel'],
    signal: ['AI summary'],
    subordinateContext: ['confidence score'],
    unassigned: ['suggested actions'],
  };

  it('initialRoles flows into the very first judgment request', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: (async () => {
        throw new Error('should not be called — first attempt passes');
      }) as unknown as VisualProofRevisionExecutor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialRoles: INITIAL_ROLES,
    });
    expect(judgment.calls[0].roles?.hero).toBe('insight card');
  });

  it('with no initialRoles, the first judgment request carries no roles field', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: (async () => {
        throw new Error('should not be called');
      }) as unknown as VisualProofRevisionExecutor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(judgment.calls[0].roles).toBeUndefined();
  });

  it('a roles-only revision (identical belief/feature/mustInclude/camera/components/environment) is NOT NO_PROGRESS', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revisedWithNewRoles: VisualProofValidationRequest = {
      belief: INTENT.belief,
      feature: INTENT.feature,
      mustInclude: [...INTENT.mustInclude],
      camera: 'establishing',
      components: AI_INTELLIGENCE_COMPONENTS,
      roles: { ...INITIAL_ROLES, hero: 'recommendation panel', support: ['insight card'] },
    };
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedWithNewRoles, rationale: 'reassigned hero' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialRoles: INITIAL_ROLES,
    });
    expect(result.status).not.toBe('NO_PROGRESS');
    expect(judgment.calls).toHaveLength(2);
    expect(judgment.calls[1].roles?.hero).toBe('recommendation panel');
  });

  it('a revision proposing the SAME role assignment as the prior request still terminates NO_PROGRESS', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }]);
    const sameRolesCandidate: VisualProofValidationRequest = {
      belief: INTENT.belief,
      feature: INTENT.feature,
      mustInclude: [...INTENT.mustInclude],
      camera: 'establishing',
      components: AI_INTELLIGENCE_COMPONENTS,
      roles: INITIAL_ROLES,
    };
    const revision = queuedRevision([{ outcome: 'revised', candidate: sameRolesCandidate, rationale: 'no-op' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      initialRoles: INITIAL_ROLES,
    });
    expect(result.status).toBe('NO_PROGRESS');
  });
});

// ── 6. fail → retry exhausted ─────────────────────────────────────────────────────────────────
describe('runRethinkLoop — retry exhausted', () => {
  it('with maxAttempts=1, a second failure after one revision terminates FAILED_RETRY_EXHAUSTED', async () => {
    const candidateB: VisualProofValidationRequest = { ...INTENT, camera: 'component' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: FAILED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: candidateB, rationale: 'attempt 1' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      maxAttempts: 1,
    });
    expect(result.status).toBe('FAILED_RETRY_EXHAUSTED');
    expect(result.attempts).toHaveLength(2);
    expect(revision.calls).toHaveLength(1);
    expect(produce).not.toHaveBeenCalled();
  });
});

// ── 7. unavailable judgment on attempt 0 ──────────────────────────────────────────────────────
describe('runRethinkLoop — unavailable judgment on the very first attempt', () => {
  it('terminates UNAVAILABLE_JUDGMENT, revision executor never called', async () => {
    const judgment = queuedJudgment([{ outcome: 'unavailable', reason: 'insufficient_context: Q5/Q6 not provided' }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('UNAVAILABLE_JUDGMENT');
    expect(result.attempts).toHaveLength(1);
    expect(revision.calls).toHaveLength(0);
    expect(produce).not.toHaveBeenCalled();
  });
});

// ── 8. unavailable judgment after a revision ──────────────────────────────────────────────────
describe('runRethinkLoop — unavailable judgment after a successful revision', () => {
  it('the revised candidate can itself become unavailable at judgment time', async () => {
    const candidateB: VisualProofValidationRequest = { ...INTENT, camera: 'component' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'unavailable', reason: 'judge declined on the revised candidate' },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: candidateB, rationale: 'attempt 1' }]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(result.status).toBe('UNAVAILABLE_JUDGMENT');
    expect(result.attempts).toHaveLength(2);
  });
});

// ── 9/10/11. producer call discipline ─────────────────────────────────────────────────────────
describe('runRethinkLoop — producer call discipline', () => {
  it('producer is called exactly once on the final pass, never more', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r' }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('producer is never called when every attempt fails and the bound is reached', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }, { outcome: 'judged', answer: FAILED_ANSWER }]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r' }]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      maxAttempts: 1,
    });
    expect(produce).not.toHaveBeenCalled();
  });

  it('producer is never called when judgment is unavailable', async () => {
    const judgment = queuedJudgment([{ outcome: 'unavailable', reason: 'x' }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(produce).not.toHaveBeenCalled();
  });
});

// ── 12. original CreativeIntent remains unchanged ─────────────────────────────────────────────
describe('runRethinkLoop — CreativeIntent immutability', () => {
  it('the original intent object is byte-identical after a full fail → revise → pass cycle', async () => {
    const before = JSON.stringify(INTENT);
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r' }]);
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(JSON.stringify(INTENT)).toBe(before);
  });
});

// ── 13. prior answers remain preserved ────────────────────────────────────────────────────────
describe('runRethinkLoop — prior answers remain preserved in the trace', () => {
  it('attempt 0\'s failed answer is still intact in the final result, not overwritten by attempt 1', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r' }]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    const attempt0 = result.attempts[0];
    expect(attempt0.judgment).toEqual({ outcome: 'judged', answer: FAILED_ANSWER });
  });
});

// ── 14. every attempt gets a unique trace entry ───────────────────────────────────────────────
describe('runRethinkLoop — unique, sequential attempt numbering', () => {
  it('attempt numbers are 0, 1, 2 across three judged candidates with no gaps or repeats', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([
      { outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r1' },
      { outcome: 'revised', candidate: { ...INTENT, camera: 'macro' }, rationale: 'r2' },
    ]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
      maxAttempts: 2,
    });
    expect(result.attempts.map((a) => a.attempt)).toEqual([0, 1, 2]);
    expect(new Set(result.attempts.map((a) => a.attempt)).size).toBe(3);
  });
});

// ── 15. revised request is used for re-judgment ───────────────────────────────────────────────
describe('runRethinkLoop — the revised candidate drives the next judgment call', () => {
  it('the second judgment call receives exactly the revised candidate, not the original request', async () => {
    const revisedCandidate: VisualProofValidationRequest = { ...INTENT, camera: 'macro' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedCandidate, rationale: 'r' }]);
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(judgment.calls[1].camera).toBe('macro');
    expect(judgment.calls[1]).toEqual(revisedCandidate);
  });
});

// ── 16. stale prior answer is never reused ────────────────────────────────────────────────────
describe('runRethinkLoop — the revision request always carries the LATEST judgment, never a stale one', () => {
  it('the second RevisionRequest carries attempt 1\'s failed answer, not attempt 0\'s', async () => {
    const failedAnswerAttempt0 = answer({ q4: false, passed: false, evidence: 'attempt 0 evidence' });
    const failedAnswerAttempt1 = answer({ q3: false, passed: false, evidence: 'attempt 1 evidence' });
    const candidateB: VisualProofValidationRequest = { ...INTENT, camera: 'component' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: failedAnswerAttempt0 },
      { outcome: 'judged', answer: failedAnswerAttempt1 },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([
      { outcome: 'revised', candidate: candidateB, rationale: 'r1' },
      { outcome: 'revised', candidate: { ...candidateB, camera: 'macro' }, rationale: 'r2' },
    ]);
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
      maxAttempts: 2,
    });
    expect(revision.calls[0].priorAnswer.evidence).toBe('attempt 0 evidence');
    expect(revision.calls[1].priorAnswer.evidence).toBe('attempt 1 evidence');
  });
});

// ── 17. retry bound is respected ──────────────────────────────────────────────────────────────
describe('runRethinkLoop — retry bound', () => {
  it('maxAttempts=0 exhausts immediately on the first failure, revision executor never called', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: FAILED_ANSWER }]);
    const revision = queuedRevision([]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
      maxAttempts: 0,
    });
    expect(result.status).toBe('FAILED_RETRY_EXHAUSTED');
    expect(revision.calls).toHaveLength(0);
  });

  it('the default bound is used when maxAttempts is omitted', () => {
    expect(DEFAULT_MAX_REVISION_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(typeof DEFAULT_MAX_REVISION_ATTEMPTS).toBe('number');
  });
});

// ── 18. no-progress detector works (and does not false-positive on a real change) ────────────
describe('runRethinkLoop — no-progress detector correctness', () => {
  it('a components-only change is NOT treated as no-progress', async () => {
    const revisedCandidate: VisualProofValidationRequest = {
      ...INTENT,
      camera: 'establishing',
      components: ['insight card', 'suggested actions'],
    };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedCandidate, rationale: 'trimmed components' }]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(result.status).toBe('PASSED');
  });
});

// ── 19. scripted revision executor (Sprint 10Q) drives the loop directly ─────────────────────
describe('runRethinkLoop — compatible with the real createScriptedRevisionExecutor (Sprint 10Q)', () => {
  it('the unmodified Sprint 10Q scripted stub can drive a fail → revise → pass cycle', async () => {
    const candidateB: VisualProofValidationRequest = { ...INTENT, camera: 'component' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revisionExecutor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: candidateB, rationale: 'stub' });
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(result.status).toBe('PASSED');
  });
});

// ── 20. scripted judgment executor (Sprint 10F/10L judgedFrom) drives the loop directly ──────
describe('runRethinkLoop — compatible with the real createScriptedStubExecutor + judgedFrom (Sprint 10F/10L)', () => {
  it('the unmodified scripted judgment stub, wrapped via judgedFrom, drives a first-pass PASSED', async () => {
    const stub = createScriptedStubExecutor({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true });
    const judgmentExecutor = judgedFrom(stub);
    const revision = queuedRevision([]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(result.status).toBe('PASSED');
  });
});

// ── final render uses the revised camera; components-drift is observable ─────────────────────
describe('runRethinkLoop — render reflects the revised camera; components drift is observable, not fabricated', () => {
  it('the finalRequest carries the revised camera that led to PASSED', async () => {
    const revisedCandidate: VisualProofValidationRequest = { ...INTENT, camera: 'macro' };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedCandidate, rationale: 'r' }]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.finalRequest.camera).toBe('macro');
    expect(produce.mock.calls[0][0].camera).toBe('macro');
  });

  it('a components-narrowing revision that reaches PASSED reports componentsFullyReflectedInRender=false — the producer cannot represent a trimmed component list, and this loop does not pretend otherwise', async () => {
    const revisedCandidate: VisualProofValidationRequest = {
      ...INTENT,
      camera: 'establishing',
      components: ['insight card'],
    };
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: revisedCandidate, rationale: 'r' }]);
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
    });
    expect(result.status).toBe('PASSED');
    if (result.status === 'PASSED') {
      expect(result.componentsFullyReflectedInRender).toBe(false);
    }
  });
});

// ── event stream ───────────────────────────────────────────────────────────────────────────────
describe('runRethinkLoop — event stream', () => {
  it('emits judged/failed-retry-available/revising/revised/passed events in order for a fail→revise→pass run', async () => {
    const judgment = queuedJudgment([
      { outcome: 'judged', answer: FAILED_ANSWER },
      { outcome: 'judged', answer: PASSED_ANSWER },
    ]);
    const revision = queuedRevision([{ outcome: 'revised', candidate: { ...INTENT, camera: 'component' }, rationale: 'r' }]);
    const events: RethinkLoopEvent['kind'][] = [];
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce: fakeProduce(),
      onEvent: (e) => events.push(e.kind),
    });
    expect(events).toEqual(['judged', 'failed-retry-available', 'revising', 'revised', 'judged', 'passed', 'rendering']);
  });
});

// ── isolation ──────────────────────────────────────────────────────────────────────────────────
// ── Creative Authoring Layer seam ─────────────────────────────────────────────────────────────
describe('runRethinkLoop — authoringExecutor seam', () => {
  it('absent authoringExecutor: behavior is unchanged — the deterministic placeholder path is used', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
    });
    expect(result.status).toBe('PASSED');
    expect(produce).toHaveBeenCalledTimes(1);
    const [, calledOpts] = produce.mock.calls[0];
    expect(calledOpts.render).toBeUndefined();
    expect(calledOpts.generatorVersion).toBeUndefined();
  });

  it('a passed judgment with a real authoringExecutor renders via the authored HTML, tagged with the authoring generator version', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const authoringExecutor: CreativeAuthoringExecutor = vi.fn(async () => ({
      outcome: 'authored' as const,
      html: '<html>authored-composition</html>',
      evidence: 'test',
    }));
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      authoringExecutor,
    });
    expect(result.status).toBe('PASSED');
    expect(authoringExecutor).toHaveBeenCalledTimes(1);
    const authoringRequest = (authoringExecutor as ReturnType<typeof vi.fn>).mock.calls[0][0] as CreativeAuthoringRequest;
    expect(authoringRequest.belief).toBe(INTENT.belief);
    expect(authoringRequest.feature).toBe(INTENT.feature);
    expect(authoringRequest.ratio).toBe(INTENT.ratio);

    expect(produce).toHaveBeenCalledTimes(1);
    const [, calledOpts] = produce.mock.calls[0];
    expect(calledOpts.generatorVersion).toBe(CREATIVE_AUTHORING_GENERATOR_VERSION);
    expect(calledOpts.render!(INTENT)).toBe('<html>authored-composition</html>');
  });

  it('authoring unavailable becomes UNAVAILABLE_AUTHORING — never a silent fallback to the placeholder render', async () => {
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const authoringExecutor: CreativeAuthoringExecutor = async () => ({
      outcome: 'unavailable',
      reason: 'structurally invalid response',
    });
    const result = await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      authoringExecutor,
    });
    expect(result.status).toBe('UNAVAILABLE_AUTHORING');
    expect(produce).not.toHaveBeenCalled();
    expect('artifact' in result).toBe(false);
  });

  it('threads the real environment and role assignment into the authoring request', async () => {
    const roles = {
      hero: 'insight card',
      support: [] as string[],
      signal: [] as string[],
      subordinateContext: [] as string[],
      unassigned: [] as string[],
    };
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const authoringExecutor: CreativeAuthoringExecutor = vi.fn(async () => ({
      outcome: 'authored' as const,
      html: '<html>x</html>',
      evidence: 'test',
    }));
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      authoringExecutor,
      initialEnvironment: 'dawn-haze',
      initialRoles: roles,
    });
    const authoringRequest = (authoringExecutor as ReturnType<typeof vi.fn>).mock.calls[0][0] as CreativeAuthoringRequest;
    expect(authoringRequest.environment).toBe('dawn-haze');
    expect(authoringRequest.roles).toEqual(roles);
  });

  it('threads the real target canvas geometry (from CreativeIntent.ratio, via dimensionsForRatio) into the authoring request', async () => {
    // INTENT.ratio is '4:3' — dimensionsForRatio('4:3') = [480, 360] (producer.ts's own real,
    // unmodified ratio->pixel table). Never a hardcoded/assumed default canvas.
    const judgment = queuedJudgment([{ outcome: 'judged', answer: PASSED_ANSWER }]);
    const revision = queuedRevision([]);
    const produce = fakeProduce();
    const authoringExecutor: CreativeAuthoringExecutor = vi.fn(async () => ({
      outcome: 'authored' as const,
      html: '<html>x</html>',
      evidence: 'test',
    }));
    await runRethinkLoop(INTENT, {
      judgmentExecutor: judgment.executor,
      revisionExecutor: revision.executor,
      produceOptions: PRODUCE_OPTIONS,
      produce,
      authoringExecutor,
    });
    const authoringRequest = (authoringExecutor as ReturnType<typeof vi.fn>).mock.calls[0][0] as CreativeAuthoringRequest;
    expect(authoringRequest.canvasWidth).toBe(480);
    expect(authoringRequest.canvasHeight).toBe(360);
  });
});

describe('isolation — no offscript/src, no reauthor-loop, no Finding, no producer/orchestrator edits', () => {
  it('the module has zero dependency on offscript/src/ or reauthor-loop.ts (prose mentions in comments, explaining what is NOT reused, are fine — only an actual import is not)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/visual-proof-rethink-loop.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
    expect(src).not.toMatch(/from\s+['"].*src\/generate/);
    expect(src).not.toMatch(/from\s+['"].*reauthor-loop/);
    expect(src).not.toMatch(/from\s+['"].*authoring-seam/);
    expect(src).not.toMatch(/import\s*\{[^}]*\bFinding\b[^}]*\}/);
  });

  it('the module never imports CreativeIntent (the exporter type) or the Decision Record', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/visual-proof-rethink-loop.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/import[^;]*CreativeIntentInput\b.*from\s+['"](?!\.\/producer)/);
    expect(src).not.toMatch(/DecisionRecord/);
  });
});
