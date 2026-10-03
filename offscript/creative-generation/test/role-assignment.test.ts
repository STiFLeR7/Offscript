import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateRoleAssignment,
  createScriptedRoleAssignmentExecutor,
  buildRoleAssignmentPrompt,
  parseRoleAssignmentResponse,
  createRealRoleAssignmentExecutor,
  ROLE_ASSIGNMENT_LLM_EXECUTOR,
  type RoleAssignmentRequest,
  type RoleAssignmentOutcome,
  type RoleAssignmentDispatch,
} from '../src/role-assignment.js';

const COMPONENTS = ['workflow builder', 'execution status', 'automation timeline', 'success notification'];

const REQUEST: RoleAssignmentRequest = {
  belief: 'AI agents run the operation end to end, with people still in control of what matters',
  feature: 'automation',
  mustInclude: ['the agent executing a multi-step workflow autonomously'],
  components: COMPONENTS,
};

// ── validateRoleAssignment — the core partition rule ─────────────────────────────────────────
describe('validateRoleAssignment', () => {
  it('a complete, valid partition is assigned', () => {
    const outcome = validateRoleAssignment(
      {
        hero: 'execution status',
        support: ['workflow builder'],
        signal: ['automation timeline'],
        subordinateContext: ['success notification'],
        unassigned: [],
      },
      COMPONENTS,
      'clear single hero',
    );
    expect(outcome.outcome).toBe('assigned');
    if (outcome.outcome === 'assigned') {
      expect(outcome.roles.hero).toBe('execution status');
      expect(outcome.evidence).toBe('clear single hero');
    }
  });

  it('a hero not present in the component list is rejected', () => {
    const outcome = validateRoleAssignment(
      { hero: 'nonexistent thing', support: [], signal: [], subordinateContext: [], unassigned: COMPONENTS },
      COMPONENTS,
      'x',
    );
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_role: hero/);
  });

  it('a support entry not in the component list is rejected — never a silently invented component', () => {
    const outcome = validateRoleAssignment(
      {
        hero: 'execution status',
        support: ['a made-up widget'],
        signal: [],
        subordinateContext: [],
        unassigned: ['workflow builder', 'automation timeline', 'success notification'],
      },
      COMPONENTS,
      'x',
    );
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_role: support entry/);
  });

  it('a component appearing in more than one bucket is rejected', () => {
    const outcome = validateRoleAssignment(
      {
        hero: 'execution status',
        support: ['workflow builder'],
        signal: ['workflow builder'],
        subordinateContext: ['automation timeline'],
        unassigned: ['success notification'],
      },
      COMPONENTS,
      'x',
    );
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/appears in more than one role bucket/);
  });

  it('an incomplete partition — a component left out of every bucket — is rejected, never silently dropped', () => {
    const outcome = validateRoleAssignment(
      { hero: 'execution status', support: ['workflow builder'], signal: [], subordinateContext: [], unassigned: [] },
      COMPONENTS,
      'x',
    );
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') {
      expect(outcome.reason).toMatch(/^incomplete_role_assignment/);
      expect(outcome.reason).toContain('automation timeline');
      expect(outcome.reason).toContain('success notification');
    }
  });

  it('an honest, non-empty "unassigned" bucket is a VALID assigned outcome, never a rejection', () => {
    const outcome = validateRoleAssignment(
      {
        hero: 'execution status',
        support: ['workflow builder'],
        signal: [],
        subordinateContext: [],
        unassigned: ['automation timeline', 'success notification'],
      },
      COMPONENTS,
      'two components read as generic decoration for this belief',
    );
    expect(outcome.outcome).toBe('assigned');
    if (outcome.outcome === 'assigned') {
      expect(outcome.roles.unassigned).toEqual(['automation timeline', 'success notification']);
    }
  });

  it('a missing/empty hero is rejected', () => {
    const outcome = validateRoleAssignment(
      { hero: '', support: [], signal: [], subordinateContext: [], unassigned: COMPONENTS },
      COMPONENTS,
      'x',
    );
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_role: hero must be/);
  });
});

