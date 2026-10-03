/**
 * Sprint 10K — real Visual Proof judgment executor.
 *
 * Every test in this file uses a DETERMINISTIC MOCKED dispatch — a fake `JudgmentDispatch`
 * returning a fixed raw string, or throwing, or delaying. None of these tests claim that any
 * particular six-answer judgment is "correct" for a given belief — they only prove the executor's
 * OWN mechanics: prompt construction, dispatch invocation, timeout handling, strict parsing,
 * passed-derivation, and the judged/unavailable distinction. The real model call (a genuine
 * semantic judgment) is exercised separately, outside this unit-test file, by
 * `offscript/scripts/_sprint10k-real-judge.ts` and reported in
 * `.experiments/2026-08-12-creative-generation-renderer-readiness/REAL-JUDGMENT-EXECUTOR-IMPLEMENTATION-REPORT.md`.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import {
  createRealJudgmentExecutor,
  buildJudgmentPrompt,
  parseJudgmentResponse,
  VISUAL_PROOF_VALIDATION_LLM_VALIDATOR,
  type JudgmentDispatch,
} from '../src/visual-proof-judgment-executor.js';
import type { RoleAssignment } from '../src/role-assignment.js';
import {
  toArtifactValidation,
  answerFromOutcome,
  VISUAL_PROOF_VALIDATION_VERSION,
  VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR,
  type VisualProofValidationRequest,
} from '../src/visual-proof-validation.js';

const REQUEST: VisualProofValidationRequest = {
  belief: 'exceptions surface themselves before a human has to go looking',
  feature: 'ai-intelligence',
  mustInclude: ['the triage queue as the hero element'],
};

const REQUEST_WITH_CONTEXT: VisualProofValidationRequest = {
  ...REQUEST,
  camera: 'component',
  components: ['triage queue list', 'severity badge', 'assignee avatar', 'resolve button'],
};

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

const ALL_YES_RAW = JSON.stringify({
  q1: true,
  q2: true,
  q3: true,
  q4: true,
  q5: true,
  q6: true,
  evidence: 'Q1: yes. Q2: yes. Q3: yes. Q4: yes. Q5: yes. Q6: yes.',
});
const ONE_NO_RAW = JSON.stringify({
  q1: true,
  q2: true,
  q3: true,
  q4: false,
  q5: true,
  q6: true,
  evidence: 'Q1: yes. Q2: yes. Q3: yes. Q4: no — too much shown. Q5: yes. Q6: yes.',
});
const MULTI_NO_RAW = JSON.stringify({
  q1: false,
  q2: true,
  q3: true,
  q4: true,
  q5: false,
  q6: true,
  evidence: 'Q1: no. Q2: yes. Q3: yes. Q4: yes. Q5: no. Q6: yes.',
});
const MALFORMED_JSON = '{this is not valid json,,,';
const MISSING_Q5_RAW = JSON.stringify({ q1: true, q2: true, q3: true, q4: true, q6: true, evidence: 'x' });
const MISSING_Q6_RAW = JSON.stringify({ q1: true, q2: true, q3: true, q4: true, q5: true, evidence: 'x' });
const NON_BOOLEAN_Q4_RAW = JSON.stringify({ q1: true, q2: true, q3: true, q4: 'yes', q5: true, q6: true, evidence: 'x' });
const EMPTY_EVIDENCE_RAW = JSON.stringify({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true, evidence: '' });
const MISSING_EVIDENCE_RAW = JSON.stringify({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true });
const NOT_AN_OBJECT_RAW = JSON.stringify(['q1', 'q2']);
const INSUFFICIENT_CONTEXT_RAW = JSON.stringify({
  insufficient_context: true,
  reason: 'no camera candidate provided; Q4 cannot be honestly assessed',
});
// Sprint 10N — Q5/Q6 honesty-hardening fixtures. Distinct, question-tagged reason strings prove
// the EXISTING insufficient_context/unavailable mechanism already distinguishes Q5 from Q6 through
// free text alone — no new outcome type or parser change is required.
const INSUFFICIENT_CONTEXT_Q5_RAW = JSON.stringify({
  insufficient_context: true,
  reason:
    'Q5: no role assignment (hero/support/signal/subordinate) was provided, and the component ' +
    'list does not map unambiguously to those roles without inventing one',
});
const INSUFFICIENT_CONTEXT_Q6_RAW = JSON.stringify({
  insufficient_context: true,
  reason:
    'Q6: no environment or material information was provided; the flat-grey-background test ' +
    'cannot be honestly run without inventing an environment to remove',
});
const MODEL_CLAIMS_PASSED_FALSE_RAW = JSON.stringify({
  q1: true,
  q2: true,
  q3: true,
  q4: true,
  q5: true,
  q6: true,
  passed: false, // the model's own claim — must be ignored
  evidence: 'x',
});

// ── Temp dir cleanup ──────────────────────────────────────────────────────────────────────────
const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-vpv-judge-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

// ── 1. valid six-answer judge response ───────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — valid six-answer judge response', () => {
  it('all-yes response maps to judged + passed=true', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') {
      expect(outcome.answer.passed).toBe(true);
      expect(outcome.answer.q1).toBe(true);
      expect(outcome.answer.q6).toBe(true);
    }
  });
});

// ── 2. one-question semantic failure ─────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — one-question semantic failure', () => {
  it('a single "no" (Q4) is judged, not unavailable, and fails the gate', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ONE_NO_RAW) });
    const outcome = await executor(REQUEST_WITH_CONTEXT);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') {
      expect(outcome.answer.passed).toBe(false);
      expect(outcome.answer.q4).toBe(false);
      expect(outcome.answer.q1).toBe(true);
    }
  });
});

// ── 3. multiple-question failure ─────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — multiple-question failure', () => {
  it('multiple "no" answers remain individually visible, passed=false', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MULTI_NO_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') {
      expect(outcome.answer.passed).toBe(false);
      expect(outcome.answer.q1).toBe(false);
      expect(outcome.answer.q5).toBe(false);
      expect(outcome.answer.q2).toBe(true);
      expect(outcome.answer.q3).toBe(true);
      expect(outcome.answer.q4).toBe(true);
      expect(outcome.answer.q6).toBe(true);
    }
  });
});

// ── 4. malformed JSON ─────────────────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — malformed JSON', () => {
  it('unparseable JSON becomes unavailable, never failed', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MALFORMED_JSON) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^malformed_response/);
    }
  });

  it('valid JSON that is not an object (e.g. an array) becomes unavailable', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(NOT_AN_OBJECT_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^malformed_response/);
  });
});

// ── 5/6. missing q5 / q6 ──────────────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — missing required answer fields', () => {
  it('missing q5 becomes unavailable with a machine-readable reason naming q5', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MISSING_Q5_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('missing_answer: q5');
  });

  it('missing q6 becomes unavailable with a machine-readable reason naming q6', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MISSING_Q6_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('missing_answer: q6');
  });
});

// ── 7. non-boolean q value ───────────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — non-boolean answer value', () => {
  it('a string "yes" instead of a boolean becomes unavailable — never coerced/inferred', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(NON_BOOLEAN_Q4_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_answer: q4/);
  });
});

// ── 8. empty / missing evidence ──────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — evidence requirement', () => {
  it('empty-string evidence becomes unavailable', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(EMPTY_EVIDENCE_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('missing_answer: evidence');
  });

  it('missing evidence field entirely becomes unavailable', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MISSING_EVIDENCE_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('missing_answer: evidence');
  });
});

// ── 9. dispatch exception ────────────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — dispatch exception', () => {
  it('a thrown dispatch error becomes unavailable, never failed, and carries the error message', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: throwingDispatch('network reset') });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^dispatch_error/);
      expect(outcome.reason).toContain('network reset');
    }
  });
});

// ── 10. timeout ───────────────────────────────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — timeout', () => {
  it('a dispatch that resolves after the timeout window becomes unavailable with reason "timeout"', async () => {
    const executor = createRealJudgmentExecutor({
      dispatch: delayedDispatch(ALL_YES_RAW, 60),
      timeoutMs: 10,
    });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('timeout');
  });

  it('a dispatch that resolves well within the timeout window still succeeds', async () => {
    const executor = createRealJudgmentExecutor({
      dispatch: delayedDispatch(ALL_YES_RAW, 5),
      timeoutMs: 500,
    });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged');
  });
});

// ── 11/12. missing camera / components context ───────────────────────────────────────────────
describe('createRealJudgmentExecutor — missing camera/components context does not crash or fabricate', () => {
  it('a request without camera or components still dispatches successfully', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged');
  });

  it('the prompt states camera/components are "(not provided)" rather than inventing a value', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/camera candidate:\s*\(not provided\)/);
    expect(prompt).toMatch(/authoritative component list:\s*\(not provided\)/);
  });

  it('the prompt states the real values when camera/components ARE provided — never overwritten with "(not provided)"', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(prompt).toContain('camera candidate: component');
    expect(prompt).toContain('triage queue list');
    expect(prompt).not.toMatch(/camera candidate:\s*\(not provided\)/);
  });

  it('the judge can honestly decline via the insufficient_context escape hatch, which becomes unavailable not a semantic "no"', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(INSUFFICIENT_CONTEXT_RAW) });
    const outcome = await executor(REQUEST); // no camera provided
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^insufficient_context/);
      expect(outcome.reason).toContain('no camera candidate provided');
    }
  });
});

// ── 13. deterministic scripted dispatch ──────────────────────────────────────────────────────
describe('createRealJudgmentExecutor — deterministic scripted dispatch', () => {
  it('the same fixed dispatch response produces the same result across repeated calls', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const a = await executor(REQUEST);
    const b = await executor(REQUEST);
    expect(a).toEqual(b);
  });
});

// ── 14. response parsing (direct unit tests of parseJudgmentResponse) ───────────────────────
describe('parseJudgmentResponse — direct unit tests', () => {
  it('parses a valid response into a judged outcome', () => {
    const outcome = parseJudgmentResponse(ALL_YES_RAW);
    expect(outcome.outcome).toBe('judged');
  });

  it('extra, unexpected fields in an otherwise-valid response are tolerated (ignored), not rejected', () => {
    const raw = JSON.stringify({ ...JSON.parse(ALL_YES_RAW), notes: 'some stray field' });
    const outcome = parseJudgmentResponse(raw);
    expect(outcome.outcome).toBe('judged');
  });
});

// ── 15. passed derived from q1-q6, never trusted from the model ─────────────────────────────
describe('createRealJudgmentExecutor — passed is always derived, never trusted from the model', () => {
  it('a model-supplied passed=false is ignored when all six answers are true — passed is recomputed', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MODEL_CLAIMS_PASSED_FALSE_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') expect(outcome.answer.passed).toBe(true);
  });

  it('the answer object never carries a field the model supplied verbatim as "passed" without recomputation', () => {
    const outcome = parseJudgmentResponse(MODEL_CLAIMS_PASSED_FALSE_RAW);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') {
      // passed is recomputed from q1..q6 (all true), NOT copied from the model's own passed:false
      expect(outcome.answer.passed).toBe(true);
    }
  });
});

// ── 16/17/18. outcome -> CreativeArtifact.validation mapping (reusing Sprint 10J helpers) ───
describe('createRealJudgmentExecutor outcomes map correctly through the existing Sprint 10J validation pipeline', () => {
  it('unavailable maps to validation.status "unknown", never "failed"', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MALFORMED_JSON) });
    const outcome = await executor(REQUEST);
    const validation = toArtifactValidation(answerFromOutcome(outcome), VISUAL_PROOF_VALIDATION_LLM_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('unknown');
  });

  it('a judged failure (any "no") maps to validation.status "failed"', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ONE_NO_RAW) });
    const outcome = await executor(REQUEST);
    const validation = toArtifactValidation(answerFromOutcome(outcome), VISUAL_PROOF_VALIDATION_LLM_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('failed');
  });

  it('a judged success (all "yes") maps to validation.status "passed"', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor(REQUEST);
    const validation = toArtifactValidation(answerFromOutcome(outcome), VISUAL_PROOF_VALIDATION_LLM_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('passed');
  });
});

// ── Executor identity — Phase 7 ───────────────────────────────────────────────────────────────
describe('executor identity — distinct from methodology identity and from the scripted stub', () => {
  it('VISUAL_PROOF_VALIDATION_LLM_VALIDATOR is distinct from the methodology version and the scripted-stub validator', () => {
    expect(VISUAL_PROOF_VALIDATION_LLM_VALIDATOR).not.toBe(VISUAL_PROOF_VALIDATION_VERSION);
    expect(VISUAL_PROOF_VALIDATION_LLM_VALIDATOR).not.toBe(VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR);
    expect(VISUAL_PROOF_VALIDATION_LLM_VALIDATOR).toBe('visual-proof-validation-llm-v1');
  });
});

// ── Prompt contract — Phase 1 ─────────────────────────────────────────────────────────────────
describe('buildJudgmentPrompt — prompt contract', () => {
  it('includes belief, feature, and mustInclude', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toContain(REQUEST.belief);
    expect(prompt).toContain(REQUEST.feature);
    expect(prompt).toContain('the triage queue as the hero element');
  });

  it('includes the six questions loaded from the native methodology document, not hardcoded in this source file', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toContain('Is every element nameable as hero / support / signal / subordinate context?');
    expect(prompt).toMatch(/Would this still be a product creative on a flat grey background\?/);
  });

  it('the source file itself does not embed any of the six question sentences verbatim — the document is the sole source of truth', () => {
    const src = readFileSync(new URL('../src/visual-proof-judgment-executor.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('Can someone understand the feature without reading any body copy');
    expect(src).not.toContain('Is every element nameable as hero');
    expect(src).not.toContain('Would this still be a product creative on a flat grey background');
  });

  it('explicitly instructs the judge NOT to design, rewrite, select sections, or approve', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/do not design/i);
    expect(prompt).toMatch(/do not select website sections/i);
    expect(prompt).toMatch(/do not approve/i);
  });

  it('instructs the judge that nothing has been rendered — this is a pre-render concept gate', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/pre-render/i);
    expect(prompt).toMatch(/nothing has been rendered/i);
  });

  it('instructs the judge not to reveal private reasoning', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/private|hidden|chain-of-thought/i);
  });

  it('instructs the judge that "passed" is derived, never supplied by the model', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/do not include a "passed"|never taken from you|derived from your/i);
  });
});

// ── Sprint 10N — Q5/Q6 insufficient-context honesty hardening ──────────────────────────────────
describe('buildJudgmentPrompt — Q5/Q6 honesty rule (Sprint 10N)', () => {
  it('states plainly that no role assignment (hero/support/signal/subordinate) was provided', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(prompt).toMatch(/role assignment[^:]*:\s*\(not provided\)/i);
  });

  it('states plainly that no environment was provided', () => {
    // Sprint 10AF: the standalone "material context" line was removed — Q6's own source wording
    // never names material, so requiring it before Q6 is answerable was a self-imposed extension
    // beyond the methodology (see MATERIAL-BLOCKER-RESOLUTION-REPORT.md §1-§3). This test now
    // covers environment only; the Q6 material-gate correction has its own describe block below.
    const prompt = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(prompt).toMatch(/-\s*environment:\s*\(not provided\)/i);
  });

  it('explicitly forbids inventing roles, environment, material, surfaces, composition decisions, hidden information, or unstated visual facts', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/never invent/i);
    expect(prompt).toMatch(/role assignments?/i);
    expect(prompt).toMatch(/environment/i);
    expect(prompt).toMatch(/material/i);
    expect(prompt).toMatch(/surfaces/i);
    expect(prompt).toMatch(/composition decisions/i);
    expect(prompt).toMatch(/hidden information/i);
    expect(prompt).toMatch(/unstated visual fact/i);
  });

  it('instructs the judge to decline Q5 via insufficient_context rather than inventing a role assignment', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/Q5[\s\S]{0,400}insufficient_context/i);
  });

  it('instructs the judge to decline Q6 via insufficient_context rather than inventing environment/material', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/Q6[\s\S]{0,400}insufficient_context/i);
  });

  it('explicitly forbids substituting a functional/realism check for Q6\'s flat-grey-background test', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/do not substitute/i);
    expect(prompt).toMatch(/functional/i);
  });

  it('the honesty rule does not alter or duplicate the six questions\' own wording — still loaded verbatim, once, from the methodology document', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    const q5Occurrences = prompt.match(/Is every element nameable as hero \/ support \/ signal \/ subordinate context\?/g) ?? [];
    const q6Occurrences = prompt.match(/Would this still be a product creative on a flat grey background\?/g) ?? [];
    expect(q5Occurrences.length).toBe(1);
    expect(q6Occurrences.length).toBe(1);
  });

  it('Q1-Q4 instructions are unchanged — camera/components "(not provided)"/provided handling still present verbatim', () => {
    const promptNoContext = buildJudgmentPrompt(REQUEST);
    expect(promptNoContext).toMatch(/camera candidate:\s*\(not provided\)/);
    expect(promptNoContext).toMatch(/authoritative component list:\s*\(not provided\)/);
    const promptWithContext = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(promptWithContext).toContain('camera candidate: component');
    expect(promptWithContext).toContain('triage queue list');
  });
});

// ── Sprint 10AE — environment identity now flows into the Q6 prompt when known ─────────────────
describe('buildJudgmentPrompt — environment context (Sprint 10AE)', () => {
  const REQUEST_WITH_ENVIRONMENT: VisualProofValidationRequest = {
    ...REQUEST_WITH_CONTEXT,
    environment: 'dawn-haze',
  };

  it('shows the selected environment slug when provided, on its own line', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_ENVIRONMENT);
    expect(prompt).toMatch(/-\s*environment:\s*dawn-haze/);
  });

  // Sprint 10AF: the "material context still (not provided)" and "environment alone doesn't
  // answer Q6, material can still be missing" tests were removed here — their premise (Q6 needs
  // material in addition to environment) is exactly what this sprint's correction overturns, per
  // MATERIAL-BLOCKER-RESOLUTION-REPORT.md §1-§3. See "buildJudgmentPrompt — Q6 material-gate
  // correction (Sprint 10AF)" below for the corrected behavior's own tests.

  it('explicitly states environment is the selected governed environment identity', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_ENVIRONMENT);
    expect(prompt.toLowerCase()).toMatch(/selected governed environment identity/);
  });

  it('still instructs no invention and no substitute question for Q6', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_ENVIRONMENT);
    expect(prompt).toMatch(/do not substitute/i);
    expect(prompt).toMatch(/never invent/i);
  });
});

describe('createRealJudgmentExecutor — environment-aware Q6 can still honestly decline (Sprint 10AE)', () => {
  it('a Q6-tagged insufficient_context response is still honored when environment is present but material is not', async () => {
    const requestWithEnvironment: VisualProofValidationRequest = { ...REQUEST_WITH_CONTEXT, environment: 'valley-deep' };
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(INSUFFICIENT_CONTEXT_Q6_RAW) });
    const outcome = await executor(requestWithEnvironment);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^insufficient_context/);
      expect(outcome.reason.toLowerCase()).toContain('q6');
    }
  });
});

describe('createRealJudgmentExecutor — Q5/Q6 honest decline (Sprint 10N)', () => {
  it('a Q5-tagged insufficient_context response becomes unavailable, never a fabricated role judgment', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(INSUFFICIENT_CONTEXT_Q5_RAW) });
    const outcome = await executor(REQUEST_WITH_CONTEXT); // Q1-Q4 context fully present; Q5 context is not
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^insufficient_context/);
      expect(outcome.reason.toLowerCase()).toContain('q5');
      expect(outcome.reason.toLowerCase()).not.toContain('q6:');
    }
  });

  it('a Q6-tagged insufficient_context response becomes unavailable, never a proxy functional/realism judgment', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(INSUFFICIENT_CONTEXT_Q6_RAW) });
    const outcome = await executor(REQUEST_WITH_CONTEXT);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^insufficient_context/);
      expect(outcome.reason.toLowerCase()).toContain('q6');
      expect(outcome.reason.toLowerCase()).not.toContain('q5:');
    }
  });

  it('Q5 and Q6 insufficient_context reasons remain distinguishable through the UNCHANGED parser — no new outcome type or enum required', () => {
    const q5 = parseJudgmentResponse(INSUFFICIENT_CONTEXT_Q5_RAW);
    const q6 = parseJudgmentResponse(INSUFFICIENT_CONTEXT_Q6_RAW);
    expect(q5.outcome).toBe('unavailable');
    expect(q6.outcome).toBe('unavailable');
    if (q5.outcome === 'unavailable' && q6.outcome === 'unavailable') {
      expect(q5.reason).not.toBe(q6.reason);
      expect(q5.reason.toLowerCase()).toContain('q5');
      expect(q6.reason.toLowerCase()).toContain('q6');
    }
  });

  it('a Q5/Q6-declined outcome maps to validation.status "unknown", identical to any other unavailable path — never "failed"', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(INSUFFICIENT_CONTEXT_Q6_RAW) });
    const outcome = await executor(REQUEST_WITH_CONTEXT);
    const validation = toArtifactValidation(
      answerFromOutcome(outcome),
      VISUAL_PROOF_VALIDATION_LLM_VALIDATOR,
      '2026-08-12T00:00:00.000Z',
    );
    expect(validation.status).toBe('unknown');
    expect(validation.status).not.toBe('failed');
  });

  it('Q1-Q4 remain fully judgeable (all-yes) when their own context is sufficient — the Q5/Q6 honesty rule does not weaken them', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor(REQUEST_WITH_CONTEXT);
    expect(outcome.outcome).toBe('judged');
    if (outcome.outcome === 'judged') {
      expect(outcome.answer.q1).toBe(true);
      expect(outcome.answer.q2).toBe(true);
      expect(outcome.answer.q3).toBe(true);
      expect(outcome.answer.q4).toBe(true);
    }
  });
});

// ── Sprint 10AF — Q6 material-gate correction: Q6 is answerable from environment + components ──
// alone, per the source's own Q6 wording (never names material/surface/shadow/glass/radius). The
// prior "material context: (not provided)" line and its accompanying decline instruction were a
// self-imposed extension beyond what the methodology requires (see
// MATERIAL-BLOCKER-RESOLUTION-REPORT.md §1-§3) — this block proves it is gone.
function extractQ6Paragraph(prompt: string): string {
  const match = prompt.match(/Q6 asks[\s\S]*?(?=\n## Rules)/);
  return match ? match[0] : '';
}

describe('buildJudgmentPrompt — Q6 material-gate correction (Sprint 10AF)', () => {
  it('no standalone "material context" line exists, with or without environment known', () => {
    const requestNoEnv = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    const requestWithEnv = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' });
    expect(requestNoEnv).not.toMatch(/-\s*material context:/i);
    expect(requestWithEnv).not.toMatch(/-\s*material context:/i);
  });

  it("Q6's own paragraph references environment (when given) and the authoritative component list, not material", () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' });
    const q6 = extractQ6Paragraph(prompt);
    expect(q6.length).toBeGreaterThan(0);
    expect(q6.toLowerCase()).toMatch(/environment/);
    expect(q6.toLowerCase()).toMatch(/component/);
  });

  it('Q6 does not say material is required to answer it', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' });
    const q6 = extractQ6Paragraph(prompt);
    expect(q6.toLowerCase()).not.toMatch(/material/);
  });

  it('Q6 does not instruct the judge to decline specifically because material is missing', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' });
    const q6 = extractQ6Paragraph(prompt);
    expect(q6.toLowerCase()).not.toMatch(/material context/);
    expect(q6.toLowerCase()).not.toMatch(/material.*\(not provided\)/);
  });

  it('Q6 still prohibits inventing environment facts, inventing interface structure, proxy realism checks, and substituting another question', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' });
    const q6 = extractQ6Paragraph(prompt);
    expect(q6).toMatch(/do not (guess|invent)/i);
    expect(q6).toMatch(/do not substitute/i);
    expect(q6).toMatch(/functional/i);
  });

  // Sprint 10AG: Q5's own paragraph was intentionally rewritten to wire in a real upstream role
  // assignment (see "buildJudgmentPrompt — Q5 role assignment context (Sprint 10AG)" below) — the
  // Sprint 10AF byte-identical guarantee applied only to that sprint's own Q6-only scope. This test
  // now asserts the corresponding CURRENT invariant: Q5's fallback (no role assignment given) still
  // declines via insufficient_context, unaffected by the Q6 correction itself.
  it('Q5 still declines via insufficient_context when no role assignment is given, unaffected by the Q6 correction', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    expect(prompt).toMatch(/Q5[\s\S]{0,400}insufficient_context/i);
  });

  it('Q1-Q4 wording and camera/components context lines remain unchanged', () => {
    const promptNoContext = buildJudgmentPrompt(REQUEST);
    expect(promptNoContext).toMatch(/camera candidate:\s*\(not provided\)/);
    expect(promptNoContext).toMatch(/authoritative component list:\s*\(not provided\)/);
    const promptWithContext = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(promptWithContext).toContain('camera candidate: component');
    expect(promptWithContext).toContain('triage queue list');
  });

  it('the six questions still load verbatim, once each, from the native methodology document', () => {
    const prompt = buildJudgmentPrompt(REQUEST);
    const q5Occurrences = prompt.match(/Is every element nameable as hero \/ support \/ signal \/ subordinate context\?/g) ?? [];
    const q6Occurrences = prompt.match(/Would this still be a product creative on a flat grey background\?/g) ?? [];
    expect(q5Occurrences.length).toBe(1);
    expect(q6Occurrences.length).toBe(1);
  });
});

// ── Sprint 10AG — Q5 role assignment integration: Q5 now receives the actual role context from an
// upstream RoleAssignmentExecutor, never inventing or freelancing its own ─────────────────────────
const FULL_ROLES: RoleAssignment = {
  hero: 'triage queue list',
  support: ['severity badge'],
  signal: ['assignee avatar'],
  subordinateContext: ['resolve button'],
  unassigned: [],
};

describe('buildJudgmentPrompt — Q5 role assignment context (Sprint 10AG)', () => {
  it('shows the given role assignment on its own lines when provided', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, roles: FULL_ROLES });
    expect(prompt).toMatch(/hero=triage queue list/);
    expect(prompt).toMatch(/support=severity badge/);
    expect(prompt).toMatch(/signal=assignee avatar/);
    expect(prompt.toLowerCase()).toMatch(/subordinate context=resolve button/);
  });

  it('still reads "(not provided)" when no role assignment is given', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(prompt).toMatch(/role assignment \(hero\/support\/signal\/subordinate context\):\s*\(not provided\)/i);
  });

  it('instructs the judge to evaluate the GIVEN assignment, never invent a different one', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, roles: FULL_ROLES });
    expect(prompt).toMatch(/already-decided/i);
    expect(prompt).toMatch(/do not invent a different assignment/i);
  });

  it('states an honest non-empty unassigned list makes Q5 false, not unavailable — the source\'s own "cut it" remedy', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, roles: FULL_ROLES });
    expect(prompt.toLowerCase()).toMatch(/unassigned/);
    expect(prompt).toMatch(/Q5 is false/);
  });

  it('still instructs declining Q5 via insufficient_context when no role assignment was given', () => {
    const prompt = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(prompt).toMatch(/Q5[\s\S]{0,400}insufficient_context/i);
  });

  it('shows an empty support/signal/subordinateContext bucket as "(none)", never omitted', () => {
    const minimalRoles: RoleAssignment = {
      hero: 'workflow builder',
      support: [],
      signal: [],
      subordinateContext: [],
      unassigned: ['execution status', 'automation timeline', 'success notification'],
    };
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, roles: minimalRoles });
    expect(prompt).toMatch(/hero=workflow builder/);
    expect(prompt).toMatch(/support=\(none\)/);
    expect(prompt).toMatch(/signal=\(none\)/);
  });
});

describe('buildJudgmentPrompt — Q1-Q4 and Q6 unaffected by the Q5 role integration (Sprint 10AG)', () => {
  it('Q1-Q4 wording and camera/components handling remain unchanged', () => {
    const promptNoContext = buildJudgmentPrompt(REQUEST);
    expect(promptNoContext).toMatch(/camera candidate:\s*\(not provided\)/);
    const promptWithContext = buildJudgmentPrompt(REQUEST_WITH_CONTEXT);
    expect(promptWithContext).toContain('camera candidate: component');
  });

  it("Q6's own paragraph is unaffected by roles being present or absent", () => {
    const withRoles = extractQ6Paragraph(buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze', roles: FULL_ROLES }));
    const withoutRoles = extractQ6Paragraph(buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, environment: 'dawn-haze' }));
    expect(withRoles).toBe(withoutRoles);
  });

  it('the six questions still load verbatim, once each, from the native methodology document', () => {
    const prompt = buildJudgmentPrompt({ ...REQUEST_WITH_CONTEXT, roles: FULL_ROLES });
    const q5Occurrences = prompt.match(/Is every element nameable as hero \/ support \/ signal \/ subordinate context\?/g) ?? [];
    expect(q5Occurrences.length).toBe(1);
  });
});

describe('createRealJudgmentExecutor — Q5 with real role context (Sprint 10AG)', () => {
  it('a full six-yes response is judged when a real role assignment is present', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor({ ...REQUEST_WITH_CONTEXT, roles: FULL_ROLES });
    expect(outcome.outcome).toBe('judged');
  });
});

// ── Dispatch-dir audit trail — Phase 11 observability, mirroring authoring-seam.ts's pattern ──
describe('createRealJudgmentExecutor — dispatch-dir audit trail (independent of authoring-seam.ts)', () => {
  it('writes a request file and a trace file when dispatchDir is given', async () => {
    const dispatchDir = freshDir();
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW), dispatchDir });
    await executor(REQUEST);
    const files = readdirSync(dispatchDir);
    expect(files.some((f) => f.endsWith('.judgment-request.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.judgment-trace.json'))).toBe(true);
  });

  it('the trace file records executor identity, outcome, q1-q6, evidence, and timestamps — never hidden reasoning beyond evidence', async () => {
    const dispatchDir = freshDir();
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW), dispatchDir });
    await executor(REQUEST);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.judgment-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.validator).toBe(VISUAL_PROOF_VALIDATION_LLM_VALIDATOR);
    expect(trace.outcome).toBe('judged');
    expect(trace.q1).toBe(true);
    expect(trace.evidence).toBeDefined();
    expect(typeof trace.startedAt).toBe('string');
    expect(typeof trace.endedAt).toBe('string');
    expect(Object.keys(trace)).not.toContain('reasoning');
    expect(Object.keys(trace)).not.toContain('chainOfThought');
  });

  it('the trace file records the failure reason, not q1-q6, for an unavailable outcome', async () => {
    const dispatchDir = freshDir();
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(MALFORMED_JSON), dispatchDir });
    await executor(REQUEST);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.judgment-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.outcome).toBe('unavailable');
    expect(trace.reason).toMatch(/^malformed_response/);
    expect(trace.q1).toBeUndefined();
  });

  it('no file is written when dispatchDir is omitted', async () => {
    const executor = createRealJudgmentExecutor({ dispatch: fixedDispatch(ALL_YES_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('judged'); // still works with no dispatchDir
  });
});
