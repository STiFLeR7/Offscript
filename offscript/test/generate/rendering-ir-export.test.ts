/**
 * C1 — Rendering IR Export (RED-first).
 *
 * The generation-pipeline-facing seam that turns a completed `AuthoringPlan` into the persisted
 * `rendering-ir.json` artifact. Pure composition of three already-tested D1 exports
 * (`buildRenderingIR` / `validateRenderingIR` / `serializeRenderingIR`) — no new derivation logic,
 * no new validation logic. The only new behavior is the fail-loud gate between build and
 * serialize, and the (plan, brief, siteMetadata) → artifact convenience wrapper the generation
 * script calls.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRenderingIR,
  validateRenderingIR,
  serializeRenderingIR,
  type RenderingIR,
} from '../../src/generate/rendering-ir.js';
import { exportRenderingIR, buildRenderingIRArtifact } from '../../src/generate/rendering-ir-export.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number): PlanItem {
  return {
    anchor: { id, anchor: id, landmark: id === 'hero' ? 'main' : undefined },
    archetype: 'hero',
    tokenRoles: ['--cr-bg', '--cr-accent'],
    intent: 'Land the one-liner',
    content: order === 0 ? 'Close the books in days.' : undefined,
    fragmentId: 'component-hero-split-01',
    composition: 'Feature trio — split — base',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0), websiteItem('features', 1)], warnings: [] };
}

describe('C1 — exportRenderingIR', () => {
  it('serializes an already-valid RenderingIR identically to serializeRenderingIR', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    expect(exportRenderingIR(rir)).toBe(serializeRenderingIR(rir));
  });

  it('throws — never writes — on an invalid/tampered RenderingIR (fail-loud, not silently trusted)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered: RenderingIR = { ...rir, digest: 'deadbeef' };
    expect(() => exportRenderingIR(tampered)).toThrow(/digest/i);
    // never trust validateRenderingIR's own verdict blindly — cross-check it agrees
    expect(validateRenderingIR(tampered).valid).toBe(false);
  });
});

describe('C1 — buildRenderingIRArtifact', () => {
  it('builds, validates, and serializes in one pass — reusing buildRenderingIR verbatim', () => {
    const plan = websitePlan();
    const b = brief();
    const artifact = buildRenderingIRArtifact(plan, b);
    expect(artifact.rir).toEqual(buildRenderingIR(plan, b));
    expect(artifact.serialized).toBe(serializeRenderingIR(artifact.rir));
  });

  it('passes siteMetadata through to buildRenderingIR unchanged (website SEO/social surface)', () => {
    const plan = websitePlan();
    const b = brief();
    const siteMetadata = { title: 'Helix — Close the books faster', canonicalUrl: 'https://helix.example' };
    const artifact = buildRenderingIRArtifact(plan, b, siteMetadata);
    expect(artifact.rir).toEqual(buildRenderingIR(plan, b, siteMetadata));
    expect(artifact.rir.document.metadata.canonicalUrl).toBe('https://helix.example');
  });

  it('round-trips through disk-shaped serialization: parse(serialize(x)) validates and replays identically', () => {
    const artifact = buildRenderingIRArtifact(websitePlan(), brief());
    const reloaded = JSON.parse(artifact.serialized) as RenderingIR;
    const check = validateRenderingIR(reloaded);
    expect(check.valid).toBe(true);
    expect(reloaded.digest).toBe(artifact.rir.digest);
    expect(reloaded.irVersion).toBe(artifact.rir.irVersion);
  });

  it('is deterministic — same (plan, brief) twice produces byte-identical serialized output', () => {
    const plan = websitePlan();
    const b = brief();
    expect(buildRenderingIRArtifact(plan, b).serialized).toBe(buildRenderingIRArtifact(plan, b).serialized);
  });
});