// ── createScriptedRoleAssignmentExecutor ──────────────────────────────────────────────────────
describe('createScriptedRoleAssignmentExecutor', () => {
  it('always returns the caller-supplied outcome verbatim, performing no validation itself', async () => {
    const invalidOutcome: RoleAssignmentOutcome = {
      outcome: 'assigned',
      roles: { hero: 'not a real component', support: [], signal: [], subordinateContext: [], unassigned: [] },
      evidence: 'stub does not check this',
    };
    const executor = createScriptedRoleAssignmentExecutor(invalidOutcome);
    const result = await executor(REQUEST);
    expect(result).toBe(invalidOutcome);
  });
});

// ── buildRoleAssignmentPrompt ──────────────────────────────────────────────────────────────────
describe('buildRoleAssignmentPrompt', () => {
  it('includes belief, feature, mustInclude, and every component', () => {
    const prompt = buildRoleAssignmentPrompt(REQUEST);
    expect(prompt).toContain(REQUEST.belief);
    expect(prompt).toContain(REQUEST.feature);
    expect(prompt).toContain('the agent executing a multi-step workflow autonomously');
    for (const c of COMPONENTS) expect(prompt).toContain(c);
  });

  it('quotes the source meaning of each role', () => {
    const prompt = buildRoleAssignmentPrompt(REQUEST);
    expect(prompt).toMatch(/the dominant product object\/state/i);
    expect(prompt).toMatch(/what reinforces it/i);
    expect(prompt).toMatch(/the live detail/i);
    expect(prompt).toMatch(/subordinate context/i);
  });

  it('instructs full coverage — every component in exactly one bucket', () => {
    const prompt = buildRoleAssignmentPrompt(REQUEST);
    expect(prompt).toMatch(/exactly one of/i);
    expect(prompt).toMatch(/do not leave any component out/i);
  });

  it('states an honest unassigned component is a valid, non-failure answer', () => {
    const prompt = buildRoleAssignmentPrompt(REQUEST);
    expect(prompt).toMatch(/not a failure/i);
  });

  it('forbids inventing a component name', () => {
    const prompt = buildRoleAssignmentPrompt(REQUEST);
    expect(prompt).toMatch(/never invent a component/i);
  });
});

// ── parseRoleAssignmentResponse ───────────────────────────────────────────────────────────────
describe('parseRoleAssignmentResponse', () => {
  it('parses a valid, complete assignment', () => {
    const raw = JSON.stringify({
      status: 'assigned',
      hero: 'execution status',
      support: ['workflow builder'],
      signal: ['automation timeline'],
      subordinateContext: ['success notification'],
      unassigned: [],
      evidence: 'clear',
    });
    const outcome = parseRoleAssignmentResponse(raw, COMPONENTS);
    expect(outcome.outcome).toBe('assigned');
  });

  it('malformed JSON becomes unavailable', () => {
    const outcome = parseRoleAssignmentResponse('{not json,,', COMPONENTS);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^malformed_response/);
  });

  it('an invented field (e.g. "confidence") is rejected outright', () => {
    const raw = JSON.stringify({
      status: 'assigned',
      hero: 'execution status',
      support: [],
      signal: [],
      subordinateContext: [],
      unassigned: ['workflow builder', 'automation timeline', 'success notification'],
      evidence: 'x',
      confidence: 0.9,
    });
    const outcome = parseRoleAssignmentResponse(raw, COMPONENTS);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invented_field/);
  });

  it('an unavailable response passes its reason through verbatim', () => {
    const raw = JSON.stringify({ status: 'unavailable', reason: 'no basis to name any component' });
    const outcome = parseRoleAssignmentResponse(raw, COMPONENTS);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('no basis to name any component');
  });

  it('a hero string not in the components list is rejected via validateRoleAssignment', () => {
    const raw = JSON.stringify({
      status: 'assigned',
      hero: 'invented hero',
      support: [],
      signal: [],
      subordinateContext: [],
      unassigned: COMPONENTS,
      evidence: 'x',
    });
    const outcome = parseRoleAssignmentResponse(raw, COMPONENTS);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^invalid_role: hero/);
  });

  it('missing support/signal/subordinateContext/unassigned default to empty arrays', () => {
    const raw = JSON.stringify({
      status: 'assigned',
      hero: 'workflow builder',
      unassigned: ['execution status', 'automation timeline', 'success notification'],
      evidence: 'x',
    });
    const outcome = parseRoleAssignmentResponse(raw, COMPONENTS);
    expect(outcome.outcome).toBe('assigned');
    if (outcome.outcome === 'assigned') {
      expect(outcome.roles.support).toEqual([]);
      expect(outcome.roles.signal).toEqual([]);
    }
  });
});

