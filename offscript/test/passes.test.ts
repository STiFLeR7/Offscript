import { describe, it, expect } from 'vitest';
import { actuatePass } from '../src/actuation.js';
import { scriptedActuator } from '../src/actuators/scripted.js';
import { contrastPass, brandFidelityPass, judgmentPasses } from '../src/passes.js';
import { loadTokens } from '../src/tokens.js';
import type { OperatorContext } from '../src/operator.js';

// Post-website-pivot (#46): `src/passes.ts` bakes its instructions at module load via
// composeInstruction. The section-intelligence playbook and the guardrail docs
// (color-expansion / theme-orchestration / anti-slop-checklist) were removed in the
// pivot, so the composer now DEGRADES those sections (names the absent docs) instead of
// throwing ENOENT — the module imports cleanly and these tests assert the degraded shape.

describe('judgment PassSpecs — shape and degraded bounds', () => {
  it('contrastPass gates on the contrast rail; removed colour/contrast guardrails degrade to named-absent notes', () => {
    expect(contrastPass.name).toBe('contrast');
    expect(contrastPass.rails.map((r) => r.name)).toEqual(['contrast']);
    expect(contrastPass.instruction).toContain('--- color-expansion.md ---');
    expect(contrastPass.instruction).toContain('--- theme-orchestration.md ---');
    expect(contrastPass.instruction).toContain('not on disk for this track');
  });

  it('brandFidelityPass gates on the brand-fidelity-scan rail; removed brand guardrails degrade', () => {
    expect(brandFidelityPass.name).toBe('brand-fidelity');
    expect(brandFidelityPass.rails.map((r) => r.name)).toEqual(['brand-fidelity-scan']);
    expect(brandFidelityPass.instruction).toContain('--- theme-orchestration.md ---');
    expect(brandFidelityPass.instruction).toContain('--- anti-slop-checklist.md ---');
  });

  it('exposes the ordered judgment passes (contrast, then brand-fidelity)', () => {
    expect(judgmentPasses).toEqual([contrastPass, brandFidelityPass]);
  });
});

describe('contrastPass end-to-end against the real contrast rail', () => {
  const ctx: OperatorContext = { params: {} };
  const failing = '<!doctype html><html><head></head><body><p style="color:#ffffff;background:#149dff">x</p></body></html>';
  const passing = '<!doctype html><html><head></head><body><p style="color:#000000;background:#ffffff">x</p></body></html>';

  it('converges to passed when the actuator returns an AA-passing variant', async () => {
    const out = await actuatePass(failing, ctx, contrastPass, scriptedActuator(passing));
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(1);
    expect(out.log.rails).toEqual(['contrast']);
  });

  it('escalates with residualViolations when the actuator never fixes the contrast', async () => {
    const stubborn = scriptedActuator([], 'passthrough');
    const out = await actuatePass(failing, ctx, contrastPass, stubborn, 3);
    expect(out.log.status).toBe('escalated');
    expect(out.log.loops).toBe(3);
    expect(out.log.residualViolations.length).toBeGreaterThan(0);
  });
});

describe('brandFidelityPass end-to-end against the real brand-fidelity-scan rail', () => {
  const tokens = loadTokens('{ "color": { "accent": "#2563eb" } }');
  const ctx: OperatorContext = { params: {}, tokens };
  const offToken = '<!doctype html><html><head><style>a{color:#ff0000}</style></head><body></body></html>';
  const onToken = '<!doctype html><html><head><style>a{color:#2563eb}</style></head><body></body></html>';

  it('converges to passed when the actuator rewrites off-token colours to brand values', async () => {
    const out = await actuatePass(offToken, ctx, brandFidelityPass, scriptedActuator(onToken));
    expect(out.log.status).toBe('passed');
    expect(out.log.loops).toBe(1);
    expect(out.log.rails).toEqual(['brand-fidelity-scan']);
  });
});
