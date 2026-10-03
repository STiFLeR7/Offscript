import { describe, it, expect } from 'vitest';
import type { Root } from 'hast';
import { findElement } from '../src/working-rep.js';
import { actuatePass } from '../src/actuation.js';
import type { PassSpec } from '../src/actuation.js';
import type { Actuator, ActuationRequest, ActuationResult } from '../src/actuator.js';
import type { Rail } from '../src/gate.js';
import type { Finding, OperatorContext } from '../src/operator.js';

// A test rail: violation unless <html> carries data-fixed="yes".
const markerRail: Rail = {
  name: 'marker-rail',
  detect(tree: Root): Finding[] {
    const html = findElement(tree, 'html');
    return html?.properties?.dataFixed === 'yes'
      ? []
      : [{ id: 'marker-rail', description: 'not fixed', outcome: 'escalated' }];
  },
};

const pass: PassSpec = { name: 'marker', instruction: 'add the marker', rails: [markerRail] };
const ctx: OperatorContext = { params: {} };
const dirty = '<!doctype html><html><head></head><body></body></html>';
const fixed = '<!doctype html><html data-fixed="yes"><head></head><body></body></html>';

// Fakes implementing the Actuator seam.
const passingActuator: Actuator = {
  async harden(): Promise<ActuationResult> {
    return { html: fixed };
  },
};

function flakyActuator(failTimes: number): Actuator {
  let calls = 0;
  return {
    async harden(req: ActuationRequest): Promise<ActuationResult> {
      calls += 1;
      return { html: calls > failTimes ? fixed : req.html };
    },
  };
}

const stubbornActuator: Actuator = {
  async harden(req: ActuationRequest): Promise<ActuationResult> {
    return { html: req.html };
  },
};

describe('actuatePass gate-loop', () => {
  it('converges on the first actuation when the actuator satisfies the rail', async () => {
    const out = await actuatePass(dirty, ctx, pass, passingActuator);
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(1);
    expect(out.html).toContain('data-fixed="yes"');
  });

  it('retries and converges after the actuator eventually satisfies the rail', async () => {
    const out = await actuatePass(dirty, ctx, pass, flakyActuator(2));
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(3); // failed twice, fixed on the third
    expect(out.html).toContain('data-fixed="yes"');
  });

  it('escalates after maxLoops when the actuator never satisfies the rail', async () => {
    const out = await actuatePass(dirty, ctx, pass, stubbornActuator, 3);
    expect(out.log.status).toBe('escalated');
    expect(out.log.loops).toBe(3);
    expect(out.log.residualViolations.length).toBeGreaterThan(0);
    expect(out.log.rails).toEqual(['marker-rail']);
    expect(out.html).not.toContain('data-fixed="yes"');
  });

  it('passes with zero actuations when the artifact is already in bounds', async () => {
    const out = await actuatePass(fixed, ctx, pass, stubbornActuator);
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(0);
  });
});
