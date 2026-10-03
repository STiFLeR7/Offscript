/**
 * Sprint 10R — the real Visual Proof revision executor.
 *
 * Every test in this file uses a DETERMINISTIC MOCKED dispatch — a fake `JudgmentDispatch`
 * returning a fixed raw string, or throwing, or delaying. None of these tests claim that any
 * particular camera/component revision is "correct" for a given failure — they only prove the
 * executor's OWN mechanics: prompt construction, dispatch invocation, timeout handling, strict
 * parsing, the allow-list rejection of invented fields, camera/component vocabulary validation, and
 * the revised/unavailable distinction. A genuine semantic revision (the real model reasoning about
 * an actual failed judgment) is exercised separately, outside this unit-test file, by
 * `offscript/scripts/_sprint10r-real-revision-run.ts` and reported in
 * `.experiments/2026-08-12-creative-generation-renderer-readiness/REAL-REVISION-EXECUTOR-IMPLEMENTATION-REPORT.md`.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import {
  createRealRevisionExecutor,
  buildRevisionPrompt,
  parseRevisionResponse,
  VISUAL_PROOF_REVISION_LLM_EXECUTOR,
  type JudgmentDispatch,
} from '../src/visual-proof-revision-executor.js';
import { createScriptedRevisionExecutor, type RevisionRequest } from '../src/visual-proof-revision.js';
import type { VisualProofValidationRequest, VisualProofValidationAnswer } from '../src/visual-proof-validation.js';

const PRIOR_REQUEST: VisualProofValidationRequest = {
  belief: 'the exception surfaces itself before anyone has to go looking',
  feature: 'ai-intelligence',
  mustInclude: ['the triage queue as the hero element'],
  camera: 'establishing',
  components: ['insight card', 'recommendation panel', 'AI summary', 'confidence score', 'suggested actions'],
};

const PRIOR_ANSWER_Q4_FAIL: VisualProofValidationAnswer = Object.freeze({
  q1: true,
  q2: true,
  q3: true,
  q4: false,
  q5: true,
  q6: true,
  passed: false,
  evidence: 'Q4: no — too much shown at 40% crop; move the camera closer or cut a component.',
});

const PRIOR_ANSWER_Q3_FAIL: VisualProofValidationAnswer = Object.freeze({
  q1: true,
  q2: true,
  q3: false,
  q4: true,
  q5: true,
  q6: true,
  passed: false,
  evidence: 'Q3: no — "confidence score" does not support the exception-surfacing claim.',
});

const REQUEST_Q4: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER_Q4_FAIL, attempt: 1 };
const REQUEST_Q3: RevisionRequest = { priorRequest: PRIOR_REQUEST, priorAnswer: PRIOR_ANSWER_Q3_FAIL, attempt: 1 };

// ── Deterministic mocked dispatch fixtures ─────────────────────────────────────────────────────
function fixedDispatch(response: string): JudgmentDispatch {
  return async () => response;
}
function throwingDispatch(message: string): JudgmentDispatch {
  return async () => {
    throw new Error(message);
  };
}
function delayedDispatch(response: string, delayMs: number): JudgmentDispatch {
  return () => new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}

const VALID_CAMERA_RAW = JSON.stringify({
  status: 'revised',
  camera: 'macro',
  evidence: 'Narrowing to macro isolates the insight card so it reads clearly at 40% crop.',
});
const VALID_COMPONENTS_RAW = JSON.stringify({
  status: 'revised',
  components: ['insight card', 'recommendation panel', 'AI summary', 'suggested actions'],
  evidence: 'Dropping "confidence score" — it does not support the exception-surfacing claim.',
});
const VALID_BOTH_RAW = JSON.stringify({
  status: 'revised',
  camera: 'component',
  components: ['insight card', 'suggested actions'],
  evidence: 'Isolating the insight card and its action removes the unrelated components at once.',
});
const UNAVAILABLE_RAW = JSON.stringify({
  status: 'unavailable',
  reason: 'the failure is about the underlying claim, not the camera or component selection',
});
const MALFORMED_JSON = '{this is not valid json,,,';
const UNSUPPORTED_COMPONENT_RAW = JSON.stringify({
  status: 'revised',
  components: ['insight card', 'live cursor avatars'],
  evidence: 'x',
});
const INVALID_CAMERA_RAW = JSON.stringify({ status: 'revised', camera: 'closeup', evidence: 'x' });
const AMBIGUOUS_CAMERA_RAW = JSON.stringify({ status: 'revised', camera: 'probably macro', evidence: 'x' });
const INVENTED_ROLE_RAW = JSON.stringify({ status: 'revised', camera: 'macro', role: 'hero', evidence: 'x' });
const INVENTED_ENV_RAW = JSON.stringify({ status: 'revised', camera: 'macro', environment: 'desk with laptop', evidence: 'x' });
const INVENTED_MATERIAL_RAW = JSON.stringify({ status: 'revised', camera: 'macro', material: 'brushed aluminum', evidence: 'x' });
const INVENTED_SURFACE_RAW = JSON.stringify({ status: 'revised', camera: 'macro', surfaces: 2, evidence: 'x' });
const EMPTY_REVISION_RAW = JSON.stringify({ status: 'revised', evidence: 'nothing actually changed' });
const MISSING_EVIDENCE_RAW = JSON.stringify({ status: 'revised', camera: 'macro' });
const NOT_AN_OBJECT_RAW = JSON.stringify(['status', 'revised']);
const MISSING_REASON_UNAVAILABLE_RAW = JSON.stringify({ status: 'unavailable' });
const INVALID_STATUS_RAW = JSON.stringify({ status: 'maybe', evidence: 'x' });

// ── Temp dir cleanup ──────────────────────────────────────────────────────────────────────────
const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-vpv-revision-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

// ── 1. valid revised camera ───────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — valid revised camera', () => {
  it('a camera-only revision produces a revised outcome with the new camera and unchanged components', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('macro');
      expect(outcome.candidate.components).toEqual(PRIOR_REQUEST.components);
      expect(outcome.rationale).toContain('Narrowing to macro');
    }
  });
});

// ── 2. valid revised components ───────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — valid revised components', () => {
  it('a components-only revision produces a revised outcome with the new list and unchanged camera', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_COMPONENTS_RAW) });
    const outcome = await executor(REQUEST_Q3);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.components).toEqual(['insight card', 'recommendation panel', 'AI summary', 'suggested actions']);
      expect(outcome.candidate.camera).toBe(PRIOR_REQUEST.camera);
    }
  });
});

// ── 3. valid camera + components revision ────────────────────────────────────────────────────
describe('createRealRevisionExecutor — valid camera + components revision', () => {
  it('both fields can be revised together', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_BOTH_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('component');
      expect(outcome.candidate.components).toEqual(['insight card', 'suggested actions']);
    }
  });
});

// ── 4. unchanged fields preserved ─────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — unchanged fields preserved', () => {
  it('belief, feature, and mustInclude are always carried through verbatim, even though the model never sends them', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.belief).toBe(PRIOR_REQUEST.belief);
      expect(outcome.candidate.feature).toBe(PRIOR_REQUEST.feature);
      expect(outcome.candidate.mustInclude).toEqual(PRIOR_REQUEST.mustInclude);
    }
  });
});

// ── 5. malformed JSON ─────────────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — malformed JSON', () => {
  it('unparseable JSON becomes unavailable', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(MALFORMED_JSON) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^malformed_response/);
  });

  it('a JSON array (not an object) becomes unavailable', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(NOT_AN_OBJECT_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^malformed_response/);
  });
});

// ── 6. unavailable response ───────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — the model honestly declines', () => {
  it('an explicit status="unavailable" response is respected verbatim, never smoothed into a revision', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(UNAVAILABLE_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toBe('the failure is about the underlying claim, not the camera or component selection');
    }
  });

  it('status="unavailable" with no reason becomes unavailable with a machine-readable missing_reason', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(MISSING_REASON_UNAVAILABLE_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^missing_reason/);
  });
});

// ── 7. unsupported component ──────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — unsupported component proposal', () => {
  it('a component not in the authoritative Feature Mapping list for this feature is rejected, never invented', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(UNSUPPORTED_COMPONENT_RAW) });
    const outcome = await executor(REQUEST_Q3);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^unsupported_component/);
      expect(outcome.reason).toContain('live cursor avatars');
    }
  });
});

// ── 8. invalid camera ─────────────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — invalid camera proposal', () => {
  it('a camera value outside the five-value vocabulary is rejected, never invented', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(INVALID_CAMERA_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^invalid_camera/);
      expect(outcome.reason).toContain('closeup');
    }
  });
});

// ── 9-12. invented fields ─────────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — invented fields outside camera/components are rejected generically', () => {
  it('an invented "role" field is rejected', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(INVENTED_ROLE_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invented_field: .*"role"/);
  });

  it('an invented "material" field is rejected', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(INVENTED_MATERIAL_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invented_field: .*"material"/);
  });

  it('an invented "surfaces" field is rejected', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(INVENTED_SURFACE_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invented_field: .*"surfaces"/);
  });
});

// ── Sprint 10AE — environment as a third revisable dimension ───────────────────────────────────
describe('createRealRevisionExecutor — environment revision (Sprint 10AE)', () => {
  const REQUEST_Q4_WITH_ELIGIBLE: RevisionRequest = {
    ...REQUEST_Q4,
    eligibleCandidates: ['dawn-haze', 'valley-deep'],
  };

  it('accepts a proposed environment that is a member of the request eligible candidate set', async () => {
    const raw = JSON.stringify({ status: 'revised', environment: 'dawn-haze', evidence: 'dawn-haze better fits the hero framing' });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4_WITH_ELIGIBLE);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') expect(outcome.candidate.environment).toBe('dawn-haze');
  });

  it('rejects a globally valid environment that is NOT in this request eligible candidate set — never substitutes another', async () => {
    const raw = JSON.stringify({ status: 'revised', environment: 'lake-mirror', evidence: 'x' });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4_WITH_ELIGIBLE); // eligible = [dawn-haze, valley-deep]
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/eligible candidate set/);
  });

  it('rejects an environment value outside the governed seven-value vocabulary entirely', async () => {
    const raw = JSON.stringify({ status: 'revised', environment: 'not-a-real-environment', evidence: 'x' });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4_WITH_ELIGIBLE);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/not a recognized EnvironmentSlug/);
  });

  it('fails closed — rejects any proposed environment when the request carries no eligibleCandidates at all (never falls back to the global vocabulary)', async () => {
    const raw = JSON.stringify({ status: 'revised', environment: 'dawn-haze', evidence: 'x' });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4); // no eligibleCandidates on this request
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/eligible candidate set/);
  });

  it('accepts a combined camera + environment revision in one response', async () => {
    const raw = JSON.stringify({
      status: 'revised',
      camera: 'macro',
      environment: 'valley-deep',
      evidence: 'both narrow the crop and set a calmer environment',
    });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4_WITH_ELIGIBLE);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('macro');
      expect(outcome.candidate.environment).toBe('valley-deep');
    }
  });

  it('an environment-only proposal is NOT an empty revision', async () => {
    const raw = JSON.stringify({ status: 'revised', environment: 'dawn-haze', evidence: 'environment alone addresses the failure' });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4_WITH_ELIGIBLE);
    expect(outcome.outcome).toBe('revised');
  });

  it('never re-runs the deterministic eligibility filter — uses the request known eligible set as-is', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/environment-selection-eligibility\.js['"]/);
    expect(src).not.toMatch(/getEligibleEnvironments/);
  });
});

describe('buildRevisionPrompt — environment context (Sprint 10AE)', () => {
  const REQUEST_Q4_WITH_ELIGIBLE: RevisionRequest = {
    ...REQUEST_Q4,
    eligibleCandidates: ['dawn-haze', 'valley-deep'],
  };

  it('lists environment as a revisable field, constrained to the eligible candidates only, when eligibleCandidates is present', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4_WITH_ELIGIBLE);
    expect(prompt).toMatch(/environment/i);
    expect(prompt).toContain('dawn-haze');
    expect(prompt).toContain('valley-deep');
  });

  it('does not present the full seven-value environment vocabulary as the revisable set — only the eligible candidates', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4_WITH_ELIGIBLE);
    expect(prompt).not.toContain('cliffside-muted');
    expect(prompt).not.toContain('lake-mirror');
    expect(prompt).not.toContain('massif-banded');
    expect(prompt).not.toContain('massif-clear');
    expect(prompt).not.toContain('ridges-distant');
  });

  it('does not offer environment as a revisable field when the request carries no eligibleCandidates', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt.toLowerCase()).not.toMatch(/propose a new environment/);
  });
});

// ── Sprint 10AG — roles as a fourth revisable dimension ─────────────────────────────────────────
// Unlike environment (which needs a separately-computed eligible-candidate set), a role proposal
// validates directly against `priorRequest.components` — already present on every RevisionRequest,
// no new RevisionRequest field is needed.
describe('createRealRevisionExecutor — roles revision (Sprint 10AG)', () => {
  const VALID_ROLES_RAW = JSON.stringify({
    status: 'revised',
    roles: {
      hero: 'insight card',
      support: ['recommendation panel'],
      signal: ['AI summary'],
      subordinateContext: ['confidence score'],
      unassigned: ['suggested actions'],
    },
    evidence: 'insight card is the clearest single proof point for this belief',
  });

  it('accepts a proposed role assignment that fully and validly partitions the prior components', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_ROLES_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') expect(outcome.candidate.roles?.hero).toBe('insight card');
  });

  it('rejects a proposed hero not present in the prior request components', async () => {
    const raw = JSON.stringify({
      status: 'revised',
      roles: { hero: 'a made-up widget', support: [], signal: [], subordinateContext: [], unassigned: PRIOR_REQUEST.components },
      evidence: 'x',
    });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_role: hero/);
  });

  it('rejects an incomplete role partition — a component left in no bucket', async () => {
    const raw = JSON.stringify({
      status: 'revised',
      roles: {
        hero: 'insight card',
        support: [],
        signal: [],
        subordinateContext: [],
        unassigned: [],
      },
      evidence: 'x',
    });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^incomplete_role_assignment/);
  });

  it('fails closed — rejects any proposed roles when the prior request carries no components at all', async () => {
    const requestNoComponents: RevisionRequest = {
      priorRequest: { ...PRIOR_REQUEST, components: undefined },
      priorAnswer: PRIOR_ANSWER_Q4_FAIL,
      attempt: 1,
    };
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_ROLES_RAW) });
    const outcome = await executor(requestNoComponents);
    expect(outcome.outcome).toBe('unavailable');
  });

  it('accepts a combined camera + roles revision in one response', async () => {
    const raw = JSON.stringify({
      status: 'revised',
      camera: 'macro',
      roles: {
        hero: 'insight card',
        support: ['recommendation panel'],
        signal: ['AI summary'],
        subordinateContext: ['confidence score'],
        unassigned: ['suggested actions'],
      },
      evidence: 'both narrow the crop and clarify the hierarchy',
    });
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
    if (outcome.outcome === 'revised') {
      expect(outcome.candidate.camera).toBe('macro');
      expect(outcome.candidate.roles?.hero).toBe('insight card');
    }
  });

  it('a roles-only proposal is NOT an empty revision', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_ROLES_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
  });

  it('reuses validateRoleAssignment from role-assignment.ts rather than re-implementing partition validation', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/from\s+['"]\.\/role-assignment\.js['"]/);
    expect(src).toMatch(/validateRoleAssignment/);
  });
});

describe('buildRevisionPrompt — roles context (Sprint 10AG)', () => {
  it('lists roles as a revisable field, quoting the four role meanings, when the prior request has components', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt.toLowerCase()).toMatch(/roles?/);
    expect(prompt).toMatch(/the dominant product object\/state/i);
  });

  it('does not offer roles as a revisable field when the prior request has no components', () => {
    const requestNoComponents: RevisionRequest = {
      priorRequest: { ...PRIOR_REQUEST, components: undefined },
      priorAnswer: PRIOR_ANSWER_Q4_FAIL,
      attempt: 1,
    };
    const prompt = buildRevisionPrompt(requestNoComponents);
    expect(prompt.toLowerCase()).not.toMatch(/propose a new role assignment/);
  });
});

// ── 13. missing revised content ───────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — missing revised content', () => {
  it('status="revised" with neither camera nor components is rejected as an empty revision', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(EMPTY_REVISION_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^empty_revision/);
  });

  it('status="revised" with a proposal but no evidence is rejected', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(MISSING_EVIDENCE_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^missing_answer: evidence/);
  });

  it('an invalid "status" value (neither revised nor unavailable) is rejected', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(INVALID_STATUS_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_status/);
  });
});

// ── 14. natural-language ambiguity ────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — natural-language ambiguity is rejected by the same strict vocabulary check', () => {
  it('"probably macro" is not one of the five exact camera values and is rejected, not coerced', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(AMBIGUOUS_CAMERA_RAW) });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_camera/);
  });
});

// ── 15/16. immutability ───────────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — immutability', () => {
  it('the prior request is never mutated by a call to the real executor', async () => {
    const before = JSON.stringify(PRIOR_REQUEST);
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_BOTH_RAW) });
    await executor(REQUEST_Q4);
    expect(JSON.stringify(PRIOR_REQUEST)).toBe(before);
  });

  it('the prior answer is never mutated by a call to the real executor', async () => {
    const before = JSON.stringify(PRIOR_ANSWER_Q4_FAIL);
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_BOTH_RAW) });
    await executor(REQUEST_Q4);
    expect(JSON.stringify(PRIOR_ANSWER_Q4_FAIL)).toBe(before);
  });

  it('the revised candidate is a distinct object reference from the prior request', async () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW) });
    const outcome = await executor(REQUEST_Q4);
    if (outcome.outcome === 'revised') expect(outcome.candidate).not.toBe(PRIOR_REQUEST);
  });
});

// ── 17. attempt is preserved (surfaced in the prompt, not enforced as a policy) ──────────────
describe('createRealRevisionExecutor — attempt is passed through for context only', () => {
  it('the prompt states the attempt number', () => {
    const prompt = buildRevisionPrompt({ ...REQUEST_Q4, attempt: 3 });
    expect(prompt).toMatch(/attempt 3/i);
  });

  it('the module defines no MAX_PASSES, maxAttempts, or retry-bound constant', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/MAX_PASSES/);
    expect(src).not.toMatch(/maxAttempts/i);
    expect(src).not.toMatch(/retryLimit/i);
  });
});

// ── 18. passed=true is not gated by the contract or the executor ────────────────────────────
describe('createRealRevisionExecutor — priorAnswer.passed is not inspected or special-cased', () => {
  it('the executor still dispatches and parses normally even when priorAnswer.passed is true — the contract does not enforce that revision only follows a failure', async () => {
    const passedAnswer: VisualProofValidationAnswer = { ...PRIOR_ANSWER_Q4_FAIL, q4: true, passed: true };
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW) });
    const outcome = await executor({ priorRequest: PRIOR_REQUEST, priorAnswer: passedAnswer, attempt: 1 });
    expect(outcome.outcome).toBe('revised');
  });
});

// ── 19. executor is async ─────────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — async contract', () => {
  it('always returns a Promise', () => {
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW) });
    const result = executor(REQUEST_Q4);
    expect(result).toBeInstanceOf(Promise);
  });
});

// ── 20. scripted executor remains unaffected ──────────────────────────────────────────────────
describe('createScriptedRevisionExecutor — unaffected by the new real executor module', () => {
  it('the Sprint 10Q scripted stub still returns its caller-supplied outcome verbatim, ignoring request content', async () => {
    const scripted = createScriptedRevisionExecutor({ outcome: 'revised', candidate: PRIOR_REQUEST, rationale: 'stub' });
    const outcome = await scripted(REQUEST_Q4);
    expect(outcome).toEqual({ outcome: 'revised', candidate: PRIOR_REQUEST, rationale: 'stub' });
  });
});

// ── dispatch exception / timeout ──────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — dispatch exception and timeout', () => {
  it('a thrown dispatch error becomes unavailable, carrying the error message', async () => {
    const executor = createRealRevisionExecutor({ dispatch: throwingDispatch('network reset') });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^dispatch_error/);
      expect(outcome.reason).toContain('network reset');
    }
  });

  it('a dispatch that resolves after the timeout window becomes unavailable with reason "timeout"', async () => {
    const executor = createRealRevisionExecutor({ dispatch: delayedDispatch(VALID_CAMERA_RAW, 60), timeoutMs: 10 });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('timeout');
  });

  it('a dispatch that resolves well within the timeout window still succeeds', async () => {
    const executor = createRealRevisionExecutor({ dispatch: delayedDispatch(VALID_CAMERA_RAW, 5), timeoutMs: 500 });
    const outcome = await executor(REQUEST_Q4);
    expect(outcome.outcome).toBe('revised');
  });
});

// ── executor identity ─────────────────────────────────────────────────────────────────────────
describe('executor identity — distinct from the judgment executor identity', () => {
  it('VISUAL_PROOF_REVISION_LLM_EXECUTOR is its own string, distinct from the judgment executor validator', () => {
    expect(VISUAL_PROOF_REVISION_LLM_EXECUTOR).toBe('visual-proof-revision-llm-v1');
    expect(VISUAL_PROOF_REVISION_LLM_EXECUTOR).not.toBe('visual-proof-validation-llm-v1');
  });
});

// ── prompt contract ────────────────────────────────────────────────────────────────────────────
describe('buildRevisionPrompt — prompt contract', () => {
  it('includes belief, feature, mustInclude, and the prior camera/components', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toContain(PRIOR_REQUEST.belief);
    expect(prompt).toContain(PRIOR_REQUEST.feature);
    expect(prompt).toContain('the triage queue as the hero element');
    expect(prompt).toContain('current camera: establishing');
    expect(prompt).toContain('insight card');
  });

  it('states all six prior question results as PASSED/FAILED, and the prior evidence', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/Q4: FAILED/);
    expect(prompt).toMatch(/Q1: PASSED/);
    expect(prompt).toContain(PRIOR_ANSWER_Q4_FAIL.evidence);
  });

  it('states the exact five-value camera vocabulary', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/establishing \| product \| workflow \| component \| macro/);
  });

  it("states this feature's authoritative component vocabulary, loaded from Feature Mapping, not hardcoded", () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toContain('insight card');
    expect(prompt).toContain('recommendation panel');
    expect(prompt).toContain('AI summary');
    expect(prompt).toContain('confidence score');
    expect(prompt).toContain('suggested actions');
  });

  // Sprint 10AG: role assignment is now a legitimate revisable field WHEN the request has
  // components (as REQUEST_Q4 does) — "never invent role assignments" no longer applies
  // universally, so this test now asserts material/surfaces/composition values remain forbidden
  // (unchanged) and roles is only forbidden when components are genuinely absent (see
  // "buildRevisionPrompt — roles context (Sprint 10AG)" below for that case).
  it('explicitly forbids inventing material, surfaces, and composition values', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/material/i);
    expect(prompt).toMatch(/surfaces/i);
    expect(prompt).toMatch(/hierarchy, density, rhythm, breathing/i);
    expect(prompt).toMatch(/focal scale/i);
  });

  it('explicitly states belief/feature/mustInclude are fixed facts, never revision targets', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/fixed facts/i);
    expect(prompt).toMatch(/never propose changing them/i);
  });

  it('instructs the model not to render or approve anything, and never to modify the creative intent', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/do not render/i);
    expect(prompt).toMatch(/do not approve/i);
    expect(prompt).toMatch(/modify the creative intent/i);
  });

  it('frames the task as "smallest legitimate revision", never "did this pass"', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/smallest legitimate revision/i);
    expect(prompt).toMatch(/NOT being asked "did this pass/i);
  });

  it('includes the six questions loaded fresh from the native methodology document, not hardcoded in this source file', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/Would this still be a product creative on a flat grey background\?/);
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('Would this still be a product creative on a flat grey background');
  });

  it('instructs honest decline when no camera/component revision addresses the failure', () => {
    const prompt = buildRevisionPrompt(REQUEST_Q4);
    expect(prompt).toMatch(/say so honestly/i);
    expect(prompt).toMatch(/"status": "unavailable"/);
  });
});

// ── isolation — no reauthor-loop, no Finding, no producer/orchestrator, no offscript/src ──────────
describe('isolation — no reauthor-loop, no Finding, no MAX_PASSES, no offscript/src, no producer/orchestrator', () => {
  it('the module has zero dependency on offscript/src/ or Website Generation (prose mentions of authoring-seam.ts in comments, explaining what this module does NOT import, are fine — only an actual import is not)', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
    expect(src).not.toMatch(/from\s+['"].*src\/generate/);
    expect(src).not.toMatch(/from\s+['"].*authoring-seam/);
  });

  it('the module does not import or reference reauthor-loop.ts or the rail Finding type', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/reauthor-loop/);
    expect(src).not.toMatch(/\bFinding\b/);
  });

  it('the module never imports producer.ts, the orchestrator, CreativeIntent, or CreativeArtifact', () => {
    const src = readFileSync(new URL('../src/visual-proof-revision-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/producer\.js['"]/);
    expect(src).not.toMatch(/from\s+['"]\.\/visual-proof-orchestrator\.js['"]/);
    expect(src).not.toMatch(/import[^;]*CreativeIntent/);
    expect(src).not.toMatch(/import[^;]*CreativeArtifact/);
  });
});

// ── dispatch-dir audit trail ──────────────────────────────────────────────────────────────────
describe('createRealRevisionExecutor — dispatch-dir audit trail', () => {
  it('writes a request file and a trace file when dispatchDir is given', async () => {
    const dispatchDir = freshDir();
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW), dispatchDir });
    await executor(REQUEST_Q4);
    const files = readdirSync(dispatchDir);
    expect(files.some((f) => f.endsWith('.revision-request.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.revision-trace.json'))).toBe(true);
  });

  it('the trace file records executor identity, attempt, prior q1-q6/evidence, and the revised outcome', async () => {
    const dispatchDir = freshDir();
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(VALID_CAMERA_RAW), dispatchDir });
    await executor(REQUEST_Q4);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.revision-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.executor).toBe(VISUAL_PROOF_REVISION_LLM_EXECUTOR);
    expect(trace.attempt).toBe(1);
    expect(trace.priorQ4).toBe(false);
    expect(trace.priorEvidence).toBe(PRIOR_ANSWER_Q4_FAIL.evidence);
    expect(trace.outcome).toBe('revised');
    expect(trace.revisedCamera).toBe('macro');
  });

  it('the trace file records the reason, not a fabricated candidate, for an unavailable outcome', async () => {
    const dispatchDir = freshDir();
    const executor = createRealRevisionExecutor({ dispatch: fixedDispatch(UNAVAILABLE_RAW), dispatchDir });
    await executor(REQUEST_Q4);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.revision-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.outcome).toBe('unavailable');
    expect(trace.reason).toBeDefined();
    expect(trace.revisedCamera).toBeUndefined();
  });
});

// ── direct parseRevisionResponse unit tests ───────────────────────────────────────────────────
describe('parseRevisionResponse — direct unit tests', () => {
  it('extra unexpected top-level keys reject the response even when otherwise well-formed', () => {
    const raw = JSON.stringify({ status: 'revised', camera: 'macro', evidence: 'x', notes: 'stray field' });
    const outcome = parseRevisionResponse(raw, REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invented_field/);
  });

  it('a non-array "components" value is rejected', () => {
    const raw = JSON.stringify({ status: 'revised', components: 'insight card', evidence: 'x' });
    const outcome = parseRevisionResponse(raw, REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_components/);
  });

  it('a components array containing a non-string element is rejected', () => {
    const raw = JSON.stringify({ status: 'revised', components: ['insight card', 5], evidence: 'x' });
    const outcome = parseRevisionResponse(raw, REQUEST_Q4);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_components/);
  });
});