// ── createRealRoleAssignmentExecutor ──────────────────────────────────────────────────────────
function fixedDispatch(response: string): RoleAssignmentDispatch {
  return async () => response;
}
function throwingDispatch(message: string): RoleAssignmentDispatch {
  return async () => {
    throw new Error(message);
  };
}
function delayedDispatch(response: string, delayMs: number): RoleAssignmentDispatch {
  return () => new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}

const VALID_ASSIGNED_RAW = JSON.stringify({
  status: 'assigned',
  hero: 'execution status',
  support: ['workflow builder'],
  signal: ['automation timeline'],
  subordinateContext: ['success notification'],
  unassigned: [],
  evidence: 'clear single hero',
});

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-role-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

describe('createRealRoleAssignmentExecutor — precondition short-circuit', () => {
  it('resolves unavailable("no_components") WITHOUT calling dispatch when components is empty', async () => {
    let called = false;
    const executor = createRealRoleAssignmentExecutor({
      dispatch: async () => {
        called = true;
        return VALID_ASSIGNED_RAW;
      },
    });
    const outcome = await executor({ ...REQUEST, components: [] });
    expect(outcome).toEqual({ outcome: 'unavailable', reason: 'no_components' });
    expect(called).toBe(false);
  });
});

describe('createRealRoleAssignmentExecutor — dispatch mechanics', () => {
  it('a valid response resolves assigned', async () => {
    const executor = createRealRoleAssignmentExecutor({ dispatch: fixedDispatch(VALID_ASSIGNED_RAW) });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('assigned');
  });

  it('a thrown dispatch error becomes unavailable, never a fabricated assignment', async () => {
    const executor = createRealRoleAssignmentExecutor({ dispatch: throwingDispatch('network reset') });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/^dispatch_error/);
  });

  it('a dispatch that resolves after the timeout window becomes unavailable with reason "timeout"', async () => {
    const executor = createRealRoleAssignmentExecutor({
      dispatch: delayedDispatch(VALID_ASSIGNED_RAW, 60),
      timeoutMs: 10,
    });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('timeout');
  });
});

describe('createRealRoleAssignmentExecutor — dispatch-dir audit trail', () => {
  it('writes a request file and a trace file when dispatchDir is given', async () => {
    const dispatchDir = freshDir();
    const executor = createRealRoleAssignmentExecutor({ dispatch: fixedDispatch(VALID_ASSIGNED_RAW), dispatchDir });
    await executor(REQUEST);
    const files = readdirSync(dispatchDir);
    expect(files.some((f) => f.endsWith('.role-request.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.role-trace.json'))).toBe(true);
  });

  it('the trace file records executor identity and the assigned roles', async () => {
    const dispatchDir = freshDir();
    const executor = createRealRoleAssignmentExecutor({ dispatch: fixedDispatch(VALID_ASSIGNED_RAW), dispatchDir });
    await executor(REQUEST);
    const traceFile = readdirSync(dispatchDir).find((f) => f.endsWith('.role-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.executor).toBe(ROLE_ASSIGNMENT_LLM_EXECUTOR);
    expect(trace.hero).toBe('execution status');
  });
});
