import { describe, it, expect } from 'vitest';
import { scriptedActuator } from '../src/actuators/scripted.js';
import type { ActuationRequest } from '../src/actuator.js';

const req = (html: string): ActuationRequest => ({
  pass: 'p',
  instruction: 'i',
  html,
  priorViolations: [],
});

describe('scriptedActuator', () => {
  it('returns the single scripted HTML for every call', async () => {
    const act = scriptedActuator('<fixed/>');
    expect((await act.harden(req('<dirty/>'))).html).toBe('<fixed/>');
    expect((await act.harden(req('<dirty/>'))).html).toBe('<fixed/>');
  });

  it('replays ordered responses by call index', async () => {
    const act = scriptedActuator(['<a/>', '<b/>', '<c/>']);
    expect((await act.harden(req('x'))).html).toBe('<a/>');
    expect((await act.harden(req('x'))).html).toBe('<b/>');
    expect((await act.harden(req('x'))).html).toBe('<c/>');
  });

  it("'last' (default) replays the final response after the script is exhausted", async () => {
    const act = scriptedActuator(['<a/>', '<b/>']);
    await act.harden(req('x'));
    await act.harden(req('x'));
    expect((await act.harden(req('x'))).html).toBe('<b/>');
  });

  it("'passthrough' returns the request HTML unchanged after exhaustion", async () => {
    const act = scriptedActuator(['<a/>'], 'passthrough');
    await act.harden(req('x'));
    expect((await act.harden(req('<unchanged/>'))).html).toBe('<unchanged/>');
  });

  it('supports a function form receiving the request and the (0-based) call index', async () => {
    const act = scriptedActuator((r: ActuationRequest, call: number) => `${r.html}-${call}`);
    expect((await act.harden(req('h'))).html).toBe('h-0');
    expect((await act.harden(req('h'))).html).toBe('h-1');
  });
});
