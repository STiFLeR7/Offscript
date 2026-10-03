/**
 * Sprint 10AD — Environment Selection contract + scripted stub + (unwired) prompt builder/strict
 * parser for a future real executor. This module performs NO semantic selection — the scripted
 * executor returns whatever outcome the caller pre-configures, content-blind, exactly mirroring
 * `createScriptedRevisionExecutor`'s own discipline. No `dispatch` call is ever made anywhere in
 * this module (Sprint 10AC's own "Sprint 1" scope: contract + prompt builder + strict parser +
 * scripted stub, no real dispatch wiring).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEnvironmentSelectionPrompt,
  createRealEnvironmentSelectionExecutor,
  createScriptedEnvironmentSelectionExecutor,
  parseEnvironmentSelectionResponse,
  validateSelectedEnvironment,
  ENVIRONMENT_SELECTION_LLM_EXECUTOR,
  type EnvironmentSelectionDispatch,
  type EnvironmentSelectionOutcome,
  type EnvironmentSelectionRequest,
} from '../src/environment-selection.js';
import type { EnvironmentSlug } from '../src/environment-library.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/environment-selection.ts', import.meta.url));

const ELIGIBLE: readonly ['dawn-haze', 'valley-deep'] = ['dawn-haze', 'valley-deep'];

function baseRequest(overrides: Partial<EnvironmentSelectionRequest> = {}): EnvironmentSelectionRequest {
  return { belief: 'this product automates approvals', eligibleCandidates: ELIGIBLE, ...overrides };
}

// ---------------------------------------------------------------------------------------------
// 1-4: candidate validation
// ---------------------------------------------------------------------------------------------

describe('validateSelectedEnvironment — valid selected candidate', () => {
  it('accepts a slug that is both globally valid and in the eligible set', () => {
    const result = validateSelectedEnvironment('dawn-haze', ELIGIBLE, 'matches the hero narrative');
    expect(result).toEqual({ outcome: 'selected', environment: 'dawn-haze', evidence: 'matches the hero narrative' });
  });
});

describe('validateSelectedEnvironment — valid global slug but ineligible candidate', () => {
  it('rejects a slug outside this request\'s own eligible set, even though it is a real EnvironmentSlug', () => {
    const result = validateSelectedEnvironment('lake-mirror', ELIGIBLE, 'evidence');
    expect(result.outcome).toBe('unavailable');
    expect((result as { reason: string }).reason).toMatch(/eligible candidate set/);
  });

  it('never silently substitutes a different eligible candidate instead of rejecting', () => {
    const result = validateSelectedEnvironment('lake-mirror', ELIGIBLE, 'evidence');
    expect(result).not.toMatchObject({ outcome: 'selected' });
  });
});

describe('validateSelectedEnvironment — invalid slug', () => {
  it('rejects a value outside the governed seven-value vocabulary entirely', () => {
    const result = validateSelectedEnvironment('not-a-real-environment', ELIGIBLE, 'evidence');
    expect(result.outcome).toBe('unavailable');
    expect((result as { reason: string }).reason).toMatch(/not a recognized EnvironmentSlug/);
  });
});

describe('validateSelectedEnvironment — candidate-specific validation', () => {
  it('validates against THIS request\'s own eligible set, not a fixed global one', () => {
    const acceptedHere = validateSelectedEnvironment('lake-mirror', ['lake-mirror', 'valley-deep'], 'e');
    const rejectedHere = validateSelectedEnvironment('lake-mirror', ELIGIBLE, 'e');
    expect(acceptedHere.outcome).toBe('selected');
    expect(rejectedHere.outcome).toBe('unavailable');
  });
});

// ---------------------------------------------------------------------------------------------
// 5-6: scripted executor
// ---------------------------------------------------------------------------------------------

describe('createScriptedEnvironmentSelectionExecutor — returns caller-supplied selected outcome', () => {
  it('resolves with the exact outcome given, regardless of the request', async () => {
    const outcome: EnvironmentSelectionOutcome = { outcome: 'selected', environment: 'dawn-haze', evidence: 'x' };
    const executor = createScriptedEnvironmentSelectionExecutor(outcome);
    const result = await executor(baseRequest({ belief: 'a completely different belief' }));
    expect(result).toEqual(outcome);
  });
});

describe('createScriptedEnvironmentSelectionExecutor — returns caller-supplied unavailable outcome', () => {
  it('resolves with the exact unavailable outcome given', async () => {
    const outcome: EnvironmentSelectionOutcome = { outcome: 'unavailable', reason: 'no honest pick' };
    const executor = createScriptedEnvironmentSelectionExecutor(outcome);
    const result = await executor(baseRequest());
    expect(result).toEqual(outcome);
  });

  it('does not inspect belief/feature/camera/eligibleCandidates to decide anything', async () => {
    const outcome: EnvironmentSelectionOutcome = { outcome: 'selected', environment: 'valley-deep', evidence: 'x' };
    const executor = createScriptedEnvironmentSelectionExecutor(outcome);
    // eligibleCandidates below does not even contain 'valley-deep' — the stub must still return the
    // preconfigured outcome verbatim; it performs no eligibility check of its own.
    const result = await executor(baseRequest({ eligibleCandidates: ['dawn-haze'], feature: 'security', camera: 'macro' }));
    expect(result).toEqual(outcome);
  });
});

// ---------------------------------------------------------------------------------------------
// 7-9: determinism, immutability
// ---------------------------------------------------------------------------------------------

describe('deterministic repeated behavior', () => {
  it('the scripted executor returns an equal result across repeated calls', async () => {
    const outcome: EnvironmentSelectionOutcome = { outcome: 'selected', environment: 'dawn-haze', evidence: 'x' };
    const executor = createScriptedEnvironmentSelectionExecutor(outcome);
    const first = await executor(baseRequest());
    const second = await executor(baseRequest());
    expect(first).toEqual(second);
  });

  it('the parser returns an equal result across repeated calls with the same raw input', () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'dawn-haze', evidence: 'x' });
    const first = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    const second = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    expect(first).toEqual(second);
  });
});

describe('input immutability', () => {
  it('validateSelectedEnvironment never mutates the eligibleCandidates array', () => {
    const candidates: EnvironmentSlug[] = ['dawn-haze', 'valley-deep'];
    const before = JSON.stringify(candidates);
    validateSelectedEnvironment('lake-mirror', candidates, 'e');
    expect(JSON.stringify(candidates)).toBe(before);
  });

  it('buildEnvironmentSelectionPrompt never mutates the request or its eligibleCandidates array', () => {
    const request = baseRequest();
    const before = JSON.stringify(request);
    buildEnvironmentSelectionPrompt(request);
    expect(JSON.stringify(request)).toBe(before);
  });
});

describe('readonly candidate set', () => {
  it('the candidate array passed in remains caller-owned (same reference, unmutated)', () => {
    const candidates: readonly EnvironmentSlug[] = Object.freeze(['dawn-haze', 'valley-deep']);
    expect(() => validateSelectedEnvironment('dawn-haze', candidates, 'e')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------
// 11: no global-vocabulary fallback
// ---------------------------------------------------------------------------------------------

describe('no global-vocabulary fallback', () => {
  it('an ineligible or invalid selection is never quietly replaced by another valid candidate', () => {
    const ineligible = validateSelectedEnvironment('lake-mirror', ELIGIBLE, 'e');
    const invalid = validateSelectedEnvironment('not-real', ELIGIBLE, 'e');
    for (const result of [ineligible, invalid]) {
      expect(result.outcome).toBe('unavailable');
      if (result.outcome === 'unavailable') {
        expect(ELIGIBLE).not.toContain(result as unknown as string);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Strict parser
// ---------------------------------------------------------------------------------------------

describe('parseEnvironmentSelectionResponse — valid selected response', () => {
  it('parses a well-formed selected response', () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'dawn-haze', evidence: 'matches belief' });
    expect(parseEnvironmentSelectionResponse(raw, ELIGIBLE)).toEqual({
      outcome: 'selected',
      environment: 'dawn-haze',
      evidence: 'matches belief',
    });
  });

  it('rejects a selected response naming an ineligible slug', () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'lake-mirror', evidence: 'x' });
    const result = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
  });
});

describe('parseEnvironmentSelectionResponse — malformed JSON', () => {
  it('returns unavailable for non-JSON input', () => {
    const result = parseEnvironmentSelectionResponse('not json at all', ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
    expect((result as { reason: string }).reason).toMatch(/malformed_response/);
  });

  it('returns unavailable for a JSON array instead of an object', () => {
    const result = parseEnvironmentSelectionResponse('[1,2,3]', ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
  });
});

describe('parseEnvironmentSelectionResponse — invalid status', () => {
  it('rejects a response with an unrecognized status value', () => {
    const raw = JSON.stringify({ status: 'maybe', environment: 'dawn-haze', evidence: 'x' });
    const result = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
  });
});

describe('parseEnvironmentSelectionResponse — missing environment on selected', () => {
  it('rejects a "selected" response with no environment field', () => {
    const raw = JSON.stringify({ status: 'selected', evidence: 'x' });
    const result = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
  });
});

describe('parseEnvironmentSelectionResponse — unavailable passthrough', () => {
  it('parses a well-formed unavailable response', () => {
    const raw = JSON.stringify({ status: 'unavailable', reason: 'no honest fit' });
    expect(parseEnvironmentSelectionResponse(raw, ELIGIBLE)).toEqual({ outcome: 'unavailable', reason: 'no honest fit' });
  });
});

describe('parseEnvironmentSelectionResponse — extra unsupported fields rejected', () => {
  it('rejects a response carrying a score/confidence/weights-style invented field', () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'dawn-haze', evidence: 'x', score: 0.9 });
    const result = parseEnvironmentSelectionResponse(raw, ELIGIBLE);
    expect(result.outcome).toBe('unavailable');
    expect((result as { reason: string }).reason).toMatch(/invented_field/);
  });
});

// ---------------------------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------------------------

describe('buildEnvironmentSelectionPrompt — content', () => {
  it('includes the belief and every eligible candidate', () => {
    const prompt = buildEnvironmentSelectionPrompt(baseRequest());
    expect(prompt).toContain('this product automates approvals');
    expect(prompt).toContain('dawn-haze');
    expect(prompt).toContain('valley-deep');
  });

  it('excludes ineligible candidates from the presented list', () => {
    const prompt = buildEnvironmentSelectionPrompt(baseRequest());
    expect(prompt).not.toContain('lake-mirror');
  });

  it('instructs the model to choose only from the eligible list and never invent a candidate', () => {
    const prompt = buildEnvironmentSelectionPrompt(baseRequest());
    expect(prompt.toLowerCase()).toMatch(/only.*eligible|eligible.*only/);
    expect(prompt.toLowerCase()).toMatch(/never invent/);
  });

  it('instructs the model not to reconsider eligibility or use recent log/history', () => {
    const prompt = buildEnvironmentSelectionPrompt(baseRequest());
    expect(prompt.toLowerCase()).toMatch(/do not reconsider|already been decided/);
    expect(prompt.toLowerCase()).toMatch(/do not use.*recent|recent log.*none/);
  });

  it('requests structured JSON-only output', () => {
    const prompt = buildEnvironmentSelectionPrompt(baseRequest());
    expect(prompt).toContain('"status"');
    expect(prompt).toContain('"environment"');
  });
});

// ---------------------------------------------------------------------------------------------
// 12-13: no recency/history in the contract
// ---------------------------------------------------------------------------------------------

describe('environment-selection.ts — no recency/history field', () => {
  it('EnvironmentSelectionRequest declares no lastEnvironment field', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/lastEnvironment\s*[:?]/);
  });

  it('declares no log-history / recent-environments field or _LOG.md reference', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/recentEnvironments\s*[:?]/);
    expect(src).not.toMatch(/_LOG\.md/);
    expect(src).not.toMatch(/from\s+['"].*recent-environment-usage/);
  });
});

// ---------------------------------------------------------------------------------------------
// 14-20: isolation
// ---------------------------------------------------------------------------------------------

describe('environment-selection.ts — isolation', () => {
  function importLines(): string[] {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    return src.match(/^import .*$/gm) ?? [];
  }

  it('imports no Material, Color, Composition, or Benchmark module', () => {
    for (const line of importLines()) {
      expect(line).not.toMatch(/material|glass|shadow|radius|composition|benchmark/i);
      expect(line).not.toMatch(/\bcolor\b/i);
    }
  });

  it('imports no Visual Proof, Revision, or Rethink module', () => {
    for (const line of importLines()) {
      expect(line).not.toMatch(/visual-proof/i);
    }
  });

  it('imports no Website Generation code or offscript/src', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"].*\/(plan|author|website-composition)\.js['"]/);
    expect(src).not.toMatch(/from\s+['"].*src\/generate/);
    expect(src).not.toMatch(/from\s+['"].*\boffscript\/src\b/);
  });

  it('imports EnvironmentSlug/isEnvironmentSlug from environment-library.ts rather than redeclaring the vocabulary', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).toMatch(/from\s+['"]\.\/environment-library\.js['"]/);
  });

  it('imports no HTTP/network client and never calls a hardcoded model API — only the injected dispatch', () => {
    // "JudgmentDispatch" may appear in prose explaining why EnvironmentSelectionDispatch is an
    // independent, sibling type (the same documentation convention this program has used
    // throughout). Sprint 10AE's real executor genuinely calls `opts.dispatch(prompt)` — that is
    // the injected boundary, not a hardcoded network call, so this test checks for the ABSENCE of
    // a concrete HTTP client, never for the absence of the injected dispatch call itself.
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/from\s+['"](node-fetch|axios|https?)['"]/);
    for (const line of importLines()) {
      expect(line).not.toMatch(/visual-proof-judgment-executor/);
    }
  });

  it('contains no absolute Windows drive-letter path literal', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/["'`][A-Za-z]:[\\/]/);
  });
});

// =================================================================================================
// Sprint 10AE — createRealEnvironmentSelectionExecutor
//
// Every test below uses a DETERMINISTIC MOCKED dispatch — a fake EnvironmentSelectionDispatch
// returning a fixed raw string, or throwing, or delaying. None of these tests claim any particular
// belief-fit selection is "correct" — they only prove the executor's OWN mechanics: prompt
// construction, dispatch invocation, timeout handling, strict parsing, and the selected/unavailable
// distinction. A genuine semantic selection (the real model reasoning about an actual belief) is
// exercised separately, outside this unit-test file, by
// offscript/scripts/_sprint10ae-real-environment-selection-run.ts.
// =================================================================================================

function fixedDispatch(response: string): EnvironmentSelectionDispatch {
  return async () => response;
}
function throwingDispatch(message: string): EnvironmentSelectionDispatch {
  return async () => {
    throw new Error(message);
  };
}
function delayedDispatch(response: string, delayMs: number): EnvironmentSelectionDispatch {
  return () => new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'env-selection-executor-test-'));
}

const REAL_EXEC_REQUEST: EnvironmentSelectionRequest = {
  belief: 'this product automates approvals',
  feature: 'automation',
  camera: 'establishing',
  eligibleCandidates: ELIGIBLE,
};

const SELECTED_DAWN_RAW = JSON.stringify({
  status: 'selected',
  environment: 'dawn-haze',
  evidence: 'dawn-haze is marked Hero in the source guidance, matching the establishing camera.',
});
const SELECTED_LAKE_MIRROR_RAW = JSON.stringify({
  status: 'selected',
  environment: 'lake-mirror',
  evidence: 'lake-mirror fits',
});
const UNAVAILABLE_RAW = JSON.stringify({ status: 'unavailable', reason: 'no honest fit among eligible candidates' });

describe('createRealEnvironmentSelectionExecutor - valid eligible selection', () => {
  it('resolves selected when the dispatch returns an eligible, globally valid slug', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_DAWN_RAW) });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome).toEqual({
      outcome: 'selected',
      environment: 'dawn-haze',
      evidence: 'dawn-haze is marked Hero in the source guidance, matching the establishing camera.',
    });
  });
});

describe('createRealEnvironmentSelectionExecutor - globally valid but ineligible result', () => {
  it('resolves unavailable when the dispatch returns a real slug outside the eligible set', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_LAKE_MIRROR_RAW) });
    const outcome = await executor(REAL_EXEC_REQUEST); // eligible = [dawn-haze, valley-deep]
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/eligible candidate set/);
  });
});

describe('createRealEnvironmentSelectionExecutor - invalid slug', () => {
  it('resolves unavailable when the dispatch returns a value outside the governed vocabulary', async () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'not-a-real-environment', evidence: 'x' });
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome.outcome).toBe('unavailable');
  });
});

describe('createRealEnvironmentSelectionExecutor - malformed JSON', () => {
  it('resolves unavailable for non-JSON dispatch output', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch('not json') });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/malformed_response/);
  });
});

describe('createRealEnvironmentSelectionExecutor - missing selection', () => {
  it('resolves unavailable for a selected response missing the environment field', async () => {
    const raw = JSON.stringify({ status: 'selected', evidence: 'x' });
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome.outcome).toBe('unavailable');
  });
});

describe('createRealEnvironmentSelectionExecutor - unavailable response', () => {
  it('passes through a genuine unavailable response', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(UNAVAILABLE_RAW) });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome).toEqual({ outcome: 'unavailable', reason: 'no honest fit among eligible candidates' });
  });
});

describe('createRealEnvironmentSelectionExecutor - real dispatch failure', () => {
  it('resolves unavailable with a dispatch_error reason when dispatch throws', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: throwingDispatch('network exploded') });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^dispatch_error: network exploded/);
  });
});

describe('createRealEnvironmentSelectionExecutor - timeout', () => {
  it('resolves unavailable with reason timeout when dispatch exceeds timeoutMs', async () => {
    const executor = createRealEnvironmentSelectionExecutor({
      dispatch: delayedDispatch(SELECTED_DAWN_RAW, 50),
      timeoutMs: 10,
    });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome).toEqual({ outcome: 'unavailable', reason: 'timeout' });
  });
});

describe('createRealEnvironmentSelectionExecutor - evidence preservation', () => {
  it('preserves the dispatch-supplied evidence string verbatim (trimmed) on a selected outcome', async () => {
    const raw = JSON.stringify({ status: 'selected', environment: 'dawn-haze', evidence: '  exact rationale text  ' });
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(raw) });
    const outcome = await executor(REAL_EXEC_REQUEST);
    expect(outcome.outcome).toBe('selected');
    if (outcome.outcome === 'selected') expect(outcome.evidence).toBe('exact rationale text');
  });
});

describe('createRealEnvironmentSelectionExecutor - candidate-set validation', () => {
  it('the same raw response is accepted or rejected depending on the request eligible set', async () => {
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_LAKE_MIRROR_RAW) });
    const accepted = await executor({ ...REAL_EXEC_REQUEST, eligibleCandidates: ['lake-mirror', 'valley-deep'] });
    const rejected = await executor({ ...REAL_EXEC_REQUEST, eligibleCandidates: ['dawn-haze', 'valley-deep'] });
    expect(accepted.outcome).toBe('selected');
    expect(rejected.outcome).toBe('unavailable');
  });
});

describe('createRealEnvironmentSelectionExecutor - input immutability', () => {
  it('never mutates the request or its eligibleCandidates array', async () => {
    const request = { ...REAL_EXEC_REQUEST, eligibleCandidates: [...ELIGIBLE] };
    const before = JSON.stringify(request);
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_DAWN_RAW) });
    await executor(request);
    expect(JSON.stringify(request)).toBe(before);
  });
});

describe('createRealEnvironmentSelectionExecutor - no eligible candidates (precondition short-circuit)', () => {
  it('resolves unavailable without ever calling dispatch when eligibleCandidates is empty', async () => {
    let dispatchCalled = false;
    const spyDispatch: EnvironmentSelectionDispatch = async () => {
      dispatchCalled = true;
      return SELECTED_DAWN_RAW;
    };
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: spyDispatch });
    const outcome = await executor({ ...REAL_EXEC_REQUEST, eligibleCandidates: [] });
    expect(outcome).toEqual({ outcome: 'unavailable', reason: 'no_eligible_candidates' });
    expect(dispatchCalled).toBe(false);
  });
});

describe('scripted executor remains unchanged', () => {
  it('createScriptedEnvironmentSelectionExecutor still returns the caller-supplied outcome verbatim', async () => {
    const outcome: EnvironmentSelectionOutcome = { outcome: 'selected', environment: 'valley-deep', evidence: 'x' };
    const scripted = createScriptedEnvironmentSelectionExecutor(outcome);
    const result = await scripted(REAL_EXEC_REQUEST);
    expect(result).toEqual(outcome);
  });
});

describe('createRealEnvironmentSelectionExecutor - dispatch-dir audit trail', () => {
  it('writes a request file and a trace file when dispatchDir is given', async () => {
    const dispatchDir = freshDir();
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_DAWN_RAW), dispatchDir });
    await executor(REAL_EXEC_REQUEST);
    const files = readdirSync(dispatchDir);
    expect(files.some((f) => f.endsWith('.selection-request.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.selection-trace.json'))).toBe(true);
  });

  it('the trace file records executor identity, outcome, and evidence, never hidden reasoning', async () => {
    const dispatchDir = freshDir();
    const executor = createRealEnvironmentSelectionExecutor({ dispatch: fixedDispatch(SELECTED_DAWN_RAW), dispatchDir });
    await executor(REAL_EXEC_REQUEST);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.selection-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.executor).toBe(ENVIRONMENT_SELECTION_LLM_EXECUTOR);
    expect(trace.outcome).toBe('selected');
    expect(trace.environment).toBe('dawn-haze');
    expect(Object.keys(trace)).not.toContain('reasoning');
    expect(Object.keys(trace)).not.toContain('chainOfThought');
  });
});

describe('environment-selection.ts - real executor isolation', () => {
  it('createRealEnvironmentSelectionExecutor does not import a Material/Color/Composition/Benchmark module', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    const lines = src.match(/^import .*$/gm) ?? [];
    for (const line of lines) {
      expect(line).not.toMatch(/material|glass|shadow|radius|composition|benchmark/i);
      expect(line).not.toMatch(/\bcolor\b/i);
    }
  });
});
