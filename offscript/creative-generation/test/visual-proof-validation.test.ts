/**
 * Sprint 10F — Visual Proof Validation methodology + contract port (q1-q4, sync).
 * Sprint 10I — HANDOFF-v3 methodology extension (Q5/Q6 ported into the METHODOLOGY DOCUMENT only;
 *   the runtime contract deliberately stayed at q1-q4 that sprint).
 * Sprint 10J — THIS sprint: contract evolution. Extends the runtime answer to q1-q6, makes the
 *   executor async, adds optional `camera`/`components` request context, and introduces the
 *   judged/unavailable executor-outcome distinction. Still NO semantic judgment anywhere in this
 *   file or the module it tests — the scripted stub requires the caller to supply all six answers
 *   explicitly and never inspects `belief`/`feature`/`mustInclude`/`camera`/`components` content to
 *   decide anything. No test here asserts that a specific belief "should" produce a specific
 *   judgment — that would be fabricated semantic truth.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createScriptedStubExecutor,
  toArtifactValidation,
  answerFromOutcome,
  loadVisualProofValidationMethodology,
  VISUAL_PROOF_VALIDATION_VERSION,
  VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR,
  type VisualProofValidationRequest,
  type VisualProofValidationAnswer,
  type VisualProofValidationAnswers,
  type VisualProofValidationExecutor,
  type VisualProofValidationOutcome,
} from '../src/visual-proof-validation.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/visual-proof-validation.ts', import.meta.url));

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

const ALL_YES: VisualProofValidationAnswers = { q1: true, q2: true, q3: true, q4: true, q5: true, q6: true };

// ── Sprint 10AE — optional environment field ────────────────────────────────────────────────────
const REQUEST_WITH_ENVIRONMENT: VisualProofValidationRequest = {
  ...REQUEST,
  environment: 'dawn-haze',
};

describe('VisualProofValidationRequest — optional environment field', () => {
  it('accepts a real EnvironmentSlug on the environment field', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST_WITH_ENVIRONMENT);
    expect(answer).toBeDefined();
  });

  it('the field remains optional — a request with no environment is still well-formed', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST);
    expect(answer).toBeDefined();
  });

  it('the source declares environment as bare EnvironmentSlug, never a richer EnvironmentContext object', () => {
    // A prose mention of "EnvironmentContext" explaining why it was NOT chosen is fine (the same
    // documentation convention this program uses throughout) — what must be absent is an actual
    // type/interface declaration by that name.
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).toMatch(/environment\?:\s*EnvironmentSlug/);
    expect(src).not.toMatch(/interface\s+EnvironmentContext/);
    expect(src).not.toMatch(/type\s+EnvironmentContext\s*=/);
  });

  it('imports EnvironmentSlug from environment-library.ts rather than redeclaring the vocabulary', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).toMatch(/from\s+['"]\.\/environment-library\.js['"]/);
  });
});

// ── Sprint 10AG — optional roles field ──────────────────────────────────────────────────────────
const REQUEST_WITH_ROLES: VisualProofValidationRequest = {
  ...REQUEST_WITH_CONTEXT,
  roles: {
    hero: 'triage queue list',
    support: ['severity badge'],
    signal: ['assignee avatar'],
    subordinateContext: ['resolve button'],
    unassigned: [],
  },
};

describe('VisualProofValidationRequest — optional roles field', () => {
  it('accepts a real RoleAssignment on the roles field', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST_WITH_ROLES);
    expect(answer).toBeDefined();
  });

  it('the field remains optional — a request with no roles is still well-formed', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST);
    expect(answer).toBeDefined();
  });

  it('imports RoleAssignment from role-assignment.ts rather than redeclaring the shape', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).toMatch(/roles\?:\s*RoleAssignment/);
    expect(src).toMatch(/from\s+['"]\.\/role-assignment\.js['"]/);
  });
});

describe('scripted stub — request accepts valid belief/feature/mustInclude', () => {
  it('produces an answer when given a well-formed request and caller-supplied answers', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST);
    expect(answer).toBeDefined();
  });
});

describe('scripted stub — answer shape (six questions)', () => {
  it('the answer contains q1..q6, passed, and evidence', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const answer = await executor(REQUEST);
    expect(answer).toHaveProperty('q1');
    expect(answer).toHaveProperty('q2');
    expect(answer).toHaveProperty('q3');
    expect(answer).toHaveProperty('q4');
    expect(answer).toHaveProperty('q5');
    expect(answer).toHaveProperty('q6');
    expect(answer).toHaveProperty('passed');
    expect(answer).toHaveProperty('evidence');
    expect(typeof answer.evidence).toBe('string');
  });

  it('the answer object has exactly six boolean fields plus passed and evidence — no q7, no score, no confidence, no weights', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(Object.keys(answer).sort()).toEqual(['evidence', 'passed', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  });

  it('individual answers remain visible, never collapsed into passed alone', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q2: false })(REQUEST);
    expect(answer.q1).toBe(true);
    expect(answer.q2).toBe(false);
    expect(answer.q3).toBe(true);
    expect(answer.q4).toBe(true);
    expect(answer.q5).toBe(true);
    expect(answer.q6).toBe(true);
  });
});

describe('scripted stub — pass/fail derivation across all six questions', () => {
  it('passed is true when all six are true', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(answer.passed).toBe(true);
  });

  it('passed is false when any single one of the six is false', async () => {
    for (const key of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const) {
      const answers = { ...ALL_YES, [key]: false };
      const answer = await createScriptedStubExecutor(answers)(REQUEST);
      expect(answer.passed).toBe(false);
    }
  });

  it('multiple failures remain individually visible even though passed is a single false', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q1: false, q5: false })(REQUEST);
    expect(answer.passed).toBe(false);
    expect(answer.q1).toBe(false);
    expect(answer.q2).toBe(true);
    expect(answer.q3).toBe(true);
    expect(answer.q4).toBe(true);
    expect(answer.q5).toBe(false);
    expect(answer.q6).toBe(true);
  });

  it('Q5 false alone fails the gate', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q5: false })(REQUEST);
    expect(answer.passed).toBe(false);
  });

  it('Q6 false alone fails the gate', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q6: false })(REQUEST);
    expect(answer.passed).toBe(false);
  });
});

describe('scripted stub — does not claim semantic judgment', () => {
  it('evidence text identifies itself as a scripted stub, not real judgment', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(answer.evidence.toUpperCase()).toContain('SCRIPTED STUB');
  });

  it('an identical request with different caller-supplied answers produces a different result — proving no judgment is derived from request content', async () => {
    const yes = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const no = await createScriptedStubExecutor({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: false })(REQUEST);
    expect(yes.passed).toBe(true);
    expect(no.passed).toBe(false);
    // same belief/feature/mustInclude in both calls — the only thing that changed was the
    // caller-supplied answers, proving the stub never reasons over request content itself.
  });

  it('adding camera/components context to the request does not change the stub result for identical answers — context is ignored for judgment', async () => {
    const withoutContext = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const withContext = await createScriptedStubExecutor(ALL_YES)(REQUEST_WITH_CONTEXT);
    expect(withContext.q1).toBe(withoutContext.q1);
    expect(withContext.q2).toBe(withoutContext.q2);
    expect(withContext.q3).toBe(withoutContext.q3);
    expect(withContext.q4).toBe(withoutContext.q4);
    expect(withContext.q5).toBe(withoutContext.q5);
    expect(withContext.q6).toBe(withoutContext.q6);
    expect(withContext.passed).toBe(withoutContext.passed);
  });

  it('a "malformed"-shaped components list (empty strings, duplicates) does not break or change the stub — content is never inspected', async () => {
    const weirdRequest: VisualProofValidationRequest = {
      ...REQUEST,
      components: ['', 'duplicate', 'duplicate', '   '],
    };
    const answer = await createScriptedStubExecutor(ALL_YES)(weirdRequest);
    expect(answer.passed).toBe(true);
    expect(answer.q3).toBe(true);
  });
});

describe('validation mapping — passed / failed / unknown', () => {
  it('an all-yes answer maps to status "passed"', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const validation = toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('passed');
  });

  it('a one-no answer (Q5) maps to status "failed"', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q5: false })(REQUEST);
    const validation = toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('failed');
  });

  it('a one-no answer (Q6) maps to status "failed"', async () => {
    const answer = await createScriptedStubExecutor({ ...ALL_YES, q6: false })(REQUEST);
    const validation = toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('failed');
  });

  it('an absent answer (judgment not executed) maps to status "unknown", never "failed"', () => {
    const validation = toArtifactValidation(undefined, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.status).toBe('unknown');
    expect(validation.status).not.toBe('failed');
  });

  it('the validator label is carried through, distinguishing a stub result from a real one, and stays distinct from the methodology version', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const validation = toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.validator).toBe(VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR);
    expect(VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR).not.toBe(VISUAL_PROOF_VALIDATION_VERSION);
  });

  it('validatedAt is carried through verbatim', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const validation = toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(validation.validatedAt).toBe('2026-08-12T00:00:00.000Z');
  });
});

describe('determinism and immutability', () => {
  it('the same request and answers produce an equivalent result across repeated calls', async () => {
    const a = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const b = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(a).toEqual(b);
  });

  it('the returned answer is frozen — mutation throws', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(() => {
      (answer as { passed: boolean }).passed = false;
    }).toThrow();
  });

  it('the returned validation mapping does not mutate the input answer', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    toArtifactValidation(answer, VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR, '2026-08-12T00:00:00.000Z');
    expect(answer.passed).toBe(true);
  });
});

describe('the future seam boundary — the scripted stub implements the (now async) real executor interface', () => {
  it('createScriptedStubExecutor returns a function assignable to VisualProofValidationExecutor and returns a Promise', async () => {
    const executor: VisualProofValidationExecutor = createScriptedStubExecutor(ALL_YES);
    const result = executor(REQUEST);
    expect(result).toBeInstanceOf(Promise);
    const answer = await result;
    expect(answer.passed).toBe(true);
  });
});

describe('request context — camera and components (Sprint 10J, additive to Sprint 10F)', () => {
  it('a request without camera/components remains valid — backward compatible with the original three-field request', async () => {
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    expect(answer).toBeDefined();
    expect(REQUEST).not.toHaveProperty('camera');
    expect(REQUEST).not.toHaveProperty('components');
  });

  it('a request with a camera candidate is valid', async () => {
    const req: VisualProofValidationRequest = { ...REQUEST, camera: 'macro' };
    const answer = await createScriptedStubExecutor(ALL_YES)(req);
    expect(answer).toBeDefined();
  });

  it('a request with a components list is valid', async () => {
    const req: VisualProofValidationRequest = { ...REQUEST, components: ['a', 'b'] };
    const answer = await createScriptedStubExecutor(ALL_YES)(req);
    expect(answer).toBeDefined();
  });

  it('camera accepts every value of the existing five-value Camera vocabulary (establishing/product/workflow/component/macro) — no new enum', async () => {
    const cameras = ['establishing', 'product', 'workflow', 'component', 'macro'] as const;
    for (const camera of cameras) {
      const req: VisualProofValidationRequest = { ...REQUEST, camera };
      const answer = await createScriptedStubExecutor(ALL_YES)(req);
      expect(answer.passed).toBe(true);
    }
  });

  it('components is readonly — the request type does not permit push/mutation (structural, not a runtime assertion)', () => {
    const req: VisualProofValidationRequest = { ...REQUEST, components: ['a', 'b'] };
    // @ts-expect-error components is readonly string[]
    req.components.push('c');
    expect(req.components).toEqual(['a', 'b', 'c']); // JS arrays are mutable at runtime even when the TS type is readonly; the guarantee is compile-time only, proven by the ts-expect-error above
  });

  it('no duplicate Feature Mapping enum exists in this module — the source file imports the Camera type rather than redeclaring one', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toMatch(/export type Camera\s*=/);
    expect(src).toMatch(/import type \{ Camera \} from '\.\/camera-selection\.js'/);
  });
});

describe('async executor — Sprint 10G §6 requirement', () => {
  it('the executor type resolves a Promise, not a bare value', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const maybePromise = executor(REQUEST);
    expect(typeof (maybePromise as Promise<unknown>).then).toBe('function');
    await maybePromise;
  });

  it('a caller can compose the executor with real async work (e.g. await Promise.all across requests)', async () => {
    const executor = createScriptedStubExecutor(ALL_YES);
    const [a, b] = await Promise.all([executor(REQUEST), executor(REQUEST_WITH_CONTEXT)]);
    expect(a.passed).toBe(true);
    expect(b.passed).toBe(true);
  });
});

describe('judged vs. unavailable outcome (Sprint 10G §10 — mechanism failure must never become "failed")', () => {
  it('a "judged" outcome carries a real answer', () => {
    const outcome: VisualProofValidationOutcome = { outcome: 'judged', answer: { ...ALL_YES, passed: true, evidence: 'x' } };
    expect(outcome.outcome).toBe('judged');
  });

  it('an "unavailable" outcome carries a reason, never an answer', () => {
    const outcome: VisualProofValidationOutcome = { outcome: 'unavailable', reason: 'executor timed out' };
    expect(outcome.outcome).toBe('unavailable');
    expect(outcome).not.toHaveProperty('answer');
  });

  it('answerFromOutcome extracts the answer from a "judged" outcome', () => {
    const answer: VisualProofValidationAnswer = { ...ALL_YES, passed: true, evidence: 'x' };
    const outcome: VisualProofValidationOutcome = { outcome: 'judged', answer };
    expect(answerFromOutcome(outcome)).toBe(answer);
  });

  it('answerFromOutcome collapses an "unavailable" outcome to undefined', () => {
    const outcome: VisualProofValidationOutcome = { outcome: 'unavailable', reason: 'LLM refused' };
    expect(answerFromOutcome(outcome)).toBeUndefined();
  });

  it('answerFromOutcome collapses an absent (never-run) outcome to undefined', () => {
    expect(answerFromOutcome(undefined)).toBeUndefined();
  });

  it('an "unavailable" outcome, routed through answerFromOutcome and toArtifactValidation, maps to "unknown" — NEVER "failed"', () => {
    const outcome: VisualProofValidationOutcome = { outcome: 'unavailable', reason: 'network error' };
    const validation = toArtifactValidation(
      answerFromOutcome(outcome),
      VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR,
      '2026-08-12T00:00:00.000Z',
    );
    expect(validation.status).toBe('unknown');
    expect(validation.status).not.toBe('failed');
  });

  it('a "judged" outcome with passed=false still maps to "failed" — a real "no" is not softened by the outcome wrapper', () => {
    const answer: VisualProofValidationAnswer = { ...ALL_YES, q5: false, passed: false, evidence: 'x' };
    const outcome: VisualProofValidationOutcome = { outcome: 'judged', answer };
    const validation = toArtifactValidation(
      answerFromOutcome(outcome),
      VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR,
      '2026-08-12T00:00:00.000Z',
    );
    expect(validation.status).toBe('failed');
  });

  it('"unavailable" is not itself a CreativeArtifactValidation status — the public status enum stays passed/failed/unknown', () => {
    const outcome: VisualProofValidationOutcome = { outcome: 'unavailable', reason: 'x' };
    const validation = toArtifactValidation(
      answerFromOutcome(outcome),
      VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR,
      '2026-08-12T00:00:00.000Z',
    );
    expect(['passed', 'failed', 'unknown']).toContain(validation.status);
  });
});

describe('visual-proof-validation.ts — the document is the source of truth for the question wording', () => {
  it('the implementation source file does not embed the four original question sentences verbatim', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toContain('Can someone understand the feature without reading any body copy');
    expect(src).not.toContain('If 40% of the interface were cropped away');
  });

  it('the implementation source file does not embed the two v3 question sentences verbatim either', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src).not.toContain('Is every element nameable as hero');
    expect(src).not.toContain('Would this still be a product creative on a flat grey background');
  });

  it('the implementation source file contains no client-specific string', () => {
    const src = readFileSync(SOURCE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('example-brand');
    expect(src.toLowerCase()).not.toContain('apa');
  });

  it('loadVisualProofValidationMethodology reads the real document, which contains all four original questions (Q1-Q4)', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('Can someone understand the feature');
    expect(doc).toContain('exactly one');
    expect(doc).toContain('every');
    expect(doc).toContain('40% of the interface');
  });
});

// ── Sprint 10I — HANDOFF-v3 methodology extension (Q5/Q6, Decision Record additions) ──────────
// The DOCUMENT was already extended in Sprint 10I. These tests verify the document content only.
describe('visual-proof-validation.ts — HANDOFF-v3 extension is reflected in the loaded methodology (Sprint 10I)', () => {
  it('loadVisualProofValidationMethodology reads the real document, which now contains Q5 verbatim', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('Is every element nameable as hero / support / signal / subordinate context?');
    expect(doc).toMatch(/An element with\s+no role is decoration — cut it\./);
  });

  it('loadVisualProofValidationMethodology reads the real document, which now contains Q6 verbatim', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('Would this still be a product creative on a flat grey background?');
    expect(doc).toMatch(/never decoration \(rings\/halos\/dots\) and never more data/);
  });

  it('the document documents the gate as six questions, not merely four', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('## The six questions');
    expect(doc).toMatch(/grew from\s+four questions to six/);
  });

  it('the binary "any no fails" gate semantics are preserved and explicitly extended to all six', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toMatch(/Any "no" → rethink the composition before rendering/);
    expect(doc).not.toMatch(/numeric score|weighted score|point system/i);
  });

  it('the document records that v3 added no numeric scoring system (qualitative checks only)', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toMatch(/No threshold moved\.\s+This era added qualitative checks only\./);
  });

  it('the document documents the new Decision Record field "surfaces=<n≤3>"', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('surfaces=<n≤3>');
    expect(doc).toMatch(/hard maximum of 3/);
  });

  it('the document documents the new Decision Record field "roles="', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('roles=');
    expect(doc).toMatch(/hero.*support.*signal.*subordinate context/s);
  });

  it('the document preserves v2 provenance alongside the new v3 provenance (both cited, neither erased)', () => {
    const doc = loadVisualProofValidationMethodology();
    expect(doc).toContain('HANDOFF-v2.md');
    expect(doc).toContain('HANDOFF-v3-composition-laws.md');
  });

  it('the runtime module NOW models all six questions on the answer shape (Sprint 10J closes the gap Sprint 10I documented)', async () => {
    // Structural guard: this sprint DID extend the TypeScript contract — the scripted stub's
    // answer now has six boolean fields, not four, closing the deliberate gap Sprint 10I recorded.
    const answer = await createScriptedStubExecutor(ALL_YES)(REQUEST);
    const keys = Object.keys(answer).sort();
    expect(keys).toEqual(['evidence', 'passed', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  });
});

describe('native methodology doc and its runtime mirror are byte-identical', () => {
  it('design/creative source and the resources mirror have identical content', () => {
    const nativePath = fileURLToPath(
      new URL(
        '../../../design/creative/governance/creative/VISUAL-PROOF-VALIDATION.md',
        import.meta.url,
      ),
    );
    const mirrorPath = fileURLToPath(
      new URL(
        '../../resources/design_processes/creative/VISUAL-PROOF-VALIDATION.md',
        import.meta.url,
      ),
    );
    const native = readFileSync(nativePath, 'utf8');
    const mirror = readFileSync(mirrorPath, 'utf8');
    expect(mirror).toBe(native);
  });
});

describe('methodology identity vs. executor identity stay distinct', () => {
  it('the methodology version was bumped to reflect the six-question contract, and is distinct from the stub validator label', () => {
    expect(VISUAL_PROOF_VALIDATION_VERSION).toBe('visual-proof-validation-v2');
    expect(VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR).not.toBe(VISUAL_PROOF_VALIDATION_VERSION);
    expect(VISUAL_PROOF_VALIDATION_SCRIPTED_STUB_VALIDATOR).toContain('scripted-stub');
  });
});

describe('no fabricated semantic claims', () => {
  it('this module exports no function that accepts only a request and returns an answer without caller-supplied answers', () => {
    // Structural guard: createScriptedStubExecutor's signature requires answers up front — there
    // is no zero-argument-judgment path anywhere in this module.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((createScriptedStubExecutor as any).length).toBeGreaterThanOrEqual(1);
  });
});
