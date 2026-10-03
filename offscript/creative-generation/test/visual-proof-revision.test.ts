/**
 * Sprint 10Q — the Visual Proof revision contract + scripted stub.
 *
 * Every test in this file exercises TRANSPORT, not semantics: `createScriptedRevisionExecutor`
 * never inspects request content and never claims a real revision was reasoned about — it is the
 * direct sibling of `createScriptedStubExecutor` (visual-proof-validation.ts, Sprint 10F), proving
 * the RevisionRequest -> VisualProofRevisionExecutor -> RevisionOutcome plumbing works end to end
 * with zero semantic reasoning. No real revision executor, LLM, or heuristic exists anywhere in
 * this file or the module it tests (Sprint 10P's own design report is explicit that this is a
 * separately-scoped, later sprint).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createScriptedRevisionExecutor,
  type RevisionRequest,
  type RevisionOutcome,
  type VisualProofRevisionExecutor,
} from '../src/visual-proof-revision.js';
import type { VisualProofValidationRequest, VisualProofValidationAnswer } from '../src/visual-proof-validation.js';

const PRIOR_REQUEST: VisualProofValidationRequest = {
  belief: 'the exception surfaces itself before anyone has to go looking',
  feature: 'ai-intelligence',
  mustInclude: ['the triage queue as the hero element'],
  camera: 'establishing',
  components: ['triage queue list', 'severity badge', 'assignee avatar', 'resolve button'],
};

const PRIOR_ANSWER: VisualProofValidationAnswer = Object.freeze({
  q1: true,
  q2: true,
  q3: true,
  q4: false,
  q5: true,
  q6: true,
  passed: false,
  evidence: 'Q4: no — too much shown; move the camera closer or cut a component.',
});

// ── Sprint 10AE — optional eligibleCandidates field ─────────────────────────────────────────────
describe('RevisionRequest — optional eligibleCandidates field', () => {
  it('accepts a real EnvironmentSlug[] on eligibleCandidates', async () => {
    const request: RevisionRequest = {
      priorRequest: PRIOR_REQUEST,
      priorAnswer: PRIOR_ANSWER,
      attempt: 1,
      eligibleCandidates: ['dawn-haze', 'valley-deep'],
    };
    const executor = createScriptedRevisionExecutor({
      outcome: 'revised',
      candidate: { ...PRIOR_REQUEST, camera: 'macro' },
      rationale: 'test',
    });
    const outcome = await executor(request);
    expect(outcome.outcome).toBe('revised');
  });

  it('the field remains optional — a request with no eligibleCandidates is still well-formed', async () => {
    const request: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 };
    const executor = createScriptedRevisionExecutor({
      outcome: 'revised',
      candidate: { ...PRIOR_REQUEST, camera: 'macro' },
      rationale: 'test',
    });
    const outcome = await executor(request);
    expect(outcome.outcome).toBe('revised');
  });

  it('imports EnvironmentSlug from environment-library.ts rather than redeclaring the vocabulary', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).toMatch(/from\s+['"]\.\/environment-library\.js['"]/);
  });
});

const REVISED_CANDIDATE: VisualProofValidationRequest = {
  ...PRIOR_REQUEST,
  camera: 'macro',
};

// ── 1-4. RevisionRequest shape ──────────────────────────────────────────────────────────────────
describe('RevisionRequest — shape', () => {
  it('accepts priorRequest + priorAnswer + attempt', () => {
    const req: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 };
    expect(req.priorRequest).toBe(PRIOR_REQUEST);
    expect(req.priorAnswer).toBe(PRIOR_ANSWER);
    expect(req.attempt).toBe(1);
  });

  it('preserves the prior request without mutation', () => {
    const before = JSON.stringify(PRIOR_REQUEST);
    const req: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 };
    void req;
    expect(JSON.stringify(PRIOR_REQUEST)).toBe(before);
    expect(req.priorRequest).toEqual(PRIOR_REQUEST);
  });

  it('preserves the complete prior q1-q6 answer, not a reduced failedQuestions subset', () => {
    const req: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 };
    expect(req.priorAnswer.q1).toBe(true);
    expect(req.priorAnswer.q2).toBe(true);
    expect(req.priorAnswer.q3).toBe(true);
    expect(req.priorAnswer.q4).toBe(false);
    expect(req.priorAnswer.q5).toBe(true);
    expect(req.priorAnswer.q6).toBe(true);
    expect(req.priorAnswer.passed).toBe(false);
    expect(req.priorAnswer.evidence).toBe(PRIOR_ANSWER.evidence);
  });

  it('attempt is represented explicitly as a number, on every constructed RevisionRequest', () => {
    const req: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 2 };
    expect(typeof req.attempt).toBe('number');
    expect(req.attempt).toBe(2);
  });
});

// ── 5-7. RevisionOutcome shape ──────────────────────────────────────────────────────────────────
describe('RevisionOutcome — shape', () => {
  it('supports a "revised" outcome', () => {
    const outcome: RevisionOutcome = { outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' };
    expect(outcome.outcome).toBe('revised');
  });

  it('supports an "unavailable" outcome', () => {
    const outcome: RevisionOutcome = { outcome: 'unavailable', reason: 'test reason' };
    expect(outcome.outcome).toBe('unavailable');
  });

  it('a revised outcome contains a complete VisualProofValidationRequest', () => {
    const outcome: RevisionOutcome = { outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' };
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.belief).toBe(REVISED_CANDIDATE.belief);
      expect(outcome.candidate.feature).toBe(REVISED_CANDIDATE.feature);
      expect(outcome.candidate.mustInclude).toEqual(REVISED_CANDIDATE.mustInclude);
      expect(outcome.candidate.camera).toBe('macro');
    }
  });

  it('an unavailable outcome contains a non-empty, machine-readable reason', () => {
    const outcome: RevisionOutcome = { outcome: 'unavailable', reason: 'insufficient_context: cannot revise without a known camera candidate' };
    if (outcome.outcome === 'unavailable') {
      expect(typeof outcome.reason).toBe('string');
      expect(outcome.reason.length).toBeGreaterThan(0);
    }
  });

  it('does not allow a bare Promise<VisualProofValidationRequest> — the outcome wrapper is required', () => {
    // Type-level guarantee, exercised at compile time: an executor MUST resolve RevisionOutcome, not
    // a bare request. This test documents the invariant by constructing only via the outcome shape.
    const executor: VisualProofRevisionExecutor = async () => ({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    expect(typeof executor).toBe('function');
  });
});

// ── 8-12. Scripted executor mechanics ───────────────────────────────────────────────────────────
describe('createScriptedRevisionExecutor — transport mechanics', () => {
  it('is async — always returns a Promise', () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    const result = executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    expect(result).toBeInstanceOf(Promise);
  });

  it('is deterministic — the same configured outcome is returned across repeated calls', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    const req: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 };
    const a = await executor(req);
    const b = await executor(req);
    expect(a).toEqual(b);
  });

  it('NEVER performs semantic reasoning — the same configured outcome is returned regardless of request content', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'fixed' });
    const wildlyDifferentRequest: RevisionRequest = {
      priorRequest: {
        belief: 'a completely different claim about a completely different feature',
        feature: 'security',
        mustInclude: ['something else entirely'],
        camera: 'macro',
        components: ['a', 'b', 'c', 'd', 'e'],
      },
      priorAnswer: {
        q1: false,
        q2: false,
        q3: false,
        q4: false,
        q5: false,
        q6: false,
        passed: false,
        evidence: 'everything failed for entirely different reasons',
      },
      attempt: 7,
    };
    const a = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    const b = await executor(wildlyDifferentRequest);
    expect(a).toEqual(b);
  });

  it('returns the caller-supplied revised request verbatim', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'caller-controlled' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate).toEqual(REVISED_CANDIDATE);
      expect(outcome.rationale).toBe('caller-controlled');
    }
  });

  it('returns the caller-supplied unavailable reason verbatim', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'unavailable', reason: 'no source-grounded remedy for this failure' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toBe('no source-grounded remedy for this failure');
    }
  });
});

// ── 13-14. Immutability ─────────────────────────────────────────────────────────────────────────
describe('immutability', () => {
  it('the original request object is untouched after being embedded in a RevisionRequest and passed through the executor', async () => {
    const requestCopy = { ...PRIOR_REQUEST, mustInclude: [...PRIOR_REQUEST.mustInclude], components: [...(PRIOR_REQUEST.components ?? [])] };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    await executor({ priorRequest: requestCopy, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    expect(requestCopy).toEqual(PRIOR_REQUEST);
  });

  it('the original answer object is untouched after being embedded in a RevisionRequest and passed through the executor', async () => {
    const answerCopy = { ...PRIOR_ANSWER };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: answerCopy, attempt: 1 });
    expect(answerCopy).toEqual(PRIOR_ANSWER);
  });

  it('the revised candidate is a distinct object from the prior request, not the same reference', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate).not.toBe(PRIOR_REQUEST);
    }
  });
});

// ── 5 (Phase 5) — actionable dimension cases ────────────────────────────────────────────────────
describe('actionable revision dimensions — camera and/or components, belief/feature/mustInclude preserved', () => {
  it('Case A — camera changed, components unchanged', async () => {
    const candidate: VisualProofValidationRequest = { ...PRIOR_REQUEST, camera: 'macro' };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate, rationale: 'camera only' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('macro');
      expect(outcome.candidate.components).toEqual(PRIOR_REQUEST.components);
      expect(outcome.candidate.belief).toBe(PRIOR_REQUEST.belief);
      expect(outcome.candidate.feature).toBe(PRIOR_REQUEST.feature);
      expect(outcome.candidate.mustInclude).toEqual(PRIOR_REQUEST.mustInclude);
    }
  });

  it('Case B — components changed, camera unchanged', async () => {
    const candidate: VisualProofValidationRequest = { ...PRIOR_REQUEST, components: ['triage queue list', 'severity badge'] };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate, rationale: 'components only' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.components).toEqual(['triage queue list', 'severity badge']);
      expect(outcome.candidate.camera).toBe(PRIOR_REQUEST.camera);
      expect(outcome.candidate.belief).toBe(PRIOR_REQUEST.belief);
      expect(outcome.candidate.feature).toBe(PRIOR_REQUEST.feature);
      expect(outcome.candidate.mustInclude).toEqual(PRIOR_REQUEST.mustInclude);
    }
  });

  it('Case C — camera and components both changed', async () => {
    const candidate: VisualProofValidationRequest = { ...PRIOR_REQUEST, camera: 'component', components: ['resolve button'] };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate, rationale: 'both' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('component');
      expect(outcome.candidate.components).toEqual(['resolve button']);
      expect(outcome.candidate.belief).toBe(PRIOR_REQUEST.belief);
      expect(outcome.candidate.feature).toBe(PRIOR_REQUEST.feature);
      expect(outcome.candidate.mustInclude).toEqual(PRIOR_REQUEST.mustInclude);
    }
  });

  it('Case D — no-op revised candidate (transport-only; not semantically meaningful)', async () => {
    const candidate: VisualProofValidationRequest = { ...PRIOR_REQUEST };
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate, rationale: 'no-op, transport proof only' });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt: 1 });
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate).toEqual(PRIOR_REQUEST);
    }
  });
});

// ── Phase 6 — attempt semantics, no bound enforced ─────────────────────────────────────────────
describe('attempt semantics — no maximum enforced by the contract', () => {
  it('accepts attempt 0, 1, 2, and higher without imposing a policy', async () => {
    const executor = createScriptedRevisionExecutor({ outcome: 'revised', candidate: REVISED_CANDIDATE, rationale: 'test' });
    for (const attempt of [0, 1, 2, 5, 100]) {
      const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER, attempt });
      expect(outcome.outcome).toBe('revised');
    }
  });

  it('the module defines no MAX_PASSES or retry-bound constant', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/MAX_PASSES/);
    expect(src).not.toMatch(/maxAttempts/i);
    expect(src).not.toMatch(/retryLimit/i);
  });
});

// ── Phase 15/16 — no CreativeIntent/CreativeArtifact requirement ──────────────────────────────
describe('the revision contract requires neither CreativeIntent nor CreativeArtifact', () => {
  it('the module source imports neither CreativeIntent nor CreativeArtifact types (prose mentions in comments are fine; imports/usages are not)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/import[^;]*CreativeIntent/);
    expect(src).not.toMatch(/import[^;]*CreativeArtifact/);
    expect(src).not.toMatch(/:\s*CreativeIntent\b/);
    expect(src).not.toMatch(/:\s*CreativeArtifact\b/);
  });
});

// ── Phase 9/17/18 — isolation ───────────────────────────────────────────────────────────────────
describe('isolation — no offscript/src, no Website Generation, no reauthor-loop, no Finding, no target enum', () => {
  it('the module has zero dependency on offscript/src/ (Website Generation)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
    expect(src).not.toMatch(/from\s+['"].*src\/generate/);
    expect(src).not.toMatch(/authoring-seam/);
    expect(src).not.toMatch(/reauthor-loop/);
  });

  it('the module does not import or reference the rail Finding type', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/\bFinding\b/);
  });

  it('the module defines no revision-target enum or closed remedy vocabulary', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/RevisionTarget/);
    expect(src).not.toMatch(/revisionTarget/);
    expect(src).not.toMatch(/'move-camera'|"move-camera"/);
    expect(src).not.toMatch(/'cut-component'|"cut-component"/);
  });

  it('the module imports only from within creative-generation (visual-proof-validation.js), never producer.ts or the orchestrator', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/visual-proof-revision.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/producer\.js['"]/);
    expect(src).not.toMatch(/from\s+['"]\.\/visual-proof-orchestrator\.js['"]/);
  });
});
